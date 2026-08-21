/**
 * 안드로이드 뒤로가기 버튼으로 시트를 닫기 위한 장치.
 *
 * 시트가 열려 있는 동안 히스토리에 표시용 항목을 하나 얹어 두고, 뒤로가기가 그 항목을 소비하면
 * 화면을 옮기는 대신 시트를 닫는다. 이렇게 하지 않으면 케이블을 입력하다 뒤로가기를 눌렀을 때
 * 시트가 아니라 공사 화면 자체를 벗어나 입력하던 내용이 사라진다.
 *
 * 시트는 한 번에 하나만 열리는 것이 보통이지만, 겹쳐 열리는 경우까지 감당하도록 스택으로 둔다.
 */

const GUARD_KEY = '__cablenoteSheet'

interface Entry {
  id: number
  dismiss: () => void
}

let stack: Entry[] = []
/** 히스토리에 우리 항목을 얹어 둔 상태인지 */
let guardPushed = false
let syncScheduled = false
let nextId = 1
let listening = false

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.history !== 'undefined'
}

/** 지금 히스토리 최상단이 우리가 얹은 항목인지 */
function standingOnGuard(): boolean {
  const state: unknown = window.history.state
  return typeof state === 'object' && state !== null && GUARD_KEY in state
}

function sync(): void {
  syncScheduled = false
  if (!isBrowser()) return

  const needed = stack.length > 0
  if (needed === guardPushed) return

  if (needed) {
    guardPushed = true
    // 라우터가 넣어 둔 상태를 지우지 않도록 위에 얹기만 한다
    const current: unknown = window.history.state
    const base = typeof current === 'object' && current !== null ? current : {}
    window.history.pushState({ ...base, [GUARD_KEY]: true }, '')
    return
  }

  guardPushed = false
  // 시트를 닫는 사이에 화면이 옮겨 갔다면 우리 항목은 이미 뒤에 묻혀 있다.
  // 그때 back() 을 부르면 방금 연 화면이 닫히므로, 최상단이 우리 항목일 때만 되돌린다.
  if (standingOnGuard()) window.history.back()
}

function scheduleSync(): void {
  if (syncScheduled) return
  syncScheduled = true
  // 시트가 닫히면서 곧바로 다른 시트가 열리는 경우(메뉴 → 입력 폼)를 한 번으로 합치기 위해
  // 같은 작업 단위가 끝난 뒤에 정리한다.
  queueMicrotask(sync)
}

function handlePopState(): void {
  // 우리가 얹은 항목이 아니면 평범한 화면 이동이므로 건드리지 않는다
  if (!guardPushed) return
  guardPushed = false

  const top = stack[stack.length - 1]
  if (top === undefined) {
    scheduleSync()
    return
  }

  // 시트가 닫히면 등록이 해제되고, 남은 시트가 있으면 항목을 다시 얹는다
  top.dismiss()
}

function ensureListener(): void {
  if (listening || !isBrowser()) return
  listening = true
  window.addEventListener('popstate', handlePopState)
}

/**
 * 뒤로가기로 닫을 대상을 등록한다.
 * 반환된 함수를 부르면 등록이 해제된다.
 */
export function registerBackDismiss(dismiss: () => void): () => void {
  if (!isBrowser()) return () => undefined

  ensureListener()

  const entry: Entry = { id: nextId, dismiss }
  nextId += 1
  stack.push(entry)
  scheduleSync()

  return () => {
    stack = stack.filter((item) => item.id !== entry.id)
    scheduleSync()
  }
}
