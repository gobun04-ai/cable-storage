import { clearAllProjects, listProjects } from './db'
import { log } from './logger'

/**
 * 앱이 이 기기에 남긴 것을 모두 지운다.
 *
 * 브라우저 설정에서 사이트 데이터를 지우는 방법도 있지만, 같은 브라우저의 다른 사이트까지
 * 영향을 받기 쉽다. 이 앱이 만든 것만 정확히 지우기 위해 앱 안에 둔다.
 *
 * 테마 설정은 남긴다. 데이터가 아니라 화면 취향이기 때문이다.
 */

/** 지울 localStorage 키의 접두사. 여기 없는 키는 건드리지 않는다. */
const CLEARED_PREFIXES = ['cablenote.collapsed.', 'cablenote.recent.'] as const

/** 이 키를 지워야 하는지. 접두사 규칙을 검증하기 위해 따로 뽑았다. */
export function shouldClearKey(key: string): boolean {
  return CLEARED_PREFIXES.some((prefix) => key.startsWith(prefix))
}

function clearLocalPreferences(): number {
  try {
    const doomed: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key !== null && shouldClearKey(key)) doomed.push(key)
    }
    for (const key of doomed) localStorage.removeItem(key)
    return doomed.length
  } catch (error) {
    // 접힘 상태나 입력 제안이 남는 것은 큰 문제가 아니므로 여기서 멈추지 않는다
    log.warn('local_preferences_clear_failed', {}, error)
    return 0
  }
}

export interface EraseSummary {
  projects: number
  localKeys: number
}

/** 지우기 전에 무엇이 얼마나 사라지는지 세어 둔다. */
export async function countErasable(): Promise<number> {
  const projects = await listProjects()
  return projects.length
}

export async function eraseAllData(): Promise<EraseSummary> {
  const projects = await listProjects()
  await clearAllProjects()
  const localKeys = clearLocalPreferences()

  log.warn('all_data_erased', { projects: projects.length, localKeys })
  return { projects: projects.length, localKeys }
}
