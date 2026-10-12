package formation

import (
	"encoding/json"
	"net/http"
	"strings"
)

func (s *Server) catalog(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, `SELECT jsonb_build_object('people',(SELECT coalesce(jsonb_agg(p.presentation||jsonb_build_object('id',p.user_id,'name',p.name,'skills',p.skills,'availability',p.availability,'about',p.about,'campus',p.campus)),'[]') FROM profiles p))`)
}
func (s *Server) preferences(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, `SELECT jsonb_build_object(
 'saved',(SELECT coalesce(jsonb_agg(competition_id),'[]') FROM saved_competitions WHERE user_id=$1),
 'connections',(SELECT coalesce(jsonb_object_agg(CASE WHEN sender_id=$1 THEN recipient_id ELSE sender_id END,CASE WHEN status='connected' THEN 'connected' WHEN sender_id=$1 THEN 'sent' ELSE 'incoming' END),'{}') FROM connections WHERE sender_id=$1 OR recipient_id=$1))`, a.ID)
}
func (s *Server) saveCompetition(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var err error
	if r.Method == "PUT" {
		_, err = s.db.Exec(r.Context(), `INSERT INTO saved_competitions VALUES($1,$2) ON CONFLICT DO NOTHING`, a.ID, r.PathValue("id"))
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
		tag, err := s.db.Exec(r.Context(), `UPDATE connections SET status='connected' WHERE sender_id=$1 AND recipient_id=$2`, other, a.ID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, forbidden
		}
		return nil, nil
	}
	if r.PathValue("action") != "" {
		return nil, missing
	}
	_, err := s.db.Exec(r.Context(), `INSERT INTO connections VALUES($1,$2,'pending',now())`, a.ID, other)
	return nil, err
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
