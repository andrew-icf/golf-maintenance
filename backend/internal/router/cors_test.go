package router_test

import (
	"net/http"
	"testing"

	"golf-maintenance/backend/internal/router"
)

// The browser sends a preflight before a cross-origin PUT or DELETE, without the session
// cookie, so it must be answered before any login check
func TestCORS_AnswersThePreflightWithoutASession(t *testing.T) {
	setUpStaff(t)
	t.Setenv("ALLOWED_ORIGIN", "http://tatooine.example")
	handler := router.New()

	recorder := sendRequest(handler, http.MethodOptions, "/api/equipment/"+nonexistentID, "", nil)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	expectedHeaders := map[string]string{
		"Access-Control-Allow-Origin":      "http://tatooine.example",
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Methods":     "GET, POST, PUT, DELETE, OPTIONS",
		"Access-Control-Allow-Headers":     "Content-Type",
	}
	for name, expected := range expectedHeaders {
		if actual := recorder.Header().Get(name); actual != expected {
			t.Errorf("expected %s %q, got %q", name, expected, actual)
		}
	}
}

func TestCORS_AllowsTheLocalFrontendWhenNoOriginIsSet(t *testing.T) {
	setUpStaff(t)
	t.Setenv("ALLOWED_ORIGIN", "")
	handler := router.New()

	recorder := sendRequest(handler, http.MethodGet, "/health", "", nil)

	if origin := recorder.Header().Get("Access-Control-Allow-Origin"); origin != "http://localhost:5173" {
		t.Errorf("expected the default origin http://localhost:5173, got %q", origin)
	}
}
