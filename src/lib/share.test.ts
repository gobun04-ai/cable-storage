import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shareFile } from './share'

const FILE = new File(['xlsx'], 'A공장 증설 물량.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})

/** 안드로이드 크롬처럼 파일 공유를 지원하는 브라우저를 흉내 낸다. */
function stubNavigator(overrides: { share?: unknown; canShare?: unknown } = {}): { share: ReturnType<typeof vi.fn> } {
  const share = vi.fn(async () => undefined)
  vi.stubGlobal('navigator', {
    share: 'share' in overrides ? overrides.share : share,
    canShare: 'canShare' in overrides ? overrides.canShare : () => true,
  })
  return { share }
}

beforeEach(() => {
  // 공유 실패는 구조화 로그를 남긴다. 테스트 출력이 묻히지 않게 가린다.
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('shareFile', () => {
  it('공유 시트로 파일을 보내면 shared 를 돌려준다', async () => {
    const { share } = stubNavigator()

    await expect(shareFile({ title: '물량', file: FILE })).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: '물량', files: [FILE] })
  })

  it('공유 기능이 없는 브라우저에서는 unsupported 를 돌려준다', async () => {
    stubNavigator({ share: undefined, canShare: undefined })

    await expect(shareFile({ title: '물량', file: FILE })).resolves.toBe('unsupported')
  })

  it('이 파일 형식을 받아 주지 않으면 공유를 시도하지 않고 unsupported 를 돌려준다', async () => {
    const { share } = stubNavigator({ canShare: () => false })

    await expect(shareFile({ title: '물량', file: FILE })).resolves.toBe('unsupported')
    expect(share).not.toHaveBeenCalled()
  })

  it('지원 여부 확인 자체가 예외를 던져도 unsupported 로 넘어간다', async () => {
    stubNavigator({
      canShare: () => {
        throw new TypeError('files not supported')
      },
    })

    await expect(shareFile({ title: '물량', file: FILE })).resolves.toBe('unsupported')
  })

  it('사용자가 공유 시트를 닫으면 cancelled 를 돌려준다', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new DOMException('사용자가 취소했습니다', 'AbortError')
      },
    })

    await expect(shareFile({ title: '물량', file: FILE })).resolves.toBe('cancelled')
  })

  it("'방금 누름' 상태가 풀려 막히면 retry 를 돌려준다", async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new DOMException('user gesture required', 'NotAllowedError')
      },
    })

    await expect(shareFile({ title: '물량', file: FILE })).resolves.toBe('retry')
  })

  it('그 밖의 오류는 failed 를 돌려준다', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new Error('알 수 없는 오류')
      },
    })

    await expect(shareFile({ title: '물량', file: FILE })).resolves.toBe('failed')
  })
})
