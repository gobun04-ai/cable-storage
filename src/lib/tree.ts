import type { Id, ProjectBody, Section, SectionNode } from '../types'
import { newId } from './id'
import { log } from './logger'

function byOrder(a: { order: number }, b: { order: number }): number {
  return a.order - b.order
}

function groupBySection<T extends { sectionId: Id; order: number }>(rows: T[]): Map<Id, T[]> {
  const map = new Map<Id, T[]>()
  for (const row of rows) {
    const list = map.get(row.sectionId)
    if (list) list.push(row)
    else map.set(row.sectionId, [row])
  }
  for (const list of map.values()) list.sort(byOrder)
  return map
}

/**
 * 평평한 배열을 화면에 그릴 트리로 조립하고 1 / 1.1 / 1.1.1 번호를 매긴다.
 * 백업 복원 등으로 부모가 사라진 항목은 버리지 않고 최상위로 끌어올린다.
 */
export function buildTree(body: ProjectBody): SectionNode[] {
  const known = new Set(body.sections.map((s) => s.id))
  const childrenOf = new Map<Id | null, Section[]>()

  for (const section of body.sections) {
    const parentId = section.parentId !== null && known.has(section.parentId) ? section.parentId : null
    if (parentId !== section.parentId) {
      log.warn('section_orphan_promoted', { sectionId: section.id })
    }
    const list = childrenOf.get(parentId)
    if (list) list.push(section)
    else childrenOf.set(parentId, [section])
  }
  for (const list of childrenOf.values()) list.sort(byOrder)

  const cablesOf = groupBySection(body.cables)
  const equipmentsOf = groupBySection(body.equipments)

  // 데이터가 깨져 부모-자식이 고리를 이루면 무한 재귀에 빠지므로 방문 여부를 추적한다.
  const visited = new Set<Id>()

  function build(parentId: Id | null, prefix: string, depth: number): SectionNode[] {
    const list = childrenOf.get(parentId) ?? []
    const nodes: SectionNode[] = []

    list.forEach((section, index) => {
      if (visited.has(section.id)) {
        log.warn('section_cycle_skipped', { sectionId: section.id })
        return
      }
      visited.add(section.id)

      const numbering = prefix === '' ? String(index + 1) : `${prefix}.${index + 1}`
      nodes.push({
        section,
        numbering,
        depth,
        children: build(section.id, numbering, depth + 1),
        cables: cablesOf.get(section.id) ?? [],
        equipments: equipmentsOf.get(section.id) ?? [],
      })
    })

    return nodes
  }

  return build(null, '', 0)
}

/** 자기 자신을 포함한 모든 하위 항목의 id */
export function collectSubtreeIds(sections: Section[], rootId: Id): Set<Id> {
  const childrenOf = new Map<Id, Id[]>()
  for (const section of sections) {
    if (section.parentId === null) continue
    const list = childrenOf.get(section.parentId)
    if (list) list.push(section.id)
    else childrenOf.set(section.parentId, [section.id])
  }

  const result = new Set<Id>([rootId])
  const queue: Id[] = [rootId]
  while (queue.length > 0) {
    const current = queue.pop()
    if (current === undefined) break
    for (const childId of childrenOf.get(current) ?? []) {
      if (result.has(childId)) continue
      result.add(childId)
      queue.push(childId)
    }
  }
  return result
}

/** 같은 부모를 가진 형제들을 order 순으로 */
function siblingsOf(sections: Section[], parentId: Id | null): Section[] {
  return sections.filter((s) => s.parentId === parentId).sort(byOrder)
}

function nextOrder(sections: Section[], parentId: Id | null): number {
  const siblings = siblingsOf(sections, parentId)
  const last = siblings[siblings.length - 1]
  return last === undefined ? 0 : last.order + 1
}

/** 항목을 추가한 새 본문과 새 항목 id를 돌려준다. */
export function addSection(
  body: ProjectBody,
  parentId: Id | null,
  title: string,
): { body: ProjectBody; sectionId: Id } {
  const section: Section = {
    id: newId(),
    parentId,
    title,
    memo: '',
    order: nextOrder(body.sections, parentId),
  }
  return {
    body: { ...body, sections: [...body.sections, section] },
    sectionId: section.id,
  }
}

export function updateSection(body: ProjectBody, sectionId: Id, patch: Partial<Omit<Section, 'id'>>): ProjectBody {
  return {
    ...body,
    sections: body.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
  }
}

/** 항목과 그 아래 모든 하위 항목·케이블·장비를 함께 지운다. */
export function removeSection(body: ProjectBody, sectionId: Id): ProjectBody {
  const doomed = collectSubtreeIds(body.sections, sectionId)
  const remaining = body.sections.filter((s) => !doomed.has(s.id))

  return {
    sections: normalizeOrders(remaining),
    cables: body.cables.filter((c) => !doomed.has(c.sectionId)),
    equipments: body.equipments.filter((e) => !doomed.has(e.sectionId)),
  }
}

/** 형제 안에서 한 칸 위/아래로 옮긴다. 끝에 닿아 있으면 원본을 그대로 돌려준다. */
export function moveSection(body: ProjectBody, sectionId: Id, direction: -1 | 1): ProjectBody {
  const target = body.sections.find((s) => s.id === sectionId)
  if (!target) return body

  const siblings = siblingsOf(body.sections, target.parentId)
  const index = siblings.findIndex((s) => s.id === sectionId)
  const swapIndex = index + direction
  const swapWith = siblings[swapIndex]
  if (index === -1 || swapWith === undefined) return body

  const orderById = new Map<Id, number>()
  siblings.forEach((s, i) => orderById.set(s.id, i))
  orderById.set(target.id, swapIndex)
  orderById.set(swapWith.id, index)

  return {
    ...body,
    sections: body.sections.map((s) => {
      const order = orderById.get(s.id)
      return order === undefined ? s : { ...s, order }
    }),
  }
}

/** 형제 그룹마다 order 를 0,1,2… 로 다시 매긴다. 삭제 후 빈 번호를 없애기 위함. */
export function normalizeOrders(sections: Section[]): Section[] {
  const counters = new Map<Id | null, number>()
  const sorted = [...sections].sort(byOrder)
  const orderById = new Map<Id, number>()

  for (const section of sorted) {
    const key = section.parentId
    const next = counters.get(key) ?? 0
    orderById.set(section.id, next)
    counters.set(key, next + 1)
  }

  return sections.map((s) => ({ ...s, order: orderById.get(s.id) ?? s.order }))
}

export interface NodeCounts {
  cables: number
  equipments: number
  /** 하위 항목 개수 (자기 자신 제외, 손자 포함) */
  descendants: number
}

/** 접힌 항목에 "케이블 3, 장비 2" 처럼 요약을 보여주기 위한 집계 */
export function countSubtree(node: SectionNode): NodeCounts {
  let cables = node.cables.length
  let equipments = node.equipments.length
  let descendants = node.children.length

  for (const child of node.children) {
    const sub = countSubtree(child)
    cables += sub.cables
    equipments += sub.equipments
    descendants += sub.descendants
  }

  return { cables, equipments, descendants }
}

/** 트리를 화면 표시 순서대로 평평하게 편다. 텍스트·엑셀 출력에서 쓴다. */
export function flattenTree(nodes: SectionNode[]): SectionNode[] {
  const out: SectionNode[] = []
  const walk = (list: SectionNode[]): void => {
    for (const node of list) {
      out.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}
