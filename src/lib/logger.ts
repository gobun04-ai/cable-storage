/**
 * 구조화 로그.
 * 이 앱은 서버로 아무것도 보내지 않으므로 로그는 브라우저 콘솔에만 남는다.
 * 사용자가 입력한 본문(공사명, 장비명 등)은 남기지 않고 길이·개수만 남긴다.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const MIN_LEVEL: Level = import.meta.env.DEV ? 'debug' : 'info'

type Fields = Record<string, unknown>

function emit(level: Level, event: string, fields?: Fields, error?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return

  const entry: Fields = {
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  }

  if (error !== undefined) {
    entry['error'] = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    if (error instanceof Error && error.stack) entry['stack'] = error.stack
  }

  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  debug: (event: string, fields?: Fields) => emit('debug', event, fields),
  info: (event: string, fields?: Fields) => emit('info', event, fields),
  warn: (event: string, fields?: Fields, error?: unknown) => emit('warn', event, fields, error),
  error: (event: string, fields?: Fields, error?: unknown) => emit('error', event, fields, error),
}
