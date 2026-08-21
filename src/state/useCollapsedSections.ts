import { useCallback, useEffect, useState } from 'react'
import { log } from '../lib/logger'
import type { Id } from '../types'

/**
 * 어떤 항목을 접어 뒀는지는 데이터가 아니라 화면 상태다.
 * 공유·백업에는 들어가지 않지만 앱을 다시 열었을 때는 유지되어야 하므로 localStorage 에 둔다.
 * 저장에 실패해도(용량 초과, 차단) 접기 기능 자체는 계속 동작해야 한다.
 */
const KEY_PREFIX = 'cablenote.collapsed.'

function read(projectId: string): Set<Id> {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + projectId)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch (error) {
    log.warn('collapsed_read_failed', { projectId }, error)
    return new Set()
  }
}

function write(projectId: string, ids: ReadonlySet<Id>): void {
  try {
    if (ids.size === 0) localStorage.removeItem(KEY_PREFIX + projectId)
    else localStorage.setItem(KEY_PREFIX + projectId, JSON.stringify([...ids]))
  } catch (error) {
    log.warn('collapsed_write_failed', { projectId }, error)
  }
}

export function useCollapsedSections(projectId: string) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<Id>>(() => read(projectId))

  // 다른 공사로 이동하면 그 공사의 접힘 상태를 새로 읽는다
  useEffect(() => {
    setCollapsed(read(projectId))
  }, [projectId])

  useEffect(() => {
    write(projectId, collapsed)
  }, [projectId, collapsed])

  const toggle = useCallback((id: Id) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const collapseAll = useCallback((ids: Id[]) => setCollapsed(new Set(ids)), [])
  const expandAll = useCallback(() => setCollapsed(new Set<Id>()), [])

  return { collapsed, toggle, collapseAll, expandAll }
}
