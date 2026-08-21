import { describe, expect, it } from 'vitest'
import { summarize } from './summary'
import type { CableRecord, EquipmentRecord, ProjectBody } from '../types'

let counter = 0
function cable(cableType: string, quantityExpr: string): CableRecord {
  counter += 1
  return {
    id: `c${counter}`,
    sectionId: 's1',
    cableType,
    from: '',
    to: '',
    quantityExpr,
    note: '',
    order: 0,
  }
}

function equipment(
  kind: 'replace' | 'new',
  name: string,
  qty: number,
  spec = '',
): EquipmentRecord {
  counter += 1
  return { id: `e${counter}`, sectionId: 's1', kind, name, qty, spec, note: '', order: 0 }
}

function body(overrides: Partial<ProjectBody> = {}): ProjectBody {
  return { sections: [], cables: [], equipments: [], ...overrides }
}

describe('summarize — 케이블', () => {
  it('같은 종류의 물량을 합산한다', () => {
    const result = summarize(
      body({ cables: [cable('CV 25sq', '10+10'), cable('CV 25sq', '5'), cable('HFIX', '3')] }),
    )

    expect(result.cables).toEqual([
      { cableType: 'CV 25sq', totalLength: 25, count: 2, invalidCount: 0 },
      { cableType: 'HFIX', totalLength: 3, count: 1, invalidCount: 0 },
    ])
  })

  it('물량이 많은 종류를 위에 둔다', () => {
    const result = summarize(body({ cables: [cable('A', '5'), cable('B', '100')] }))

    expect(result.cables.map((row) => row.cableType)).toEqual(['B', 'A'])
  })

  it('앞뒤 공백과 대소문자가 달라도 같은 종류로 묶는다', () => {
    const result = summarize(body({ cables: [cable('CV 25sq', '10'), cable(' cv 25SQ ', '10')] }))

    expect(result.cables).toHaveLength(1)
    expect(result.cables[0]?.totalLength).toBe(20)
    // 표기는 처음 등장한 것을 그대로 쓴다
    expect(result.cables[0]?.cableType).toBe('CV 25sq')
  })

  it('계산할 수 없는 수식은 합계에서 빼고 건수로 알린다', () => {
    const result = summarize(body({ cables: [cable('CV', '10'), cable('CV', '2++3')] }))

    expect(result.cables[0]).toEqual({ cableType: 'CV', totalLength: 10, count: 2, invalidCount: 1 })
    expect(result.invalidQuantityCount).toBe(1)
    expect(result.totalCableLength).toBe(10)
  })

  it('물량을 비워 둔 기록은 오류가 아니라 0 으로 센다', () => {
    const result = summarize(body({ cables: [cable('CV', '')] }))

    expect(result.invalidQuantityCount).toBe(0)
    expect(result.totalCableCount).toBe(1)
    expect(result.totalCableLength).toBe(0)
  })

  it('종류를 비워 두면 미기재로 묶는다', () => {
    const result = summarize(body({ cables: [cable('  ', '10')] }))

    expect(result.cables[0]?.cableType).toBe('(종류 미기재)')
  })

  it('소수 합산에서 부동소수점 찌꺼기가 남지 않는다', () => {
    const result = summarize(body({ cables: [cable('CV', '0.1'), cable('CV', '0.2')] }))

    expect(result.totalCableLength).toBe(0.3)
  })
})

describe('summarize — 장비', () => {
  it('교체와 신규를 나눠서 센다', () => {
    const result = summarize(
      body({
        equipments: [
          equipment('replace', 'MCCB', 2),
          equipment('new', '계전기', 3),
          equipment('replace', 'MCCB', 1),
        ],
      }),
    )

    expect(result.replacements).toEqual([
      { kind: 'replace', name: 'MCCB', spec: '', totalQty: 3, count: 2 },
    ])
    expect(result.additions).toEqual([{ kind: 'new', name: '계전기', spec: '', totalQty: 3, count: 1 }])
    expect(result.totalReplacementQty).toBe(3)
    expect(result.totalAdditionQty).toBe(3)
  })

  it('규격이 다르면 다른 줄로 센다', () => {
    const result = summarize(
      body({
        equipments: [equipment('replace', 'MCCB', 1, 'A형'), equipment('replace', 'MCCB', 1, 'B형')],
      }),
    )

    expect(result.replacements).toHaveLength(2)
  })

  it('같은 장비를 교체와 신규 양쪽에 적으면 따로 센다', () => {
    const result = summarize(
      body({ equipments: [equipment('replace', 'MCCB', 1), equipment('new', 'MCCB', 1)] }),
    )

    expect(result.replacements).toHaveLength(1)
    expect(result.additions).toHaveLength(1)
  })
})

describe('summarize — 빈 상태', () => {
  it('기록이 없으면 모든 값이 0 이다', () => {
    const result = summarize(body())

    expect(result).toEqual({
      cables: [],
      totalCableLength: 0,
      totalCableCount: 0,
      invalidQuantityCount: 0,
      replacements: [],
      additions: [],
      totalReplacementQty: 0,
      totalAdditionQty: 0,
    })
  })
})
