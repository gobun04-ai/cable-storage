import { describe, expect, it } from 'vitest'
import { parseBackup } from './backup'

const NOW = new Date(2026, 7, 21, 12, 0, 0).getTime()

function backupText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: 'cablenote',
    version: 1,
    exportedAt: '2026-08-21T03:00:00.000Z',
    projects: [
      {
        id: 'p1',
        name: 'A공장 증설',
        site: '1공장동',
        memo: '',
        createdAt: 1000,
        updatedAt: 2000,
        counts: { sections: 1, cables: 1, equipments: 0 },
        body: {
          sections: [{ id: 's1', parentId: null, title: '전기실', memo: '', order: 0 }],
          cables: [
            {
              id: 'c1',
              sectionId: 's1',
              cableType: 'CV 25sq',
              from: 'A',
              to: 'B',
              quantityExpr: '10',
              note: '',
              order: 0,
            },
          ],
          equipments: [],
        },
      },
    ],
    ...overrides,
  })
}

/** 성공을 기대하는 경우에만 쓰는 도우미 */
function parsed(text: string) {
  const result = parseBackup(text, NOW)
  if (!result.ok) throw new Error(`읽기에 실패했습니다: ${result.message}`)
  return result
}

function errorOf(text: string): string {
  const result = parseBackup(text, NOW)
  if (result.ok) throw new Error('오류를 기대했지만 성공했습니다.')
  return result.message
}

describe('parseBackup — 정상 파일', () => {
  it('공사와 내용을 그대로 읽는다', () => {
    const result = parsed(backupText())

    expect(result.projects).toHaveLength(1)
    expect(result.projects[0]?.name).toBe('A공장 증설')
    expect(result.projects[0]?.body.sections).toHaveLength(1)
    expect(result.projects[0]?.body.cables[0]?.cableType).toBe('CV 25sq')
  })

  it('만든 시각과 고친 시각을 보존한다', () => {
    const result = parsed(backupText())

    expect(result.projects[0]?.createdAt).toBe(1000)
    expect(result.projects[0]?.updatedAt).toBe(2000)
  })

  it('개수는 실제 내용을 다시 세어 채운다', () => {
    const result = parsed(backupText())

    expect(result.projects[0]?.counts).toEqual({ sections: 1, cables: 1, equipments: 0 })
  })

  it('내보낸 시각을 함께 돌려준다', () => {
    expect(parsed(backupText()).exportedAt).toBe('2026-08-21T03:00:00.000Z')
  })
})

describe('parseBackup — 잘못된 파일', () => {
  it('JSON 이 아니면 알려 준다', () => {
    expect(errorOf('이건 그냥 글자')).toContain('읽지 못했습니다')
  })

  it('다른 앱의 파일이면 거절한다', () => {
    expect(errorOf(JSON.stringify({ app: 'other', version: 1, projects: [] }))).toContain(
      '이 앱에서 만든 백업 파일이 아닙니다',
    )
  })

  it('더 새로운 버전이면 업데이트를 권한다', () => {
    expect(errorOf(backupText({ version: 99 }))).toContain('업데이트')
  })

  it('공사 목록이 배열이 아니면 거절한다', () => {
    expect(errorOf(backupText({ projects: '없음' }))).toContain('공사 목록이 없습니다')
  })

  it('복원할 공사가 하나도 없으면 거절한다', () => {
    expect(errorOf(backupText({ projects: [] }))).toContain('복원할 공사가 없습니다')
  })
})

describe('parseBackup — 일부가 깨진 파일', () => {
  it('이름이 없는 공사는 건너뛰고 몇 건인지 알려 준다', () => {
    const result = parsed(backupText({ projects: [{ name: '' }, JSON.parse(backupText()).projects[0]] }))

    expect(result.projects).toHaveLength(1)
    expect(result.skipped).toBe(1)
  })

  it('식별자가 없는 항목은 버린다', () => {
    const broken = JSON.parse(backupText())
    broken.projects[0].body.sections.push({ title: '식별자 없음' })
    const result = parsed(JSON.stringify(broken))

    expect(result.projects[0]?.body.sections).toHaveLength(1)
  })

  it('사라진 항목을 가리키는 케이블은 버린다', () => {
    const broken = JSON.parse(backupText())
    broken.projects[0].body.cables.push({ id: 'c2', sectionId: '없는항목', cableType: 'X' })
    const result = parsed(JSON.stringify(broken))

    expect(result.projects[0]?.body.cables).toHaveLength(1)
  })

  it('본문이 통째로 없어도 빈 공사로 살린다', () => {
    const result = parsed(backupText({ projects: [{ name: '빈 공사' }] }))

    expect(result.projects[0]?.body).toEqual({ sections: [], cables: [], equipments: [] })
  })

  it('장비 구분이 이상하면 교체로 본다', () => {
    const broken = JSON.parse(backupText())
    broken.projects[0].body.equipments.push({ id: 'e1', sectionId: 's1', name: 'X', kind: '이상한값' })
    const result = parsed(JSON.stringify(broken))

    expect(result.projects[0]?.body.equipments[0]?.kind).toBe('replace')
  })

  it('숫자 자리에 글자가 들어 있으면 기본값으로 되돌린다', () => {
    const broken = JSON.parse(backupText())
    broken.projects[0].body.sections[0].order = '첫번째'
    broken.projects[0].createdAt = '어제'
    const result = parsed(JSON.stringify(broken))

    expect(result.projects[0]?.body.sections[0]?.order).toBe(0)
    expect(result.projects[0]?.createdAt).toBe(NOW)
  })
})
