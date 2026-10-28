package models

import "time"

// A club, with its courses (layouts), holes, and amenities.
// Holes is every hole in play order. It's kept only so the frontend keeps working
// until it reads layouts, and it goes away once the frontend has moved over.
type Course struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	Layouts   []Layout  `json:"layouts"`
	Holes     []Hole    `json:"holes"`
	Amenities []Amenity `json:"amenities"`
}

// A layout is one playable course within a club ("Course A"). A club with a single
// course has one layout holding all of its holes.
type Layout struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Code           *string `json:"code"`
	Position       int     `json:"position"`
	FrontHoleCount *int    `json:"front_hole_count"`
	Holes          []Hole  `json:"holes"`
}

type Hole struct {
	ID         string `json:"id"`
	LayoutID   string `json:"layout_id"`
	HoleNumber int    `json:"hole_number"`
	Par        int    `json:"par"`
	Yardage    *int   `json:"yardage"`
}

type Amenity struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Type   string  `json:"type"`
	HoleID *string `json:"hole_id"`
}
