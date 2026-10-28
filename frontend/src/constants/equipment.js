import { lookupLabel } from './lookupLabel'

// What each status and type from the API is called on screen.
// The statuses mirror the database's equipment_status enum, which the Go handler also
// lists, so a new status has to be added in all three places. The tests below catch a
// mismatch with their own lists, but they can't see a new type added in the database.
export const EQUIPMENT_STATUS_LABELS = {
  working_order: 'Working Order',
  needs_repair: 'Needs Repair',
  in_shop: 'In Shop',
}

export const EQUIPMENT_TYPE_LABELS = {
  cart: 'Cart',
  trash_can: 'Trash Can',
  ball_mark_repair_tool: 'Ball Mark Repair Tool',
  sand_tube: 'Ball Marker Eraser (Sand Tube)',
  weed_eater: 'Weed Eater',
  edger: 'Edger',
  blower: 'Blower',
  hole_punch: 'Hole Punch',
  bucket: 'Bucket',
  cup_puller: 'Cup Puller',
  cup_setter: 'Cup Setter',
  dust_pan: 'Dust Pan',
  sand_bucket: 'Sand Bucket w/ Scooper',
  chainsaw: 'Chainsaw',
  gas_can: 'Gas Can',
}

// The status dropdown's choices, in display order
export const EQUIPMENT_STATUS_OPTIONS = Object.entries(EQUIPMENT_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
)

export function formatEquipmentStatus(status) {
  return lookupLabel(EQUIPMENT_STATUS_LABELS, status)
}

export function formatEquipmentType(type) {
  return lookupLabel(EQUIPMENT_TYPE_LABELS, type)
}