import { log } from './logger'
import type { ProjectBody } from '../types'

/**
 * 이전에 적은 값을 다시 꺼내 쓰기 위한 제안 목록.
 *
 * 현장 명칭은 회사·현장마다 달라서 고정 목록을 미리 넣어 두는 것이 오히려 방해가 된다.
 * 그래서 사용자가 실제로 적은 값만 모아 둔다. 지금 보고 있는 공사에서 쓴 값을 앞에 두고,
 * 그 뒤에 다른 공사에서 최근에 쓴 값을 붙인다.
 */

export type SuggestField = 'cableType' | 'from' | 'to' | 'equipmentName' | 'equipmentSpec'

const KEY_PREFIX = 'cablenote.recent.'
/** 필드당 보관할 최근 값 개수. 너무 많으면 제안이 오히려 뒤죽박죽이 된다. */
const RECENT_LIMIT = 40
const SUGGEST_LIMIT = 6

function readRecent(field: SuggestField): string[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + field)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch (error) {
    log.warn('recent_read_failed', { field }, error)
    return []
  }
}

/** 방금 쓴 값을 맨 앞으로 올린다. 저장 실패는 무시한다 — 제안은 없어도 입력은 된다. */
export function rememberValue(field: SuggestField, value: string): void {
  const trimmed = value.trim()
  if (trimmed === '') return

  try {
    const next = [trimmed, ...readRecent(field).filter((v) => v !== trimmed)].slice(0, RECENT_LIMIT)
    localStorage.setItem(KEY_PREFIX + field, JSON.stringify(next))
  } catch (error) {
    log.warn('recent_write_failed', { field }, error)
  }
}

/** 지금 편집 중인 공사 안에서 쓰인 값을 많이 쓴 순서로 모은다. */
export function valuesInProject(body: ProjectBody, field: SuggestField): string[] {
  const counter = new Map<string, number>()

  const bump = (value: string): void => {
    const trimmed = value.trim()
    if (trimmed === '') return
    counter.set(trimmed, (counter.get(trimmed) ?? 0) + 1)
  }

  if (field === 'cableType') for (const cable of body.cables) bump(cable.cableType)
  else if (field === 'from') for (const cable of body.cables) bump(cable.from)
  else if (field === 'to') for (const cable of body.cables) bump(cable.to)
  else if (field === 'equipmentName') for (const item of body.equipments) bump(item.name)
  else for (const item of body.equipments) bump(item.spec)

  return [...counter.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value)
}

/**
 * 입력창 아래에 보여 줄 제안.
 * query 가 비어 있으면 자주·최근에 쓴 값을, 적혀 있으면 그 글자가 들어간 값만 보여 준다.
 */
export function suggestValues(options: {
  field: SuggestField
  body: ProjectBody
  query: string
  limit?: number
}): string[] {
  const { field, body, query, limit = SUGGEST_LIMIT } = options
  const needle = query.trim().toLowerCase()

  const ordered = [...valuesInProject(body, field), ...readRecent(field)]

  const seen = new Set<string>()
  const result: string[] = []

  for (const candidate of ordered) {
    const key = candidate.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    // 이미 똑같이 적어 놓은 값을 다시 제안하지 않는다
    if (key === needle) continue
    if (needle !== '' && !key.includes(needle)) continue

    result.push(candidate)
    if (result.length >= limit) break
  }

  return result
}
