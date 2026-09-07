package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/handlers"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on environment variables")
	}

	if err := db.Connect(); err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Pool.Close()

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "message": "Hello from Go backend!"})
	})

	http.HandleFunc("/users", handlers.CreateUser)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Go backend running on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
