package config

import "testing"

func TestLoad(t *testing.T) {
	for _, tc := range []struct {
		name string
		env  map[string]string
		bad  bool
	}{
		{"missing database", nil, true},
		{"bad address", map[string]string{"HTTP_ADDR": "8080", "DATABASE_URL": "postgres://localhost/compmate"}, true},
		{"default address", map[string]string{"DATABASE_URL": "postgres://localhost/compmate"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := load(func(key string) string { return tc.env[key] })
			if (err != nil) != tc.bad {
				t.Fatalf("unexpected error: %v", err)
			}
			if !tc.bad && cfg.HTTPAddr != "127.0.0.1:8080" {
				t.Fatalf("unexpected default address: %s", cfg.HTTPAddr)
			}
		})
	}
}
