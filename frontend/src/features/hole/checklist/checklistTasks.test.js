import { describe, expect, it } from 'vitest'
import {
  EXPECTED_GROUPS,
  EXPECTED_MISSING_FEATURE_TITLES,
  EXPECTED_MIXED_DUTIES,
  EXPECTED_MIXED_SECTIONS,
  EXPECTED_NO_KEY_SECTIONS,
  EXPECTED_OTHER_IDS,
  EXPECTED_OUT_OF_ORDER_SECTIONS,
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
  MISSING_FEATURE_ITEMS,
  MIXED_DUTY_ITEMS,
  MIXED_SECTION_ITEMS,
  NO_ITEMS_CASES,
  NO_KEY_SECTION_ITEMS,
  OUT_OF_ORDER_BUNKER_ITEMS,
  UNKNOWN_FEATURE_ITEMS,
  UNORDERED_SECTION_ITEMS,
  makeChecklistItem,
} from '../../../test/fixtures/checklistCases'
import {
  DUPLICATE_FEATURES,
  EXPECTED_NON_CONTIGUOUS_BUNKER_IDS,
  EXPECTED_NON_CONTIGUOUS_SECTION_KEYS,
  FROZEN_FEATURES,
  IGNORED_FEATURE_CASES,
  MISSING_FEATURE_CASES,
  NON_CONTIGUOUS_BUNKER_FEATURES,
  NOT_A_LIST_CASES,
  SHUFFLED_FEATURES,
  makeFeature,
  makeFeatures,
} from '../../../test/fixtures/holeFeatureCases'
import {
  CUSTOM_TASK_LIST,
  DUTY_NAME_CASES,
  EXPECTED_DUTY_BY_TASK,
  EXPECTED_NO_LIST_DUTIES,
  FROZEN_TASK_LIST,
  NO_DUTY_LIST_CASES,
  NO_TASK_LIST_CASES,
  ODD_TASK_TITLE_CASES,
  REVERSED_DUTIES,
  SAMPLE_DUTIES,
  SAMPLE_TASKS,
  SAMPLE_TASK_LIST,
  UNKNOWN_DUTY_TASK_LIST,
  UNKNOWN_FEATURE_TASK_LIST,
  UNUSABLE_TASK_CASES,
  buildSampleItems,
} from '../../../test/fixtures/holeTaskCases'
import {
  SAMPLE_BUNKER_COUNT,
  buildChecklistItems,
  buildSampleFeatures,
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

function idsOf(items) {
  return items.map((item) => item.id)
}

function itemWithId(items, id) {
  return items.find((item) => item.id === id)
}

describe('buildSampleFeatures', () => {
  it('gives the standard six, then the bunkers numbered from one', () => {
    const features = buildSampleFeatures(2)

    expect(features.map((feature) => [feature.type, feature.position])).toEqual([
      ['tee_box', 1],
      ['par_3_tee_box', 1],
      ['fairway', 1],
      ['approach', 1],
      ['rough', 1],
      ['green', 1],
      ['bunker', 1],
      ['bunker', 2],
    ])
  })

  it('uses three bunkers when it is not told how many', () => {
    expect(SAMPLE_BUNKER_COUNT).toBe(3)
    expect(buildSampleFeatures().filter((feature) => feature.type === 'bunker')).toHaveLength(3)
  })

  it.each(INVALID_BUNKER_COUNT_CASES)('makes no bunkers for a count of $label', ({ bunkerCount }) => {
    const features = buildSampleFeatures(bunkerCount)

    expect(features.some((feature) => feature.type === 'bunker')).toBe(false)
    expect(features).toHaveLength(6)
  })

  it('gives every feature its own id', () => {
    const ids = idsOf(buildSampleFeatures(5))

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildChecklistItems', () => {
  it.each(ITEM_COUNT_CASES)('makes $expected tasks for $bunkerCount bunkers', ({ bunkerCount, expected }) => {
    expect(buildSampleItems(bunkerCount)).toHaveLength(expected)
  })

  it('gives every task its own id, however many bunkers there are', () => {
    for (const bunkerCount of [0, 3, 12]) {
      const ids = idsOf(buildSampleItems(bunkerCount))

      expect(new Set(ids).size, `${bunkerCount} bunkers`).toBe(ids.length)
    }
  })

  it.each(FEATURE_COUNT_CASES)('makes $count tasks for the $feature area', ({ feature, count }) => {
    expect(buildSampleItems().filter((item) => item.feature === feature)).toHaveLength(count)
  })

  it('numbers the bunkers from one, each with its own section and the two rake tasks', () => {
    const bunkerItems = buildSampleItems(4).filter((item) => item.feature === 'bunker')

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
    const others = buildSampleItems().filter((item) => item.feature !== 'bunker' && item.feature !== 'tee_box')

    expect(others).toHaveLength(10)
    for (const item of others) {
      expect(item.section, item.id).toBeNull()
    }
  })

  it('puts the tee box tasks in the Tee box section and the par 3 tasks in the Par 3 tee box section', () => {
    const items = buildSampleItems()

    for (const id of ['tee-box-cleared', 'collect-garbage', 'tee-box-mowed']) {
      expect(itemWithId(items, id).section, id).toEqual({ key: 'tee-box', title: 'Tee box', order: 1 })
    }
    for (const id of ['par-3-tee-box-cleared', 'par-3-tee-box-mowed']) {
      expect(itemWithId(items, id).section, id).toEqual({ key: 'par-3-tee-box', title: 'Par 3 tee box', order: 2 })
    }
  })

  it('does not share its lists or section with the task list', () => {
    const item = itemWithId(buildSampleItems(), 'tee-box-cleared')
    item.allowedJobTitles.push('landscaper')
    item.section.title = 'Changed'

    const freshItem = itemWithId(buildSampleItems(), 'tee-box-cleared')

    expect(freshItem.allowedJobTitles).toEqual(['greenskeeper'])
    expect(freshItem.section.title).toBe('Tee box')
    expect(SAMPLE_TASKS[0].allowed_job_titles).toEqual(['greenskeeper'])
  })

  it.each(MISSING_FEATURE_CASES)('leaves out the tasks of a missing $omit', ({ omit, missingIds }) => {
    const everyId = idsOf(buildSampleItems())
    const features = buildSampleFeatures().filter((feature) => feature.type !== omit)

    const ids = idsOf(buildChecklistItems(features, SAMPLE_TASK_LIST))

    expect(ids).toEqual(everyId.filter((id) => !missingIds.includes(id)))
  })

  it("numbers each bunker's section by the bunker's own position", () => {
    const items = buildChecklistItems(NON_CONTIGUOUS_BUNKER_FEATURES, SAMPLE_TASK_LIST)
    const bunkerItems = items.filter((item) => item.feature === 'bunker')

    expect(idsOf(bunkerItems).sort()).toEqual(EXPECTED_NON_CONTIGUOUS_BUNKER_IDS)
    expect([...new Set(bunkerItems.map((item) => item.section.key))].sort()).toEqual(
      EXPECTED_NON_CONTIGUOUS_SECTION_KEYS
    )
  })

  it('makes one set of tasks when the same feature is listed twice', () => {
    const items = buildChecklistItems(DUPLICATE_FEATURES, SAMPLE_TASK_LIST)

    expect(idsOf(items)).toEqual(idsOf(buildChecklistItems(makeFeatures([1]), SAMPLE_TASK_LIST)))
  })

  it.each(IGNORED_FEATURE_CASES)('ignores $label', ({ entry }) => {
    const withEntry = buildChecklistItems([...makeFeatures(), entry], SAMPLE_TASK_LIST)

    expect(idsOf(withEntry)).toEqual(idsOf(buildChecklistItems(makeFeatures(), SAMPLE_TASK_LIST)))
  })

  it.each(NOT_A_LIST_CASES)('builds no tasks when the features are $label', ({ features }) => {
    expect(buildChecklistItems(features, SAMPLE_TASK_LIST)).toEqual([])
  })

  it('builds no tasks when there are no features at all', () => {
    expect(buildChecklistItems(undefined, SAMPLE_TASK_LIST)).toEqual([])
  })

  it('gives the same tasks whatever order the features come in', () => {
    const shuffled = buildChecklistItems(SHUFFLED_FEATURES, SAMPLE_TASK_LIST)

    expect(idsOf(shuffled)).toEqual(idsOf(buildChecklistItems(makeFeatures([1, 2, 3]), SAMPLE_TASK_LIST)))
  })

  it('does not modify the features it is given', () => {
    expect(() => buildChecklistItems(FROZEN_FEATURES, SAMPLE_TASK_LIST)).not.toThrow()
    expect(FROZEN_FEATURES).toHaveLength(9)
  })

  it('builds from the tasks it is given, not from a fixed list', () => {
    const items = buildChecklistItems(makeFeatures(), CUSTOM_TASK_LIST)

    expect(items).toEqual([
      {
        id: 'green-inspected',
        templateId: 'green-inspected',
        feature: 'green',
        name: 'Inspected',
        allowedJobTitles: ['mechanic'],
        duty: 'inspection',
        section: null,
      },
    ])
  })

  it('keeps the tasks in the order the list gives them', () => {
    const reversed = { ...SAMPLE_TASK_LIST, tasks: [...SAMPLE_TASKS].reverse() }

    const ids = idsOf(buildChecklistItems(buildSampleFeatures(0), reversed))

    expect(ids[0]).toBe('green-sprayed')
    expect(ids[ids.length - 1]).toBe('tee-box-cleared')
  })

  it.each(NO_TASK_LIST_CASES)('builds no tasks when the task list is $label', ({ taskList }) => {
    expect(buildChecklistItems(makeFeatures([1]), taskList)).toEqual([])
  })

  it.each(UNUSABLE_TASK_CASES)('skips $label', ({ entry }) => {
    const withEntry = { ...SAMPLE_TASK_LIST, tasks: [...SAMPLE_TASKS, entry] }

    expect(idsOf(buildChecklistItems(buildSampleFeatures(), withEntry))).toEqual(idsOf(buildSampleItems()))
  })

  it.each(ODD_TASK_TITLE_CASES)('makes a task with $label one only admins may check', ({ task }) => {
    const [item] = buildChecklistItems(makeFeatures(), { duties: SAMPLE_DUTIES, tasks: [task] })

    expect(item.allowedJobTitles).toEqual([])
  })

  it('gives each task the code of its duty, not the duty id', () => {
    for (const item of buildSampleItems()) {
      expect(item.duty, item.id).toBe(EXPECTED_DUTY_BY_TASK[item.templateId])
    }
  })

  it('gives a task whose duty is not in the list no duty', () => {
    const [item] = buildChecklistItems(makeFeatures(), UNKNOWN_DUTY_TASK_LIST)

    expect(item.duty).toBeNull()
  })

  it('puts a task for a kind of feature the page does not know under Other, with no section', () => {
    const features = [...makeFeatures(), makeFeature('dugout')]

    const [item] = buildChecklistItems(features, UNKNOWN_FEATURE_TASK_LIST)

    expect(item.feature).toBe('other')
    expect(item.section).toBeNull()
  })

  it('does not modify the task list it is given', () => {
    expect(() => buildChecklistItems(makeFeatures([1, 2, 3]), FROZEN_TASK_LIST)).not.toThrow()
    expect(buildChecklistItems(makeFeatures([1, 2, 3]), FROZEN_TASK_LIST)).toHaveLength(21)
  })
})

describe('groupChecklist', () => {
  it('lays out the areas, the sections, and the tasks as the page does', () => {
    expect(describeGroups(groupChecklist(buildSampleItems()))).toEqual(EXPECTED_GROUPS)
  })

  it.each(NO_ITEMS_CASES)('returns no groups for $label', ({ items }) => {
    expect(groupChecklist(items)).toEqual([])
  })

  it('leaves out the bunkers when the hole has none', () => {
    const titles = groupChecklist(buildSampleItems(0)).map((group) => group.title)

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
    const items = buildSampleItems()
    const shownIds = groupChecklist(items).flatMap((group) =>
      group.sections.flatMap((section) => section.items.map((item) => item.id))
    )

    expect(shownIds.sort()).toEqual(idsOf(items).sort())
  })
})

describe('listDuties', () => {
  it("lists every duty on the full checklist, in the order the club's list gives them", () => {
    expect(listDuties(buildSampleItems(), SAMPLE_DUTIES)).toEqual(FULL_DUTIES)
  })

  it('lists only the duties the tasks have', () => {
    expect(listDuties(GREENS_ONLY_ITEMS, SAMPLE_DUTIES)).toEqual(GREENS_ONLY_DUTIES)
  })

  it('counts a duty once, puts one the list does not know last under its own code, and skips tasks with none', () => {
    expect(listDuties(MIXED_DUTY_ITEMS, SAMPLE_DUTIES)).toEqual(EXPECTED_MIXED_DUTIES)
  })

  it.each(NO_ITEMS_CASES)('lists no duties for $label', ({ items }) => {
    expect(listDuties(items, SAMPLE_DUTIES)).toEqual([])
  })

  it('uses the order the duties are given in', () => {
    const keys = listDuties(buildSampleItems(), REVERSED_DUTIES).map((duty) => duty.key)

    expect(keys).toEqual(FULL_DUTIES.map((duty) => duty.key).reverse())
  })

  it.each(DUTY_NAME_CASES)('titles a duty with $label as "$expected"', ({ name, expected }) => {
    const items = [makeChecklistItem({ id: 'a', duty: 'greens' })]

    expect(listDuties(items, [{ id: 'd', code: 'greens', name, position: 1 }])).toEqual([
      { key: 'greens', title: expected },
    ])
  })

  it.each(NO_DUTY_LIST_CASES)('titles every duty by its code when the list of duties is $label', ({ duties }) => {
    expect(listDuties(MIXED_DUTY_ITEMS, duties)).toEqual(EXPECTED_NO_LIST_DUTIES)
  })

  it('lists a duty once when the list names it twice', () => {
    const twice = [...SAMPLE_DUTIES, SAMPLE_DUTIES[2]]

    expect(listDuties(GREENS_ONLY_ITEMS, twice)).toEqual(GREENS_ONLY_DUTIES)
  })

  it('does not modify the tasks or the duties it is given', () => {
    expect(() => listDuties(FROZEN_ITEMS, FROZEN_TASK_LIST.duties)).not.toThrow()
  })
})

describe('titles', () => {
  it.each(FEATURE_TITLE_CASES)('writes the area $feature as "$expected"', ({ feature, expected }) => {
    expect(formatFeatureTitle(feature)).toBe(expected)
  })
})