package auth

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

const (
	MinPasswordLength = 8
	// bcrypt reads only the first 72 bytes of a password and the library refuses anything
	// longer, so a longer one has to be turned away up front
	MaxPasswordBytes = 72
)

// ValidateNewPassword says what is wrong with a password someone wants to switch to, or
// returns an empty string when it is fine. The minimum counts characters, so a password in
// another alphabet isn't penalized, and the maximum counts bytes, since that is bcrypt's limit.
func ValidateNewPassword(newPassword, currentPassword string) string {
	switch {
	case utf8.RuneCountInString(newPassword) < MinPasswordLength:
		return fmt.Sprintf("new password must be at least %d characters", MinPasswordLength)
	case strings.TrimSpace(newPassword) == "":
		return "new password cannot be only spaces"
	case len(newPassword) > MaxPasswordBytes:
		return fmt.Sprintf(
			"new password is too long: at most %d bytes (some characters count as more than one)",
			MaxPasswordBytes,
		)
	case newPassword == currentPassword:
		return "new password must be different from the current password"
	}

	return ""
}
