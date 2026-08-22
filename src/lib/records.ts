import type { CableRecord, EquipmentRecord, Id, ProjectBody } from '../types'
import { newId } from './id'

/** 케이블·장비 기록을 더하고 고치고 지우는 순수 함수 모음. 항상 새 본문을 돌려준다. */

export type CableInput = Omit<CableRecord, 'id' | 'sectionId' | 'order'>
export type EquipmentInput = Omit<EquipmentRecord, 'id' | 'sectionId' | 'order'>

/*
 * 기록을 새로 만드는 함수는 본문과 함께 방금 만든 것의 식별자를 돌려준다.
 * 화면이 그 줄을 찾아 잠시 표시해 주기 위해서다 (addSection 과 같은 방식).
 * 복제는 원본을 찾지 못하면 아무것도 만들지 않으므로 식별자가 null 이 될 수 있다.
 */


function nextOrder(rows: readonly { sectionId: Id; order: number }[], sectionId: Id): number {
  let max = -1
  for (const row of rows) {
    if (row.sectionId === sectionId && row.order > max) max = row.order
  }
  return max + 1
}

/** 같은 항목에 속한 기록들의 order 를 0,1,2… 로 다시 매긴다. */
function renumber<T extends { sectionId: Id; order: number }>(rows: T[], sectionId: Id): T[] {
  const ordered = rows
    .filter((row) => row.sectionId === sectionId)
    .sort((a, b) => a.order - b.order)
    .map((row, index) => [row, index] as const)

  const orderByRow = new Map<T, number>(ordered)
  return rows.map((row) => {
    const order = orderByRow.get(row)
    return order === undefined ? row : { ...row, order }
  })
}

function move<T extends { id: Id; sectionId: Id; order: number }>(
  rows: T[],
  id: Id,
  direction: -1 | 1,
): T[] | null {
  const target = rows.find((row) => row.id === id)
  if (!target) return null

  const siblings = rows.filter((row) => row.sectionId === target.sectionId).sort((a, b) => a.order - b.order)
  const index = siblings.findIndex((row) => row.id === id)
  const swapWith = siblings[index + direction]
  if (index === -1 || swapWith === undefined) return null

  const orderById = new Map<Id, number>()
  siblings.forEach((row, i) => orderById.set(row.id, i))
  orderById.set(target.id, index + direction)
  orderById.set(swapWith.id, index)

  return rows.map((row) => {
    const order = orderById.get(row.id)
    return order === undefined ? row : { ...row, order }
  })
}

// ---------- 케이블 ----------

export function addCable(
  body: ProjectBody,
  sectionId: Id,
  input: CableInput,
): { body: ProjectBody; cableId: Id } {
  const cable: CableRecord = {
    ...input,
    id: newId(),
    sectionId,
    order: nextOrder(body.cables, sectionId),
  }
  return {
    body: { ...body, cables: [...body.cables, cable] },
    cableId: cable.id,
  }
}

export function updateCable(body: ProjectBody, cableId: Id, input: CableInput): ProjectBody {
  return {
    ...body,
    cables: body.cables.map((cable) => (cable.id === cableId ? { ...cable, ...input } : cable)),
  }
}

export function removeCable(body: ProjectBody, cableId: Id): ProjectBody {
  const target = body.cables.find((cable) => cable.id === cableId)
  if (!target) return body

  const remaining = body.cables.filter((cable) => cable.id !== cableId)
  return { ...body, cables: renumber(remaining, target.sectionId) }
}

/** 같은 규격을 여러 구간에 적을 때 쓴다. 바로 아래에 사본을 넣는다. */
export function duplicateCable(body: ProjectBody, cableId: Id): { body: ProjectBody; cableId: Id | null } {
  const target = body.cables.find((cable) => cable.id === cableId)
  if (!target) return { body, cableId: null }

  const copy: CableRecord = { ...target, id: newId(), order: target.order + 0.5 }
  return {
    body: { ...body, cables: renumber([...body.cables, copy], target.sectionId) },
    cableId: copy.id,
  }
}

export function moveCable(body: ProjectBody, cableId: Id, direction: -1 | 1): ProjectBody {
  const moved = move(body.cables, cableId, direction)
  return moved === null ? body : { ...body, cables: moved }
}

// ---------- 장비 ----------

export function addEquipment(
  body: ProjectBody,
  sectionId: Id,
  input: EquipmentInput,
): { body: ProjectBody; equipmentId: Id } {
  const equipment: EquipmentRecord = {
    ...input,
    id: newId(),
    sectionId,
    order: nextOrder(body.equipments, sectionId),
  }
  return {
    body: { ...body, equipments: [...body.equipments, equipment] },
    equipmentId: equipment.id,
  }
}

export function updateEquipment(body: ProjectBody, equipmentId: Id, input: EquipmentInput): ProjectBody {
  return {
    ...body,
    equipments: body.equipments.map((item) => (item.id === equipmentId ? { ...item, ...input } : item)),
  }
}

export function removeEquipment(body: ProjectBody, equipmentId: Id): ProjectBody {
  const target = body.equipments.find((item) => item.id === equipmentId)
  if (!target) return body

  const remaining = body.equipments.filter((item) => item.id !== equipmentId)
  return { ...body, equipments: renumber(remaining, target.sectionId) }
}

export function duplicateEquipment(
  body: ProjectBody,
  equipmentId: Id,
): { body: ProjectBody; equipmentId: Id | null } {
  const target = body.equipments.find((item) => item.id === equipmentId)
  if (!target) return { body, equipmentId: null }

  const copy: EquipmentRecord = { ...target, id: newId(), order: target.order + 0.5 }
  return {
    body: { ...body, equipments: renumber([...body.equipments, copy], target.sectionId) },
    equipmentId: copy.id,
  }
}

export function moveEquipment(body: ProjectBody, equipmentId: Id, direction: -1 | 1): ProjectBody {
  const moved = move(body.equipments, equipmentId, direction)
  return moved === null ? body : { ...body, equipments: moved }
}
