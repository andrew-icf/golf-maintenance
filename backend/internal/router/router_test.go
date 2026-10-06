package router_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golf-maintenance/backend/internal/router"
	"golf-maintenance/backend/internal/testutil"
)

func TestCreateUserPermissions(t *testing.T) {
	testutil.SetupTestDB(t)

	adminID := testutil.CreateUser(t, "admin@example.com", "password123", "admin")
	staffID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	adminCookie := testutil.SessionCookie(t, adminID)
	staffCookie := testutil.SessionCookie(t, staffID)

	testCases := []struct {
		name           string
		cookie         *http.Cookie
		expectedStatus int
	}{
		{"no session", nil, http.StatusUnauthorized},
		{"staff user", staffCookie, http.StatusForbidden},
		{"admin user", adminCookie, http.StatusCreated},
	}

	handler := router.New()

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			body := strings.NewReader(`{"email":"new@example.com","password":"password123","full_name":"New Person"}`)
			request := httptest.NewRequest(http.MethodPost, "/users", body)
			request.Header.Set("Content-Type", "application/json")
			if testCase.cookie != nil {
				request.AddCookie(testCase.cookie)
			}

			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)

			if recorder.Code != testCase.expectedStatus {
				t.Errorf("expected status %d, got %d (body: %s)",
					testCase.expectedStatus, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestRequiresSession(t *testing.T) {
	testutil.SetupTestDB(t)

	userID := testutil.CreateUser(t, "staff@example.com", "password123", "staff")
	cookie := testutil.SessionCookie(t, userID)
	handler := router.New()

	withoutCookie := httptest.NewRecorder()
	handler.ServeHTTP(withoutCookie, httptest.NewRequest(http.MethodGet, "/me", nil))
	if withoutCookie.Code != http.StatusUnauthorized {
		t.Errorf("without a session: expected 401, got %d", withoutCookie.Code)
	}

	withCookie := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/me", nil)
	request.AddCookie(cookie)
	handler.ServeHTTP(withCookie, request)
	if withCookie.Code != http.StatusOK {
		t.Errorf("with a session: expected 200, got %d", withCookie.Code)
	}
}
