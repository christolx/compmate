package formation

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"strings"
	"time"
)

//go:embed seed/catalog.json seed/legacy.json
var seedFiles embed.FS

// catalogV2 marks the enriched sample catalog. Databases seeded before it
// receive its new listings and copy once, on the first Seed after upgrading.
const catalogV2 = "catalog-v2"

type seedCatalog struct {
	People       map[string]map[string]any `json:"people"`
	Competitions []map[string]any          `json:"competitions"`
	Teams        []map[string]any          `json:"teams"`
	State        struct {
		Saved []string          `json:"saved"`
		Conns map[string]string `json:"conns"`
	} `json:"state"`
}

// seedLegacy holds the original-ui-v1 placeholder copy that catalog-v2
// replaced, so the upgrade only rewrites text nobody has edited since.
type seedLegacy struct {
	Competitions map[string]string `json:"competitions"`
	People       map[string]string `json:"people"`
	Teams        map[string]string `json:"teams"`
	Added        struct {
		People       []string `json:"people"`
		Competitions []string `json:"competitions"`
		Teams        []string `json:"teams"`
	} `json:"added"`
}

// Seed imports the previous UI fixtures once. Never overwrites account edits or decisions.
// Local-only accounts use <id>@compmate.local / compmate-demo-password. Production disables SEED_DATA.
func Seed(ctx context.Context, db *pgxpool.Pool) error {
	now := time.Now() // one clock so every listing shifts by the same days
	data, _, err := loadSeed()
	if err != nil {
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
			user := seedUser(key)
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
		var upgraded bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM seed_versions WHERE version=$1)`, catalogV2).Scan(&upgraded); err != nil {
			return err
		}
		if !upgraded {
			// Reload: the loop above shifted data's dates in place.
			fresh, legacy, err := loadSeed()
			if err != nil {
				return err
			}
			if err = upgradeCatalogV2(ctx, tx, fresh, legacy, now); err != nil {
				return err
			}
		}
		return tx.Commit(ctx)
	}
	hash, err := seedPasswordHash()
	if err != nil {
		return err
	}
	if err = seedPeople(ctx, tx, data.People, nil, hash); err != nil {
		return err
	}
	if err = seedCompetitions(ctx, tx, data.Competitions, nil, now); err != nil {
		return err
	}
	if err = seedTeams(ctx, tx, data.Teams, nil); err != nil {
		return err
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
	if _, err = tx.Exec(ctx, `INSERT INTO seed_versions VALUES('original-ui-v1',now()),($1,now())`, catalogV2); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func loadSeed() (*seedCatalog, *seedLegacy, error) {
	var data seedCatalog
	var legacy seedLegacy
	for name, v := range map[string]any{"seed/catalog.json": &data, "seed/legacy.json": &legacy} {
		raw, err := seedFiles.ReadFile(name)
		if err != nil {
			return nil, nil, err
		}
		if err = json.Unmarshal(raw, v); err != nil {
			return nil, nil, err
		}
	}
	return &data, &legacy, nil
}

// upgradeCatalogV2 brings an original-ui-v1 database up to the enriched catalog:
// it adds the new sample listings, fills detail fields the old listings lacked,
// and swaps placeholder copy that still matches the original text exactly.
func upgradeCatalogV2(ctx context.Context, tx pgx.Tx, data *seedCatalog, legacy *seedLegacy, now time.Time) error {
	for _, c := range data.Competitions {
		id, title, org := seedStr(c, "id"), seedStr(c, "title"), seedStr(c, "org")
		var current string
		err := tx.QueryRow(ctx, `SELECT presentation->>'deadline' FROM competitions WHERE id=$1 AND title=$2 AND organizer=$3`, id, title, org).Scan(&current)
		if err == pgx.ErrNoRows {
			continue
		} else if err != nil {
			return err
		}
		// Align new timeline dates with the listing's own (possibly rolled) deadline.
		meta, err := seedShiftedCopy(c, current)
		if err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE competitions SET presentation=$4::jsonb||presentation WHERE id=$1 AND title=$2 AND organizer=$3`, id, title, org, meta); err != nil {
			return err
		}
		if old, ok := legacy.Competitions[id]; ok {
			if _, err = tx.Exec(ctx, `UPDATE competitions SET description=$2, presentation=presentation||jsonb_build_object('overview',$2::text) WHERE id=$1 AND description=$3`, id, seedStr(c, "overview"), old); err != nil {
				return err
			}
		}
	}
	for key, old := range legacy.People {
		about := seedStr(data.People[key], "about")
		if _, err := tx.Exec(ctx, `UPDATE profiles SET about=$2, presentation=presentation||jsonb_build_object('about',$2::text) WHERE user_id=$1 AND about=$3 AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND seeded)`, seedUser(key), about, old); err != nil {
			return err
		}
	}
	for _, t := range data.Teams {
		if old, ok := legacy.Teams[seedStr(t, "id")]; ok {
			if _, err := tx.Exec(ctx, `UPDATE teams SET about=$2, presentation=presentation||jsonb_build_object('about',$2::text) WHERE id=$1 AND about=$3`, seedStr(t, "id"), seedStr(t, "about"), old); err != nil {
				return err
			}
		}
	}
	only := func(ids []string) map[string]bool {
		m := map[string]bool{}
		for _, id := range ids {
			m[id] = true
		}
		return m
	}
	hash, err := seedPasswordHash()
	if err != nil {
		return err
	}
	if err = seedPeople(ctx, tx, data.People, only(legacy.Added.People), hash); err != nil {
		return err
	}
	if err = seedCompetitions(ctx, tx, data.Competitions, only(legacy.Added.Competitions), now); err != nil {
		return err
	}
	if err = seedTeams(ctx, tx, data.Teams, only(legacy.Added.Teams)); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO seed_versions VALUES($1,now())`, catalogV2)
	return err
}

func seedPasswordHash() (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte("compmate-demo-password"), bcrypt.DefaultCost)
	return string(hash), err
}

// seedPeople inserts sample accounts and profiles; only limits it to those keys (nil = all).
func seedPeople(ctx context.Context, tx pgx.Tx, people map[string]map[string]any, only map[string]bool, hash string) error {
	for key, p := range people {
		if only != nil && !only[key] {
			continue
		}
		user := seedUser(key)
		meta, _ := json.Marshal(p)
		if _, err := tx.Exec(ctx, `INSERT INTO users(id,email,password_hash,seeded) VALUES($1,$2,$3,true) ON CONFLICT DO NOTHING`, user, user+"@compmate.local", hash); err != nil {
			return err
		}
		contact := user + "@compmate.local"
		if _, err := tx.Exec(ctx, `INSERT INTO profiles(user_id,name,campus,skills,availability,about,contact,share_contact,presentation) SELECT $1,$2,'BINUS',$3,$4,$5,$6,true,$7 WHERE EXISTS(SELECT 1 FROM users WHERE id=$1 AND seeded) ON CONFLICT DO NOTHING`, user, seedStr(p, "name"), strings.Join(seedList(p, "skills"), ", "), seedStr(p, "avail"), seedStr(p, "about"), contact, meta); err != nil {
			return err
		}
	}
	return nil
}

// seedCompetitions inserts sample listings; only limits it to those ids (nil = all).
func seedCompetitions(ctx context.Context, tx pgx.Tx, comps []map[string]any, only map[string]bool, now time.Time) error {
	for _, c := range comps {
		if only != nil && !only[seedStr(c, "id")] {
			continue
		}
		_, deadline, err := seedSchedule(c, now)
		if err != nil {
			return err
		}
		meta, _ := json.Marshal(c)
		min := seedNum(c, "min")
		if min < 2 {
			min = 2
		}
		url := seedStr(c, "url")
		if url != "" && !strings.HasPrefix(url, "https://") {
			url = "https://" + url
		}
		if _, err = tx.Exec(ctx, `INSERT INTO competitions(id,title,organizer,description,official_url,deadline,min_members,max_members,presentation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`, seedStr(c, "id"), seedStr(c, "title"), seedStr(c, "org"), seedStr(c, "overview"), url, deadline, min, seedNum(c, "max"), meta); err != nil {
			return err
		}
	}
	return nil
}

// seedTeams inserts sample teams; only limits it to those ids (nil = all).
// A team is skipped when its competition or leader is gone, and members who
// already belong to another team in that competition are left out.
func seedTeams(ctx context.Context, tx pgx.Tx, teams []map[string]any, only map[string]bool) error {
	free := func(user, comp, team string) (bool, error) {
		var ok bool
		err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id=$1) AND NOT EXISTS(SELECT 1 FROM memberships m JOIN teams t ON t.id=m.team_id WHERE m.user_id=$1 AND t.competition_id=$2 AND t.id<>$3)`, user, comp, team).Scan(&ok)
		return ok, err
	}
	for _, t := range teams {
		tid, comp := seedStr(t, "id"), seedStr(t, "comp")
		if only != nil && !only[tid] {
			continue
		}
		var compExists, teamExists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM competitions WHERE id=$1), EXISTS(SELECT 1 FROM teams WHERE id=$2)`, comp, tid).Scan(&compExists, &teamExists); err != nil {
			return err
		}
		leader := seedUser(seedStr(t, "leader"))
		ok, err := free(leader, comp, tid)
		if err != nil {
			return err
		}
		if !compExists || teamExists || !ok {
			continue
		}
		members := []string{}
		for _, m := range seedList(t, "members") {
			if ok, err := free(seedUser(m), comp, tid); err != nil {
				return err
			} else if ok {
				members = append(members, seedUser(m))
			}
		}
		meta, _ := json.Marshal(t)
		if _, err = tx.Exec(ctx, `INSERT INTO teams(id,competition_id,leader_id,name,about,capacity,presentation) VALUES($1,$2,$3,$4,$5,$6,$7)`, tid, comp, leader, seedStr(t, "name"), seedStr(t, "about"), seedNum(t, "target"), meta); err != nil {
			return err
		}
		for _, v := range t["roles"].([]any) {
			r := v.(map[string]any)
			rm, _ := json.Marshal(r)
			if _, err = tx.Exec(ctx, `INSERT INTO roles(id,team_id,name,skills,capacity,presentation) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, tid+":"+seedStr(r, "id"), tid, seedStr(r, "name"), strings.Join(seedList(r, "skills"), ", "), seedNum(r, "qty"), rm); err != nil {
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
			if member != leader {
				role = filledRole
			}
			if _, err = tx.Exec(ctx, `INSERT INTO memberships(team_id,user_id,role_id,share_contact) VALUES($1,$2,$3,true) ON CONFLICT DO NOTHING`, tid, member, role); err != nil {
				return err
			}
		}
	}
	return nil
}

func seedUser(s string) string {
	if s == "me" {
		return "maya"
	}
	return s
}
func seedStr(m map[string]any, k string) string { v, _ := m[k].(string); return v }
func seedNum(m map[string]any, k string) int    { v, _ := m[k].(float64); return int(v) }
func seedList(m map[string]any, k string) []string {
	out := []string{}
	if arr, ok := m[k].([]any); ok {
		for _, v := range arr {
			out = append(out, v.(string))
		}
	}
	return out
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
	out, err := seedShift(c, days)
	if err != nil {
		return nil, time.Time{}, err
	}
	deadline, err := time.Parse("2006-01-02", fmt.Sprint(c["deadline"]))
	if err != nil {
		return nil, time.Time{}, err
	}
	raw, err := json.Marshal(out)
	return raw, deadline.Add(seedClose), err
}

// seedShift moves every date field of c (in place) by days and returns the moved fields.
func seedShift(c map[string]any, days int) (map[string]any, error) {
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
			return nil, err
		}
		c[k], out[k] = v, v
	}
	if steps, ok := c["timeline"].([]any); ok {
		for _, step := range steps {
			if m, ok := step.(map[string]any); ok {
				v, err := shift(m["date"])
				if err != nil {
					return nil, err
				}
				m["date"] = v
			}
		}
		out["timeline"] = steps
	}
	return out, nil
}

// seedShiftedCopy returns c as JSON with its dates moved so its deadline lands on deadline (yyyy-mm-dd).
func seedShiftedCopy(c map[string]any, deadline string) ([]byte, error) {
	raw, _ := json.Marshal(c)
	var cp map[string]any
	if err := json.Unmarshal(raw, &cp); err != nil {
		return nil, err
	}
	want, err := time.Parse("2006-01-02", deadline)
	if err != nil {
		return nil, fmt.Errorf("stored deadline %q: %w", deadline, err)
	}
	have, err := time.Parse("2006-01-02", seedStr(cp, "deadline"))
	if err != nil {
		return nil, err
	}
	if _, err = seedShift(cp, int(want.Sub(have).Hours()/24)); err != nil {
		return nil, err
	}
	return json.Marshal(cp)
}
