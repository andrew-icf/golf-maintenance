package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"golf-maintenance/backend/internal/db"
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Go backend running on :%s", port)
	if err := http.ListenAndServe(":"+port, router.New()); err != nil {
		log.Fatal(err)
	}
}
