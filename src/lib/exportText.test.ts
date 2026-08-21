import { describe, expect, it } from 'vitest'
import { buildShareText } from './exportText'
import type { Project } from '../types'

/** 2026-08-21 12:00 (로컬) */
const NOW = new Date(2026, 7, 21, 12, 0, 0).getTime()

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: '2026년 A공장 증설공사',
    site: '',
    memo: '',
    createdAt: NOW,
    updatedAt: NOW,
    counts: { sections: 0, cables: 0, equipments: 0 },
    body: { sections: [], cables: [], equipments: [] },
    ...overrides,
  }
}

const SAMPLE = project({
  site: 'A공장 1공장동',
  memo: '주말 작업 예정',
  body: {
    sections: [
      { id: 's1', parentId: null, title: '1층 전기실', memo: '', order: 0 },
      { id: 's1a', parentId: 's1', title: 'MCC반', memo: '노후 반', order: 0 },
      { id: 's2', parentId: null, title: '옥외 배관', memo: '', order: 1 },
    ],
    cables: [
      {
        id: 'c1',
        sectionId: 's1a',
        cableType: 'CV 4C 25sq',
        from: 'MCC반',
        to: 'P-101',
        quantityExpr: '2+3+5',
        note: '트레이 경유',
        order: 0,
      },
      {
        id: 'c2',
        sectionId: 's2',
        cableType: 'HFIX 2.5sq',
        from: '',
        to: '',
        quantityExpr: '15',
        note: '',
        order: 0,
      },
    ],
    equipments: [
      {
        id: 'e1',
        sectionId: 's1a',
        kind: 'replace',
        name: 'MCCB 100A',
        qty: 2,
        spec: 'LS ABS103c',
        note: '',
        order: 0,
      },
      { id: 'e2', sectionId: 's1a', kind: 'new', name: '계전기', qty: 1, spec: '', note: '', order: 1 },
    ],
  },
})

describe('buildShareText — 머리말', () => {
  it('공사명을 맨 위에 둔다', () => {
    expect(buildShareText(SAMPLE, NOW).split('\n')[0]).toBe('■ 2026년 A공장 증설공사')
  })

  it('현장과 작성일을 적는다', () => {
    const text = buildShareText(SAMPLE, NOW)

    expect(text).toContain('현장 : A공장 1공장동')
    expect(text).toContain('작성 : ')
    expect(text).toContain('2026')
  })

  it('현장을 비워 두면 그 줄을 넣지 않는다', () => {
    expect(buildShareText(project(), NOW)).not.toContain('현장 :')
  })

  it('메모가 있으면 머리말에 넣는다', () => {
    expect(buildShareText(SAMPLE, NOW)).toContain('[메모]\n주말 작업 예정')
  })
})

describe('buildShareText — 본문', () => {
  const text = buildShareText(SAMPLE, NOW)

  it('항목을 번호와 함께 계층으로 적는다', () => {
    expect(text).toContain('1. 1층 전기실')
    expect(text).toContain('  1.1 MCC반')
    expect(text).toContain('2. 옥외 배관')
  })

  it('항목 메모를 표시한다', () => {
    expect(text).toContain('※ 노후 반')
  })

  it('케이블을 종류·경로·물량 순으로 한 줄에 적는다', () => {
    expect(text).toContain('· CV 4C 25sq | MCC반 → P-101 | 2+3+5 = 10 m')
  })

  it('숫자 하나만 적은 물량은 수식을 반복하지 않는다', () => {
    expect(text).toContain('· HFIX 2.5sq | 15 m')
  })

  it('케이블 비고를 다음 줄에 적는다', () => {
    expect(text).toContain('※ 트레이 경유')
  })

  it('장비를 교체·신규 표시와 함께 적는다', () => {
    expect(text).toContain('[교체] MCCB 100A × 2 (LS ABS103c)')
    expect(text).toContain('[신규] 계전기 × 1')
  })
})

describe('buildShareText — 집계', () => {
  const text = buildShareText(SAMPLE, NOW)

  it('케이블 총량과 종류별 물량을 적는다', () => {
    expect(text).toContain('[케이블] 총 25 m / 2건')
    expect(text).toContain('· HFIX 2.5sq — 15 m (1건)')
    expect(text).toContain('· CV 4C 25sq — 10 m (1건)')
  })

  it('교체와 신규 장비를 나눠 적는다', () => {
    expect(text).toContain('[교체 장비] 총 2개 / 1종')
    expect(text).toContain('[신규 장비] 총 1개 / 1종')
  })

  it('계산할 수 없는 수식이 있으면 알린다', () => {
    const broken = project({
      body: {
        sections: [{ id: 's1', parentId: null, title: '구역', memo: '', order: 0 }],
        cables: [
          {
            id: 'c1',
            sectionId: 's1',
            cableType: 'CV',
            from: '',
            to: '',
            quantityExpr: '2++3',
            note: '',
            order: 0,
          },
        ],
        equipments: [],
      },
    })
    const text = buildShareText(broken, NOW)

    expect(text).toContain('2++3 (계산 불가)')
    expect(text).toContain('물량 수식 1건은 계산할 수 없어')
  })
})

describe('buildShareText — 빈 공사', () => {
  it('항목이 없으면 그렇다고 알린다', () => {
    expect(buildShareText(project(), NOW)).toContain('(아직 등록한 항목이 없습니다)')
  })

  it('기록이 없어도 오류 없이 끝난다', () => {
    expect(() => buildShareText(project(), NOW)).not.toThrow()
  })
})
