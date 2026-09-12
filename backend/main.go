package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

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

	http.HandleFunc("/health", middleware.CORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "Hello from Go backend!"})
	}))

	http.HandleFunc("/users", middleware.CORS(handlers.CreateUser))
	http.HandleFunc("/login", middleware.CORS(handlers.Login))
	http.HandleFunc("/logout", middleware.CORS(handlers.Logout))
	http.HandleFunc("/me", middleware.CORS(auth.RequireAuth(handlers.Me)))
	http.HandleFunc("/clock-in", middleware.CORS(auth.RequireAuth(handlers.ClockIn)))
	http.HandleFunc("/clock-out", middleware.CORS(auth.RequireAuth(handlers.ClockOut)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Go backend running on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
