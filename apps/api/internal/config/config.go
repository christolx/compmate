package config

import (
	"errors"
	"net"
	"os"
)

type Config struct {
	HTTPAddr    string
	DatabaseURL string
}

func Load() (Config, error) {
	return load(os.Getenv)
}

func load(env func(string) string) (Config, error) {
	c := Config{HTTPAddr: env("HTTP_ADDR"), DatabaseURL: env("DATABASE_URL")}
	if c.HTTPAddr == "" {
		c.HTTPAddr = "127.0.0.1:8080"
	}
	if _, _, err := net.SplitHostPort(c.HTTPAddr); err != nil {
		return Config{}, errors.New("HTTP_ADDR must use host:port format")
	}
	if c.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	return c, nil
}
