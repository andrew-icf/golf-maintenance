package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/joho/godotenv"

	"golf-maintenance/backend/internal/auth"
	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/handlers"
	"golf-maintenance/backend/internal/middleware"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on environment variables")
	}

	if err := db.Connect(); err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Pool.Close()

	r := chi.NewRouter()
	r.Use(middleware.CORS)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "Hello from Go backend!"})
	})

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
		r.Get("/api/schedule", handlers.GetSchedules)
		// Applies middleware to a single route inline
		r.With(auth.RequireRole("admin")).Put("/api/equipment/{id}", handlers.UpdateEquipmentStatus)
		r.With(auth.RequireRole("admin")).Post("/api/schedule", handlers.CreateSchedule)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Go backend running on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
