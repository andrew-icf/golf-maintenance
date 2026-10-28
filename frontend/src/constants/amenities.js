import { lookupLabel } from './lookupLabel'

// What each amenity type from the API is called on screen. The type is free text in the
// database, so one with no label here is shown as it arrived, which makes the gap visible.
export const AMENITY_TYPE_LABELS = {
  clubhouse: 'Clubhouse',
  driving_range: 'Driving range',
  comfort_station: 'Comfort station',
  pool: 'Pool',
  tennis_court: 'Tennis court',
}

export function formatAmenityType(type) {
  return lookupLabel(AMENITY_TYPE_LABELS, type)
}