package formation

import (
	"log/slog"
	"net/http"
	"time"
)

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) { w.status = code; w.ResponseWriter.WriteHeader(code) }

// Logs route patterns, duration and status only. No cookies, bodies, email or contact data.
func monitor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, status: 200}
		requestID := id()
		w.Header().Set("X-Request-ID", requestID)
		defer func() {
			if recover() != nil {
				slog.Error("request panic", "request_id", requestID)
				http.Error(rw, "Internal server error", 500)
			}
			if rw.status >= 500 {
				slog.Error("http request failed", "request_id", requestID, "route", r.Pattern, "status", rw.status, "duration_ms", time.Since(start).Milliseconds())
			}
		}()
		next.ServeHTTP(rw, r)
	})
}
func (s *Server) clientError(w http.ResponseWriter, r *http.Request, a actor) (any, error) {
	var v struct {
		Code string `json:"code"`
	}
	if err := decode(w, r, &v); err != nil {
		return nil, err
	}
	if v.Code != "render_failure" {
		return nil, bad("Unknown error code")
	}
	slog.Error("client render failure", "request_id", w.Header().Get("X-Request-ID"))
	return nil, nil
}
