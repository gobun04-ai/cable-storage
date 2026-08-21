import { describe, expect, it } from 'vitest'
import { buildWorkbookSheets } from './exportXlsx'
import type { Project } from '../types'
import type { Cell, SheetData } from 'write-excel-file/browser'

const NOW = new Date(2026, 7, 21, 9, 30).getTime()

const PROJECT: Project = {
  id: 'p1',
  name: 'A공장 증설',
  site: '1공장동',
  memo: '',
  createdAt: NOW,
  updatedAt: NOW,
  counts: { sections: 0, cables: 0, equipments: 0 },
  body: {
    sections: [
      { id: 's1', parentId: null, title: '1층 전기실', memo: '', order: 0 },
      { id: 's1a', parentId: 's1', title: 'MCC반', memo: '', order: 0 },
    ],
    cables: [
      {
        id: 'c1',
        sectionId: 's1a',
        cableType: 'CV 25sq',
        from: 'MCC반',
        to: 'P-101',
        quantityExpr: '10+10',
        note: '트레이',
        order: 0,
      },
      {
        id: 'c2',
        sectionId: 's1a',
        cableType: 'HFIX',
        from: '',
        to: '',
        quantityExpr: '2++3',
        note: '',
        order: 1,
      },
    ],
    equipments: [
      { id: 'e1', sectionId: 's1a', kind: 'replace', name: 'MCCB', qty: 2, spec: 'A형', note: '', order: 0 },
      { id: 'e2', sectionId: 's1', kind: 'new', name: '계전기', qty: 1, spec: '', note: '', order: 0 },
    ],
  },
}

/** 셀에서 값만 꺼낸다. 빈 셀은 null */
function valueOf(cell: Cell): unknown {
  if (cell === null || cell === undefined) return null
  if (typeof cell === 'object' && 'value' in cell) return cell.value ?? null
  return cell
}

function valuesOf(rows: SheetData, rowIndex: number): unknown[] {
  return (rows[rowIndex] ?? []).map(valueOf)
}

function sheetNamed(project: Project, name: string): SheetData {
  const sheet = buildWorkbookSheets(project, NOW).find((item) => item.sheet === name)
  if (!sheet) throw new Error(`${name} 시트를 찾지 못했습니다.`)
  return sheet.data
}

describe('buildWorkbookSheets', () => {
  it('케이블·장비·집계 세 장을 만든다', () => {
    expect(buildWorkbookSheets(PROJECT, NOW).map((sheet) => sheet.sheet)).toEqual(['케이블', '장비', '집계'])
  })

  it('모든 시트에 열 너비를 지정한다', () => {
    for (const sheet of buildWorkbookSheets(PROJECT, NOW)) {
      expect(sheet.columns?.length).toBeGreaterThan(0)
    }
  })
})

describe('케이블 시트', () => {
  const rows = sheetNamed(PROJECT, '케이블')

  it('첫 줄에 머리글을 둔다', () => {
    expect(valuesOf(rows, 0)).toEqual([
      '번호',
      '항목 경로',
      '케이블 종류',
      '시작점(From)',
      '종단(To)',
      '물량 수식',
      '합계(m)',
      '비고',
      '확인',
    ])
  })

  it('수식과 계산된 합계를 함께 적는다', () => {
    expect(valuesOf(rows, 1)).toEqual([
      '1.1',
      '1층 전기실 > MCC반',
      'CV 25sq',
      'MCC반',
      'P-101',
      '10+10',
      20,
      '트레이',
      null,
    ])
  })

  it('합계를 숫자 형식으로 넣는다', () => {
    const cell = rows[1]?.[6]

    expect(typeof cell === 'object' && cell !== null && 'type' in cell ? cell.type : null).toBe(Number)
  })

  it('계산할 수 없는 수식은 합계를 비우고 확인 표시를 남긴다', () => {
    const row = valuesOf(rows, 2)

    expect(row[5]).toBe('2++3')
    expect(row[6]).toBeNull()
    expect(row[8]).toBe('수식 확인 필요')
  })
})

describe('장비 시트', () => {
  const rows = sheetNamed(PROJECT, '장비')

  it('교체와 신규를 글자로 구분해 적는다', () => {
    const kinds = rows.slice(1).map((row) => valueOf(row[2]))

    expect(kinds).toContain('교체')
    expect(kinds).toContain('신규')
  })

  it('수량을 숫자로 넣는다', () => {
    const mccb = rows.slice(1).find((row) => valueOf(row[3]) === 'MCCB')

    expect(valueOf(mccb?.[4] ?? null)).toBe(2)
  })

  it('상위 항목의 장비를 먼저 적는다', () => {
    const names = rows.slice(1).map((row) => valueOf(row[3]))

    expect(names).toEqual(['계전기', 'MCCB'])
  })
})

describe('집계 시트', () => {
  const rows = sheetNamed(PROJECT, '집계')
  const flat = rows.map((row) => row.map(valueOf))

  it('공사명과 현장을 맨 위에 적는다', () => {
    expect(flat[0]?.[0]).toBe('A공장 증설')
    expect(flat[1]).toEqual(['현장', '1공장동'])
  })

  it('케이블 합계 줄을 넣는다', () => {
    const totalRow = flat.find((row) => row[0] === '합계' && typeof row[1] === 'number')

    expect(totalRow?.[1]).toBe(20)
  })

  it('계산하지 못한 수식이 있으면 알린다', () => {
    const notice = flat.find((row) => typeof row[0] === 'string' && row[0].includes('계산할 수 없어'))

    expect(notice).toBeDefined()
  })
})

describe('빈 공사', () => {
  const empty: Project = {
    ...PROJECT,
    body: { sections: [], cables: [], equipments: [] },
  }

  it('기록이 없어도 시트를 만들고 빈 상태를 적는다', () => {
    expect(valuesOf(sheetNamed(empty, '케이블'), 1)).toEqual(['등록된 케이블이 없습니다'])
    expect(valuesOf(sheetNamed(empty, '장비'), 1)).toEqual(['등록된 장비가 없습니다'])
  })

  it('집계 시트도 오류 없이 만들어진다', () => {
    expect(() => sheetNamed(empty, '집계')).not.toThrow()
  })
})
