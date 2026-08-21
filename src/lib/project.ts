import type { Id, Project, ProjectBody } from '../types'
import { newId } from './id'

export function createEmptyProject(input: { name: string; site?: string; memo?: string }): Project {
  const now = Date.now()
  return {
    id: newId(),
    name: input.name,
    site: input.site ?? '',
    memo: input.memo ?? '',
    createdAt: now,
    updatedAt: now,
    counts: { sections: 0, cables: 0, equipments: 0 },
    body: { sections: [], cables: [], equipments: [] },
  }
}

/**
 * 본문을 통째로 복사하면서 모든 식별자를 새로 발급한다.
 * 부모-자식 관계가 끊기지 않도록 옛 id → 새 id 대응표를 먼저 만든 뒤 참조를 바꾼다.
 */
export function cloneBody(body: ProjectBody): ProjectBody {
  const idMap = new Map<Id, Id>()
  for (const section of body.sections) idMap.set(section.id, newId())

  const remap = (oldId: Id): Id => idMap.get(oldId) ?? oldId

  return {
    sections: body.sections.map((section) => ({
      ...section,
      id: remap(section.id),
      parentId: section.parentId === null ? null : remap(section.parentId),
    })),
    cables: body.cables.map((cable) => ({
      ...cable,
      id: newId(),
      sectionId: remap(cable.sectionId),
    })),
    equipments: body.equipments.map((equipment) => ({
      ...equipment,
      id: newId(),
      sectionId: remap(equipment.sectionId),
    })),
  }
}

export function duplicateProject(source: Project, name: string): Project {
  const now = Date.now()
  return {
    ...source,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    body: cloneBody(source.body),
  }
}
