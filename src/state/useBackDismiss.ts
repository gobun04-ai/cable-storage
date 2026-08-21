import { useEffect, useRef } from 'react'
import { registerBackDismiss } from '../lib/backGuard'

/**
 * 열려 있는 동안 안드로이드 뒤로가기 버튼이 화면 이동 대신 onDismiss 를 부르게 한다.
 */
export function useBackDismiss(active: boolean, onDismiss: () => void): void {
  // 콜백이 매 렌더 새로 만들어져도 등록을 다시 하지 않도록 최신 값만 들고 있는다
  const latest = useRef(onDismiss)
  latest.current = onDismiss

  useEffect(() => {
    if (!active) return
    return registerBackDismiss(() => latest.current())
  }, [active])
}
