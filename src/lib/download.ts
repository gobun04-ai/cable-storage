import { log } from './logger'

/**
 * 만들어진 파일을 사용자의 기기에 저장한다.
 * 링크를 잠깐 만들어 누르는 방식이라, 다 쓴 뒤에는 URL 을 반드시 해제해야 메모리가 새지 않는다.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
    // 브라우저가 저장을 시작할 시간을 준 뒤 해제한다
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  log.info('file_downloaded', { fileName, bytes: blob.size })
}

/** 파일명에 쓸 수 없는 글자를 지운다. 윈도우 기준이 가장 까다로워 그쪽에 맞춘다. */
export function safeFileName(base: string, extension: string): string {
  const cleaned = base
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)

  return `${cleaned === '' ? '케이블노트' : cleaned}.${extension}`
}
