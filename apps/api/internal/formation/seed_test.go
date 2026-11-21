package formation

import (
	"testing"
	"time"
)

func TestSeedScheduleKeepsSpacingRelativeToNow(t *testing.T) {
	c := map[string]any{"open": "2026-09-21", "deadline": "2026-10-09", "event": "2026-10-30",
		"timeline": []any{map[string]any{"label": "Final", "date": "2026-10-30"}}}
	now := time.Date(2026, 11, 21, 10, 0, 0, 0, time.UTC)
	_, deadline, err := seedSchedule(c, now)
	if err != nil {
		t.Fatal(err)
	}
	if c["deadline"] != "2026-11-24" || c["open"] != "2026-11-06" || c["event"] != "2026-12-15" {
		t.Fatalf("unexpected shift: %v", c)
	}
	if c["timeline"].([]any)[0].(map[string]any)["date"] != "2026-12-15" {
		t.Fatal("timeline not shifted")
	}
	if !deadline.Equal(time.Date(2026, 11, 24, 17, 0, 0, 0, time.UTC)) || !deadline.After(now) {
		t.Fatalf("deadline %v", deadline)
	}
	before := map[string]any{"deadline": "2026-10-09"}
	if _, _, err := seedSchedule(before, seedAnchor.AddDate(0, 0, -5)); err != nil || before["deadline"] != "2026-10-09" {
		t.Fatal("dates must not move backwards")
	}
}
