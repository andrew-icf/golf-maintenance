package router

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"golf-maintenance/backend/internal/auth"
	"golf-maintenance/backend/internal/handlers"
	"golf-maintenance/backend/internal/middleware"
)

func New() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.CORS)

	r.Get("/health", healthHandler)

	r.Post("/login", handlers.Login)
	r.Post("/logout", handlers.Logout)
	r.With(auth.RequireAuth, auth.RequireRole("admin")).Post("/users", handlers.CreateUser)

	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Get("/me", handlers.Me)
		r.Post("/clock-in", handlers.ClockIn)
		r.Post("/clock-out", handlers.ClockOut)
		r.Get("/api/course", handlers.GetCourse)
		r.Get("/api/equipment", handlers.GetEquipment)
		r.Put("/api/equipment/{id}", handlers.UpdateEquipmentStatus)
		r.Get("/api/schedule", handlers.GetSchedules)
		// Applies middleware to a single route inline
		r.With(auth.RequireRole("admin")).Post("/api/schedule", handlers.CreateSchedule)
		r.With(auth.RequireRole("admin")).Get("/api/users", handlers.ListUsers)
		r.With(auth.RequireRole("admin")).Post("/api/schedule/repeat", handlers.RepeatSchedule)
		r.With(auth.RequireRole("admin")).Put("/api/schedule/{id}", handlers.UpdateSchedule)
		r.With(auth.RequireRole("admin")).Delete("/api/schedule", handlers.DeleteSchedules)
	})

	return r
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "Hello from Go Golf backend!"})
}
