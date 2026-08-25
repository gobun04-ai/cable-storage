import { describe, expect, it } from 'vitest'
import {
  addSection,
  buildTree,
  collectSubtreeIds,
  countSubtree,
  duplicateSection,
  flattenTree,
  moveSection,
  normalizeOrders,
  removeSection,
  reorderSection,
  updateSection,
} from './tree'
import type { CableRecord, EquipmentRecord, ProjectBody, Section } from '../types'

function section(id: string, parentId: string | null, order: number, title = id): Section {
  return { id, parentId, title, memo: '', order }
}

function cable(id: string, sectionId: string, order = 0): CableRecord {
  return { id, sectionId, cableType: 'CV 4C 25sq', from: 'A', to: 'B', quantityExpr: '10', note: '', order }
}

function equipment(id: string, sectionId: string, order = 0): EquipmentRecord {
  return { id, sectionId, kind: 'replace', name: 'MCCB', qty: 1, spec: '', note: '', order }
}

/**
 *  s1
 *   └ s1a
 *      └ s1a1
 *   └ s1b
 *  s2
 */
function sampleBody(): ProjectBody {
  return {
    sections: [
      section('s1', null, 0),
      section('s2', null, 1),
      section('s1a', 's1', 0),
      section('s1b', 's1', 1),
      section('s1a1', 's1a', 0),
    ],
    cables: [cable('c1', 's1a1'), cable('c2', 's1b')],
    equipments: [equipment('e1', 's1a1')],
  }
}

describe('buildTree', () => {
  it('중첩 단계에 맞춰 1, 1.1, 1.1.1 형태로 번호를 매긴다', () => {
    const tree = buildTree(sampleBody())
    const numbering = flattenTree(tree).map((node) => `${node.numbering} ${node.section.id}`)

    expect(numbering).toEqual(['1 s1', '1.1 s1a', '1.1.1 s1a1', '1.2 s1b', '2 s2'])
  })

  it('배열에 담긴 순서가 아니라 order 값 순서로 정렬한다', () => {
    const body: ProjectBody = {
      sections: [section('b', null, 1), section('a', null, 0)],
      cables: [],
      equipments: [],
    }

    expect(buildTree(body).map((n) => n.section.id)).toEqual(['a', 'b'])
  })

  it('깊이를 0부터 센다', () => {
    const tree = buildTree(sampleBody())
    const depths = flattenTree(tree).map((node) => node.depth)

    expect(depths).toEqual([0, 1, 2, 1, 0])
  })

  it('케이블과 장비를 소속 항목에 붙이고 order 순으로 정렬한다', () => {
    const body: ProjectBody = {
      sections: [section('s1', null, 0)],
      cables: [cable('c2', 's1', 1), cable('c1', 's1', 0)],
      equipments: [equipment('e1', 's1', 0)],
    }
    const [node] = buildTree(body)

    expect(node?.cables.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(node?.equipments.map((e) => e.id)).toEqual(['e1'])
  })

  it('부모가 사라진 항목을 버리지 않고 최상위로 끌어올린다', () => {
    const body: ProjectBody = {
      sections: [section('orphan', 'gone', 0)],
      cables: [],
      equipments: [],
    }

    expect(buildTree(body).map((n) => n.section.id)).toEqual(['orphan'])
  })

  it('부모-자식이 고리를 이뤄도 무한 재귀에 빠지지 않는다', () => {
    const body: ProjectBody = {
      sections: [section('a', 'b', 0), section('b', 'a', 0)],
      cables: [],
      equipments: [],
    }

    // 고리를 이룬 항목은 최상위 후보가 없으므로 화면에 나오지 않지만, 멈추지 않고 끝나야 한다
    expect(() => buildTree(body)).not.toThrow()
  })

  it('항목이 하나도 없으면 빈 배열을 돌려준다', () => {
    expect(buildTree({ sections: [], cables: [], equipments: [] })).toEqual([])
  })
})

describe('addSection', () => {
  it('같은 부모의 마지막 순서 뒤에 붙인다', () => {
    const { body, sectionId } = addSection(sampleBody(), 's1', '새 항목')
    const added = body.sections.find((s) => s.id === sectionId)

    expect(added?.parentId).toBe('s1')
    expect(added?.order).toBe(2)
  })

  it('parentId 가 null 이면 최상위에 붙인다', () => {
    const { body, sectionId } = addSection(sampleBody(), null, '새 항목')
    const added = body.sections.find((s) => s.id === sectionId)

    expect(added?.parentId).toBeNull()
    expect(added?.order).toBe(2)
  })

  it('원본 본문을 바꾸지 않는다', () => {
    const original = sampleBody()
    addSection(original, null, '새 항목')

    expect(original.sections).toHaveLength(5)
  })
})

describe('updateSection', () => {
  it('지정한 항목만 고친다', () => {
    const body = updateSection(sampleBody(), 's1a', { title: '바뀐 이름', memo: '메모' })

    expect(body.sections.find((s) => s.id === 's1a')?.title).toBe('바뀐 이름')
    expect(body.sections.find((s) => s.id === 's1')?.title).toBe('s1')
  })
})

describe('removeSection', () => {
  it('하위 항목과 그 안의 케이블·장비까지 함께 지운다', () => {
    const body = removeSection(sampleBody(), 's1')

    expect(body.sections.map((s) => s.id)).toEqual(['s2'])
    expect(body.cables).toHaveLength(0)
    expect(body.equipments).toHaveLength(0)
  })

  it('형제 항목과 그 기록은 건드리지 않는다', () => {
    const body = removeSection(sampleBody(), 's1a')

    expect(body.sections.map((s) => s.id).sort()).toEqual(['s1', 's1b', 's2'])
    expect(body.cables.map((c) => c.id)).toEqual(['c2'])
  })

  it('삭제 후 남은 형제의 순서를 0부터 다시 매긴다', () => {
    const body = removeSection(sampleBody(), 's1a')
    const s1b = body.sections.find((s) => s.id === 's1b')

    expect(s1b?.order).toBe(0)
  })

  it('없는 항목을 지우려 해도 내용이 그대로 남는다', () => {
    const body = removeSection(sampleBody(), 'nope')

    expect(body.sections).toHaveLength(5)
  })
})

describe('duplicateSection', () => {
  const WITH = { withRecords: true }
  const WITHOUT = { withRecords: false }

  it('하위 항목과 그 안의 케이블·장비까지 복제한다', () => {
    const { body } = duplicateSection(sampleBody(), 's1', WITH)

    // s1 아래는 s1a, s1a1, s1b — 자기 자신까지 넷이 늘어난다
    expect(body.sections).toHaveLength(9)
    expect(body.cables).toHaveLength(4)
    expect(body.equipments).toHaveLength(2)
  })

  it('사본에 새 식별자를 매겨 원본과 겹치지 않게 한다', () => {
    const { body, sectionId } = duplicateSection(sampleBody(), 's1', WITH)
    const ids = body.sections.map((s) => s.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(sectionId).not.toBe('s1')
    expect(ids).toContain(sectionId)
  })

  it('사본을 원본 바로 아래 형제 자리에 넣는다', () => {
    const { body, sectionId } = duplicateSection(sampleBody(), 's1', WITH)
    const roots = buildTree(body).map((node) => node.section.id)

    expect(roots).toEqual(['s1', sectionId, 's2'])
  })

  it('사본 안의 부모-자식 관계를 그대로 옮긴다', () => {
    const { body, sectionId } = duplicateSection(sampleBody(), 's1', WITH)
    const copy = buildTree(body).find((node) => node.section.id === sectionId)

    expect(copy?.children.map((child) => child.section.title)).toEqual(['s1a', 's1b'])
    expect(copy?.children[0]?.children.map((child) => child.section.title)).toEqual(['s1a1'])
  })

  it('맨 위 항목 이름에만 (사본) 을 붙인다', () => {
    const { body, sectionId } = duplicateSection(sampleBody(), 's1', WITH)
    const copy = buildTree(body).find((node) => node.section.id === sectionId)

    expect(copy?.section.title).toBe('s1 (사본)')
    expect(copy?.children.map((child) => child.section.title)).toEqual(['s1a', 's1b'])
  })

  it('복제한 기록은 사본 항목에 붙는다', () => {
    const { body, sectionId } = duplicateSection(sampleBody(), 's1', WITH)
    const copy = buildTree(body).find((node) => node.section.id === sectionId)
    const copiedDeep = copy?.children[0]?.children[0]

    expect(copiedDeep?.cables).toHaveLength(1)
    expect(copiedDeep?.cables[0]?.id).not.toBe('c1')
  })

  it('구조만 복제하면 케이블·장비는 딸려오지 않는다', () => {
    const { body, sectionId } = duplicateSection(sampleBody(), 's1', WITHOUT)
    const copy = buildTree(body).find((node) => node.section.id === sectionId)

    expect(body.sections).toHaveLength(9)
    expect(body.cables).toHaveLength(2)
    expect(body.equipments).toHaveLength(1)
    expect(copy?.children[0]?.children[0]?.cables).toHaveLength(0)
  })

  it('하위가 없는 항목도 복제한다', () => {
    const { body, sectionId } = duplicateSection(sampleBody(), 's2', WITH)

    expect(body.sections).toHaveLength(6)
    expect(buildTree(body).map((node) => node.section.id)).toEqual(['s1', 's2', sectionId])
  })

  it('없는 항목을 복제하려 하면 본문을 그대로 두고 식별자는 비운다', () => {
    const before = sampleBody()
    const result = duplicateSection(before, 'nope', WITH)

    expect(result.body).toBe(before)
    expect(result.sectionId).toBeNull()
  })

  it('원본 본문을 고치지 않는다', () => {
    const before = sampleBody()
    duplicateSection(before, 's1', WITH)

    expect(before.sections).toHaveLength(5)
    expect(before.cables).toHaveLength(2)
  })
})

describe('moveSection', () => {
  it('같은 부모 안에서 한 칸 위로 옮긴다', () => {
    const body = moveSection(sampleBody(), 's1b', -1)
    const order = buildTree(body)[0]?.children.map((n) => n.section.id)

    expect(order).toEqual(['s1b', 's1a'])
  })

  it('같은 부모 안에서 한 칸 아래로 옮긴다', () => {
    const body = moveSection(sampleBody(), 's1', 1)

    expect(buildTree(body).map((n) => n.section.id)).toEqual(['s2', 's1'])
  })

  it('맨 위에서 더 올리면 아무 변화가 없다', () => {
    const before = sampleBody()
    const after = moveSection(before, 's1a', -1)

    expect(after).toBe(before)
  })

  it('맨 아래에서 더 내리면 아무 변화가 없다', () => {
    const before = sampleBody()
    const after = moveSection(before, 's2', 1)

    expect(after).toBe(before)
  })

  it('다른 부모의 항목과 섞이지 않는다', () => {
    const body = moveSection(sampleBody(), 's2', -1)

    expect(buildTree(body).map((n) => n.section.id)).toEqual(['s2', 's1'])
  })
})

describe('reorderSection', () => {
  /** s1 아래 형제 순서를 읽는다 */
  function childrenOfS1(body: ProjectBody): (string | undefined)[] {
    return buildTree(body)[0]?.children.map((node) => node.section.id) ?? []
  }

  it('형제 안에서 지정한 자리로 옮긴다', () => {
    const body: ProjectBody = {
      ...sampleBody(),
      sections: [
        section('s1', null, 0),
        section('a', 's1', 0),
        section('b', 's1', 1),
        section('c', 's1', 2),
      ],
    }

    expect(childrenOfS1(reorderSection(body, 'c', 0))).toEqual(['c', 'a', 'b'])
    expect(childrenOfS1(reorderSection(body, 'a', 2))).toEqual(['b', 'c', 'a'])
    expect(childrenOfS1(reorderSection(body, 'a', 1))).toEqual(['b', 'a', 'c'])
  })

  it('옮긴 뒤 형제 순서를 0부터 빈틈없이 다시 매긴다', () => {
    const body = reorderSection(sampleBody(), 's1b', 0)
    const orders = body.sections.filter((s) => s.parentId === 's1').map((s) => s.order)

    expect([...orders].sort()).toEqual([0, 1])
  })

  it('범위를 벗어난 자리는 양 끝으로 붙인다', () => {
    const body = sampleBody()

    expect(childrenOfS1(reorderSection(body, 's1a', 99))).toEqual(['s1b', 's1a'])
    expect(childrenOfS1(reorderSection(body, 's1b', -5))).toEqual(['s1b', 's1a'])
  })

  it('제자리로 옮기면 본문을 그대로 돌려준다', () => {
    const before = sampleBody()

    expect(reorderSection(before, 's1a', 0)).toBe(before)
  })

  it('다른 부모의 항목은 건드리지 않는다', () => {
    const body = reorderSection(sampleBody(), 's1b', 0)
    const roots = buildTree(body).map((node) => node.section.id)

    expect(roots).toEqual(['s1', 's2'])
  })

  it('없는 항목을 옮기려 하면 본문을 그대로 돌려준다', () => {
    const before = sampleBody()

    expect(reorderSection(before, 'nope', 1)).toBe(before)
  })

  it('원본 본문을 고치지 않는다', () => {
    const before = sampleBody()
    reorderSection(before, 's1b', 0)

    expect(before.sections.find((s) => s.id === 's1b')?.order).toBe(1)
  })
})

describe('collectSubtreeIds', () => {
  it('자기 자신과 모든 자손을 모은다', () => {
    const ids = collectSubtreeIds(sampleBody().sections, 's1')

    expect([...ids].sort()).toEqual(['s1', 's1a', 's1a1', 's1b'])
  })

  it('자식이 없으면 자기 자신만 담는다', () => {
    const ids = collectSubtreeIds(sampleBody().sections, 's2')

    expect([...ids]).toEqual(['s2'])
  })
})

describe('countSubtree', () => {
  it('자기 것과 하위 전체의 개수를 합산한다', () => {
    const [first] = buildTree(sampleBody())
    const counts = countSubtree(first!)

    expect(counts).toEqual({ cables: 2, equipments: 1, descendants: 3 })
  })
})

describe('normalizeOrders', () => {
  it('형제 그룹마다 0부터 빈틈없이 다시 매긴다', () => {
    const sections = [section('a', null, 5), section('b', null, 9), section('c', 'a', 3)]
    const result = normalizeOrders(sections)

    expect(result.map((s) => [s.id, s.order])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 0],
    ])
  })
})
