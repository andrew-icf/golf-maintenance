package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"golang.org/x/crypto/bcrypt"

	"golf-maintenance/backend/internal/auth"
	"golf-maintenance/backend/internal/db"
)

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// ChangePassword lets a logged-in person replace their own password. It needs the current
// password, so someone who finds a signed-in tablet can't lock the owner out. The person's other
// sessions end, so a lost phone stops working, and this one stays signed in. It is open to
// anyone logged in, on the clock or not.
func ChangePassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	sessionCookie, err := r.Cookie("session_token")
	if err != nil {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return
	}

	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		http.Error(w, "current_password and new_password are required", http.StatusBadRequest)
		return
	}
	if problem := auth.ValidateNewPassword(req.NewPassword, req.CurrentPassword); problem != "" {
		http.Error(w, problem, http.StatusBadRequest)
		return
	}

	var passwordHash string
	err = db.Pool.QueryRow(
		r.Context(),
		`SELECT password_hash FROM users WHERE id = $1`,
		userID,
	).Scan(&passwordHash)
	if err != nil {
		log.Printf("error loading password hash: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	// A wrong password is a 403, not a 401: the app reads a 401 as "your session is gone"
	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.CurrentPassword))
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		http.Error(w, "current password is incorrect", http.StatusForbidden)
		return
	}
	if err != nil {
		log.Printf("error comparing passwords: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("error hashing password: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	// The new password and the end of the other sessions happen together or not at all
	transaction, err := db.Pool.Begin(r.Context())
	if err != nil {
		log.Printf("error starting transaction: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer transaction.Rollback(r.Context())

	if _, err := transaction.Exec(
		r.Context(),
		`UPDATE users SET password_hash = $1 WHERE id = $2`,
		string(newHash), userID,
	); err != nil {
		log.Printf("error saving password: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if _, err := transaction.Exec(
		r.Context(),
		`DELETE FROM sessions WHERE user_id = $1 AND token <> $2`,
		userID, sessionCookie.Value,
	); err != nil {
		log.Printf("error ending other sessions: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if err := transaction.Commit(r.Context()); err != nil {
		log.Printf("error committing password change: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "password changed"})
}
