import { log } from './logger'

/**
 * 정리한 텍스트를 다른 앱으로 보내거나 클립보드에 복사한다.
 *
 * 안드로이드 크롬은 공유 시트를 띄울 수 있지만(Web Share API) HTTPS 에서만 동작한다.
 * 그래서 공유가 안 되는 환경에서는 조용히 복사로 넘어간다.
 *
 * 파일(엑셀) 공유는 다루지 않는다 — 안드로이드 크롬이 xlsx 를 공유 시트로 넘기지 못하게 막는다
 * (canShare 는 통과시키고 share 에서 NotAllowedError: Permission denied 를 던진다).
 * 엑셀은 내려받기만 하고, 다른 앱으로 보내는 것은 파일 관리자에 맡긴다.
 */

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

function canUseWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** 클립보드 복사. 최신 API 가 막혀 있으면 예전 방식으로 한 번 더 시도한다. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (error) {
    log.warn('clipboard_write_failed', { length: text.length }, error)
  }

  // HTTPS 가 아닌 환경(사내망 IP 로 열어 보는 경우)에서는 위 API 를 쓸 수 없다
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()

    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  } catch (error) {
    log.error('clipboard_fallback_failed', { length: text.length }, error)
    return false
  }
}

/**
 * 공유 시트를 띄우고, 쓸 수 없으면 클립보드에 복사한다.
 * 반드시 버튼 클릭 같은 사용자 동작 안에서 불러야 한다.
 */
export async function shareText(options: { title: string; text: string }): Promise<ShareOutcome> {
  if (canUseWebShare()) {
    try {
      await navigator.share({ title: options.title, text: options.text })
      log.info('text_shared', { length: options.text.length })
      return 'shared'
    } catch (error) {
      // 사용자가 공유 시트를 닫은 것은 실패가 아니다
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      log.warn('web_share_failed', { length: options.text.length }, error)
    }
  }

  return (await copyText(options.text)) ? 'copied' : 'failed'
}
