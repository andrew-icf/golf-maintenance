package auth

import (
	"log"
	"net/http"

	"golf-maintenance/backend/internal/db"
)

// ClockInRequiredMessage is what a refused request is told. The frontend will recognize it
// to bring up the clock-in screen, so changing the wording means changing it there too.
const ClockInRequiredMessage = "clock in required"

// RequireClockedIn lets a request through only when the person is on the clock, meaning they
// have a clock entry with no clock-out yet. Admins are exempt. It must run after
// RequireAuth, which says who is asking.
func RequireClockedIn(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := UserIDFromContext(r.Context())
		if !ok {
			http.Error(w, "not authenticated", http.StatusUnauthorized)
			return
		}

		// One query answers both questions: what role this person has, and whether they
		// have an open clock entry
		var role string
		var isClockedIn bool
		err := db.Pool.QueryRow(
			r.Context(),
			`SELECT users.role,
			        EXISTS (
			            SELECT 1 FROM clock_entries
			            WHERE clock_entries.user_id = users.id AND clock_entries.clock_out IS NULL
			        )
			 FROM users
			 WHERE users.id = $1`,
			userID,
		).Scan(&role, &isClockedIn)
		if err != nil {
			log.Printf("error checking clock status: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if role != "admin" && !isClockedIn {
			http.Error(w, ClockInRequiredMessage, http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
