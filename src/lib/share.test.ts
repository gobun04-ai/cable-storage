import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canShareType, shareFile } from './share'

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

/** 지정한 이름의 오류를 던지는 공유 함수 */
function throwingNavigator(error: unknown): void {
  vi.stubGlobal('navigator', {
    canShare: () => true,
    share: async () => {
      throw error
    },
  })
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
    stubNavigator()

    await expect(shareFile(FILE)).resolves.toEqual({ outcome: 'shared', reason: null })
  })

  it('지원 여부를 확인할 때와 똑같은 데이터를 넘긴다', async () => {
    // 확인한 것과 다른 데이터를 넘기면 브라우저가 공유를 거부한다. 제목을 섞지 않는다.
    const canShare = vi.fn(() => true)
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { canShare, share })

    await shareFile(FILE)

    expect(canShare).toHaveBeenCalledWith({ files: [FILE] })
    expect(share).toHaveBeenCalledWith({ files: [FILE] })
  })

  it('공유 기능이 없는 브라우저에서는 unsupported 를 돌려준다', async () => {
    stubNavigator({ share: undefined, canShare: undefined })

    await expect(shareFile(FILE)).resolves.toMatchObject({ outcome: 'unsupported' })
  })

  it('이 파일 형식을 받아 주지 않으면 공유를 시도하지 않는다', async () => {
    const { share } = stubNavigator({ canShare: () => false })

    await expect(shareFile(FILE)).resolves.toMatchObject({ outcome: 'unsupported' })
    expect(share).not.toHaveBeenCalled()
  })

  it('지원 여부 확인 자체가 예외를 던져도 unsupported 로 넘어간다', async () => {
    stubNavigator({
      canShare: () => {
        throw new TypeError('files not supported')
      },
    })

    await expect(shareFile(FILE)).resolves.toEqual({
      outcome: 'unsupported',
      reason: 'TypeError: files not supported',
    })
  })

  it('사용자가 공유 시트를 닫으면 cancelled 를 돌려주고 이유를 남기지 않는다', async () => {
    throwingNavigator(new DOMException('사용자가 취소했습니다', 'AbortError'))

    await expect(shareFile(FILE)).resolves.toEqual({ outcome: 'cancelled', reason: null })
  })

  it('브라우저가 공유를 막으면 이름과 상세 메시지를 함께 돌려준다', async () => {
    // 이 메시지가 원인을 가른다. 이름만으로는 정책 차단인지 사용자 동작 문제인지 구분할 수 없다.
    throwingNavigator(new DOMException('Permission denied', 'NotAllowedError'))

    await expect(shareFile(FILE)).resolves.toEqual({
      outcome: 'failed',
      reason: 'NotAllowedError: Permission denied',
    })
  })

  it('메시지가 없는 오류는 이름만 돌려준다', async () => {
    throwingNavigator(new DOMException('', 'NotAllowedError'))

    await expect(shareFile(FILE)).resolves.toEqual({ outcome: 'failed', reason: 'NotAllowedError' })
  })

  it('오류가 아닌 것을 던져도 이유를 채워 돌려준다', async () => {
    throwingNavigator('알 수 없음')

    await expect(shareFile(FILE)).resolves.toEqual({ outcome: 'failed', reason: '알 수 없음' })
  })
})

describe('canShareType', () => {
  it('브라우저가 받아 주는 형식이면 true', () => {
    vi.stubGlobal('navigator', { share: () => undefined, canShare: () => true })

    expect(canShareType('text/csv', 'csv')).toBe(true)
  })

  it('받지 않는 형식이면 false', () => {
    vi.stubGlobal('navigator', { share: () => undefined, canShare: () => false })

    expect(canShareType('application/octet-stream', 'exe')).toBe(false)
  })

  it('확인 기능이 없는 브라우저에서는 false', () => {
    vi.stubGlobal('navigator', {})

    expect(canShareType('text/csv', 'csv')).toBe(false)
  })

  it('확인하다 예외가 나도 false 로 넘어간다', () => {
    vi.stubGlobal('navigator', {
      canShare: () => {
        throw new TypeError('probe failed')
      },
    })

    expect(canShareType('text/csv', 'csv')).toBe(false)
  })
})
