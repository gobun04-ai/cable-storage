import { log } from './logger'

/**
 * 정리한 텍스트를 다른 앱으로 보내거나 클립보드에 복사한다.
 *
 * 안드로이드 크롬은 공유 시트를 띄울 수 있지만(Web Share API) HTTPS 에서만 동작한다.
 * 그래서 공유가 안 되는 환경에서는 조용히 복사로 넘어간다.
 */

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/** 파일 공유는 텍스트와 달리 저장으로 물러날지 말지를 부르는 쪽이 정해야 해서 결과를 더 잘게 나눈다. */
export type FileShareOutcome = 'shared' | 'cancelled' | 'retry' | 'unsupported' | 'failed'

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

/** 이 기기·브라우저가 이 파일을 공유 시트로 보낼 수 있는지 확인한다. HTTPS 가 아니면 여기서 걸린다. */
function canShareFile(file: File): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false

  try {
    return navigator.canShare({ files: [file] })
  } catch (error) {
    // 형식을 받아 주지 않는 브라우저는 예외를 던지기도 한다
    log.warn('file_share_unsupported', { bytes: file.size }, error)
    return false
  }
}

/**
 * 파일을 다른 앱으로 보낸다. 기기에 저장하지는 않는다.
 * 반드시 버튼 클릭 같은 사용자 동작 안에서 불러야 한다.
 */
export async function shareFile(options: { title: string; file: File }): Promise<FileShareOutcome> {
  const { file, title } = options
  if (!canShareFile(file)) return 'unsupported'

  try {
    await navigator.share({ title, files: [file] })
    log.info('file_shared', { bytes: file.size })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException) {
      // 사용자가 공유 시트를 닫은 것은 실패가 아니다
      if (error.name === 'AbortError') return 'cancelled'

      /*
       * 파일을 만드는 동안 '방금 눌렀음' 상태가 풀리면 브라우저가 공유를 막는다.
       * 이때 저장으로 떨어뜨리면 원치 않는 파일이 기기에 남으므로, 한 번 더 누르게 한다.
       */
      if (error.name === 'NotAllowedError') {
        log.warn('file_share_needs_gesture', { bytes: file.size })
        return 'retry'
      }
    }

    log.warn('file_share_failed', { bytes: file.size }, error)
    return 'failed'
  }
}
