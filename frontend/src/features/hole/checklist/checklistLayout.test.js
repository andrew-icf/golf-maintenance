import { describe, expect, it } from 'vitest'
import {
  FROZEN_ITEMS,
  NO_ITEMS_CASES,
  OUT_OF_ORDER_BUNKER_ITEMS,
} from '../../../test/fixtures/checklistCases'
import {
  COLUMN_ORDER_ITEMS,
  EXPECTED_COLUMN_ORDER,
  EXPECTED_SAMPLE_LAYOUT,
  EXPECTED_TITLES,
  ODD_TITLE_LIST_CASES,
  ODD_VIEWER_CASES,
  ONE_ROLE_ITEMS,
  SEVERAL_TITLES_ITEMS,
  TITLE_ITEMS,
  VIEWER_CASES,
} from '../../../test/fixtures/checklistLayoutCases'
import { FROZEN_USER, LUKE, NO_PERSON_CASES } from '../../../test/fixtures/taskPermissionCases'
import { makeChecklistItem } from '../../../test/fixtures/checklistCases'
import { buildChecklistLayout } from './checklistLayout'
import { buildChecklistItems, groupChecklist } from './checklistTasks'

// Test data
const SAMPLE_ITEMS = buildChecklistItems()

// Actions
function yoursFlags(layout) {
  return layout.columns.map((column) => column.isYours)
}

function namesByColumn(layout) {
  return layout.areas.map((area) => ({
    title: area.title,
    sections: area.sections.map((section) => ({
      title: section.title,
      columns: Object.fromEntries(
        section.cells.map((cell) => [cell.columnKey, cell.items.map((item) => item.name)])
      ),
    })),
  }))
}

function cellItems(layout, areaTitle, sectionTitle, columnKey) {
  const area = layout.areas.find((candidate) => candidate.title === areaTitle)
  const section = area.sections.find((candidate) => candidate.title === sectionTitle)
  return section.cells.find((cell) => cell.columnKey === columnKey).items
}

describe('buildChecklistLayout', () => {
  describe('the columns', () => {
    it('puts a Greenskeeper column ahead of an Operator column on the sample hole', () => {
      const { columns } = buildChecklistLayout(SAMPLE_ITEMS, LUKE)

      expect(columns.map((column) => [column.key, column.title])).toEqual([
        ['greenskeeper', 'Greenskeeper'],
        ['operator', 'Operator'],
      ])
    })

    it('puts the leading roles first, the others as they arrived, and Other last', () => {
      const { columns } = buildChecklistLayout(COLUMN_ORDER_ITEMS, LUKE)

      expect(columns.map((column) => column.key)).toEqual(EXPECTED_COLUMN_ORDER)
    })

    it('gives a club with one role one column', () => {
      const { columns } = buildChecklistLayout(ONE_ROLE_ITEMS, LUKE)

      expect(columns).toEqual([{ key: 'operator', title: 'Operator', isYours: true }])
    })

    it('writes known job titles as their labels, unknown ones as they are, and Other as Other', () => {
      const { columns } = buildChecklistLayout(TITLE_ITEMS, LUKE)

      expect(columns.map((column) => column.title)).toEqual(EXPECTED_TITLES)
    })

    it.each(NO_ITEMS_CASES)('has no columns and no areas for $label', ({ items }) => {
      expect(buildChecklistLayout(items, LUKE)).toEqual({ columns: [], areas: [] })
    })
  })

  describe("which columns are the viewer's", () => {
    it.each(VIEWER_CASES)('marks the right columns for $name', ({ user, expectedYours }) => {
      expect(yoursFlags(buildChecklistLayout(SAMPLE_ITEMS, user))).toEqual(expectedYours)
    })

    it.each(NO_PERSON_CASES)('marks no column when the person is $label', ({ user }) => {
      expect(yoursFlags(buildChecklistLayout(SAMPLE_ITEMS, user))).toEqual([false, false])
    })

    it.each(ODD_VIEWER_CASES)('marks the right columns for $label', ({ user, expectedYours }) => {
      expect(yoursFlags(buildChecklistLayout(SAMPLE_ITEMS, user))).toEqual(expectedYours)
    })
  })

  describe('the cells', () => {
    it('lays out the sample hole into role columns as the page draws it', () => {
      expect(namesByColumn(buildChecklistLayout(SAMPLE_ITEMS, LUKE))).toEqual(EXPECTED_SAMPLE_LAYOUT)
    })

    it('gives every section one cell for each column, in column order', () => {
      const layout = buildChecklistLayout(SAMPLE_ITEMS, LUKE)
      const columnKeys = layout.columns.map((column) => column.key)

      for (const area of layout.areas) {
        for (const section of area.sections) {
          expect(
            section.cells.map((cell) => cell.columnKey),
            `${area.title} / ${section.title}`
          ).toEqual(columnKeys)
        }
      }
    })

    it('shows every task exactly once', () => {
      const layout = buildChecklistLayout(SAMPLE_ITEMS, LUKE)
      const shownIds = layout.areas.flatMap((area) =>
        area.sections.flatMap((section) => section.cells.flatMap((cell) => cell.items.map((item) => item.id)))
      )

      expect(shownIds.sort()).toEqual(SAMPLE_ITEMS.map((item) => item.id).sort())
    })

    it('uses the same areas and sections as the grouped checklist', () => {
      const layout = buildChecklistLayout(SAMPLE_ITEMS, LUKE)
      const grouped = groupChecklist(SAMPLE_ITEMS)

      expect(layout.areas.map((area) => [area.key, area.title])).toEqual(
        grouped.map((group) => [group.key, group.title])
      )
      expect(layout.areas.map((area) => area.sections.map((section) => [section.key, section.title]))).toEqual(
        grouped.map((group) => group.sections.map((section) => [section.key, section.title]))
      )
    })

    it('keeps tasks in the order they arrived within a column', () => {
      const layout = buildChecklistLayout(OUT_OF_ORDER_BUNKER_ITEMS, LUKE)

      expect(cellItems(layout, 'Bunkers', 'Bunker 2', 'operator').map((item) => item.id)).toEqual([
        'b2-hand',
        'b2-machine',
      ])
    })

    it('puts a task that names several job titles in the column of the first', () => {
      const layout = buildChecklistLayout(SEVERAL_TITLES_ITEMS, LUKE)
      const operatorIds = cellItems(layout, 'Green', null, 'operator').map((item) => item.id)
      const greenskeeperIds = cellItems(layout, 'Green', null, 'greenskeeper').map((item) => item.id)

      expect(operatorIds).toEqual(['shared'])
      expect(greenskeeperIds).toEqual(['solo'])
    })

    it.each(ODD_TITLE_LIST_CASES)(
      'puts a task with $label in the $expectedKey column',
      ({ allowedJobTitles, expectedKey }) => {
        // Set after the item is made, because making it would turn a missing list into the default
        const oddItem = { ...makeChecklistItem({ id: 'odd' }), allowedJobTitles }
        const layout = buildChecklistLayout([oddItem], LUKE)

        expect(layout.columns.map((column) => column.key)).toEqual([expectedKey])
        expect(cellItems(layout, 'Green', null, expectedKey).map((item) => item.id)).toEqual(['odd'])
      }
    )
  })

  it('does not modify the tasks or the person it is given', () => {
    expect(() => buildChecklistLayout(FROZEN_ITEMS, FROZEN_USER)).not.toThrow()
    expect(FROZEN_ITEMS.map((item) => item.id)).toEqual(['b2-hand', 'b1-hand', 'green-task'])
  })
})