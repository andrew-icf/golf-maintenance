package router_test

import (
	"net/http"
	"net/http/httptest"
	"strings"

	"encoding/json"
	"testing"
)

func sendRequest(handler http.Handler, method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		request.AddCookie(cookie)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func decodeJSONObject(t *testing.T, responseBody []byte) map[string]any {
	t.Helper()
	var decoded map[string]any
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		t.Fatalf("could not decode response %q: %v", string(responseBody), err)
	}
	return decoded
}
