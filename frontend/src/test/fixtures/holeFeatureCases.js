import { holeIdOf, makeHole, makeLayout } from './course'
import { makePageResponse } from './coursePageCases'

// Test data for building a hole's checklist from the features the server sends with the hole

export const STANDARD_FEATURE_TYPES = ['tee_box', 'par_3_tee_box', 'fairway', 'approach', 'rough', 'green']

export function makeFeature(type, position = 1) {
  return { id: `feature-${type}-${position}`, type, position }
}

// The standard six, then a bunker at each of the given positions
export function makeFeatures(bunkerPositions = []) {
  return [
    ...STANDARD_FEATURE_TYPES.map((type) => makeFeature(type)),
    ...bunkerPositions.map((position) => makeFeature('bunker', position)),
  ]
}

// The kind of feature each task needs, written out by hand so it is checked against the code
export const EXPECTED_FEATURE_TYPES = {
  'collect-garbage': 'tee_box',
  'tee-box-cleared': 'tee_box',
  'tee-box-mowed': 'tee_box',
  'par-3-tee-box-cleared': 'par_3_tee_box',
  'par-3-tee-box-mowed': 'par_3_tee_box',
  'fairway-mowed': 'fairway',
  'cart-signs': 'fairway',
  'fairway-sprayed': 'fairway',
  'rough-mowed': 'rough',
  'bunker-raked-machine': 'bunker',
  'bunker-raked-hand': 'bunker',
  'pin-placement': 'green',
  'ball-marks': 'green',
  'top-dress': 'green',
  'green-mowed': 'green',
  'green-rolled': 'green',
  'green-sprayed': 'green',
}

// A hole that lacks one kind of feature has none of that feature's tasks. The approach has no
// tasks yet, so a hole without one loses nothing.
export const MISSING_FEATURE_CASES = [
  { omit: 'tee_box', missingIds: ['collect-garbage', 'tee-box-cleared', 'tee-box-mowed'] },
  { omit: 'par_3_tee_box', missingIds: ['par-3-tee-box-cleared', 'par-3-tee-box-mowed'] },
  { omit: 'fairway', missingIds: ['fairway-mowed', 'cart-signs', 'fairway-sprayed'] },
  { omit: 'approach', missingIds: [] },
  { omit: 'rough', missingIds: ['rough-mowed'] },
  {
    omit: 'green',
    missingIds: ['pin-placement', 'ball-marks', 'top-dress', 'green-mowed', 'green-rolled', 'green-sprayed'],
  },
]

// A hole whose bunkers are numbered 2 and 4: each bunker's section follows its own number
export const NON_CONTIGUOUS_BUNKER_FEATURES = makeFeatures([2, 4])
export const EXPECTED_NON_CONTIGUOUS_BUNKER_IDS = [
  'bunker-raked-hand:2',
  'bunker-raked-hand:4',
  'bunker-raked-machine:2',
  'bunker-raked-machine:4',
]
export const EXPECTED_NON_CONTIGUOUS_SECTION_KEYS = ['bunker-2', 'bunker-4']

// The same green, and the same first bunker, listed twice
export const DUPLICATE_FEATURES = [
  ...makeFeatures([1]),
  makeFeature('green'),
  makeFeature('green'),
  makeFeature('bunker', 1),
]

// Entries mixed in with the real features, none of which should make a task
export const IGNORED_FEATURE_CASES = [
  { label: 'a kind of feature the page does not know', entry: makeFeature('dugout') },
  { label: 'an entry that is null', entry: null },
  { label: 'an entry that is text', entry: 'bunker' },
  { label: 'an entry that is a number', entry: 42 },
  { label: 'an entry with no type', entry: { id: 'no-type', position: 1 } },
  { label: 'an entry whose type is a number', entry: { id: 'number-type', type: 7, position: 1 } },
  { label: 'a bunker at position zero', entry: makeFeature('bunker', 0) },
  { label: 'a bunker at a negative position', entry: makeFeature('bunker', -1) },
  { label: 'a bunker at a fractional position', entry: makeFeature('bunker', 1.5) },
  { label: 'a bunker whose position is text', entry: { id: 'text-position', type: 'bunker', position: '2' } },
  { label: 'a bunker with no position', entry: { id: 'no-position', type: 'bunker' } },
]

// Things that are not a list of features, so the hole has no tasks. An empty list is the same.
export const NOT_A_LIST_CASES = [
  { label: 'null', features: null },
  { label: 'text', features: 'tee_box' },
  { label: 'a number', features: 42 },
  { label: 'an object', features: { type: 'tee_box', position: 1 } },
  { label: 'an empty list', features: [] },
]

// Features that arrive in the opposite order, which must make the same tasks
export const SHUFFLED_FEATURES = makeFeatures([3, 1, 2]).reverse()

// Frozen, so any attempt to change them in place throws
export const FROZEN_FEATURES = Object.freeze(makeFeatures([3, 1, 2]).map((feature) => Object.freeze(feature)))

// A course whose holes have different numbers of bunkers
export const BUNKER_PAGE_CASES = [
  { name: 'a hole with no bunkers', bunkers: 0, holeId: holeIdOf('K', 1) },
  { name: 'a hole with one bunker', bunkers: 1, holeId: holeIdOf('K', 2) },
  { name: 'a hole with three bunkers', bunkers: 3, holeId: holeIdOf('K', 3) },
  { name: 'a hole with five bunkers', bunkers: 5, holeId: holeIdOf('K', 4) },
]
export const BUNKER_PAGE = makePageResponse(
  [
    makeLayout({
      name: 'Course K',
      code: 'K',
      holes: BUNKER_PAGE_CASES.map((testCase, index) => makeHole('K', index + 1, 4, 400, testCase.bunkers)),
    }),
  ],
  []
)

// A hole that has no features at all
export const NO_FEATURES_HOLE_ID = holeIdOf('N', 1)
export const NO_FEATURES_PAGE = makePageResponse(
  [makeLayout({ name: 'Course N', code: 'N', holes: [{ ...makeHole('N', 1, 4, 400), features: [] }] })],
  []
)

// Holes whose features are missing, null, text, or an object where a list belongs
export const FEATURE_VALUE_CASES = [
  { label: 'missing from the hole', holeId: holeIdOf('V', 1) },
  { label: 'null', holeId: holeIdOf('V', 2) },
  { label: 'text', holeId: holeIdOf('V', 3) },
  { label: 'an object', holeId: holeIdOf('V', 4) },
]
export const FEATURE_VALUE_PAGE = makePageResponse(
  [
    makeLayout({
      name: 'Course V',
      code: 'V',
      holes: [
        { id: holeIdOf('V', 1), hole_number: 1, par: 4, yardage: 400 },
        { ...makeHole('V', 2, 4, 400), features: null },
        { ...makeHole('V', 3, 4, 400), features: 'tee_box' },
        { ...makeHole('V', 4, 4, 400), features: { tee_box: 1 } },
      ],
    }),
  ],
  []
)