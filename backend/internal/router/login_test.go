package router_test

import (
	"net/http"
	"testing"

	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

func TestLogin_SucceedsWithCorrectPassword(t *testing.T) {
	testutil.SetupTestDB(t)
	testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	handler := router.New()

	recorder := sendRequest(handler, http.MethodPost, "/login",
		`{"email":"staff@example.com","password":"password123"}`, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}

	var sessionCookie *http.Cookie
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == "session_token" {
			sessionCookie = cookie
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected a session_token cookie to be set")
	}
	if !sessionCookie.HttpOnly {
		t.Error("session cookie must be HttpOnly")
	}
}

func TestLogin_RejectsBadCredentialsWithIdenticalResponses(t *testing.T) {
	testutil.SetupTestDB(t)
	testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	handler := router.New()

	wrongPassword := sendRequest(handler, http.MethodPost, "/login",
		`{"email":"staff@example.com","password":"wrongpassword"}`, nil)
	unknownEmail := sendRequest(handler, http.MethodPost, "/login",
		`{"email":"nobody@example.com","password":"password123"}`, nil)

	if wrongPassword.Code != http.StatusUnauthorized {
		t.Errorf("wrong password: expected 401, got %d", wrongPassword.Code)
	}
	if unknownEmail.Code != http.StatusUnauthorized {
		t.Errorf("unknown email: expected 401, got %d", unknownEmail.Code)
	}
	if wrongPassword.Body.String() != unknownEmail.Body.String() {
		t.Error("the two failure responses must be identical so attackers can't tell which emails exist")
	}
}
