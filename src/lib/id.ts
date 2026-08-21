/**
 * 레코드 식별자 생성.
 * crypto.randomUUID 는 보안 컨텍스트(HTTPS·localhost)에서만 제공되므로,
 * LAN IP로 열어 시험하는 경우를 위해 폴백을 둔다.
 */
export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()

  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }

  // 마지막 수단. 충돌 가능성이 있으나 단일 기기·단일 사용자 환경에서는 실질적으로 안전하다.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
