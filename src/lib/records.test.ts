import { describe, expect, it } from 'vitest'
import {
  addCable,
  addEquipment,
  duplicateCable,
  moveCable,
  moveEquipment,
  removeCable,
  removeEquipment,
  updateCable,
  type CableInput,
  type EquipmentInput,
} from './records'
import type { ProjectBody } from '../types'

const EMPTY: ProjectBody = { sections: [], cables: [], equipments: [] }

function cableInput(overrides: Partial<CableInput> = {}): CableInput {
  return {
    cableType: 'CV 4C 25sq',
    from: 'MCC반',
    to: 'P-101',
    quantityExpr: '10',
    note: '',
    ...overrides,
  }
}

function equipmentInput(overrides: Partial<EquipmentInput> = {}): EquipmentInput {
  return { kind: 'replace', name: 'MCCB 100A', qty: 1, spec: '', note: '', ...overrides }
}

/** s1 에 케이블 3건이 순서대로 들어 있는 본문 */
function threeCables(): ProjectBody {
  let body = EMPTY
  body = addCable(body, 's1', cableInput({ cableType: 'A' }))
  body = addCable(body, 's1', cableInput({ cableType: 'B' }))
  body = addCable(body, 's1', cableInput({ cableType: 'C' }))
  return body
}

function typesOf(body: ProjectBody): string[] {
  return [...body.cables].sort((a, b) => a.order - b.order).map((c) => c.cableType)
}

describe('addCable', () => {
  it('추가한 순서대로 order 를 매긴다', () => {
    expect(threeCables().cables.map((c) => c.order)).toEqual([0, 1, 2])
  })

  it('항목마다 순서를 따로 센다', () => {
    let body = addCable(EMPTY, 's1', cableInput())
    body = addCable(body, 's2', cableInput())

    expect(body.cables.map((c) => [c.sectionId, c.order])).toEqual([
      ['s1', 0],
      ['s2', 0],
    ])
  })

  it('기록마다 다른 식별자를 발급한다', () => {
    const body = threeCables()
    const ids = new Set(body.cables.map((c) => c.id))

    expect(ids.size).toBe(3)
  })

  it('원본 본문을 바꾸지 않는다', () => {
    const before = threeCables()
    addCable(before, 's1', cableInput())

    expect(before.cables).toHaveLength(3)
  })
})

describe('updateCable', () => {
  it('지정한 기록만 고친다', () => {
    const body = threeCables()
    const target = body.cables[1]
    const next = updateCable(body, target!.id, cableInput({ cableType: '바뀜' }))

    expect(typesOf(next)).toEqual(['A', '바뀜', 'C'])
  })

  it('없는 기록을 고치려 하면 그대로 둔다', () => {
    const body = threeCables()

    expect(typesOf(updateCable(body, 'nope', cableInput({ cableType: 'X' })))).toEqual(['A', 'B', 'C'])
  })
})

describe('removeCable', () => {
  it('지운 뒤 남은 기록의 순서를 0부터 다시 매긴다', () => {
    const body = threeCables()
    const next = removeCable(body, body.cables[0]!.id)

    expect(next.cables.map((c) => [c.cableType, c.order])).toEqual([
      ['B', 0],
      ['C', 1],
    ])
  })

  it('없는 기록을 지우려 하면 원본을 그대로 돌려준다', () => {
    const body = threeCables()

    expect(removeCable(body, 'nope')).toBe(body)
  })
})

describe('duplicateCable', () => {
  it('원본 바로 아래에 사본을 넣는다', () => {
    const body = threeCables()
    const next = duplicateCable(body, body.cables[0]!.id)

    expect(typesOf(next)).toEqual(['A', 'A', 'B', 'C'])
  })

  it('사본에 새 식별자를 준다', () => {
    const body = threeCables()
    const sourceId = body.cables[0]!.id
    const next = duplicateCable(body, sourceId)

    expect(next.cables.filter((c) => c.id === sourceId)).toHaveLength(1)
  })

  it('사본의 순서도 정수로 정리된다', () => {
    const body = duplicateCable(threeCables(), threeCables().cables[0]!.id)

    expect(body.cables.every((c) => Number.isInteger(c.order))).toBe(true)
  })
})

describe('moveCable', () => {
  it('한 칸 위로 옮긴다', () => {
    const body = threeCables()

    expect(typesOf(moveCable(body, body.cables[2]!.id, -1))).toEqual(['A', 'C', 'B'])
  })

  it('한 칸 아래로 옮긴다', () => {
    const body = threeCables()

    expect(typesOf(moveCable(body, body.cables[0]!.id, 1))).toEqual(['B', 'A', 'C'])
  })

  it('맨 위에서 더 올리면 그대로 둔다', () => {
    const body = threeCables()

    expect(moveCable(body, body.cables[0]!.id, -1)).toBe(body)
  })

  it('맨 아래에서 더 내리면 그대로 둔다', () => {
    const body = threeCables()

    expect(moveCable(body, body.cables[2]!.id, 1)).toBe(body)
  })

  it('다른 항목의 기록과 섞이지 않는다', () => {
    let body = threeCables()
    body = addCable(body, 's2', cableInput({ cableType: 'Z' }))
    const zId = body.cables[body.cables.length - 1]!.id

    expect(moveCable(body, zId, -1)).toBe(body)
  })
})

describe('장비 기록', () => {
  it('교체와 신규를 구분해 담는다', () => {
    let body = addEquipment(EMPTY, 's1', equipmentInput({ kind: 'replace', name: '차단기' }))
    body = addEquipment(body, 's1', equipmentInput({ kind: 'new', name: '계전기' }))

    expect(body.equipments.map((e) => [e.kind, e.name])).toEqual([
      ['replace', '차단기'],
      ['new', '계전기'],
    ])
  })

  it('지운 뒤 순서를 다시 매긴다', () => {
    let body = addEquipment(EMPTY, 's1', equipmentInput({ name: 'A' }))
    body = addEquipment(body, 's1', equipmentInput({ name: 'B' }))
    const next = removeEquipment(body, body.equipments[0]!.id)

    expect(next.equipments.map((e) => [e.name, e.order])).toEqual([['B', 0]])
  })

  it('순서를 바꾼다', () => {
    let body = addEquipment(EMPTY, 's1', equipmentInput({ name: 'A' }))
    body = addEquipment(body, 's1', equipmentInput({ name: 'B' }))
    const next = moveEquipment(body, body.equipments[1]!.id, -1)
    const names = [...next.equipments].sort((a, b) => a.order - b.order).map((e) => e.name)

    expect(names).toEqual(['B', 'A'])
  })
})
