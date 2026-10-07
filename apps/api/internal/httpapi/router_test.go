package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeDB struct {
	err   error
	calls int
}

func (db *fakeDB) Ping(ctx context.Context) error {
	db.calls++
	if _, ok := ctx.Deadline(); !ok {
		panic("readiness must bound DB ping")
	}
	return db.err
}

func TestHealthIndependentOfDatabase(t *testing.T) {
	db := &fakeDB{err: errors.New("offline")}
	res := httptest.NewRecorder()
	New(db).ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/api/health", nil))
	if res.Code != http.StatusOK || db.calls != 0 {
		t.Fatalf("health = %d, DB calls = %d", res.Code, db.calls)
	}
}

func TestReadiness(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		code int
		body string
	}{
		{"online", nil, 200, "{\"status\":\"ready\"}\n"},
		{"offline", errors.New("private connection details"), 503, "{\"status\":\"database_unavailable\"}\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := &fakeDB{err: tc.err}
			res := httptest.NewRecorder()
			New(db).ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/api/ready", nil))
			if res.Code != tc.code || res.Body.String() != tc.body || db.calls != 1 {
				t.Fatalf("readiness = %d %q; calls = %d", res.Code, res.Body.String(), db.calls)
			}
			if res.Header().Get("Content-Type") != "application/json" {
				t.Fatal("readiness response must be JSON")
			}
		})
	}
}
