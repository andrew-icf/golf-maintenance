package router_test

import (
	"context"
	"net/http"
	"reflect"
	"testing"

	"golf-maintenance/backend/internal/db"
)

// ---- Test data and helpers ----

func insertEquipment(t *testing.T, courseID, equipmentType, label, status string) string {
	t.Helper()
	return insertedID(t,
		`INSERT INTO equipment (course_id, type, label, status)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		courseID, equipmentType, label, status,
	)
}

func storedEquipmentStatus(t *testing.T, equipmentID string) string {
	t.Helper()
	var status string
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT status::text FROM equipment WHERE id = $1`,
		equipmentID,
	).Scan(&status)
	if err != nil {
		t.Fatalf("could not load equipment %s: %v", equipmentID, err)
	}
	return status
}

func updateStatusPath(equipmentID string) string {
	return "/api/equipment/" + equipmentID
}

// ---- Listing ----

func TestGetEquipment_ListsEveryItemSortedByLabel(t *testing.T) {
	staff := setUpClockedInStaff(t)
	courseID := insertCourse(t, testClubName)
	// Inserted out of order, so a sorted response can only come from the handler
	insertEquipment(t, courseID, "mower", "Mower 2", "in_shop")
	insertEquipment(t, courseID, "cart", "Cart 1", "working_order")
	insertEquipment(t, courseID, "mower", "Mower 1", "needs_repair")

	recorder := sendRequest(staff.handler, http.MethodGet, "/api/equipment", "", staff.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}

	type listedItem struct{ Label, Type, Status string }
	listed := []listedItem{}
	for _, item := range decodeJSONList(t, recorder.Body.Bytes()) {
		label, _ := item["label"].(string)
		equipmentType, _ := item["type"].(string)
		status, _ := item["status"].(string)
		listed = append(listed, listedItem{label, equipmentType, status})
	}

	expected := []listedItem{
		{"Cart 1", "cart", "working_order"},
		{"Mower 1", "mower", "needs_repair"},
		{"Mower 2", "mower", "in_shop"},
	}
	if !reflect.DeepEqual(listed, expected) {
		t.Errorf("expected %+v, got %+v", expected, listed)
	}
}

// The frontend maps over the list, so no equipment must be an empty array, not null
func TestGetEquipment_NoEquipmentIsAnEmptyList(t *testing.T) {
	staff := setUpClockedInStaff(t)

	recorder := sendRequest(staff.handler, http.MethodGet, "/api/equipment", "", staff.cookie)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
	if body := recorder.Body.String(); body != "[]\n" {
		t.Errorf("expected an empty JSON array, got %q", body)
	}
}

// ---- Updating the status ----

func TestUpdateEquipmentStatus_AcceptsEveryAllowedStatus(t *testing.T) {
	staff := setUpClockedInStaff(t)
	courseID := insertCourse(t, testClubName)

	// Each status is set on an item that starts in a different one, so the change is visible
	testCases := []struct {
		startingStatus string
		newStatus      string
	}{
		{"in_shop", "working_order"},
		{"working_order", "needs_repair"},
		{"needs_repair", "in_shop"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.newStatus, func(t *testing.T) {
			equipmentID := insertEquipment(t, courseID, "mower", "Mower "+testCase.newStatus, testCase.startingStatus)

			body := `{"status":"` + testCase.newStatus + `"}`
			recorder := sendRequest(staff.handler, http.MethodPut, updateStatusPath(equipmentID), body, staff.cookie)

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
			response := decodeJSONObject(t, recorder.Body.Bytes())
			if response["id"] != equipmentID || response["status"] != testCase.newStatus {
				t.Errorf("expected id %s and status %s in the response, got %v", equipmentID, testCase.newStatus, response)
			}
			if stored := storedEquipmentStatus(t, equipmentID); stored != testCase.newStatus {
				t.Errorf("expected the stored status %s, got %s", testCase.newStatus, stored)
			}
		})
	}
}

func TestUpdateEquipmentStatus_RejectsInvalidRequests(t *testing.T) {
	staff := setUpClockedInStaff(t)
	equipmentID := insertEquipment(t, insertCourse(t, testClubName), "mower", "Mower 1", "working_order")

	testCases := []struct {
		name string
		body string
	}{
		{"a status that is not allowed", `{"status":"broken"}`},
		{"no status", `{}`},
		{"a status in the wrong case", `{"status":"Needs_Repair"}`},
		{"a body that is not JSON", `{"status":`},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := sendRequest(staff.handler, http.MethodPut, updateStatusPath(equipmentID), testCase.body, staff.cookie)
			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}

	if stored := storedEquipmentStatus(t, equipmentID); stored != "working_order" {
		t.Errorf("invalid requests must not change the status, but it is now %s", stored)
	}
}

func TestUpdateEquipmentStatus_UnknownEquipmentIsNotFound(t *testing.T) {
	staff := setUpClockedInStaff(t)

	for _, equipmentID := range []string{nonexistentID, "not-a-uuid"} {
		t.Run(equipmentID, func(t *testing.T) {
			recorder := sendRequest(staff.handler, http.MethodPut, updateStatusPath(equipmentID), `{"status":"in_shop"}`, staff.cookie)
			if recorder.Code != http.StatusNotFound {
				t.Errorf("expected 404, got %d (body: %s)", recorder.Code, recorder.Body.String())
			}
		})
	}
}
