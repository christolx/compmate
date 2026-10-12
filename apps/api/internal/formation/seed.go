package formation

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"strings"
	"time"
)

//go:embed seed/catalog.json
var seedFiles embed.FS

// Seed imports the previous UI fixtures once. Never overwrites account edits or decisions.
// Local-only accounts use <id>@compmate.local / compmate-demo-password. Production disables SEED_DATA.
func Seed(ctx context.Context, db *pgxpool.Pool) error {
	raw, err := seedFiles.ReadFile("seed/catalog.json")
	if err != nil {
		return err
	}
	var data struct {
		People       map[string]map[string]any `json:"people"`
		Competitions []map[string]any          `json:"competitions"`
		Teams        []map[string]any          `json:"teams"`
		State        struct {
			Saved []string          `json:"saved"`
			Conns map[string]string `json:"conns"`
		} `json:"state"`
	}
	if err = json.Unmarshal(raw, &data); err != nil {
		return err
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(741897)`); err != nil {
		return err
	}
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM seed_versions WHERE version='original-ui-v1')`).Scan(&exists); err != nil {
		return err
	}
	if exists {
		// Backfill display defaults only; right-hand merge preserves edits.
		for key, p := range data.People {
			user := key
			if user == "me" {
				user = "maya"
			}
			meta, _ := json.Marshal(p)
			if _, err = tx.Exec(ctx, `UPDATE profiles SET presentation=$2::jsonb||presentation WHERE user_id=$1 AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND seeded) AND presentation<>$2::jsonb||presentation`, user, meta); err != nil {
				return err
			}
		}
		return tx.Commit(ctx)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("compmate-demo-password"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	uid := func(s string) string {
		if s == "me" {
			return "maya"
		}
		return s
	}
	str := func(m map[string]any, k string) string { v, _ := m[k].(string); return v }
	num := func(m map[string]any, k string) int { v, _ := m[k].(float64); return int(v) }
	list := func(m map[string]any, k string) []string {
		out := []string{}
		if arr, ok := m[k].([]any); ok {
			for _, v := range arr {
				out = append(out, v.(string))
			}
		}
		return out
	}
	for key, p := range data.People {
		user := uid(key)
		meta, _ := json.Marshal(p)
		if _, err = tx.Exec(ctx, `INSERT INTO users(id,email,password_hash,seeded) VALUES($1,$2,$3,true) ON CONFLICT DO NOTHING`, user, user+"@compmate.local", string(hash)); err != nil {
			return err
		}
		contact := user + "@compmate.local"
		if _, err = tx.Exec(ctx, `INSERT INTO profiles(user_id,name,campus,skills,availability,about,contact,share_contact,presentation) VALUES($1,$2,'BINUS',$3,$4,$5,$6,true,$7) ON CONFLICT DO NOTHING`, user, str(p, "name"), strings.Join(list(p, "skills"), ", "), str(p, "avail"), str(p, "about"), contact, meta); err != nil {
			return err
		}
	}
	for _, c := range data.Competitions {
		meta, _ := json.Marshal(c)
		deadline, err := time.Parse("2006-01-02", str(c, "deadline"))
		if err != nil {
			return err
		}
		deadline = deadline.Add(17 * time.Hour)
		min := num(c, "min")
		if min < 2 {
			min = 2
		}
		url := str(c, "url")
		if url == "" {
			url = ""
		}
		if url != "" && !strings.HasPrefix(url, "https://") {
			url = "https://" + url
		}
		if _, err = tx.Exec(ctx, `INSERT INTO competitions(id,title,organizer,description,official_url,deadline,min_members,max_members,presentation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`, str(c, "id"), str(c, "title"), str(c, "org"), str(c, "overview"), url, deadline, min, num(c, "max"), meta); err != nil {
			return err
		}
	}
	for _, t := range data.Teams {
		tid := str(t, "id")
		meta, _ := json.Marshal(t)
		leader := uid(str(t, "leader"))
		members := list(t, "members")
		if _, err = tx.Exec(ctx, `INSERT INTO teams(id,competition_id,leader_id,name,about,capacity,presentation) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, tid, str(t, "comp"), leader, str(t, "name"), str(t, "about"), num(t, "target"), meta); err != nil {
			return err
		}
		for _, v := range t["roles"].([]any) {
			r := v.(map[string]any)
			rm, _ := json.Marshal(r)
			rid := tid + ":" + str(r, "id")
			if _, err = tx.Exec(ctx, `INSERT INTO roles(id,team_id,name,skills,capacity,presentation) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, rid, tid, str(r, "name"), strings.Join(list(r, "skills"), ", "), num(r, "qty"), rm); err != nil {
				return err
			}
		}
		filledRole := tid + ":seed-members"
		if len(members) > 1 {
			if _, err = tx.Exec(ctx, `INSERT INTO roles(id,team_id,name,capacity) VALUES($1,$2,'Member',$3) ON CONFLICT DO NOTHING`, filledRole, tid, len(members)-1); err != nil {
				return err
			}
		}
		for _, member := range members {
			var role any
			if uid(member) != leader {
				role = filledRole
			}
			if _, err = tx.Exec(ctx, `INSERT INTO memberships(team_id,user_id,role_id,share_contact) VALUES($1,$2,$3,true) ON CONFLICT DO NOTHING`, tid, uid(member), role); err != nil {
				return err
			}
		}
	}
	for _, v := range []struct{ ID, Team, User, Role, Message string }{{"seed-orion", "orion", "maya", "researcher", "Interested in researching the case with Orion."}, {"v1", "vertex", "livia", "designer", "I designed a mobile banking flow for my HCI course and ran six usability tests on it. Happy to own the demo screens and keep them consistent."}, {"v2", "vertex", "fikri", "presenter", "I MC campus events and pitched at our faculty startup day. Free every weekend and happy to rehearse a lot."}} {
		if _, err = tx.Exec(ctx, `INSERT INTO applications(id,team_id,user_id,role_id,message,share_contact) VALUES($1,$2,$3,$4,$5,true) ON CONFLICT DO NOTHING`, v.ID, v.Team, v.User, v.Team+":"+v.Role, v.Message); err != nil {
			return err
		}
		var leader string
		if err = tx.QueryRow(ctx, `SELECT leader_id FROM teams WHERE id=$1`, v.Team).Scan(&leader); err != nil {
			return err
		}
		if err = notify(ctx, tx, leader, v.Team, fmt.Sprintf("New application from %s", v.User)); err != nil {
			return err
		}
	}
	for _, cid := range data.State.Saved {
		if _, err = tx.Exec(ctx, `INSERT INTO saved_competitions VALUES('maya',$1) ON CONFLICT DO NOTHING`, cid); err != nil {
			return err
		}
	}
	for other, status := range data.State.Conns {
		sender, recipient := "maya", other
		if status == "incoming" {
			sender, recipient = other, "maya"
		}
		state := "pending"
		if status == "connected" {
			state = "connected"
		}
		if _, err = tx.Exec(ctx, `INSERT INTO connections(sender_id,recipient_id,status) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, sender, recipient, state); err != nil {
			return err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO seed_versions VALUES('original-ui-v1',now())`); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
