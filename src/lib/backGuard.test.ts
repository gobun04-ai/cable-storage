import { describe, expect, it } from 'vitest'
import { registerBackDismiss } from './backGuard'

describe('registerBackDismiss', () => {
  it('브라우저가 아닌 환경(window 없음)에서도 예외를 던지지 않는다', () => {
    // 이 테스트는 node 환경에서 돈다. 서버 렌더링이나 테스트에서 불려도 앱이 죽지 않아야 한다.
    expect(() => {
      const release = registerBackDismiss(() => undefined)
      release()
    }).not.toThrow()
  })

  it('해제 함수를 돌려준다', () => {
    expect(typeof registerBackDismiss(() => undefined)).toBe('function')
  })
})
