/** 화면 표시용 포맷 유틸. 한국 시간대 기준으로 사용자의 로캘 설정을 따른다. */

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const DATETIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(timestamp: number): string {
  return DATE_FORMATTER.format(new Date(timestamp))
}

export function formatDateTime(timestamp: number): string {
  return DATETIME_FORMATTER.format(new Date(timestamp))
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 자정을 기준으로 며칠 전인지 센다. 22시와 다음날 1시가 "0시간 차이"로 보이지 않게 하기 위함. */
function daysBetweenMidnights(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((b - a) / DAY_MS)
}

/** "오늘 14:30", "어제", "3일 전", 일주일이 넘으면 날짜 */
export function formatRelativeDate(timestamp: number, now: number = Date.now()): string {
  const target = new Date(timestamp)
  const days = daysBetweenMidnights(target, new Date(now))

  if (days <= 0) {
    const time = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(target)
    return `오늘 ${time}`
  }
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  return formatDate(timestamp)
}

/** 소수점이 필요할 때만 표시한다. 40 → "40", 40.5 → "40.5" */
export function formatNumber(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('ko-KR', { maximumFractionDigits: maxFractionDigits })
}
