package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"

	"golf-maintenance/backend/internal/auth"
	"golf-maintenance/backend/internal/db"
)

type createUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

func CreateUser(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" || req.FullName == "" {
		http.Error(w, "email, password, and full_name are required", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("error hashing password: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	role := req.Role
	if role == "" {
		role = "staff"
	}

	var id string
	err = db.Pool.QueryRow(
		r.Context(),
		`INSERT INTO users (email, password_hash, full_name, role)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		req.Email, string(hash), req.FullName, role,
	).Scan(&id)

	if err != nil {
		log.Printf("error creating user: %v", err)
		http.Error(w, "could not create user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"id":      id,
		"email":   req.Email,
		"message": "user created",
	})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "email and password are required", http.StatusBadRequest)
		return
	}

	var id, passwordHash, fullName, role string
	err := db.Pool.QueryRow(
		r.Context(),
		`SELECT id, password_hash, full_name, role FROM users WHERE email = $1`,
		req.Email,
	).Scan(&id, &passwordHash, &fullName, &role)

	if err != nil {
		// Deliberately vague — don't reveal whether the email exists or not
		http.Error(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		http.Error(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	token, expiresAt, err := auth.CreateSession(r.Context(), id)
	if err != nil {
		log.Printf("error creating session: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Expires:  expiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	})

	json.NewEncoder(w).Encode(map[string]string{
		"id":        id,
		"email":     req.Email,
		"full_name": fullName,
		"role":      role,
		"message":   "login successful",
	})
}

func Logout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_token")
	if err == nil {
		_, _ = db.Pool.Exec(r.Context(), `DELETE FROM sessions WHERE token = $1`, cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	json.NewEncoder(w).Encode(map[string]string{"message": "logged out"})
}
func Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return
	}

	var email, fullName, role string
	err := db.Pool.QueryRow(
		r.Context(),
		`SELECT email, full_name, role FROM users WHERE id = $1`,
		userID,
	).Scan(&email, &fullName, &role)

	if err != nil {
		log.Printf("error fetching user: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	var clockedIn bool
	err = db.Pool.QueryRow(
		r.Context(),
		`SELECT EXISTS(SELECT 1 FROM clock_entries WHERE user_id = $1 AND clock_out IS NULL)`,
		userID,
	).Scan(&clockedIn)

	if err != nil {
		log.Printf("error checking clock status: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         userID,
		"email":      email,
		"full_name":  fullName,
		"role":       role,
		"clocked_in": clockedIn,
	})
}
