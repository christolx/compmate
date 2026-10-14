package formation

import (
	"bytes"
	"compmate/api/internal/httpapi"
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

type harness struct {
	t           *testing.T
	db          *pgxpool.Pool
	url         string
	admin       *http.Client
	competition string
}

func setup(t *testing.T) *harness {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL required for real PostgreSQL integration tests")
	}
	ctx := context.Background()
	base, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := "test_" + id()
	if _, err = base.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err = Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	if err = Migrate(ctx, db); err != nil {
		t.Fatalf("repeat migration: %v", err)
	}
	server := httptest.NewServer(New(db, httpapi.New(db)))
	t.Cleanup(func() {
		server.Close()
		db.Close()
		_, _ = base.Exec(ctx, `DROP SCHEMA `+schema+` CASCADE`)
		base.Close()
	})
	h := &harness{t: t, db: db, url: server.URL}
	admin, user := h.signup("admin")
	h.admin = admin
	if _, err = db.Exec(ctx, `UPDATE users SET admin=true WHERE id=$1`, user); err != nil {
		t.Fatal(err)
	}
	c := h.req(admin, "POST", "/competitions", h.comp(time.Now().Add(24*time.Hour), ""), 200)
	h.competition = c["id"].(string)
	return h
}
func (h *harness) comp(deadline time.Time, campus string) map[string]any {
	return map[string]any{"title": "Campus Challenge", "organizer": "University", "description": "Curated test fixture", "official_url": "https://example.edu/challenge", "deadline": deadline.UTC().Format(time.RFC3339), "min_members": 2, "max_members": 5, "campus": campus, "published": true}
}
func (h *harness) request(client *http.Client, method, path string, body any) (int, map[string]any, string) {
	b, _ := json.Marshal(body)
	r, _ := http.NewRequest(method, h.url+"/api/v1"+path, bytes.NewReader(b))
	if method != "GET" {
		r.Header.Set("Content-Type", "application/json")
	}
	res, err := client.Do(r)
	if err != nil {
		return 0, nil, err.Error()
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var result map[string]any
	_ = json.Unmarshal(raw, &result)
	return res.StatusCode, result, string(raw)
}
func (h *harness) req(client *http.Client, method, path string, body any, code int) map[string]any {
	h.t.Helper()
	status, data, raw := h.request(client, method, path, body)
	if status != code {
		h.t.Fatalf("%s %s: want %d got %d: %s", method, path, code, status, raw)
	}
	return data
}
func (h *harness) signup(name string) (*http.Client, string) {
	h.t.Helper()
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar}
	p := h.req(client, "POST", "/signup", map[string]string{"email": name + "@example.edu", "password": "test-password-123", "name": name}, 200)
	return client, p["id"].(string)
}
func (h *harness) profile(client *http.Client, name, campus, contact string, share bool) {
	h.req(client, "PUT", "/profile", profileInput{Name: name, Campus: campus, Skills: "Go, Design", Contact: contact, Share: share}, 200)
}
func (h *harness) team(client *http.Client, name string, capacity int, roles []roleInput) string {
	h.t.Helper()
	res := h.req(client, "POST", "/teams", teamInput{Competition: h.competition, Name: name, About: "Build together", Capacity: capacity, Share: true, Roles: roles}, 200)
	return res["id"].(string)
}
func (h *harness) role(client *http.Client, tid string, index int) string {
	res := h.req(client, "GET", "/teams/"+tid, nil, 200)
	return res["roles"].([]any)[index].(map[string]any)["id"].(string)
}
func (h *harness) apply(client *http.Client, tid, role string, share bool) string {
	res := h.req(client, "POST", "/teams/"+tid+"/applications", map[string]any{"role_id": role, "message": "I can help build our project", "share_contact": share}, 200)
	return res["id"].(string)
}
func (h *harness) count(sql string, args ...any) int {
	h.t.Helper()
	var n int
	if err := h.db.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		h.t.Fatal(err)
	}
	return n
}
func (h *harness) decide(client *http.Client, aid, action string, code int) {
	h.req(client, "POST", "/applications/"+aid+"/"+action, map[string]any{}, code)
}

func TestFormationJourneyAndPrivacy(t *testing.T) {
	h := setup(t)
	leader, lid := h.signup("leader")
	applicant, uid := h.signup("applicant")
	stranger, _ := h.signup("stranger")
	h.profile(leader, "Leader", "Campus A", "LEADER_PRIVATE_CONTACT", true)
	h.profile(applicant, "Applicant", "Campus A", "APPLICANT_PRIVATE_CONTACT", true)
	tid := h.team(leader, "Real team", 2, []roleInput{{Name: "Developer", Skills: "Go", Capacity: 1}})
	role := h.role(leader, tid, 0)
	h.req(http.DefaultClient, "GET", "/dashboard", nil, 401)
	h.req(stranger, "GET", "/teams/"+tid+"/contacts", nil, 403)
	h.req(applicant, "PATCH", "/teams/"+tid, map[string]bool{"recruiting": false}, 403)
	h.req(applicant, "POST", "/competitions", h.comp(time.Now().Add(time.Hour), ""), 403)
	for _, path := range []string{"/teams", "/teams/" + tid, "/competitions"} {
		_, _, raw := h.request(http.DefaultClient, "GET", path, nil)
		if strings.Contains(raw, "PRIVATE_CONTACT") || strings.Contains(raw, "@example.edu") {
			t.Fatalf("private data leaked: %s", path)
		}
	}
	aid := h.apply(applicant, tid, role, true)
	h.req(applicant, "POST", "/teams/"+tid+"/applications", map[string]any{"role_id": role, "message": "Duplicate request message", "share_contact": true}, 409)
	h.decide(stranger, aid, "accept", 403)
	h.req(applicant, "GET", "/teams/"+tid+"/contacts", nil, 403)
	inbox := h.req(leader, "GET", "/dashboard", nil, 200)["inbox"].([]any)
	outgoing := h.req(applicant, "GET", "/dashboard", nil, 200)["applications"].([]any)
	if inbox[0].(map[string]any)["id"] != outgoing[0].(map[string]any)["id"] {
		t.Fatal("application not shared")
	}
	other := h.req(stranger, "GET", "/dashboard", nil, 200)
	if len(other["inbox"].([]any))+len(other["applications"].([]any)) != 0 {
		t.Fatal("unauthorized applications leaked")
	}
	h.decide(leader, aid, "accept", 200)
	h.decide(leader, aid, "accept", 200)
	if h.count(`SELECT count(*) FROM memberships WHERE team_id=$1`, tid) != 2 {
		t.Fatal("acceptance membership mismatch")
	}
	for _, client := range []*http.Client{leader, applicant} {
		dash := h.req(client, "GET", "/dashboard", nil, 200)
		if len(dash["teams"].([]any)) != 1 {
			t.Fatal("member team missing after reload")
		}
		_, _, raw := h.request(client, "GET", "/teams/"+tid+"/contacts", nil)
		if !strings.Contains(raw, "LEADER_PRIVATE_CONTACT") || !strings.Contains(raw, "APPLICANT_PRIVATE_CONTACT") {
			t.Fatal("consented contact missing")
		}
		h.req(client, "POST", "/teams/"+tid+"/connected", map[string]any{}, 200)
	}
	h.decide(applicant, aid, "withdraw", 409)
	h.profile(applicant, "Applicant", "Campus A", "APPLICANT_PRIVATE_CONTACT", false)
	_, _, raw := h.request(leader, "GET", "/teams/"+tid+"/contacts", nil)
	if strings.Contains(raw, "APPLICANT_PRIVATE_CONTACT") {
		t.Fatal("revoked contact still visible")
	}
	h.req(stranger, "GET", "/teams/"+tid+"/contacts", nil, 403)
	metrics := h.req(h.admin, "GET", "/admin/metrics", nil, 200)
	if metrics["connected_teams"] != float64(1) {
		t.Fatalf("metrics: %v", metrics)
	}
	h.req(applicant, "GET", "/account/export", nil, 200)
	h.req(applicant, "DELETE", "/account", map[string]string{"password": "wrong"}, 401)
	h.req(applicant, "DELETE", "/account", map[string]string{"password": "test-password-123"}, 200)
	if h.count(`SELECT count(*) FROM profiles WHERE user_id=$1`, uid) != 0 || h.count(`SELECT count(*) FROM sessions WHERE user_id=$1`, uid) != 0 {
		t.Fatal("account data retained")
	}
	h.req(applicant, "GET", "/me", nil, 401)
	h.req(leader, "DELETE", "/account", map[string]string{"password": "test-password-123"}, 409)
	h.req(leader, "DELETE", "/teams/"+tid, map[string]any{}, 200)
	h.req(leader, "DELETE", "/account", map[string]string{"password": "test-password-123"}, 200)
	if h.count(`SELECT count(*) FROM users WHERE id=$1`, lid) != 0 {
		t.Fatal("leader deletion failed")
	}
}
func TestConcurrentLastSeatAndRoleLimits(t *testing.T) {
	h := setup(t)
	leader, _ := h.signup("leader")
	one, _ := h.signup("one")
	two, _ := h.signup("two")
	tid := h.team(leader, "Race team", 2, []roleInput{{Name: "Developer", Capacity: 1}})
	role := h.role(leader, tid, 0)
	a := h.apply(one, tid, role, false)
	b := h.apply(two, tid, role, true)
	codes := make(chan int, 2)
	var wg sync.WaitGroup
	for _, aid := range []string{a, b} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _, _ := h.request(leader, "POST", "/applications/"+aid+"/accept", map[string]any{})
			codes <- code
		}()
	}
	wg.Wait()
	close(codes)
	success, conflicts := 0, 0
	for c := range codes {
		if c == 200 {
			success++
		} else if c == 409 {
			conflicts++
		} else {
			t.Fatalf("unexpected acceptance %d", c)
		}
	}
	if success != 1 || conflicts != 1 || h.count(`SELECT count(*) FROM memberships WHERE team_id=$1`, tid) != 2 || h.count(`SELECT count(*) FROM applications WHERE team_id=$1 AND status='accepted'`, tid) != 1 {
		t.Fatal("last seat race broke atomicity")
	}
	h.req(h.admin, "POST", "/teams/"+tid+"/applications", map[string]any{"role_id": role, "message": "Full team must reject me"}, 409)
	tid2 := h.team(leader, "Role limit", 3, []roleInput{{Name: "Designer", Capacity: 1}, {Name: "Developer", Capacity: 1}})
	role2 := h.role(leader, tid2, 0)
	roleOne, _ := h.signup("roleone")
	roleTwo, _ := h.signup("roletwo")
	c := h.apply(roleOne, tid2, role2, false)
	d := h.apply(roleTwo, tid2, role2, true)
	h.decide(leader, c, "accept", 200)
	h.decide(leader, d, "accept", 409)
	if h.count(`SELECT count(*) FROM memberships WHERE team_id=$1`, tid2) != 2 {
		t.Fatal("role limit exceeded")
	}
}
func TestRecruitmentDeadlinesWithdrawalAndModeration(t *testing.T) {
	h := setup(t)
	leader, _ := h.signup("leader")
	applicant, _ := h.signup("applicant")
	other, _ := h.signup("other")
	tid := h.team(leader, "Controls team", 3, []roleInput{{Name: "Developer", Capacity: 2}})
	role := h.role(leader, tid, 0)
	aid := h.apply(applicant, tid, role, true)
	h.req(leader, "PATCH", "/teams/"+tid, map[string]bool{"recruiting": false}, 200)
	h.decide(leader, aid, "accept", 409)
	h.req(other, "POST", "/teams/"+tid+"/applications", map[string]any{"role_id": role, "message": "Closed recruitment application"}, 409)
	h.req(leader, "PATCH", "/teams/"+tid, map[string]bool{"recruiting": true}, 200)
	h.req(h.admin, "PUT", "/competitions/"+h.competition, h.comp(time.Now().Add(-time.Hour), ""), 200)
	h.decide(leader, aid, "accept", 409)
	h.req(other, "POST", "/teams/"+tid+"/applications", map[string]any{"role_id": role, "message": "Expired recruitment application"}, 409)
	h.req(h.admin, "PUT", "/competitions/"+h.competition, h.comp(time.Now().Add(time.Hour), "Restricted Campus"), 200)
	h.decide(leader, aid, "accept", 409)
	h.profile(applicant, "Applicant", "Restricted Campus", "CONTACT_WITHOUT_CONSENT", true)
	h.decide(applicant, aid, "withdraw", 200)
	h.decide(applicant, aid, "withdraw", 200)
	h.decide(leader, aid, "accept", 409)
	h.req(applicant, "POST", "/teams/"+tid+"/applications", map[string]any{"role_id": role, "message": "Withdrawn application is final"}, 409)
	h.profile(other, "Other", "Restricted Campus", "OTHER_CONTACT", true)
	bid := h.apply(other, tid, role, false)
	h.decide(leader, bid, "decline", 200)
	h.decide(leader, bid, "accept", 409)
	h.req(other, "POST", "/reports", map[string]string{"team_id": tid, "reason": "Misleading description needs moderation"}, 200)
	var rid string
	if err := h.db.QueryRow(context.Background(), `SELECT id FROM reports WHERE team_id=$1`, tid).Scan(&rid); err != nil {
		t.Fatal(err)
	}
	h.req(other, "GET", "/admin/reports", nil, 403)
	h.req(h.admin, "POST", "/admin/reports/"+rid+"/resolve", map[string]bool{"hide_team": true}, 200)
	h.req(http.DefaultClient, "GET", "/teams/"+tid, nil, 404)
	h.req(leader, "GET", "/teams/"+tid, nil, 200)
	_, _, raw := h.request(http.DefaultClient, "GET", "/teams", nil)
	if strings.Contains(raw, tid) {
		t.Fatal("moderated team public")
	}
	h.req(h.admin, "POST", "/admin/reports/"+rid+"/resolve", map[string]bool{"hide_team": false}, 200)
	h.req(h.admin, "PUT", "/competitions/"+h.competition, h.comp(time.Now().Add(time.Hour), ""), 200)
	newcomer, _ := h.signup("newcomer")
	nid := h.apply(newcomer, tid, role, false)
	h.decide(leader, nid, "accept", 200)
	h.profile(newcomer, "Newcomer", "", "UNCONSENTED_CONTACT", true)
	_, _, raw = h.request(leader, "GET", "/teams/"+tid+"/contacts", nil)
	if strings.Contains(raw, "UNCONSENTED_CONTACT") {
		t.Fatal("team consent not enforced")
	}
}
func TestAuthenticationCSRFValidationAndDuplicateRace(t *testing.T) {
	h := setup(t)
	leader, _ := h.signup("leader")
	applicant, uid := h.signup("applicant")
	h.req(applicant, "POST", "/login", map[string]string{"email": "applicant@example.edu", "password": "wrong"}, 401)
	for _, tc := range []struct {
		body, origin, contentType string
		code                      int
	}{{`{}`, "https://attacker.example", "application/json", 403}, {`{}`, "", "", 400}, {`{} {}`, "", "application/json", 400}, {`{}garbage`, "", "application/json", 400}, {`{"unknown":true}`, "", "application/json", 400}} {
		r, _ := http.NewRequest("PUT", h.url+"/api/v1/profile", strings.NewReader(tc.body))
		r.Header.Set("Content-Type", tc.contentType)
		r.Header.Set("Origin", tc.origin)
		res, err := applicant.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != tc.code {
			t.Fatalf("validation got %d want %d", res.StatusCode, tc.code)
		}
	}
	h.req(leader, "POST", "/teams", teamInput{Competition: h.competition, Name: "Invalid role seats", Capacity: 4, Roles: []roleInput{{Name: "Developer", Capacity: 1}}}, 400)
	tid := h.team(leader, "Duplicate race", 2, []roleInput{{Name: "Developer", Capacity: 1}})
	role := h.role(leader, tid, 0)
	codes := make(chan int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _, _ := h.request(applicant, "POST", "/teams/"+tid+"/applications", map[string]any{"role_id": role, "message": "Concurrent duplicate application"})
			codes <- code
		}()
	}
	wg.Wait()
	close(codes)
	sum := 0
	for c := range codes {
		sum += c
	}
	if sum != 609 || h.count(`SELECT count(*) FROM applications WHERE team_id=$1`, tid) != 1 {
		t.Fatal("duplicate race not protected")
	}
	if _, err := h.db.Exec(context.Background(), `UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1`, uid); err != nil {
		t.Fatal(err)
	}
	h.req(applicant, "GET", "/dashboard", nil, 401)
	h.req(applicant, "POST", "/teams/"+tid+"/applications", map[string]any{}, 401)
	h.req(applicant, "POST", "/login", map[string]string{"email": "applicant@example.edu", "password": "test-password-123"}, 200)
	h.req(applicant, "POST", "/logout", map[string]any{}, 200)
	h.req(applicant, "GET", "/me", nil, 401)
	for i := 0; i < 22; i++ {
		status, _, _ := h.request(http.DefaultClient, "POST", "/login", map[string]string{"email": "unknown@example.edu", "password": "wrong"})
		if i == 21 && status != 429 {
			t.Fatal("auth rate limit missing")
		}
	}
}

func TestDeadlineDuringLockWaitAndFailedCommit(t *testing.T) {
	h := setup(t)
	leader, _ := h.signup("leader")
	applicant, _ := h.signup("applicant")
	tid := h.team(leader, "Deadline race", 2, []roleInput{{Name: "Developer", Capacity: 1}})
	aid := h.apply(applicant, tid, h.role(leader, tid, 0), true)
	ctx := context.Background()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT id FROM teams WHERE id=$1 FOR UPDATE`, tid); err != nil {
		t.Fatal(err)
	}
	if _, err = h.db.Exec(ctx, `UPDATE competitions SET deadline=now()+interval '200 milliseconds' WHERE id=$1`, h.competition); err != nil {
		t.Fatal(err)
	}
	done := make(chan int, 1)
	go func() {
		code, _, _ := h.request(leader, "POST", "/applications/"+aid+"/accept", map[string]any{})
		done <- code
	}()
	time.Sleep(350 * time.Millisecond)
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if code := <-done; code != 409 {
		t.Fatalf("expired during lock wait: %d", code)
	}
	if h.count(`SELECT count(*) FROM memberships WHERE team_id=$1`, tid) != 1 {
		t.Fatal("expired acceptance mutated roster")
	}
	h.req(h.admin, "PUT", "/competitions/"+h.competition, h.comp(time.Now().Add(time.Hour), ""), 200)
	// Failure after membership + decision must roll back all writes.
	_, err = h.db.Exec(ctx, `CREATE FUNCTION fail_alert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'PRIVATE_FAILURE_DETAIL'; END$$; CREATE TRIGGER fail_alert BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION fail_alert()`)
	if err != nil {
		t.Fatal(err)
	}
	code, _, body := h.request(leader, "POST", "/applications/"+aid+"/accept", map[string]any{})
	if code != 500 || strings.Contains(body, "PRIVATE_FAILURE_DETAIL") {
		t.Fatalf("unsafe failure: %d %s", code, body)
	}
	if h.count(`SELECT count(*) FROM memberships WHERE team_id=$1`, tid) != 1 || h.count(`SELECT count(*) FROM applications WHERE id=$1 AND status='pending'`, aid) != 1 || h.count(`SELECT count(*) FROM events WHERE kind='accepted'`) != 0 {
		t.Fatal("failed acceptance left partial writes")
	}
}

func TestSecureCookieOnHTTPS(t *testing.T) {
	h := setup(t)
	t.Setenv("COOKIE_SECURE", "true")
	server := httptest.NewTLSServer(New(h.db, httpapi.New(h.db)))
	defer server.Close()
	jar, _ := cookiejar.New(nil)
	client := server.Client()
	client.Jar = jar
	r, _ := http.NewRequest("POST", server.URL+"/api/v1/login", strings.NewReader(`{"email":"admin@example.edu","password":"test-password-123"}`))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", server.URL)
	res, err := client.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("HTTPS login: %d", res.StatusCode)
	}
	cookies := res.Cookies()
	if len(cookies) != 1 {
		t.Fatalf("cookies: %d", len(cookies))
	}
	cookie := cookies[0]
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/" || cookie.MaxAge != 604800 {
		t.Fatal("production cookie protections missing")
	}
	me, err := client.Get(server.URL + "/api/v1/me")
	if err != nil {
		t.Fatal(err)
	}
	me.Body.Close()
	if me.StatusCode != 200 {
		t.Fatal("HTTPS session did not persist")
	}
}

func TestDefaultUISeedAndPreferences(t *testing.T) {
	h := setup(t)
	ctx := context.Background()
	if err := Seed(ctx, h.db); err != nil {
		t.Fatal(err)
	}
	if h.count(`SELECT count(*) FROM users WHERE seeded`) != 19 || h.count(`SELECT count(*) FROM teams WHERE id='vertex'`) != 1 {
		t.Fatal("old default data not seeded")
	}
	if h.count(`SELECT count(*) FROM profiles p JOIN users u ON u.id=p.user_id WHERE u.seeded AND jsonb_array_length(p.presentation->'links')=3`) != 19 {
		t.Fatal("sample profiles missing external links")
	}
	// Upgrade old fixture URLs without overwriting a user's custom links.
	if _, err := h.db.Exec(ctx, `UPDATE profiles SET presentation=jsonb_set(presentation,'{links}','[{"label":"LinkedIn","value":"linkedin.com/in/mayaputri"},{"label":"Portfolio","value":"mayaputri.notion.site"}]') WHERE user_id='maya';
 UPDATE profiles SET presentation=jsonb_set(presentation,'{links}','[{"label":"Portfolio","value":"https://example.edu/my-work"}]') WHERE user_id='raka';
 UPDATE profiles SET presentation=jsonb_set(presentation,'{links}','[{"label":"LinkedIn","value":"linkedin.com/in/nadiachen"}]') WHERE user_id='nadia';
 UPDATE competitions SET official_url='' WHERE id='ived';
 UPDATE competitions SET official_url='https://example.edu/custom-event' WHERE id='nbcc'`); err != nil {
		t.Fatal(err)
	}
	if err := Seed(ctx, h.db); err != nil {
		t.Fatal(err)
	}
	if h.count(`SELECT count(*) FROM profiles WHERE user_id='maya' AND presentation->'links'->0->>'example'='true'`) != 1 ||
		h.count(`SELECT count(*) FROM profiles WHERE user_id='nadia' AND presentation->'links'->0->>'example'='true'`) != 1 ||
		h.count(`SELECT count(*) FROM profiles WHERE user_id='raka' AND presentation->'links'->0->>'value'='https://example.edu/my-work'`) != 1 ||
		h.count(`SELECT count(*) FROM competitions WHERE id='ived' AND official_url='https://example.com/?competition=ived'`) != 1 ||
		h.count(`SELECT count(*) FROM competitions WHERE id='nbcc' AND official_url='https://example.edu/custom-event'`) != 1 {
		t.Fatal("sample link backfill failed or overwrote custom links")
	}
	seededClient, _ := cookiejar.New(nil)
	maya := &http.Client{Jar: seededClient}
	h.req(maya, "POST", "/login", map[string]string{"email": "maya@compmate.local", "password": "compmate-demo-password"}, 200)
	dashboard := h.req(maya, "GET", "/dashboard", nil, 200)
	if len(dashboard["inbox"].([]any)) != 2 || len(dashboard["applications"].([]any)) != 1 {
		t.Fatal("seeded applications not shared")
	}
	h.profile(maya, "Maya Edited", "BINUS", "PRIVATE-SEED-CONTACT", false)
	if err := Seed(ctx, h.db); err != nil {
		t.Fatal(err)
	}
	me := h.req(maya, "GET", "/me", nil, 200)
	if me["name"] != "Maya Edited" || me["share_contact"] != false {
		t.Fatal("seed overwrote account edits")
	}
	_, _, catalog := h.request(http.DefaultClient, "GET", "/catalog", nil)
	if strings.Contains(catalog, "PRIVATE-SEED-CONTACT") || strings.Contains(catalog, "password_hash") {
		t.Fatal("catalog leaked private data")
	}
	h.req(maya, "PUT", "/saved/ived", map[string]any{}, 200)
	h.req(maya, "POST", "/connections/nadia/accept", map[string]any{}, 200)
	prefs := h.req(maya, "GET", "/preferences", nil, 200)
	if prefs["connections"].(map[string]any)["nadia"] != "connected" {
		t.Fatal("connection not committed")
	}
	h.req(h.admin, "POST", "/connections/nadia/accept", map[string]any{}, 403)
}
func TestInvitationsAndSameCompetitionAcceptance(t *testing.T) {
	h := setup(t)
	leader, _ := h.signup("leader")
	applicant, uid := h.signup("applicant")
	other, _ := h.signup("other")
	tid := h.team(leader, "Inviting team", 3, []roleInput{{Name: "Developer", Capacity: 2}})
	rid := h.role(leader, tid, 0)
	invite := h.req(leader, "POST", "/teams/"+tid+"/invitations", map[string]string{"user_id": uid, "role_id": rid}, 200)["id"].(string)
	h.req(other, "POST", "/invitations/"+invite+"/accept", map[string]any{}, 403)
	h.req(applicant, "POST", "/invitations/"+invite+"/accept", map[string]bool{"share_contact": false}, 200)
	h.req(applicant, "POST", "/invitations/"+invite+"/accept", map[string]bool{"share_contact": false}, 200)
	if h.count(`SELECT count(*) FROM memberships WHERE team_id=$1`, tid) != 2 || h.count(`SELECT count(*) FROM applications WHERE team_id=$1 AND user_id=$2 AND status='accepted'`, tid, uid) != 1 {
		t.Fatal("invitation not atomic/shared")
	}
	second := h.team(leader, "Another team", 2, []roleInput{{Name: "Designer", Capacity: 1}})
	h.req(applicant, "POST", "/teams/"+second+"/applications", map[string]any{"role_id": h.role(leader, second, 0), "message": "Already in another team here"}, 409)
}
