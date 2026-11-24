package formation

import (
	"encoding/json"
	"testing"
)

func TestProfilePresentationKeepsOnlyEditableFields(t *testing.T) {
	raw := `{"program":" CS ","roles":["Developer","developer"," "],"mutual":999,"connections":5000,"complete":1,"contact":"x","links":[{"label":"LinkedIn","value":"https://linkedin.com/in/x"}]}`
	clean, err := profilePresentation(json.RawMessage(raw))
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	_ = json.Unmarshal(clean, &got)
	for _, k := range []string{"mutual", "connections", "complete", "contact"} {
		if _, ok := got[k]; ok {
			t.Fatalf("%s must be dropped: %s", k, clean)
		}
	}
	if got["program"] != "CS" || len(got["roles"].([]any)) != 1 {
		t.Fatalf("unexpected cleanup: %s", clean)
	}
	for _, bad := range []string{
		`{"links":[{"label":"Portfolio","value":"https://not%20a%20url/"}]}`,
		`{"links":[{"label":"Portfolio","value":"javascript:alert(1)"}]}`,
		`{"level":"Wizard"}`,
		`[]`,
	} {
		if _, err := profilePresentation(json.RawMessage(bad)); err == nil {
			t.Fatalf("accepted %s", bad)
		}
	}
}
