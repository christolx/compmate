package formation

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type competitionInput struct {
	Title       string    `json:"title"`
	Organizer   string    `json:"organizer"`
	Description string    `json:"description"`
	URL         string    `json:"official_url"`
	Deadline    time.Time `json:"deadline"`
	Min         int       `json:"min_members"`
	Max         int       `json:"max_members"`
	Campus      string    `json:"campus"`
	Published   bool      `json:"published"`
	// Display details (category, format, fee, dates, poster, skills); see competitionPresentation.
	Presentation json.RawMessage `json:"presentation,omitempty"`
}

// validate returns the first problem with a curated listing, naming the field.
func (v competitionInput) validate(creating bool, now time.Time) error {
	u, err := url.Parse(v.URL)
	switch {
	case len(strings.TrimSpace(v.Title)) < 3 || len(v.Title) > 160:
		return bad("Title needs 3–160 characters")
	case len(strings.TrimSpace(v.Organizer)) < 2 || len(v.Organizer) > 160:
		return bad("Organizer needs 2–160 characters")
	case len(v.Description) > 4000:
		return bad("Description is limited to 4,000 characters")
	case err != nil || u.Scheme != "https" || u.Hostname() == "" || !strings.Contains(u.Hostname(), ".") || u.User != nil || len(v.URL) > 1000:
		return bad("Official link must be a full https:// address")
	case v.Deadline.IsZero():
		return bad("Deadline required")
	case creating && !v.Deadline.After(now):
		return bad("Deadline must be in the future")
	case v.Deadline.After(now.AddDate(2, 0, 0)):
		return bad("Deadline must be within two years")
	case v.Min < 2 || v.Max > 20:
		return bad("Team size must be between 2 and 20")
	case v.Max < v.Min:
		return bad("Maximum members must be at least the minimum")
	case len(v.Campus) > 120:
		return bad("Campus is limited to 120 characters")
	}
	return nil
}

// competitionPresentation keeps the display fields admins curate.
func competitionPresentation(raw json.RawMessage) (json.RawMessage, error) {
	if raw == nil {
		return nil, nil
	}
	var in struct {
		Cat    *string   `json:"cat"`
		Group  *string   `json:"group"`
		Loc    *string   `json:"loc"`
		Place  *string   `json:"place"`
		Fee    *int      `json:"fee"`
		Open   *string   `json:"open"`
		Event  *string   `json:"event"`
		Poster *string   `json:"poster"`
		Skills *[]string `json:"skills"`
	}
	d := json.NewDecoder(strings.NewReader(string(raw)))
	d.DisallowUnknownFields()
	if d.Decode(&in) != nil {
		return nil, bad("Invalid competition details")
	}
	out := map[string]any{}
	text := func(k string, p *string, max int) error {
		if p == nil {
			return nil
		}
		if len(*p) > max {
			return bad(k + " is too long")
		}
		out[strings.ToLower(k)] = strings.TrimSpace(*p)
		return nil
	}
	if err := text("Cat", in.Cat, 60); err != nil {
		return nil, err
	}
	if err := text("Group", in.Group, 40); err != nil {
		return nil, err
	}
	if err := text("Place", in.Place, 120); err != nil {
		return nil, err
	}
	if in.Loc != nil {
		if *in.Loc != "Online" && *in.Loc != "Offline" && *in.Loc != "Hybrid" {
			return nil, bad("Format must be Online, Offline or Hybrid")
		}
		out["loc"] = *in.Loc
	}
	if in.Fee != nil {
		if *in.Fee < 0 || *in.Fee > 100_000_000 {
			return nil, bad("Fee must be between 0 and 100,000,000")
		}
		out["fee"] = *in.Fee
	}
	for k, p := range map[string]*string{"open": in.Open, "event": in.Event} {
		if p == nil || *p == "" {
			continue
		}
		if _, err := time.Parse("2006-01-02", *p); err != nil {
			return nil, bad("Dates must be YYYY-MM-DD")
		}
		out[k] = *p
	}
	if in.Poster != nil && *in.Poster != "" {
		u, err := url.Parse(*in.Poster)
		if err != nil || u.Scheme != "https" || u.Hostname() == "" || len(*in.Poster) > 1000 {
			return nil, bad("Poster must be an https:// image address")
		}
		out["poster"] = *in.Poster
	}
	if in.Skills != nil {
		skills := []string{}
		for _, x := range *in.Skills {
			if x = strings.TrimSpace(x); x != "" && len(x) <= 60 && len(skills) < 12 {
				skills = append(skills, x)
			}
		}
		out["skills"] = skills
	}
	return json.Marshal(out)
}

func (s *Server) competitions(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, `SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY deadline),'[]') FROM competitions c WHERE published OR $1`, a.Admin)
}
func (s *Server) curate(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	if !a.Admin {
		return nil, forbidden
	}
	var v competitionInput
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	cid := r.PathValue("id")
	if err := v.validate(cid == "", time.Now()); err != nil {
		return nil, err
	}
	presentation, err := competitionPresentation(v.Presentation)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if cid == "" {
		cid = id()
		_, err = tx.Exec(ctx, `INSERT INTO competitions(id,title,organizer,description,official_url,deadline,min_members,max_members,campus,published,presentation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,coalesce($11::jsonb,'{}'))`, cid, v.Title, v.Organizer, v.Description, v.URL, v.Deadline, v.Min, v.Max, v.Campus, v.Published, presentation)
	} else {
		// Lock parent before team operations; same lock order throughout keeps eligibility edits atomic.
		var exists string
		if err = tx.QueryRow(ctx, `SELECT id FROM competitions WHERE id=$1 FOR UPDATE`, cid).Scan(&exists); err != nil {
			return nil, err
		}
		var incompatible bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM teams WHERE competition_id=$1 AND (capacity<$2 OR capacity>$3))`, cid, v.Min, v.Max).Scan(&incompatible); err != nil {
			return nil, err
		}
		if incompatible {
			return nil, conflict("Existing teams incompatible with new size limits")
		}
		_, err = tx.Exec(ctx, `UPDATE competitions SET title=$2,organizer=$3,description=$4,official_url=$5,deadline=$6,min_members=$7,max_members=$8,campus=$9,published=$10,presentation=presentation||coalesce($11::jsonb,'{}') WHERE id=$1`, cid, v.Title, v.Organizer, v.Description, v.URL, v.Deadline, v.Min, v.Max, v.Campus, v.Published, presentation)
	}
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]string{"id": cid}, nil
}

// Public projections never contain email, private contacts, messages or consent.
const teamProjection = `SELECT to_jsonb(t)||jsonb_build_object(
 'leader_name',(SELECT name FROM profiles WHERE user_id=t.leader_id),
 'competition_title',c.title,'deadline',c.deadline,'campus',c.campus,
 'member_count',(SELECT count(*) FROM memberships WHERE team_id=t.id),
 'eligible',recruitment_eligible(t.id,$1) AND NOT EXISTS(SELECT 1 FROM applications WHERE team_id=t.id AND user_id=$1),
 'roles',(SELECT coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('filled',(SELECT count(*) FROM memberships WHERE role_id=x.id)) ORDER BY x.name),'[]') FROM roles x WHERE team_id=t.id),
 'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.name,'role',coalesce(x.name,'Leader')) ORDER BY (m.user_id=t.leader_id) DESC, coalesce(array_position(ARRAY(SELECT jsonb_array_elements_text(coalesce(t.presentation->'members','[]'))),m.user_id),9999),m.joined_at),'[]') FROM memberships m JOIN profiles p ON p.user_id=m.user_id LEFT JOIN roles x ON x.id=m.role_id WHERE m.team_id=t.id)
 ) AS item FROM teams t JOIN competitions c ON c.id=t.competition_id `

func (s *Server) teams(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, `SELECT coalesce(jsonb_agg(item ORDER BY item->>'created_at'),'[]') FROM (`+teamProjection+` WHERE c.published AND NOT t.moderated AND ($2='' OR c.id=$2)) q`, a.ID, r.URL.Query().Get("competition"))
}
func (s *Server) team(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, teamProjection+` WHERE t.id=$2 AND (c.published AND NOT t.moderated OR $3 OR EXISTS(SELECT 1 FROM memberships WHERE team_id=t.id AND user_id=$1))`, a.ID, r.PathValue("id"), a.Admin)
}

type roleInput struct {
	Name     string `json:"name"`
	Skills   string `json:"skills"`
	Capacity int    `json:"capacity"`
}
type teamInput struct {
	Presentation json.RawMessage `json:"presentation,omitempty"`
	Competition  string          `json:"competition_id"`
	Name         string          `json:"name"`
	About        string          `json:"about"`
	Capacity     int             `json:"capacity"`
	Share        bool            `json:"share_contact"`
	Roles        []roleInput     `json:"roles"`
}

func (s *Server) createTeam(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v teamInput
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(v.Name)) < 2 || len(v.Name) > 100 || len(v.About) > 2000 || len(v.Roles) == 0 || len(v.Roles) > 19 {
		return nil, bad("Team name and 1–19 roles required")
	}
	total := 0
	for _, x := range v.Roles {
		if len(strings.TrimSpace(x.Name)) < 2 || len(x.Name) > 80 || len(x.Skills) > 500 || x.Capacity < 1 || x.Capacity > 19 {
			return nil, bad("Role needs name, skills and capacity 1–19")
		}
		total += x.Capacity
	}
	if total != v.Capacity-1 {
		return nil, bad("Role seats must equal team capacity minus leader")
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	// User lock first (same order as accept) serializes joins and creations per student.
	if err = tx.QueryRow(ctx, `SELECT id FROM users WHERE id=$1 FOR UPDATE`, a.ID).Scan(new(string)); err != nil {
		return nil, err
	}
	var min, max int
	var deadline time.Time
	var campus string
	var published bool
	if err = tx.QueryRow(ctx, `SELECT min_members,max_members,deadline,campus,published FROM competitions WHERE id=$1 FOR SHARE`, v.Competition).Scan(&min, &max, &deadline, &campus, &published); err != nil {
		return nil, err
	}
	if !published || !deadline.After(time.Now()) {
		return nil, conflict("Competition closed or deadline passed")
	}
	var myCampus string
	if err = tx.QueryRow(ctx, `SELECT campus FROM profiles WHERE user_id=$1`, a.ID).Scan(&myCampus); err != nil {
		return nil, err
	}
	if !sameCampus(campus, myCampus) {
		return nil, failure{403, "Only " + strings.TrimSpace(campus) + " students can join this competition. Update your campus in Edit profile if that's you."}
	}
	var member bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships m JOIN teams t ON t.id=m.team_id WHERE t.competition_id=$1 AND m.user_id=$2)`, v.Competition, a.ID).Scan(&member); err != nil {
		return nil, err
	}
	if member {
		return nil, conflict("You already belong to a team in this competition")
	}
	if v.Capacity < min || v.Capacity > max {
		return nil, bad("Capacity outside competition limits")
	}
	if v.Presentation != nil {
		var obj map[string]any
		if json.Unmarshal(v.Presentation, &obj) != nil || obj == nil {
			return nil, bad("Invalid team presentation")
		}
	}
	tid := id()
	if _, err = tx.Exec(ctx, `INSERT INTO teams(id,competition_id,leader_id,name,about,capacity,presentation) VALUES($1,$2,$3,$4,$5,$6,coalesce($7::jsonb,'{}'))`, tid, v.Competition, a.ID, v.Name, v.About, v.Capacity, v.Presentation); err != nil {
		return nil, err
	}
	for order, x := range v.Roles {
		if _, err = tx.Exec(ctx, `INSERT INTO roles(id,team_id,name,skills,capacity,presentation) VALUES($1,$2,$3,$4,$5,jsonb_build_object('order',$6::int))`, id(), tid, x.Name, x.Skills, x.Capacity, order); err != nil {
			return nil, err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO memberships(team_id,user_id,share_contact) VALUES($1,$2,$3)`, tid, a.ID, v.Share); err != nil {
		return nil, err
	}
	// Leading a team counts as joining: pending requests elsewhere in this competition lapse.
	if _, err = tx.Exec(ctx, `UPDATE applications SET status='withdrawn',decided_at=now() WHERE user_id=$1 AND status='pending' AND team_id IN (SELECT id FROM teams WHERE competition_id=$2 AND id<>$3)`, a.ID, v.Competition, tid); err != nil {
		return nil, err
	}
	if err = event(ctx, tx, a.ID, "create_team"); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]string{"id": tid}, nil
}

// Every team mutation locks competition first, team second. Acceptance serializes seats and role occupancy.
func lockTeam(ctx context.Context, tx pgx.Tx, tid string) (leader string, capacity int, err error) {
	var cid string
	if err = tx.QueryRow(ctx, `SELECT competition_id FROM teams WHERE id=$1`, tid).Scan(&cid); err != nil {
		return
	}
	if err = tx.QueryRow(ctx, `SELECT id FROM competitions WHERE id=$1 FOR SHARE`, cid).Scan(&cid); err != nil {
		return
	}
	err = tx.QueryRow(ctx, `SELECT leader_id,capacity FROM teams WHERE id=$1 FOR UPDATE`, tid).Scan(&leader, &capacity)
	return
}
func sameCampus(required, actual string) bool {
	required = strings.TrimSpace(required)
	return required == "" || strings.EqualFold(required, strings.TrimSpace(actual))
}

// eligible enforces recruitment_eligible and, when it fails, names the first
// broken rule so students and leaders see why instead of a generic refusal.
func eligible(ctx context.Context, tx pgx.Tx, tid, user, role string) error {
	var open bool
	err := tx.QueryRow(ctx, `SELECT recruitment_eligible($1,$2,$3)`, tid, user, role).Scan(&open)
	if err != nil || open {
		return err
	}
	var reason string
	err = tx.QueryRow(ctx, `SELECT CASE
 WHEN t.moderated OR NOT c.published THEN 'This team is not available'
 WHEN c.deadline <= statement_timestamp() THEN 'Registration for this competition has closed'
 WHEN NOT t.recruiting THEN 'This team has closed recruitment'
 WHEN (SELECT count(*) FROM memberships WHERE team_id=t.id)>=t.capacity THEN 'This team is full'
 WHEN NOT same_campus(c.campus,(SELECT campus FROM profiles WHERE user_id=$2)) THEN 'Only '||btrim(c.campus)||' students can join this competition'
 WHEN EXISTS(SELECT 1 FROM memberships m JOIN teams j ON j.id=m.team_id WHERE j.competition_id=t.competition_id AND m.user_id=$2) THEN 'Already in a team for this competition'
 ELSE 'That role is no longer open' END
 FROM teams t JOIN competitions c ON c.id=t.competition_id WHERE t.id=$1`, tid, user).Scan(&reason)
	if err != nil {
		return err
	}
	return conflict(reason)
}
func (s *Server) recruit(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v struct {
		Recruiting bool `json:"recruiting"`
	}
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	leader, _, err := lockTeam(ctx, tx, r.PathValue("id"))
	if err != nil {
		return nil, err
	}
	if leader != a.ID {
		return nil, forbidden
	}
	if _, err = tx.Exec(ctx, `UPDATE teams SET recruiting=$2 WHERE id=$1`, r.PathValue("id"), v.Recruiting); err != nil {
		return nil, err
	}
	return nil, tx.Commit(ctx)
}
func (s *Server) deleteTeam(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	leader, _, err := lockTeam(ctx, tx, r.PathValue("id"))
	if err != nil {
		return nil, err
	}
	if leader != a.ID {
		return nil, forbidden
	}
	// Tell members before the cascade removes the team; team-less notes survive deletion.
	if _, err = tx.Exec(ctx, `INSERT INTO notifications(id,user_id,actor_id,kind,text)
 SELECT replace(gen_random_uuid()::text,'-',''), m.user_id, $2, 'team', t.name||' was deleted by its leader'
 FROM memberships m JOIN teams t ON t.id=m.team_id WHERE m.team_id=$1 AND m.user_id<>$2`, r.PathValue("id"), a.ID); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM teams WHERE id=$1`, r.PathValue("id")); err != nil {
		return nil, err
	}
	return nil, tx.Commit(ctx)
}
