package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type Pinger interface {
	Ping(context.Context) error
}

// Liveness reports process health; readiness also requires a reachable DB.
func New(db Pinger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		respond(w, http.StatusOK, "ok")
	})
	mux.HandleFunc("GET /api/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			respond(w, http.StatusServiceUnavailable, "database_unavailable")
			return
		}
		respond(w, http.StatusOK, "ready")
	})
	return mux
}

func respond(w http.ResponseWriter, code int, status string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": status})
}
