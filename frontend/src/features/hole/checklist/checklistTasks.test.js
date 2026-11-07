import { describe, expect, it } from 'vitest'
import { formatJobTitle } from '../../../constants/jobTitles'
import {
  DUTY_TITLE_CASES,
  EXPECTED_GROUPS,
  EXPECTED_MISSING_FEATURE_TITLES,
  EXPECTED_MIXED_DUTIES,
  EXPECTED_MIXED_SECTIONS,
  EXPECTED_NO_KEY_SECTIONS,
  EXPECTED_OTHER_IDS,
  EXPECTED_OUT_OF_ORDER_SECTIONS,
  EXPECTED_TASKS,
  EXPECTED_UNKNOWN_FEATURE_TITLES,
  EXPECTED_UNORDERED_SECTION_TITLES,
  FEATURE_COUNT_CASES,
  FEATURE_TITLE_CASES,
  FROZEN_ITEMS,
  FULL_DUTIES,
  GREENS_ONLY_DUTIES,
  GREENS_ONLY_ITEMS,
  INVALID_BUNKER_COUNT_CASES,
  ITEM_COUNT_CASES,
  ITEMS_WITHOUT_BUNKERS,
  MISSING_FEATURE_ITEMS,
  MIXED_DUTY_ITEMS,
  MIXED_SECTION_ITEMS,
  NO_ITEMS_CASES,
  NO_KEY_SECTION_ITEMS,
  OUT_OF_ORDER_BUNKER_ITEMS,
  SAMPLE_ITEM_COUNT,
  UNKNOWN_FEATURE_ITEMS,
  UNORDERED_SECTION_ITEMS,
} from '../../../test/fixtures/checklistCases'
import {
  DUTY_ORDER,
  FEATURE_ORDER,
  SAMPLE_BUNKER_COUNT,
  TASK_TEMPLATES,
  buildChecklistItems,
  formatDutyTitle,
  formatFeatureTitle,
  groupChecklist,
  listDuties,
} from './checklistTasks'

// Actions
function describeGroups(groups) {
  return groups.map((group) => ({
    title: group.title,
    sections: group.sections.map((section) => ({
      title: section.title,
      names: section.items.map((item) => item.name),
    })),
  }))
}

function sectionsOf(groups, title) {
  const group = groups.find((candidate) => candidate.title === title)
  return group.sections.map((section) => ({
    title: section.title,
    ids: section.items.map((item) => item.id),
  }))
}

describe('the task list', () => {
  it('gives every task an id, a name, an area, a duty, and who may check it', () => {
    for (const template of TASK_TEMPLATES) {
      expect(template.id, template.name).toBeTruthy()
      expect(template.name.trim(), template.id).not.toBe('')
      expect(FEATURE_ORDER, template.id).toContain(template.feature)
      expect(DUTY_ORDER, template.id).toContain(template.duty)
      expect(template.allowedJobTitles.length, template.id).toBeGreaterThan(0)
      for (const title of template.allowedJobTitles) {
        expect(formatJobTitle(title), `${template.id} names ${title}`).not.toBe('')
      }
    }
  })

  it('gives every task its own id', () => {
    const ids = TASK_TEMPLATES.map((template) => template.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(EXPECTED_TASKS)('has the task $id', ({ id, feature, name, duty, titles, section }) => {
    const template = TASK_TEMPLATES.find((candidate) => candidate.id === id)

    expect(template).toBeDefined()
    expect(template).toMatchObject({ feature, name, duty, allowedJobTitles: titles })
    expect(template.section?.key ?? null).toBe(section)
  })

  it('has exactly the tasks on the list, no more', () => {
    expect(TASK_TEMPLATES).toHaveLength(EXPECTED_TASKS.length)
  })

  it('puts the tee box tasks in two sections, the regular tee box ahead of the par 3', () => {
    const sectionedTemplates = TASK_TEMPLATES.filter((template) => template.feature === 'tee_box' && template.section)

    expect(sectionedTemplates.map((template) => template.section.key)).toEqual([
      'tee-box',
      'tee-box',
      'par-3-tee-box',
      'par-3-tee-box',
    ])
    expect(sectionedTemplates.map((template) => template.section.title)).toEqual([
      'Tee box',
      'Tee box',
      'Par 3 tee box',
      'Par 3 tee box',
    ])
    expect(sectionedTemplates.map((template) => template.section.order)).toEqual([1, 1, 2, 2])
  })
})

describe('buildChecklistItems', () => {
  it.each(ITEM_COUNT_CASES)('makes $expected tasks for $bunkerCount bunkers', ({ bunkerCount, expected }) => {
    expect(buildChecklistItems(bunkerCount)).toHaveLength(expected)
  })

  it('uses three bunkers when it is not told how many', () => {
    expect(SAMPLE_BUNKER_COUNT).toBe(3)
    expect(buildChecklistItems()).toHaveLength(SAMPLE_ITEM_COUNT)
  })

  it.each(INVALID_BUNKER_COUNT_CASES)('treats a bunker count of $label as no bunkers', ({ bunkerCount }) => {
    const items = buildChecklistItems(bunkerCount)

    expect(items).toHaveLength(ITEMS_WITHOUT_BUNKERS)
    expect(items.some((item) => item.feature === 'bunker')).toBe(false)
  })

  it('gives every task its own id, however many bunkers there are', () => {
    for (const bunkerCount of [0, 3, 12]) {
      const ids = buildChecklistItems(bunkerCount).map((item) => item.id)

      expect(new Set(ids).size, `${bunkerCount} bunkers`).toBe(ids.length)
    }
  })

  it.each(FEATURE_COUNT_CASES)('makes $count tasks for the $feature area', ({ feature, count }) => {
    expect(buildChecklistItems().filter((item) => item.feature === feature)).toHaveLength(count)
  })

  it('numbers the bunkers from one, each with its own section and the two rake tasks', () => {
    const bunkerItems = buildChecklistItems(4).filter((item) => item.feature === 'bunker')

    expect(bunkerItems).toHaveLength(8)
    for (const bunkerNumber of [1, 2, 3, 4]) {
      const inBunker = bunkerItems.filter((item) => item.section.key === `bunker-${bunkerNumber}`)

      expect(inBunker.map((item) => item.name).sort(), `bunker ${bunkerNumber}`).toEqual([
        'Raked by hand',
        'Raked by machine',
      ])
      for (const item of inBunker) {
        expect(item.section.title).toBe(`Bunker ${bunkerNumber}`)
        expect(item.section.order).toBe(bunkerNumber)
      }
    }
  })

  it('gives tasks outside the bunkers and the tee boxes no section', () => {
    const others = buildChecklistItems().filter(
      (item) => item.feature !== 'bunker' && item.feature !== 'tee_box'
    )

    expect(others).toHaveLength(10)
    for (const item of others) {
      expect(item.section, item.id).toBeNull()
    }
  })

  it('does not share its lists or section with the task list', () => {
    const item = buildChecklistItems().find((candidate) => candidate.id === 'tee-box-cleared')
    item.allowedJobTitles.push('landscaper')
    item.section.title = 'Changed'

    const freshItem = buildChecklistItems().find((candidate) => candidate.id === 'tee-box-cleared')

    expect(freshItem.allowedJobTitles).toEqual(['greenskeeper'])
    expect(freshItem.section.title).toBe('Tee box')
  })
})

describe('groupChecklist', () => {
  it('lays out the areas, the sections, and the tasks as the page does', () => {
    expect(describeGroups(groupChecklist(buildChecklistItems()))).toEqual(EXPECTED_GROUPS)
  })

  it.each(NO_ITEMS_CASES)('returns no groups for $label', ({ items }) => {
    expect(groupChecklist(items)).toEqual([])
  })

  it('leaves out the bunkers when the hole has none', () => {
    const titles = groupChecklist(buildChecklistItems(0)).map((group) => group.title)

    expect(titles).toEqual(['Tee box', 'Fairway', 'Rough', 'Green'])
  })

  it("orders sections by their order and keeps each section's tasks in the order they came", () => {
    const sections = sectionsOf(groupChecklist(OUT_OF_ORDER_BUNKER_ITEMS), 'Bunkers')

    expect(sections).toEqual(EXPECTED_OUT_OF_ORDER_SECTIONS)
  })

  it('puts tasks with no section in an untitled section ahead of the others', () => {
    const sections = sectionsOf(groupChecklist(MIXED_SECTION_ITEMS), 'Bunkers')

    expect(sections).toEqual(EXPECTED_MIXED_SECTIONS)
  })

  it('puts sections with no order after the ones that have one, in the order they came', () => {
    const [group] = groupChecklist(UNORDERED_SECTION_ITEMS)

    expect(group.sections.map((section) => section.title)).toEqual(EXPECTED_UNORDERED_SECTION_TITLES)
  })

  it('treats a section with no usable key as no section', () => {
    const sections = sectionsOf(groupChecklist(NO_KEY_SECTION_ITEMS), 'Bunkers')

    expect(sections).toEqual(EXPECTED_NO_KEY_SECTIONS)
  })

  it('puts an area it does not know after the known ones, under its own name', () => {
    const titles = groupChecklist(UNKNOWN_FEATURE_ITEMS).map((group) => group.title)

    expect(titles).toEqual(EXPECTED_UNKNOWN_FEATURE_TITLES)
  })

  it('puts tasks with no area last, under Other', () => {
    const groups = groupChecklist(MISSING_FEATURE_ITEMS)

    expect(groups.map((group) => group.title)).toEqual(EXPECTED_MISSING_FEATURE_TITLES)
    expect(sectionsOf(groups, 'Other')[0].ids).toEqual(EXPECTED_OTHER_IDS)
  })

  it('does not modify the tasks it is given', () => {
    expect(() => groupChecklist(FROZEN_ITEMS)).not.toThrow()
    expect(FROZEN_ITEMS.map((item) => item.id)).toEqual(['b2-hand', 'b1-hand', 'green-task'])
  })

  it('shows every task exactly once', () => {
    const items = buildChecklistItems()
    const shownIds = groupChecklist(items).flatMap((group) =>
      group.sections.flatMap((section) => section.items.map((item) => item.id))
    )

    expect(shownIds.sort()).toEqual(items.map((item) => item.id).sort())
  })
})

describe('listDuties', () => {
  it('lists every duty on the full checklist, in the order of the page', () => {
    expect(listDuties(buildChecklistItems())).toEqual(FULL_DUTIES)
  })

  it('lists only the duties the tasks have', () => {
    expect(listDuties(GREENS_ONLY_ITEMS)).toEqual(GREENS_ONLY_DUTIES)
  })

  it('counts a duty once, puts one it does not know last under its own name, and skips tasks with none', () => {
    expect(listDuties(MIXED_DUTY_ITEMS)).toEqual(EXPECTED_MIXED_DUTIES)
  })

  it.each(NO_ITEMS_CASES)('lists no duties for $label', ({ items }) => {
    expect(listDuties(items)).toEqual([])
  })

  it('does not modify the tasks it is given', () => {
    expect(() => listDuties(FROZEN_ITEMS)).not.toThrow()
  })
})

describe('titles', () => {
  it.each(DUTY_TITLE_CASES)('writes the duty $duty as "$expected"', ({ duty, expected }) => {
    expect(formatDutyTitle(duty)).toBe(expected)
  })

  it.each(FEATURE_TITLE_CASES)('writes the area $feature as "$expected"', ({ feature, expected }) => {
    expect(formatFeatureTitle(feature)).toBe(expected)
  })
})