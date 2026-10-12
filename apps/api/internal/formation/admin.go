package formation

import (
	"net/http"
	"strings"
)

func (s *Server) report(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v struct {
		Team   string `json:"team_id"`
		Reason string `json:"reason"`
	}
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(v.Reason)) < 10 || len(v.Reason) > 2000 {
		return nil, bad("Report reason needs 10–2000 chars")
	}
	var exists bool
	if err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM teams WHERE id=$1)`, v.Team).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, missing
	}
	_, err := s.db.Exec(r.Context(), `INSERT INTO reports(id,reporter_id,team_id,reason) VALUES($1,$2,$3,$4)`, id(), a.ID, v.Team, v.Reason)
	return nil, err
}
func (s *Server) reports(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	if !a.Admin {
		return nil, forbidden
	}
	return jsonRow(r.Context(), s.db, `SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('team_name',t.name,'moderated',t.moderated) ORDER BY r.created_at DESC),'[]') FROM reports r JOIN teams t ON t.id=r.team_id`)
}
func (s *Server) resolve(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	if !a.Admin {
		return nil, forbidden
	}
	var v struct {
		Hide bool `json:"hide_team"`
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
	var tid string
	if err = tx.QueryRow(ctx, `SELECT team_id FROM reports WHERE id=$1`, r.PathValue("id")).Scan(&tid); err != nil {
		return nil, err
	}
	if _, _, err = lockTeam(ctx, tx, tid); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE reports SET resolved=true WHERE id=$1`, r.PathValue("id")); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE teams SET moderated=$2 WHERE id=$1`, tid, v.Hide); err != nil {
		return nil, err
	}
	return nil, tx.Commit(ctx)
}
func (s *Server) metrics(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	if !a.Admin {
		return nil, forbidden
	}
	return jsonRow(r.Context(), s.db, `SELECT jsonb_build_object(
 'signups',(SELECT count(*) FROM users),
 'teams',(SELECT count(*) FROM teams),
 'applications',(SELECT count(*) FROM applications),
 'accepted',(SELECT count(*) FROM applications WHERE status='accepted'),
 'acceptance_rate',(SELECT round(count(*) FILTER(WHERE status='accepted')::numeric/nullif(count(*),0),3) FROM applications),
 'median_response_hours',(SELECT percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM(decided_at-created_at))/3600) FROM applications WHERE status IN ('accepted','declined')),
 'connected_teams',(SELECT count(*) FROM teams t WHERE (SELECT count(*) FROM memberships WHERE team_id=t.id AND connected_at IS NOT NULL)>=2),
 'applications_per_recruiting_team',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'applications',(SELECT count(*) FROM applications WHERE team_id=t.id))),'[]') FROM teams t JOIN competitions c ON c.id=t.competition_id WHERE t.recruiting AND NOT t.moderated AND c.published AND c.deadline>now() AND (SELECT count(*) FROM memberships WHERE team_id=t.id)<t.capacity),
 'funnel',(SELECT coalesce(jsonb_object_agg(kind,n),'{}') FROM (SELECT kind,count(*) n FROM events GROUP BY kind) e))`)
}
func (s *Server) export(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	w.Header().Set("Content-Disposition", `attachment; filename="compmate-account.json"`)
	return jsonRow(r.Context(), s.db, `SELECT jsonb_build_object(
 'account',(SELECT jsonb_build_object('id',id,'email',email,'created_at',created_at) FROM users WHERE id=$1),
 'profile',(SELECT to_jsonb(p) FROM profiles p WHERE user_id=$1),
 'applications',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM applications a WHERE user_id=$1),
 'memberships',(SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') FROM memberships m WHERE user_id=$1),
 'teams',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM teams t WHERE leader_id=$1),
 'reports',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM reports x WHERE reporter_id=$1),
 'saved',(SELECT coalesce(jsonb_agg(competition_id),'[]') FROM saved_competitions WHERE user_id=$1),
 'connections',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM connections x WHERE sender_id=$1 OR recipient_id=$1),
 'invitations',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM team_invitations x WHERE user_id=$1 OR team_id IN(SELECT id FROM teams WHERE leader_id=$1)),
 'notifications',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM notifications x WHERE user_id=$1))`, a.ID)
}
func (s *Server) deleteAccount(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v struct {
		Password string `json:"password"`
	}
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	// Password confirmation protects permanent data removal; FK prevents deleting a team leader accidentally.
	if err := s.verifyPassword(r.Context(), a.ID, v.Password); err != nil {
		return nil, err
	}
	var owns bool
	if err := s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM teams WHERE leader_id=$1)`, a.ID).Scan(&owns); err != nil {
		return nil, err
	}
	if owns {
		return nil, conflict("Delete teams you lead before deleting account")
	}
	_, err := s.db.Exec(r.Context(), `DELETE FROM users WHERE id=$1`, a.ID)
	if err != nil {
		return nil, err
	}
	return s.logout(w, r, a)
}
