package formation

import (
	"context"
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
	u, err := url.Parse(v.URL)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || len(v.URL) > 1000 || len(v.Title) < 3 || len(v.Title) > 160 || len(v.Organizer) < 2 || len(v.Organizer) > 160 || len(v.Description) > 4000 || len(v.Campus) > 120 || v.Deadline.IsZero() || v.Min < 2 || v.Max < v.Min || v.Max > 20 {
		return nil, bad("Valid title, organizer, HTTPS official link, deadline and team size 2–20 required")
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	cid := r.PathValue("id")
	if cid == "" {
		cid = id()
		_, err = tx.Exec(ctx, `INSERT INTO competitions(id,title,organizer,description,official_url,deadline,min_members,max_members,campus,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, cid, v.Title, v.Organizer, v.Description, v.URL, v.Deadline, v.Min, v.Max, v.Campus, v.Published)
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
		_, err = tx.Exec(ctx, `UPDATE competitions SET title=$2,organizer=$3,description=$4,official_url=$5,deadline=$6,min_members=$7,max_members=$8,campus=$9,published=$10 WHERE id=$1`, cid, v.Title, v.Organizer, v.Description, v.URL, v.Deadline, v.Min, v.Max, v.Campus, v.Published)
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
 'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.name,'role',coalesce(x.name,'Leader')) ORDER BY m.joined_at),'[]') FROM memberships m JOIN profiles p ON p.user_id=m.user_id LEFT JOIN roles x ON x.id=m.role_id WHERE m.team_id=t.id)
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
	Competition string      `json:"competition_id"`
	Name        string      `json:"name"`
	About       string      `json:"about"`
	Capacity    int         `json:"capacity"`
	Share       bool        `json:"share_contact"`
	Roles       []roleInput `json:"roles"`
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
	if campus != "" && campus != myCampus {
		return nil, forbidden
	}
	if v.Capacity < min || v.Capacity > max {
		return nil, bad("Capacity outside competition limits")
	}
	tid := id()
	if _, err = tx.Exec(ctx, `INSERT INTO teams(id,competition_id,leader_id,name,about,capacity) VALUES($1,$2,$3,$4,$5,$6)`, tid, v.Competition, a.ID, v.Name, v.About, v.Capacity); err != nil {
		return nil, err
	}
	for _, x := range v.Roles {
		if _, err = tx.Exec(ctx, `INSERT INTO roles(id,team_id,name,skills,capacity) VALUES($1,$2,$3,$4,$5)`, id(), tid, x.Name, x.Skills, x.Capacity); err != nil {
			return nil, err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO memberships(team_id,user_id,share_contact) VALUES($1,$2,$3)`, tid, a.ID, v.Share); err != nil {
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
func eligible(ctx context.Context, tx pgx.Tx, tid, user, role string) error {
	var open bool
	err := tx.QueryRow(ctx, `SELECT recruitment_eligible($1,$2,$3)`, tid, user, role).Scan(&open)
	if err != nil {
		return err
	}
	if !open {
		return conflict("Team closed, full, expired, role filled or applicant ineligible")
	}
	return nil
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
	if _, err = tx.Exec(ctx, `DELETE FROM teams WHERE id=$1`, r.PathValue("id")); err != nil {
		return nil, err
	}
	return nil, tx.Commit(ctx)
}
