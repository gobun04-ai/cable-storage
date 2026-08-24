import { log } from './logger'

/**
 * 정리한 텍스트를 다른 앱으로 보내거나 클립보드에 복사한다.
 *
 * 안드로이드 크롬은 공유 시트를 띄울 수 있지만(Web Share API) HTTPS 에서만 동작한다.
 * 그래서 공유가 안 되는 환경에서는 조용히 복사로 넘어간다.
 */

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/** 파일 공유는 텍스트와 달리 저장으로 물러날지 말지를 부르는 쪽이 정해야 해서 결과를 더 잘게 나눈다. */
export type FileShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed'

export interface FileShareResult {
  outcome: FileShareOutcome
  /** 공유하지 못한 이유. 성공하거나 사용자가 닫았으면 null */
  reason: string | null
}

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

/** 휴대폰에는 개발자 콘솔이 없다. 공유가 막힌 이유를 화면에 짧게 보여 주려고 오류 이름만 꺼낸다. */
function reasonOf(error: unknown): string {
  return error instanceof Error && error.name !== '' ? error.name : '알 수 없는 오류'
}

/**
 * 파일을 다른 앱으로 보낸다. 기기에 저장하지는 않는다.
 * 반드시 버튼 클릭 같은 사용자 동작 안에서, 기다림 없이 곧바로 불러야 한다.
 */
export async function shareFile(file: File): Promise<FileShareResult> {
  /*
   * 확인과 실행에 똑같은 데이터를 넘긴다.
   * canShare 로 허락받은 것과 다른 데이터를 share 에 넘기면 브라우저가 거부할 수 있다.
   */
  const data: ShareData = { files: [file] }

  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function'
  ) {
    return { outcome: 'unsupported', reason: '공유 기능 없음' }
  }

  try {
    // HTTPS 가 아니거나 이 형식을 받지 않으면 여기서 걸린다
    if (!navigator.canShare(data)) return { outcome: 'unsupported', reason: '파일 공유 미지원' }
  } catch (error) {
    log.warn('file_share_unsupported', { bytes: file.size }, error)
    return { outcome: 'unsupported', reason: reasonOf(error) }
  }

  try {
    await navigator.share(data)
    log.info('file_shared', { bytes: file.size })
    return { outcome: 'shared', reason: null }
  } catch (error) {
    // 사용자가 공유 시트를 닫은 것은 실패가 아니다
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { outcome: 'cancelled', reason: null }
    }

    log.warn('file_share_failed', { bytes: file.size }, error)
    return { outcome: 'failed', reason: reasonOf(error) }
  }
}
