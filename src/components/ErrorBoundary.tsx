import { Component, type ErrorInfo, type ReactNode } from 'react'
import { log } from '../lib/logger'
import { Button } from './Button'
import { ErrorState } from './States'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * 예상하지 못한 렌더 오류로 화면이 흰색으로 남는 것을 막는다.
 * 저장된 데이터는 IndexedDB 에 있으므로 새로고침하면 그대로 살아 있다.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('render_crashed', { componentStack: info.componentStack?.slice(0, 500) }, error)
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="app-main">
        <ErrorState
          title="화면을 그리는 중 문제가 생겼습니다"
          description={
            '입력해 둔 내용은 휴대폰에 그대로 저장되어 있습니다.\n아래 버튼으로 앱을 다시 열어 주세요.'
          }
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              다시 열기
            </Button>
          }
        />
      </main>
    )
  }
}
