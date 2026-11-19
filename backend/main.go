package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"

	"golf-maintenance/backend/internal/db"
	"golf-maintenance/backend/internal/jobs"
	"golf-maintenance/backend/internal/router"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on environment variables")
	}

	if err := db.Connect(); err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Pool.Close()

	// Marks are only kept for 14 days, so old ones are deleted when the server starts and then once a day
	go jobs.RunEvery(context.Background(), 24*time.Hour, jobs.CleanUpOldMarks)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Go backend running on :%s", port)
	if err := http.ListenAndServe(":"+port, router.New()); err != nil {
		log.Fatal(err)
	}
}
