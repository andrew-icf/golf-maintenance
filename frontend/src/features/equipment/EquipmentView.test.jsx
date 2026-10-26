import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EquipmentView } from './EquipmentView'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getEquipment: vi.fn(), updateEquipmentStatus: vi.fn() },
}))

vi.mock('../../api', () => ({ api: apiMock }))

// Test data
function makeItem({ id, type, label, status = 'working_order', parentId = null }) {
  return {
    id,
    type,
    label,
    status,
    parent_equipment_id: parentId,
    assigned_user_id: null,
  }
}

const CART_ONE = makeItem({ id: 'cart-1', type: 'cart', label: 'Cart-1', status: 'in_shop' })
const TRASH_CAN = makeItem({ id: 'item-1', type: 'trash_can', label: 'Cart-1-1', parentId: CART_ONE.id })
const WEED_EATER = makeItem({
  id: 'item-2',
  type: 'weed_eater',
  label: 'Cart-1-2',
  status: 'needs_repair',
  parentId: CART_ONE.id,
})
const CART_TWO = makeItem({ id: 'cart-2', type: 'cart', label: 'Cart-2' })
const BLOWER = makeItem({ id: 'item-3', type: 'blower', label: 'Cart-2-1', parentId: CART_TWO.id })
const ALL_EQUIPMENT = [CART_ONE, TRASH_CAN, WEED_EATER, CART_TWO, BLOWER]

const STANDALONE_CHAINSAW = makeItem({ id: 'item-9', type: 'chainsaw', label: 'Shop-1' })
const UNKNOWN_TYPE_ITEM = makeItem({
  id: 'item-10',
  type: 'forklift',
  label: 'Cart-2-9',
  parentId: CART_TWO.id,
})

// How each dropdown is named for screen readers
const CART_ONE_SELECT = 'Status of Cart-1 (Cart)'
const TRASH_CAN_SELECT = 'Status of Cart-1-1 (Trash Can)'
const WEED_EATER_SELECT = 'Status of Cart-1-2 (Weed Eater)'
const CART_TWO_SELECT = 'Status of Cart-2 (Cart)'
const BLOWER_SELECT = 'Status of Cart-2-1 (Blower)'
const ALL_SELECT_NAMES = [
  CART_ONE_SELECT,
  TRASH_CAN_SELECT,
  WEED_EATER_SELECT,
  CART_TWO_SELECT,
  BLOWER_SELECT,
]

// Every dropdown with the status it should start on, and the tint its row should have
const STATUS_CASES = [
  { select: CART_ONE_SELECT, status: 'in_shop', tint: 'status-in_shop' },
  { select: TRASH_CAN_SELECT, status: 'working_order', tint: 'status-working_order' },
  { select: WEED_EATER_SELECT, status: 'needs_repair', tint: 'status-needs_repair' },
]

// The dropdowns that should not move when the weed eater's status changes
const UNTOUCHED_BY_WEED_EATER_CHANGE = [
  { select: CART_ONE_SELECT, status: 'in_shop' },
  { select: TRASH_CAN_SELECT, status: 'working_order' },
  { select: CART_TWO_SELECT, status: 'working_order' },
  { select: BLOWER_SELECT, status: 'working_order' },
]

const STATUS_OPTION_TEXTS = ['Working Order', 'Needs Repair', 'In Shop']

const LOADING_TEXT = 'Loading equipment...'
const EMPTY_TEXT = 'No equipment yet.'
const LOAD_ERROR_MESSAGE = 'could not fetch equipment'
const UPDATE_ERROR_MESSAGE = 'equipment not found'

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

// Actions
async function renderLoadedView(equipment = ALL_EQUIPMENT) {
  apiMock.getEquipment.mockResolvedValue(equipment)
  render(<EquipmentView />)
  await screen.findAllByRole('listitem')
}

function selectNamed(name) {
  return screen.getByRole('combobox', { name })
}

function rowOf(select) {
  return select.closest('li')
}

function sectionTitled(title) {
  return screen.getByRole('heading', { name: title }).closest('section')
}

// What each row calls itself, taken from its visible label
function rowLabelsIn(section) {
  return within(section)
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.equipment-label').textContent)
}

describe('EquipmentView', () => {
  let alertSpy

  beforeEach(() => {
    apiMock.getEquipment.mockReset()
    apiMock.updateEquipmentStatus.mockReset()
    // The page reports a failed change with a browser alert, which jsdom doesn't implement
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  describe('loading the equipment', () => {
    it('shows a loading message until the equipment arrives', async () => {
      const equipment = createDeferred()
      apiMock.getEquipment.mockReturnValue(equipment.promise)

      render(<EquipmentView />)

      expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)

      await act(async () => {
        equipment.resolve(ALL_EQUIPMENT)
      })

      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(ALL_EQUIPMENT.length)
    })

    it('shows the error and no equipment when loading fails', async () => {
      apiMock.getEquipment.mockRejectedValue(new Error(LOAD_ERROR_MESSAGE))

      render(<EquipmentView />)

      expect(await screen.findByText(LOAD_ERROR_MESSAGE)).toBeInTheDocument()
      expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })

    it('says so when there is no equipment yet', async () => {
      apiMock.getEquipment.mockResolvedValue([])

      render(<EquipmentView />)

      expect(await screen.findByText(EMPTY_TEXT)).toBeInTheDocument()
      expect(screen.queryAllByRole('heading')).toHaveLength(0)
    })
  })

  describe('layout', () => {
    it('does not repeat the page title, which the top bar shows', async () => {
      await renderLoadedView()

      expect(screen.queryByRole('heading', { name: 'Equipment' })).not.toBeInTheDocument()
    })

    it('shows one section per cart, titled by its label, in the order received', async () => {
      await renderLoadedView()

      const titles = screen.getAllByRole('heading').map((heading) => heading.textContent)

      expect(titles).toEqual([CART_ONE.label, CART_TWO.label])
    })

    it('lists the cart first, then the items attached to it, by type name', async () => {
      await renderLoadedView()

      expect(rowLabelsIn(sectionTitled(CART_ONE.label))).toEqual(['Cart', 'Trash Can', 'Weed Eater'])
    })

    it("keeps each cart's items in its own section", async () => {
      await renderLoadedView()

      expect(rowLabelsIn(sectionTitled(CART_TWO.label))).toEqual(['Cart', 'Blower'])
      expect(within(sectionTitled(CART_ONE.label)).queryByText('Blower')).not.toBeInTheDocument()
    })

    it('treats an item with no parent as the start of its own section', async () => {
      await renderLoadedView([CART_ONE, TRASH_CAN, STANDALONE_CHAINSAW])

      const titles = screen.getAllByRole('heading').map((heading) => heading.textContent)

      expect(titles).toEqual([CART_ONE.label, STANDALONE_CHAINSAW.label])
      expect(rowLabelsIn(sectionTitled(STANDALONE_CHAINSAW.label))).toEqual(['Chainsaw'])
    })

    it('shows a type it has no name for exactly as it was received', async () => {
      await renderLoadedView([CART_TWO, UNKNOWN_TYPE_ITEM])

      expect(rowLabelsIn(sectionTitled(CART_TWO.label))).toEqual(['Cart', 'forklift'])
    })
  })

  describe('statuses', () => {
    it('names every dropdown after its item', async () => {
      await renderLoadedView()

      expect(screen.getAllByRole('combobox')).toHaveLength(ALL_SELECT_NAMES.length)
      for (const name of ALL_SELECT_NAMES) {
        expect(selectNamed(name)).toBeInTheDocument()
      }
    })

    it.each(STATUS_CASES)('shows $select as $status, with its row tinted to match', async ({ select, status, tint }) => {
      await renderLoadedView()

      expect(selectNamed(select)).toHaveValue(status)
      expect(rowOf(selectNamed(select))).toHaveClass(tint)
    })

    it('offers the three statuses, in order, in every dropdown', async () => {
      await renderLoadedView()

      for (const select of screen.getAllByRole('combobox')) {
        const optionTexts = within(select)
          .getAllByRole('option')
          .map((option) => option.textContent)

        expect(optionTexts).toEqual(STATUS_OPTION_TEXTS)
      }
    })
  })

  describe('changing a status', () => {
    it('sends the change for that item and updates its row without reloading', async () => {
      apiMock.updateEquipmentStatus.mockResolvedValue({ message: 'status updated' })
      await renderLoadedView()
      const select = selectNamed(WEED_EATER_SELECT)

      await userEvent.selectOptions(select, 'working_order')

      expect(apiMock.updateEquipmentStatus).toHaveBeenCalledTimes(1)
      expect(apiMock.updateEquipmentStatus).toHaveBeenCalledWith(WEED_EATER.id, 'working_order')
      await waitFor(() => {
        expect(select).toHaveValue('working_order')
      })
      expect(rowOf(select)).toHaveClass('status-working_order')
      expect(rowOf(select)).not.toHaveClass('status-needs_repair')
      expect(apiMock.getEquipment).toHaveBeenCalledTimes(1)
    })

    it.each(UNTOUCHED_BY_WEED_EATER_CHANGE)('leaves $select on $status when another item changes', async ({ select, status }) => {
      apiMock.updateEquipmentStatus.mockResolvedValue({ message: 'status updated' })
      await renderLoadedView()

      await userEvent.selectOptions(selectNamed(WEED_EATER_SELECT), 'in_shop')
      await waitFor(() => {
        expect(selectNamed(WEED_EATER_SELECT)).toHaveValue('in_shop')
      })

      expect(selectNamed(select)).toHaveValue(status)
    })

    it('disables only that dropdown while the change is on its way', async () => {
      const update = createDeferred()
      apiMock.updateEquipmentStatus.mockReturnValue(update.promise)
      await renderLoadedView()
      const select = selectNamed(TRASH_CAN_SELECT)

      await userEvent.selectOptions(select, 'in_shop')

      expect(select).toBeDisabled()
      for (const name of ALL_SELECT_NAMES.filter((selectName) => selectName !== TRASH_CAN_SELECT)) {
        expect(selectNamed(name)).toBeEnabled()
      }

      await act(async () => {
        update.resolve({ message: 'status updated' })
      })

      expect(select).toBeEnabled()
      expect(select).toHaveValue('in_shop')
    })

    it('shows the error and keeps the old status when the change fails', async () => {
      apiMock.updateEquipmentStatus.mockRejectedValue(new Error(UPDATE_ERROR_MESSAGE))
      await renderLoadedView()
      const select = selectNamed(WEED_EATER_SELECT)

      await userEvent.selectOptions(select, 'working_order')

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(UPDATE_ERROR_MESSAGE)
      })
      await waitFor(() => {
        expect(select).toBeEnabled()
      })
      expect(select).toHaveValue('needs_repair')
      expect(rowOf(select)).toHaveClass('status-needs_repair')
    })

    it('can change several items one after another', async () => {
      apiMock.updateEquipmentStatus.mockResolvedValue({ message: 'status updated' })
      await renderLoadedView()

      await userEvent.selectOptions(selectNamed(WEED_EATER_SELECT), 'working_order')
      await waitFor(() => {
        expect(selectNamed(WEED_EATER_SELECT)).toHaveValue('working_order')
      })
      await userEvent.selectOptions(selectNamed(TRASH_CAN_SELECT), 'needs_repair')
      await waitFor(() => {
        expect(selectNamed(TRASH_CAN_SELECT)).toHaveValue('needs_repair')
      })

      expect(apiMock.updateEquipmentStatus).toHaveBeenNthCalledWith(1, WEED_EATER.id, 'working_order')
      expect(apiMock.updateEquipmentStatus).toHaveBeenNthCalledWith(2, TRASH_CAN.id, 'needs_repair')
      expect(selectNamed(WEED_EATER_SELECT)).toHaveValue('working_order')
      expect(rowOf(selectNamed(TRASH_CAN_SELECT))).toHaveClass('status-needs_repair')
    })
  })
})