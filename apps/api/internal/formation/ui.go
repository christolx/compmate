package formation

import (
	"encoding/json"
	"github.com/jackc/pgx/v5/pgconn"
	"net/http"
	"strings"
)

// catalog lists student profiles. Social signals are derived from real
// connections; anonymous visitors get roster-level fields only.
func (s *Server) catalog(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, `WITH peers AS (
 SELECT sender_id AS a, recipient_id AS b FROM connections WHERE status='connected'
 UNION ALL SELECT recipient_id, sender_id FROM connections WHERE status='connected'),
mine AS (SELECT b FROM peers WHERE a=$1)
SELECT jsonb_build_object('people',(SELECT coalesce(jsonb_agg(
 (p.presentation - ARRAY['mutual','connections','complete','mutual_ids'] - CASE WHEN $1='' THEN ARRAY['links','exp','pastTeams'] ELSE ARRAY[]::text[] END)
 ||jsonb_build_object('id',p.user_id,'name',p.name,'skills',p.skills,'availability',p.availability,
  'about',CASE WHEN $1='' THEN '' ELSE p.about END,'campus',CASE WHEN $1='' THEN '' ELSE p.campus END,
  'connections',(SELECT count(*) FROM peers WHERE a=p.user_id),
  'mutual_ids',(SELECT coalesce(jsonb_agg(x.b ORDER BY x.b),'[]') FROM (SELECT b FROM peers WHERE a=p.user_id AND p.user_id<>$1 AND b IN (SELECT b FROM mine)) x))),'[]') FROM profiles p))`, a.ID)
}
func (s *Server) preferences(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, `SELECT jsonb_build_object(
 'saved',(SELECT coalesce(jsonb_agg(competition_id),'[]') FROM saved_competitions WHERE user_id=$1),
 'connections',(SELECT coalesce(jsonb_object_agg(CASE WHEN sender_id=$1 THEN recipient_id ELSE sender_id END,CASE WHEN status='connected' THEN 'connected' WHEN sender_id=$1 THEN 'sent' ELSE 'incoming' END),'{}') FROM connections WHERE sender_id=$1 OR recipient_id=$1))`, a.ID)
}
func (s *Server) saveCompetition(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var err error
	if r.Method == "PUT" {
		var tag pgconn.CommandTag
		tag, err = s.db.Exec(r.Context(), `INSERT INTO saved_competitions SELECT $1,id FROM competitions WHERE id=$2 AND published ON CONFLICT DO NOTHING`, a.ID, r.PathValue("id"))
		if err == nil && tag.RowsAffected() == 0 {
			var saved bool
			if err = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM saved_competitions WHERE user_id=$1 AND competition_id=$2)`, a.ID, r.PathValue("id")).Scan(&saved); err == nil && !saved {
				return nil, missing
			}
		}
	} else {
		_, err = s.db.Exec(r.Context(), `DELETE FROM saved_competitions WHERE user_id=$1 AND competition_id=$2`, a.ID, r.PathValue("id"))
	}
	return nil, err
}
func (s *Server) connection(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	other := r.PathValue("id")
	if other == a.ID {
		return nil, bad("Cannot connect to yourself")
	}
	if r.Method == "DELETE" {
		_, err := s.db.Exec(r.Context(), `DELETE FROM connections WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)`, a.ID, other)
		return nil, err
	}
	if r.PathValue("action") == "accept" {
		tag, err := s.db.Exec(r.Context(), `UPDATE connections SET status='connected' WHERE sender_id=$1 AND recipient_id=$2 AND status='pending'`, other, a.ID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			var connected bool
			if err = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM connections WHERE sender_id=$1 AND recipient_id=$2 AND status='connected')`, other, a.ID).Scan(&connected); err != nil || connected {
				return nil, err
			}
			return nil, forbidden
		}
		return nil, notify(r.Context(), s.db, note{User: other, Actor: a.ID, Kind: "connection", Text: "{actor} accepted your connection request"})
	}
	if r.PathValue("action") != "" {
		return nil, missing
	}
	if _, err := s.db.Exec(r.Context(), `INSERT INTO connections VALUES($1,$2,'pending',now())`, a.ID, other); err != nil {
		return nil, err
	}
	return nil, notify(r.Context(), s.db, note{User: other, Actor: a.ID, Kind: "connection", Text: "{actor} wants to connect with you"})
}
func (s *Server) readNotification(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	tag, err := s.db.Exec(r.Context(), `UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2`, r.PathValue("id"), a.ID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, missing
	}
	return nil, nil
}
func (s *Server) editTeam(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v struct {
		Capacity     *int            `json:"capacity"`
		Name         *string         `json:"name"`
		About        *string         `json:"about"`
		Recruiting   *bool           `json:"recruiting"`
		Presentation json.RawMessage `json:"presentation"`
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
	tid := r.PathValue("id")
	leader, old, err := lockTeam(ctx, tx, tid)
	if err != nil {
		return nil, err
	}
	if leader != a.ID {
		return nil, forbidden
	}
	if v.Name != nil && (len(strings.TrimSpace(*v.Name)) < 2 || len(*v.Name) > 100) {
		return nil, bad("Team name needs 2–100 chars")
	}
	if v.About != nil && len(*v.About) > 2000 {
		return nil, bad("About exceeds limit")
	}
	if v.Capacity != nil {
		var min, max, members int
		err = tx.QueryRow(ctx, `SELECT c.min_members,c.max_members,(SELECT count(*) FROM memberships WHERE team_id=t.id) FROM teams t JOIN competitions c ON c.id=t.competition_id WHERE t.id=$1`, tid).Scan(&min, &max, &members)
		if err != nil {
			return nil, err
		}
		if *v.Capacity < min || *v.Capacity > max || *v.Capacity < members {
			return nil, conflict("Capacity must fit competition limits and current roster")
		}
		if *v.Capacity > old {
			var rid string
			err = tx.QueryRow(ctx, `SELECT id FROM roles WHERE team_id=$1 ORDER BY id LIMIT 1`, tid).Scan(&rid)
			if err != nil {
				return nil, err
			}
			if _, err = tx.Exec(ctx, `UPDATE roles SET capacity=capacity+$2 WHERE id=$1`, rid, *v.Capacity-old); err != nil {
				return nil, err
			}
		}
		if _, err = tx.Exec(ctx, `UPDATE teams SET capacity=$2 WHERE id=$1`, tid, *v.Capacity); err != nil {
			return nil, err
		}
	}
	if v.Presentation != nil {
		var object map[string]any
		if json.Unmarshal(v.Presentation, &object) != nil || object == nil {
			return nil, bad("Invalid team presentation")
		}
	}
	_, err = tx.Exec(ctx, `UPDATE teams SET name=coalesce($2,name),about=coalesce($3,about),recruiting=coalesce($4,recruiting),presentation=presentation||coalesce($5::jsonb,'{}') WHERE id=$1`, tid, v.Name, v.About, v.Recruiting, v.Presentation)
	if err != nil {
		return nil, err
	}
	return nil, tx.Commit(ctx)
}
