// What each status and type from the API is called on screen.
// The statuses mirror the database's equipment_status enum, which the Go handler also
// lists, so a new status has to be added in all three places.
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

// A value with no label is shown as it arrived, so a missing label is visible instead of
// blank. Anything that isn't text shows nothing.
function lookupLabel(labels, value) {
  if (typeof value !== 'string') {
    return ''
  }
  return Object.hasOwn(labels, value) ? labels[value] : value
}

export function formatEquipmentStatus(status) {
  return lookupLabel(EQUIPMENT_STATUS_LABELS, status)
}

export function formatEquipmentType(type) {
  return lookupLabel(EQUIPMENT_TYPE_LABELS, type)
}