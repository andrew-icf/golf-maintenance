import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUS_OPTIONS,
  EQUIPMENT_TYPE_LABELS,
  formatEquipmentStatus,
  formatEquipmentType,
} from './equipment'

// Test data. The statuses mirror the database's equipment_status enum, in dropdown order.
const BACKEND_STATUSES = ['working_order', 'needs_repair', 'in_shop']

const STATUS_LABEL_CASES = [
  { status: 'working_order', label: 'Working Order' },
  { status: 'needs_repair', label: 'Needs Repair' },
  { status: 'in_shop', label: 'In Shop' },
]

const TYPE_LABEL_CASES = [
  { type: 'cart', label: 'Cart' },
  { type: 'trash_can', label: 'Trash Can' },
  { type: 'ball_mark_repair_tool', label: 'Ball Mark Repair Tool' },
  { type: 'sand_tube', label: 'Ball Marker Eraser (Sand Tube)' },
  { type: 'weed_eater', label: 'Weed Eater' },
  { type: 'edger', label: 'Edger' },
  { type: 'blower', label: 'Blower' },
  { type: 'hole_punch', label: 'Hole Punch' },
  { type: 'bucket', label: 'Bucket' },
  { type: 'cup_puller', label: 'Cup Puller' },
  { type: 'cup_setter', label: 'Cup Setter' },
  { type: 'dust_pan', label: 'Dust Pan' },
  { type: 'sand_bucket', label: 'Sand Bucket w/ Scooper' },
  { type: 'chainsaw', label: 'Chainsaw' },
  { type: 'gas_can', label: 'Gas Can' },
]

// Values neither lookup table has a label for
const UNKNOWN_VALUE_CASES = [
  { label: 'an unknown name', value: 'forklift', expected: 'forklift' },
  { label: 'a name every object inherits', value: 'constructor', expected: 'constructor' },
  { label: 'the prototype key', value: '__proto__', expected: '__proto__' },
  { label: 'an empty string', value: '', expected: '' },
  { label: 'null', value: null, expected: '' },
  { label: 'undefined', value: undefined, expected: '' },
]

const FORMATTERS = [
  { name: 'formatEquipmentStatus', format: formatEquipmentStatus },
  { name: 'formatEquipmentType', format: formatEquipmentType },
]

describe('equipment status labels', () => {
  it('covers exactly the statuses the database allows, in dropdown order', () => {
    expect(Object.keys(EQUIPMENT_STATUS_LABELS)).toEqual(BACKEND_STATUSES)
  })

  it.each(STATUS_LABEL_CASES)('writes $status as "$label"', ({ status, label }) => {
    expect(formatEquipmentStatus(status)).toBe(label)
  })

  it('has a different label for every status', () => {
    const labels = Object.values(EQUIPMENT_STATUS_LABELS)

    expect(new Set(labels).size).toBe(labels.length)
  })

  it('builds the dropdown options from the labels, in the same order', () => {
    expect(EQUIPMENT_STATUS_OPTIONS).toEqual(
      STATUS_LABEL_CASES.map(({ status, label }) => ({ value: status, label }))
    )
  })
})

describe('equipment type labels', () => {
  it('covers exactly the types in the test list', () => {
    expect(Object.keys(EQUIPMENT_TYPE_LABELS).sort()).toEqual(
      TYPE_LABEL_CASES.map(({ type }) => type).sort()
    )
  })

  it.each(TYPE_LABEL_CASES)('writes $type as "$label"', ({ type, label }) => {
    expect(formatEquipmentType(type)).toBe(label)
  })

  it('has a different label for every type', () => {
    const labels = Object.values(EQUIPMENT_TYPE_LABELS)

    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe.each(FORMATTERS)('$name with a value it has no label for', ({ format }) => {
  it.each(UNKNOWN_VALUE_CASES)('handles $label', ({ value, expected }) => {
    expect(format(value)).toBe(expected)
  })
})