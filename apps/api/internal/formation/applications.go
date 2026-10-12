package formation

import (
	"net/http"
	"strings"
)

func (s *Server) apply(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v struct {
		Role    string `json:"role_id"`
		Message string `json:"message"`
		Share   bool   `json:"share_contact"`
	}
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(v.Message)) < 10 || len(v.Message) > 2000 {
		return nil, bad("Application message needs 10–2000 chars")
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	tid := r.PathValue("id")
	if _, _, err = lockTeam(ctx, tx, tid); err != nil {
		return nil, err
	}
	if err = eligible(ctx, tx, tid, a.ID, v.Role); err != nil {
		return nil, err
	}
	aid := id()
	if _, err = tx.Exec(ctx, `INSERT INTO applications(id,team_id,user_id,role_id,message,share_contact) VALUES($1,$2,$3,$4,$5,$6)`, aid, tid, a.ID, v.Role, v.Message, v.Share); err != nil {
		return nil, err
	}
	var leader string
	if err = tx.QueryRow(ctx, `SELECT leader_id FROM teams WHERE id=$1`, tid).Scan(&leader); err != nil {
		return nil, err
	}
	if err = notify(ctx, tx, leader, tid, "New application received"); err != nil {
		return nil, err
	}
	if err = event(ctx, tx, a.ID, "apply"); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]string{"id": aid}, nil
}
func (s *Server) decision(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	action := r.PathValue("action")
	if action != "accept" && action != "decline" && action != "withdraw" {
		return nil, missing
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	aid := r.PathValue("id")
	var tid string
	if err = tx.QueryRow(ctx, `SELECT team_id FROM applications WHERE id=$1`, aid).Scan(&tid); err != nil {
		return nil, err
	}
	if action == "accept" {
		var user string
		if err = tx.QueryRow(ctx, `SELECT user_id FROM applications WHERE id=$1`, aid).Scan(&user); err != nil {
			return nil, err
		}
		if err = tx.QueryRow(ctx, `SELECT id FROM users WHERE id=$1 FOR UPDATE`, user).Scan(&user); err != nil {
			return nil, err
		}
	}
	leader, _, err := lockTeam(ctx, tx, tid)
	if err != nil {
		return nil, err
	}
	var user, role, status string
	var share bool
	if err = tx.QueryRow(ctx, `SELECT user_id,role_id,status,share_contact FROM applications WHERE id=$1 FOR UPDATE`, aid).Scan(&user, &role, &status, &share); err != nil {
		return nil, err
	}
	if action == "withdraw" {
		if user != a.ID {
			return nil, forbidden
		}
	} else if leader != a.ID {
		return nil, forbidden
	}
	target := map[string]string{"accept": "accepted", "decline": "declined", "withdraw": "withdrawn"}[action]
	if status == target {
		return nil, nil
	}
	if status != "pending" {
		return nil, conflict("Only pending applications may change; accepted members cannot withdraw")
	}
	if action == "accept" {
		if err = eligible(ctx, tx, tid, user, role); err != nil {
			return nil, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO memberships(team_id,user_id,role_id,share_contact) VALUES($1,$2,$3,$4)`, tid, user, role, share); err != nil {
			return nil, err
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE applications SET status=$2,decided_at=now() WHERE id=$1`, aid, target); err != nil {
		return nil, err
	}
	recipient := user
	if action == "withdraw" {
		recipient = leader
	}
	if action == "accept" {
		if _, err = tx.Exec(ctx, `UPDATE applications SET status='withdrawn',decided_at=now() WHERE user_id=$1 AND team_id<>$2 AND status='pending' AND team_id IN (SELECT other.id FROM teams other JOIN teams accepted ON accepted.competition_id=other.competition_id WHERE accepted.id=$2)`, user, tid); err != nil {
			return nil, err
		}
	}
	if err = notify(ctx, tx, recipient, tid, "Application "+target); err != nil {
		return nil, err
	}
	if err = event(ctx, tx, a.ID, target); err != nil {
		return nil, err
	}
	return nil, tx.Commit(ctx)
}

const applicationProjection = `SELECT to_jsonb(a)||jsonb_build_object('team_name',t.name,'name',p.name,'skills',p.skills,'role_name',x.name) AS item
 FROM applications a JOIN teams t ON t.id=a.team_id JOIN profiles p ON p.user_id=a.user_id JOIN roles x ON x.id=a.role_id `

func (s *Server) dashboard(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, `SELECT jsonb_build_object(
 'applications',(SELECT coalesce(jsonb_agg(item ORDER BY item->>'created_at' DESC),'[]') FROM (`+applicationProjection+` WHERE a.user_id=$1) q),
 'inbox',(SELECT coalesce(jsonb_agg(item ORDER BY item->>'created_at' DESC),'[]') FROM (`+applicationProjection+` WHERE t.leader_id=$1) q),
 'teams',(SELECT coalesce(jsonb_agg(item),'[]') FROM (`+teamProjection+` WHERE EXISTS(SELECT 1 FROM memberships WHERE team_id=t.id AND user_id=$1)) q),
 'notifications',(SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC),'[]') FROM (SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50) n))`, a.ID)
}
func (s *Server) contacts(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	// Single statement keeps authorization and projection on same snapshot.
	result, err := jsonRow(r.Context(), s.db, `SELECT CASE WHEN EXISTS(SELECT 1 FROM memberships WHERE team_id=$1 AND user_id=$2) THEN
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.name,'contact',CASE WHEN m.share_contact AND p.share_contact THEN p.contact ELSE NULL END)),'[]') FROM memberships m JOIN profiles p ON p.user_id=m.user_id WHERE m.team_id=$1)
 ELSE NULL END`, r.PathValue("id"), a.ID)
	if err != nil {
		return nil, err
	}
	if string(result) == "null" || len(result) == 0 {
		return nil, forbidden
	}
	return result, nil
}
func (s *Server) connected(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	tag, err := s.db.Exec(r.Context(), `UPDATE memberships SET connected_at=coalesce(connected_at,now()) WHERE team_id=$1 AND user_id=$2 AND (SELECT count(*) FROM memberships WHERE team_id=$1)>1`, r.PathValue("id"), a.ID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, conflict("Join a team with another member first")
	}
	return nil, nil
}
func (s *Server) readNotifications(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	_, err := s.db.Exec(r.Context(), `UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`, a.ID)
	return nil, err
}
