import { describe, expect, it } from 'vitest'
import { shouldClearKey } from './reset'

describe('shouldClearKey', () => {
  it('접힘 상태와 입력 제안은 지운다', () => {
    expect(shouldClearKey('cablenote.collapsed.p1')).toBe(true)
    expect(shouldClearKey('cablenote.recent.cableType')).toBe(true)
  })

  it('다른 사이트나 다른 앱이 남긴 값은 건드리지 않는다', () => {
    expect(shouldClearKey('theme')).toBe(false)
    expect(shouldClearKey('some-other-app.data')).toBe(false)
    expect(shouldClearKey('')).toBe(false)
  })

  it('설치 안내를 닫은 기록은 데이터가 아니므로 남긴다', () => {
    expect(shouldClearKey('cablenote.installBannerDismissed')).toBe(false)
  })

  it('접두사가 비슷하기만 한 키는 지우지 않는다', () => {
    expect(shouldClearKey('cablenote.collapsedX')).toBe(false)
    expect(shouldClearKey('xcablenote.recent.a')).toBe(false)
  })
})
