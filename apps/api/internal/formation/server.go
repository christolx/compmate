package formation

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/mail"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

type Server struct {
	db       *pgxpool.Pool
	secure   bool
	origin   string
	attempts sync.Map
}
type failure struct {
	code    int
	message string
}

func (e failure) Error() string { return e.message }
func bad(s string) error        { return failure{400, s} }
func conflict(s string) error   { return failure{409, s} }

var forbidden = failure{403, "Permission denied"}
var unauth = failure{401, "Sign in required; session may have expired"}
var missing = failure{404, "Not found"}

type actor struct {
	ID    string
	Admin bool
}
type endpoint func(http.ResponseWriter, *http.Request, actor) (any, error)

func New(db *pgxpool.Pool, health http.Handler) http.Handler {
	s := &Server{db: db, secure: os.Getenv("COOKIE_SECURE") == "true", origin: os.Getenv("PUBLIC_ORIGIN")}
	mux := http.NewServeMux()
	mux.Handle("GET /api/health", health)
	mux.Handle("GET /api/ready", health)
	register := func(method, path string, auth bool, fn endpoint) {
		mux.HandleFunc(method+" /api/v1"+path, s.wrap(auth, fn))
	}
	register("POST", "/client-errors", false, s.clientError)
	register("POST", "/signup", false, s.signup)
	register("POST", "/login", false, s.login)
	register("POST", "/logout", false, s.logout)
	register("GET", "/me", true, s.me)
	register("GET", "/catalog", false, s.catalog)
	register("GET", "/preferences", true, s.preferences)
	register("GET", "/invitations", true, s.invites)
	register("POST", "/teams/{id}/invitations", true, s.invite)
	register("POST", "/invitations/{id}/{action}", true, s.answerInvite)
	register("PUT", "/saved/{id}", true, s.saveCompetition)
	register("DELETE", "/saved/{id}", true, s.saveCompetition)
	register("POST", "/connections/{id}", true, s.connection)
	register("DELETE", "/connections/{id}", true, s.connection)
	register("POST", "/connections/{id}/{action}", true, s.connection)
	register("POST", "/notifications/{id}/read", true, s.readNotification)
	register("PUT", "/profile", true, s.profile)
	register("GET", "/account/export", true, s.export)
	register("DELETE", "/account", true, s.deleteAccount)
	register("GET", "/competitions", false, s.competitions)
	register("POST", "/competitions", true, s.curate)
	register("PUT", "/competitions/{id}", true, s.curate)
	register("GET", "/teams", false, s.teams)
	register("POST", "/teams", true, s.createTeam)
	register("GET", "/teams/{id}", false, s.team)
	register("PATCH", "/teams/{id}", true, s.editTeam)
	register("DELETE", "/teams/{id}", true, s.deleteTeam)
	register("POST", "/teams/{id}/applications", true, s.apply)
	register("GET", "/dashboard", true, s.dashboard)
	register("POST", "/applications/{id}/{action}", true, s.decision)
	register("GET", "/teams/{id}/contacts", true, s.contacts)
	register("POST", "/teams/{id}/connected", true, s.connected)
	register("POST", "/reports", true, s.report)
	register("GET", "/admin/reports", true, s.reports)
	register("POST", "/admin/reports/{id}/resolve", true, s.resolve)
	register("GET", "/admin/metrics", true, s.metrics)
	register("POST", "/notifications/read", true, s.readNotifications)
	return monitor(mux)
}
func (s *Server) wrap(auth bool, fn endpoint) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		r = r.WithContext(ctx)
		if r.URL.Path == "/api/v1/login" || r.URL.Path == "/api/v1/signup" {
			ip, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				ip = r.RemoteAddr
			}
			now := time.Now()
			entry, _ := s.attempts.LoadOrStore(ip, &attemptWindow{start: now})
			limit := entry.(*attemptWindow)
			limit.mu.Lock()
			if now.Sub(limit.start) > time.Minute {
				limit.start = now
				limit.n = 0
			}
			limit.n++
			blocked := limit.n > 20
			limit.mu.Unlock()
			// Bound memory without trusting forwarded IP headers.
			s.attempts.Range(func(k, v any) bool {
				other := v.(*attemptWindow)
				other.mu.Lock()
				old := now.Sub(other.start) > 2*time.Minute
				other.mu.Unlock()
				if old {
					s.attempts.Delete(k)
				}
				return true
			})
			if blocked {
				w.Header().Set("Retry-After", "60")
				s.reply(w, nil, failure{429, "Too many sign-in attempts. Retry in one minute."})
				return
			}
		}
		if r.Method != "GET" {
			// JSON-only mutations prevent form CSRF even when Origin is omitted by non-browser clients.
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				s.reply(w, nil, bad("Content-Type must be application/json"))
				return
			}
			origin := r.Header.Get("Origin")
			if origin != "" {
				u, err := url.Parse(origin)
				localAlias := false
				if err == nil && !s.secure {
					configured, _ := url.Parse(s.origin)
					if configured != nil {
						isLocal := func(host string) bool { return host == "localhost" || host == "127.0.0.1" || host == "::1" }
						localAlias = isLocal(configured.Hostname()) && isLocal(u.Hostname()) && configured.Port() == u.Port() && configured.Scheme == u.Scheme
					}
				}
				if err != nil || (origin != s.origin && u.Host != r.Host && !localAlias) {
					s.reply(w, nil, forbidden)
					return
				}
			}
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				s.reply(w, nil, forbidden)
				return
			}
		}
		a := actor{}
		if c, err := r.Cookie("compmate_session"); err == nil {
			err = s.db.QueryRow(ctx, `SELECT u.id,u.admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>now()`, digest(c.Value)).Scan(&a.ID, &a.Admin)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				s.reply(w, nil, err)
				return
			}
		}
		if auth && a.ID == "" {
			s.reply(w, nil, unauth)
			return
		}
		data, err := fn(w, r, a)
		s.reply(w, data, err)
	}
}
func (s *Server) reply(w http.ResponseWriter, data any, err error) {
	code := 200
	if err != nil {
		var f failure
		var p *pgconn.PgError
		switch {
		case errors.As(err, &f):
			code = f.code
			data = map[string]string{"error": f.message}
		case errors.Is(err, pgx.ErrNoRows):
			code = 404
			data = map[string]string{"error": "Not found"}
		case errors.As(err, &p) && (p.Code == "23505" || p.Code == "23514" || p.Code == "23503"):
			code = 409
			data = map[string]string{"error": "Record already exists or conflicts with current team rules"}
		default:
			code = 500
			data = map[string]string{"error": "Request failed. Retry shortly."}
			slog.Error("request failed", "type", http.StatusText(code))
		}
	}
	if data == nil {
		data = map[string]bool{"ok": true}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(data)
}
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 32768)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		return bad("Invalid request body")
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		return bad("Only one JSON document allowed")
	}

	return nil
}
func (s *Server) session(ctx context.Context, w http.ResponseWriter, user string) error {
	token := id()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `DELETE FROM sessions WHERE expires_at<=now()`); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')`, digest(token), user); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{Name: "compmate_session", Value: token, Path: "/", HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode, MaxAge: 604800})
	return nil
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (s *Server) signup(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v credentials
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	v.Email = strings.ToLower(strings.TrimSpace(v.Email))
	v.Name = strings.TrimSpace(v.Name)
	parsed, err := mail.ParseAddress(v.Email)
	if err != nil || parsed.Address != v.Email || len(v.Email) > 254 || len(v.Name) < 2 || len(v.Name) > 80 || len(v.Password) < 10 || len(v.Password) > 72 {
		return nil, bad("Use valid email, name (2–80 chars), password (10–72 bytes)")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(v.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user := id()
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(r.Context())
	if _, err = tx.Exec(r.Context(), `INSERT INTO users(id,email,password_hash,admin) VALUES($1,$2,$3,$4)`, user, v.Email, string(hash), false); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(r.Context(), `INSERT INTO profiles(user_id,name) VALUES($1,$2)`, user, v.Name); err != nil {
		return nil, err
	}
	if err = event(r.Context(), tx, user, "signup"); err != nil {
		return nil, err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return nil, err
	}
	if err = s.session(r.Context(), w, user); err != nil {
		return nil, err
	}
	return s.me(w, r, actor{ID: user})
}

// Precomputed valid hash ensures nonexistent users also incur bcrypt verification.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("unused-password-for-timing"), bcrypt.DefaultCost)

func (s *Server) login(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v credentials
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	var user, hash string
	err := s.db.QueryRow(r.Context(), `SELECT id,password_hash FROM users WHERE email=$1`, strings.ToLower(strings.TrimSpace(v.Email))).Scan(&user, &hash)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if hash == "" {
		hash = string(dummyHash)
	}
	check := bcrypt.CompareHashAndPassword([]byte(hash), []byte(v.Password))
	if user == "" || check != nil {
		return nil, failure{401, "Email or password incorrect"}
	}
	if err = s.session(r.Context(), w, user); err != nil {
		return nil, err
	}
	return s.me(w, r, actor{ID: user})
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	if c, err := r.Cookie("compmate_session"); err == nil {
		if _, err = s.db.Exec(r.Context(), `DELETE FROM sessions WHERE token_hash=$1`, digest(c.Value)); err != nil {
			return nil, err
		}
	}
	http.SetCookie(w, &http.Cookie{Name: "compmate_session", Value: "", Path: "/", HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	return nil, nil
}
func (s *Server) me(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	return jsonRow(r.Context(), s.db, `SELECT to_jsonb(p)||jsonb_build_object('id',u.id,'email',u.email,'admin',u.admin) FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`, a.ID)
}

type profileInput struct {
	Name         string          `json:"name"`
	Campus       string          `json:"campus"`
	Skills       string          `json:"skills"`
	Availability string          `json:"availability"`
	About        string          `json:"about"`
	Contact      string          `json:"contact"`
	Share        bool            `json:"share_contact"`
	Presentation json.RawMessage `json:"presentation,omitempty"`
}

func (s *Server) profile(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v profileInput
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(v.Name)) < 2 || len(v.Name) > 80 || len(v.Campus) > 120 || len(v.Skills) > 500 || len(v.About) > 2000 || len(v.Contact) > 300 || len(v.Availability) > 200 {
		return nil, bad("Profile fields exceed limits or name missing")
	}
	if v.Presentation != nil {
		var obj map[string]any
		if json.Unmarshal(v.Presentation, &obj) != nil || obj == nil {
			return nil, bad("Invalid profile presentation")
		}
		delete(obj, "contact")
		delete(obj, "email")
		delete(obj, "share_contact")
		v.Presentation, _ = json.Marshal(obj)
	}
	_, err := s.db.Exec(r.Context(), `UPDATE profiles SET name=$2,campus=$3,skills=$4,availability=$5,about=$6,contact=$7,share_contact=$8,presentation=presentation||coalesce($9::jsonb,'{}') WHERE user_id=$1`, a.ID, v.Name, v.Campus, v.Skills, v.Availability, v.About, v.Contact, v.Share, v.Presentation)
	if err != nil {
		return nil, err
	}
	return s.me(w, r, a)
}
func event(ctx context.Context, tx pgx.Tx, user, kind string) error {
	_, err := tx.Exec(ctx, `INSERT INTO events(id,user_id,kind) VALUES($1,$2,$3)`, id(), user, kind)
	return err
}
func notify(ctx context.Context, tx pgx.Tx, user, team, text string) error {
	_, err := tx.Exec(ctx, `INSERT INTO notifications(id,user_id,team_id,text) VALUES($1,$2,$3,$4)`, id(), user, team, text)
	return err
}

type attemptWindow struct {
	mu    sync.Mutex
	start time.Time
	n     int
}

func (s *Server) verifyPassword(ctx context.Context, user, password string) error {
	var hash string
	if err := s.db.QueryRow(ctx, `SELECT password_hash FROM users WHERE id=$1`, user).Scan(&hash); err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return failure{401, "Password incorrect"}
	}
	return nil
}
