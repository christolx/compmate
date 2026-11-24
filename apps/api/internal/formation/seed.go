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
	now := time.Now() // one clock so every listing shifts by the same days
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
			// Replace only known fictional URLs from the original fixtures.
			// Custom profile links remain untouched.
			name, _ := p["name"].(string)
			generatedLinks, _ := json.Marshal([]map[string]string{{"label": "LinkedIn", "value": "linkedin.com/in/" + strings.ToLower(strings.ReplaceAll(name, " ", ""))}})
			legacyLinks := string(generatedLinks)
			if user == "maya" {
				legacyLinks = `[{"label":"LinkedIn","value":"linkedin.com/in/mayaputri"},{"label":"Portfolio","value":"mayaputri.notion.site"}]`
			} else if user == "raka" {
				legacyLinks = `[{"label":"LinkedIn","value":"linkedin.com/in/rakapratama"},{"label":"Portfolio","value":"rakapratama.com"},{"label":"Instagram","value":"@rakapratama"}]`
			}
			links, _ := json.Marshal(p["links"])
			if _, err = tx.Exec(ctx, `UPDATE profiles SET presentation=jsonb_set(presentation,'{links}',$2::jsonb) WHERE user_id=$1 AND presentation->'links'=$3::jsonb AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND seeded)`, user, links, legacyLinks); err != nil {
				return err
			}
			if _, err = tx.Exec(ctx, `UPDATE profiles SET presentation=$2::jsonb||presentation WHERE user_id=$1 AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND seeded) AND presentation<>$2::jsonb||presentation`, user, meta); err != nil {
				return err
			}
		}
		for _, c := range data.Competitions {
			// Roll expired sample events forward so local demos stay usable.
			// Only untouched seed listings (same title/organizer) move.
			shifted, deadline, err := seedSchedule(c, now)
			if err != nil {
				return err
			}
			if _, err = tx.Exec(ctx, `UPDATE competitions SET deadline=$2, presentation=presentation||$5::jsonb WHERE id=$1 AND title=$3 AND organizer=$4 AND deadline<now()`, c["id"], deadline, c["title"], c["org"], shifted); err != nil {
				return err
			}
			// Older seeds closed at 17:00 UTC, i.e. midnight WIB, which showed as the next day.
			if _, err = tx.Exec(ctx, `UPDATE competitions SET deadline=deadline-interval '1 second' WHERE id=$1 AND title=$2 AND organizer=$3 AND (deadline AT TIME ZONE 'UTC')::time='17:00'`, c["id"], c["title"], c["org"]); err != nil {
				return err
			}
			if poster, ok := c["poster"].(string); ok && poster != "" {
				if _, err = tx.Exec(ctx, `UPDATE competitions SET presentation=jsonb_set(presentation,'{poster}',to_jsonb($2::text)) WHERE id=$1 AND title=$3 AND organizer=$4 AND COALESCE(presentation->>'poster','')=''`, c["id"], poster, c["title"], c["org"]); err != nil {
					return err
				}
			}
			if _, err = tx.Exec(ctx, `UPDATE competitions SET official_url=$2 WHERE id=$1 AND official_url='' AND title=$3 AND organizer=$4`, c["id"], c["url"], c["title"], c["org"]); err != nil {
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
		_, deadline, err := seedSchedule(c, now)
		if err != nil {
			return err
		}
		meta, _ := json.Marshal(c)
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
		if err = notify(ctx, tx, note{User: leader, Team: v.Team, Actor: v.User, Role: v.Team + ":" + v.Role, Kind: "application", Text: "{actor} applied to {team} as {role}"}); err != nil {
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

// seedClose ends sample registration at 23:59:59 WIB (UTC+7) on the listed date.
const seedClose = 16*time.Hour + 59*time.Minute + 59*time.Second

// seedAnchor is the demo date the original sample schedules were written for.
var seedAnchor = time.Date(2026, 10, 6, 0, 0, 0, 0, time.UTC)

// seedSchedule shifts a sample competition's dates (in place) by whole days so the
// original spacing relative to seedAnchor is kept relative to now. It returns the
// shifted date fields as JSON and the shifted deadline (end of day WIB).
func seedSchedule(c map[string]any, now time.Time) ([]byte, time.Time, error) {
	days := int(now.UTC().Truncate(24*time.Hour).Sub(seedAnchor).Hours() / 24)
	if days < 0 {
		days = 0
	}
	shift := func(v any) (string, error) {
		s, _ := v.(string)
		d, err := time.Parse("2006-01-02", s)
		if err != nil {
			return "", fmt.Errorf("seed date %q: %w", s, err)
		}
		return d.AddDate(0, 0, days).Format("2006-01-02"), nil
	}
	out := map[string]any{}
	for _, k := range []string{"open", "deadline", "event"} {
		if _, ok := c[k]; !ok {
			continue
		}
		v, err := shift(c[k])
		if err != nil {
			return nil, time.Time{}, err
		}
		c[k], out[k] = v, v
	}
	if steps, ok := c["timeline"].([]any); ok {
		for _, step := range steps {
			if m, ok := step.(map[string]any); ok {
				v, err := shift(m["date"])
				if err != nil {
					return nil, time.Time{}, err
				}
				m["date"] = v
			}
		}
		out["timeline"] = steps
	}
	deadline, err := time.Parse("2006-01-02", fmt.Sprint(c["deadline"]))
	if err != nil {
		return nil, time.Time{}, err
	}
	raw, err := json.Marshal(out)
	return raw, deadline.Add(seedClose), err
}
