import { describe, expect, it } from 'vitest'
import { buildShareText } from './exportText'
import { summarize } from './summary'
import { buildTree, flattenTree } from './tree'
import type { CableRecord, EquipmentRecord, Project, ProjectBody, Section } from '../types'

/**
 * 큰 공사에서도 화면이 멈추지 않는지 확인한다.
 * 계획서에서 잡은 기준은 1,000개 규모다. 실제 현장은 이보다 훨씬 작다.
 */

/** 항목 1,000개(5단계 깊이) + 케이블 2,000건 + 장비 1,000건 */
function hugeBody(): ProjectBody {
  const sections: Section[] = []
  const cables: CableRecord[] = []
  const equipments: EquipmentRecord[] = []

  const perLevel = 200
  let previousLevel: string[] = []

  for (let depth = 0; depth < 5; depth += 1) {
    const currentLevel: string[] = []

    for (let index = 0; index < perLevel; index += 1) {
      const id = `s-${depth}-${index}`
      const parentId = depth === 0 ? null : (previousLevel[index % previousLevel.length] ?? null)
      sections.push({ id, parentId, title: `구역 ${depth}-${index}`, memo: '', order: index })
      currentLevel.push(id)

      for (let n = 0; n < 2; n += 1) {
        cables.push({
          id: `c-${depth}-${index}-${n}`,
          sectionId: id,
          cableType: `CV ${(index % 7) + 1}C ${(index % 5) * 10 + 4}sq`,
          from: `반 ${index}`,
          to: `부하 ${n}`,
          quantityExpr: '12+8+5.5+3',
          note: '',
          order: n,
        })
      }

      equipments.push({
        id: `e-${depth}-${index}`,
        sectionId: id,
        kind: index % 2 === 0 ? 'replace' : 'new',
        name: `장비 ${index % 20}`,
        qty: (index % 3) + 1,
        spec: `모델 ${index % 8}`,
        note: '',
        order: 0,
      })
    }

    previousLevel = currentLevel
  }

  return { sections, cables, equipments }
}

const BODY = hugeBody()

function elapsed(run: () => void): number {
  const start = performance.now()
  run()
  return performance.now() - start
}

describe('큰 공사 처리 속도', () => {
  it('항목 1,000개 / 케이블 2,000건 / 장비 1,000건을 만든다', () => {
    expect(BODY.sections).toHaveLength(1000)
    expect(BODY.cables).toHaveLength(2000)
    expect(BODY.equipments).toHaveLength(1000)
  })

  it('트리를 조립하는 데 한 프레임(16ms) 안팎이면 화면이 버벅이지 않는다', () => {
    const ms = elapsed(() => buildTree(BODY))

    // 기기 성능 차이를 감안해 넉넉히 잡되, 눈에 띄게 느려지면 잡히도록 상한을 둔다
    expect(ms).toBeLessThan(200)
  })

  it('모든 항목이 트리에 들어간다', () => {
    expect(flattenTree(buildTree(BODY))).toHaveLength(1000)
  })

  it('집계를 빠르게 낸다', () => {
    const ms = elapsed(() => summarize(BODY))

    expect(ms).toBeLessThan(200)
  })

  it('공유 텍스트를 만드는 데 오래 걸리지 않는다', () => {
    const project: Project = {
      id: 'p1',
      name: '대형 공사',
      site: '',
      memo: '',
      createdAt: 0,
      updatedAt: 0,
      counts: { sections: 1000, cables: 2000, equipments: 1000 },
      body: BODY,
    }

    const ms = elapsed(() => buildShareText(project, 0))

    expect(ms).toBeLessThan(500)
  })

  it('집계 결과가 실제 물량과 맞는다', () => {
    const summary = summarize(BODY)

    // 케이블 2,000건 × (12+8+5.5+3 = 28.5) m
    expect(summary.totalCableLength).toBe(2000 * 28.5)
    expect(summary.totalCableCount).toBe(2000)
    expect(summary.invalidQuantityCount).toBe(0)
  })
})
