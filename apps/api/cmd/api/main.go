package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"compmate/api/internal/config"
	"compmate/api/internal/httpapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	if err := run(); err != nil {
		slog.Error("API stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		// Parser errors may contain credentials; return a safe config error.
		return errors.New("DATABASE_URL is invalid")
	}
	poolCfg.MaxConns = 10
	poolCfg.ConnConfig.ConnectTimeout = 3 * time.Second
	db, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return errors.New("database pool initialization failed")
	}
	defer db.Close()

	server := &http.Server{
		Addr: cfg.HTTPAddr, Handler: httpapi.New(db),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second, WriteTimeout: 10 * time.Second,
		IdleTimeout: 60 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		slog.Info("API listening", "addr", cfg.HTTPAddr)
		errCh <- server.ListenAndServe()
	}()
	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
	return nil
}
