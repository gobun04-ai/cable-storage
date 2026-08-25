import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shareText } from './share'

const OPTIONS = { title: 'A공장 증설', text: '케이블 20m' }

/** 공유·복사 기능을 흉내 낸 브라우저를 세운다. */
function stubNavigator(options: { share?: unknown; write?: unknown } = {}): void {
  vi.stubGlobal('navigator', {
    share: options.share,
    clipboard: options.write === undefined ? undefined : { writeText: options.write },
  })
}

beforeEach(() => {
  // 공유 실패는 구조화 로그를 남긴다. 테스트 출력이 묻히지 않게 가린다.
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('shareText', () => {
  it('공유 시트로 보내면 shared 를 돌려준다', async () => {
    const share = vi.fn(async () => undefined)
    stubNavigator({ share })

    await expect(shareText(OPTIONS)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: OPTIONS.title, text: OPTIONS.text })
  })

  it('사용자가 공유 시트를 닫으면 cancelled 를 돌려주고 복사하지 않는다', async () => {
    const write = vi.fn(async () => undefined)
    stubNavigator({
      share: async () => {
        throw new DOMException('사용자가 취소했습니다', 'AbortError')
      },
      write,
    })

    await expect(shareText(OPTIONS)).resolves.toBe('cancelled')
    expect(write).not.toHaveBeenCalled()
  })

  it('공유 기능이 없으면 클립보드에 복사하고 copied 를 돌려준다', async () => {
    const write = vi.fn(async () => undefined)
    stubNavigator({ write })

    await expect(shareText(OPTIONS)).resolves.toBe('copied')
    expect(write).toHaveBeenCalledWith(OPTIONS.text)
  })

  it('공유가 실패하면 복사로 넘어간다', async () => {
    const write = vi.fn(async () => undefined)
    stubNavigator({
      share: async () => {
        throw new DOMException('공유할 수 없습니다', 'NotAllowedError')
      },
      write,
    })

    await expect(shareText(OPTIONS)).resolves.toBe('copied')
    expect(write).toHaveBeenCalledWith(OPTIONS.text)
  })

  it('공유도 복사도 안 되면 failed 를 돌려준다', async () => {
    // 클립보드가 막히면 예전 방식(document)으로 한 번 더 시도하는데, 그것도 없는 환경이다
    stubNavigator({
      write: async () => {
        throw new Error('clipboard blocked')
      },
    })

    await expect(shareText(OPTIONS)).resolves.toBe('failed')
  })
})
