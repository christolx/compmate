package formation

import (
	"net/http"
)

func (s *Server) invites(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, `SELECT jsonb_build_object(
 'incoming',(SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]') FROM team_invitations i WHERE i.user_id=$1 AND i.status='pending'),
 'outgoing',(SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]') FROM team_invitations i JOIN teams t ON t.id=i.team_id WHERE t.leader_id=$1 AND i.status='pending'))`, a.ID)
}
func (s *Server) invite(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v struct {
		User string `json:"user_id"`
		Role string `json:"role_id"`
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
	leader, _, err := lockTeam(ctx, tx, tid)
	if err != nil {
		return nil, err
	}
	if leader != a.ID {
		return nil, forbidden
	}
	if err = eligible(ctx, tx, tid, v.User, v.Role); err != nil {
		return nil, err
	}
	iid := id()
	if _, err = tx.Exec(ctx, `INSERT INTO team_invitations(id,team_id,user_id,role_id) VALUES($1,$2,$3,$4)`, iid, tid, v.User, v.Role); err != nil {
		return nil, err
	}
	if err = notify(ctx, tx, v.User, tid, "You received a team invitation"); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]string{"id": iid}, nil
}
func (s *Server) answerInvite(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	action := r.PathValue("action")
	if action != "accept" && action != "decline" {
		return nil, missing
	}
	var v struct {
		Share bool `json:"share_contact"`
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
	iid := r.PathValue("id")
	var tid, user, role, status string
	if err = tx.QueryRow(ctx, `SELECT team_id,user_id FROM team_invitations WHERE id=$1`, iid).Scan(&tid, &user); err != nil {
		return nil, err
	}
	if user != a.ID {
		return nil, forbidden
	}
	if err = tx.QueryRow(ctx, `SELECT id FROM users WHERE id=$1 FOR UPDATE`, user).Scan(&user); err != nil {
		return nil, err
	}
	leader, _, err := lockTeam(ctx, tx, tid)
	if err != nil {
		return nil, err
	}
	if err = tx.QueryRow(ctx, `SELECT role_id,status FROM team_invitations WHERE id=$1 FOR UPDATE`, iid).Scan(&role, &status); err != nil {
		return nil, err
	}
	target := "declined"
	if action == "accept" {
		target = "accepted"
	}
	if status == target {
		return nil, nil
	}
	if status != "pending" {
		return nil, conflict("Invitation already answered")
	}
	if action == "accept" {
		if err = eligible(ctx, tx, tid, user, role); err != nil {
			return nil, err
		}
		tag, err := tx.Exec(ctx, `INSERT INTO applications(id,team_id,user_id,role_id,message,share_contact,status,decided_at) VALUES($1,$2,$3,$4,'Accepted team invitation',$5,'accepted',now()) ON CONFLICT(team_id,user_id) DO UPDATE SET role_id=$4,share_contact=$5,status='accepted',decided_at=now() WHERE applications.status='pending'`, id(), tid, user, role, v.Share)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, conflict("Previous application is final")
		}
		if _, err = tx.Exec(ctx, `INSERT INTO memberships(team_id,user_id,role_id,share_contact) VALUES($1,$2,$3,$4)`, tid, user, role, v.Share); err != nil {
			return nil, err
		}
		if _, err = tx.Exec(ctx, `UPDATE applications SET status='withdrawn',decided_at=now() WHERE user_id=$1 AND team_id<>$2 AND status='pending' AND team_id IN (SELECT other.id FROM teams other JOIN teams joined ON joined.competition_id=other.competition_id WHERE joined.id=$2)`, user, tid); err != nil {
			return nil, err
		}
		if err = event(ctx, tx, user, "accepted"); err != nil {
			return nil, err
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE team_invitations SET status=$2 WHERE id=$1`, iid, target); err != nil {
		return nil, err
	}
	if err = notify(ctx, tx, leader, tid, "Team invitation "+target); err != nil {
		return nil, err
	}
	return nil, tx.Commit(ctx)
}
