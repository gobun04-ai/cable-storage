import { useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { log } from '../lib/logger'
import { useToast } from './ToastProvider'

/**
 * 서비스 워커를 등록해 오프라인 동작을 켠다.
 *
 * 새 버전이 준비돼도 곧바로 새로고침하지 않는다. 현장에서 입력하던 중에 화면이 갈아엎어지면 안 되므로,
 * 알림을 띄우고 사용자가 누를 때 바꾼다.
 */
export function useAppUpdate(): void {
  const toast = useToast()

  useEffect(() => {
    const updateServiceWorker = registerSW({
      onNeedRefresh() {
        log.info('sw_update_available')
        toast.show({
          message: '새 버전이 준비됐습니다.',
          durationMs: 20_000,
          action: {
            label: '지금 적용',
            onClick: () => {
              void updateServiceWorker(true)
            },
          },
        })
      },
      onOfflineReady() {
        log.info('sw_offline_ready')
        toast.show({ message: '이제 통신이 끊겨도 앱이 열립니다.', tone: 'success' })
      },
      onRegisterError(error) {
        log.error('sw_register_failed', {}, error)
      },
    })
  }, [toast])
}
