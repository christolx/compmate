package formation

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestCompetitionValidationNamesTheField(t *testing.T) {
	now := time.Date(2026, 11, 24, 0, 0, 0, 0, time.UTC)
	ok := competitionInput{Title: "Hack", Organizer: "Uni", URL: "https://uni.edu/hack", Deadline: now.AddDate(0, 1, 0), Min: 2, Max: 4}
	if err := ok.validate(true, now); err != nil {
		t.Fatal(err)
	}
	cases := map[string]func(*competitionInput){
		"future":    func(v *competitionInput) { v.Deadline = now.AddDate(-6, 0, 0) },
		"two years": func(v *competitionInput) { v.Deadline = time.Date(9999, 1, 1, 0, 0, 0, 0, time.UTC) },
		"https":     func(v *competitionInput) { v.URL = "http://uni.edu" },
		"Maximum":   func(v *competitionInput) { v.Min, v.Max = 5, 3 },
	}
	for want, mutate := range cases {
		v := ok
		mutate(&v)
		if err := v.validate(true, now); err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("%s: got %v", want, err)
		}
	}
	past := ok
	past.Deadline = now.Add(-time.Hour)
	if err := past.validate(false, now); err != nil {
		t.Fatalf("editing may close a listing: %v", err)
	}
}

func TestCompetitionPresentation(t *testing.T) {
	raw, err := competitionPresentation(json.RawMessage(`{"cat":"Hackathon","loc":"Hybrid","fee":50000,"event":"2026-12-20","skills":["React"," ",""]}`))
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	_ = json.Unmarshal(raw, &got)
	if got["cat"] != "Hackathon" || got["loc"] != "Hybrid" || len(got["skills"].([]any)) != 1 {
		t.Fatalf("unexpected: %s", raw)
	}
	for _, bad := range []string{`{"loc":"Moon"}`, `{"fee":-1}`, `{"event":"20/12/2026"}`, `{"poster":"http://x.y/p.png"}`, `{"teamsCount":99}`} {
		if _, err := competitionPresentation(json.RawMessage(bad)); err == nil {
			t.Fatalf("accepted %s", bad)
		}
	}
}
