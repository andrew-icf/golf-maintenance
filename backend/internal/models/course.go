package models

import "time"

type Course struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	Holes     []Hole    `json:"holes"`
	Amenities []Amenity `json:"amenities"`
}

type Hole struct {
	ID         string `json:"id"`
	HoleNumber int    `json:"hole_number"`
	Par        int    `json:"par"`
	Yardage    *int   `json:"yardage"`
}

type Amenity struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}
