package auth_test

import (
	"strings"
	"testing"

	"golf-maintenance/backend/internal/auth"
)

// Test data
const currentPassword = "password123"

const (
	tooShortMessage   = "new password must be at least 8 characters"
	tooLongMessage    = "new password is too long: at most 72 bytes (some characters count as more than one)"
	onlySpacesMessage = "new password cannot be only spaces"
	sameMessage       = "new password must be different from the current password"
)

var acceptedPasswords = []struct {
	name        string
	replacement string
}{
	{"eight plain characters", "abcd1234"},
	{"eight characters that take two bytes each", strings.Repeat("é", 8)},
	{"exactly 72 bytes", strings.Repeat("a", 72)},
	{"72 bytes made of two-byte characters", strings.Repeat("é", 36)},
	{"a passphrase with spaces", "correct horse battery"},
	{"spaces around real characters", " abcdefgh "},
	{"the current password in another case", "Password123"},
}

var refusedPasswords = []struct {
	name        string
	replacement string
	expected    string
}{
	{"nothing", "", tooShortMessage},
	{"seven plain characters", "abc1234", tooShortMessage},
	{"seven characters that take two bytes each", strings.Repeat("é", 7), tooShortMessage},
	{"73 bytes", strings.Repeat("a", 73), tooLongMessage},
	{"37 two-byte characters, which is 74 bytes", strings.Repeat("é", 37), tooLongMessage},
	{"25 three-byte characters, which is 75 bytes", strings.Repeat("日", 25), tooLongMessage},
	{"ten spaces", strings.Repeat(" ", 10), onlySpacesMessage},
	{"eight tabs", strings.Repeat("\t", 8), onlySpacesMessage},
	{"the current password", currentPassword, sameMessage},
}

func TestValidateNewPassword_AcceptsPasswordsThatMeetTheRules(t *testing.T) {
	for _, testCase := range acceptedPasswords {
		t.Run(testCase.name, func(t *testing.T) {
			if problem := auth.ValidateNewPassword(testCase.replacement, currentPassword); problem != "" {
				t.Errorf("expected it to be accepted, got %q", problem)
			}
		})
	}
}

func TestValidateNewPassword_RefusesPasswordsThatBreakTheRules(t *testing.T) {
	for _, testCase := range refusedPasswords {
		t.Run(testCase.name, func(t *testing.T) {
			if problem := auth.ValidateNewPassword(testCase.replacement, currentPassword); problem != testCase.expected {
				t.Errorf("expected %q, got %q", testCase.expected, problem)
			}
		})
	}
}

func TestValidateNewPassword_ChecksLengthBeforeSameness(t *testing.T) {
	// A short password that is also the current one is told it is too short, not the same
	problem := auth.ValidateNewPassword("short", "short")

	if problem != tooShortMessage {
		t.Errorf("expected %q, got %q", tooShortMessage, problem)
	}
}
