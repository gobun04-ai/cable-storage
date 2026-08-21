import { useCallback, useSyncExternalStore } from 'react'
import { log } from '../lib/logger'

/**
 * 홈 화면 설치를 앱 안에서 처리한다.
 *
 * 크롬은 설치 조건이 갖춰지면 beforeinstallprompt 이벤트를 한 번 던지는데, 기본 배너는 잘 뜨지 않는다.
 * 그 이벤트를 잡아 두었다가 사용자가 버튼을 눌렀을 때 설치 창을 띄운다.
 * 브라우저 메뉴에서 '홈 화면에 추가'를 찾아 헤매지 않아도 된다.
 *
 * 이벤트는 앱이 뜬 직후 한 번만 오므로, 화면마다 따로 듣지 않고 모듈 차원에서 한 번만 잡아 나눠 쓴다.
 */

/** 표준에 아직 들어가지 않은 이벤트라 필요한 부분만 직접 적어 둔다. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

let deferredEvent: BeforeInstallPromptEvent | null = null
let installedFlag = false
/** 값이 바뀔 때마다 올린다. React 가 이 숫자로 변화를 알아챈다. */
let version = 0
const listeners = new Set<() => void>()

function notify(): void {
  version += 1
  for (const listener of listeners) listener()
}

/** 홈 화면 아이콘으로 실행된 상태인지 */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS 사파리는 표준 대신 navigator.standalone 을 쓴다
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

let bootstrapped = false

function bootstrap(): void {
  if (bootstrapped || typeof window === 'undefined') return
  bootstrapped = true

  installedFlag = detectStandalone()

  window.addEventListener('beforeinstallprompt', (event) => {
    // 기본 배너를 막아 두고, 우리 버튼을 누를 때 띄운다
    event.preventDefault()
    deferredEvent = event as BeforeInstallPromptEvent
    log.info('install_prompt_ready')
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferredEvent = null
    installedFlag = true
    log.info('app_installed')
    notify()
  })
}

bootstrap()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): number {
  return version
}

export function useInstallPrompt() {
  // 반환값 자체는 쓰지 않는다. 상태가 바뀔 때 다시 그리게 하는 용도다.
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const install = useCallback(async (): Promise<InstallOutcome> => {
    const event = deferredEvent
    if (!event) return 'unavailable'

    try {
      await event.prompt()
      const { outcome } = await event.userChoice
      log.info('install_prompt_answered', { outcome })
      // 한 번 쓴 이벤트는 다시 쓸 수 없다
      deferredEvent = null
      notify()
      return outcome
    } catch (error) {
      log.warn('install_prompt_failed', {}, error)
      deferredEvent = null
      notify()
      return 'unavailable'
    }
  }, [])

  return {
    /** 설치 창을 띄울 수 있는 상태인지 */
    canInstall: deferredEvent !== null && !installedFlag,
    /** 이미 홈 화면 앱으로 실행 중인지 */
    installed: installedFlag,
    install,
  }
}
