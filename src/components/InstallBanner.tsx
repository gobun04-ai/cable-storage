import { useState } from 'react'
import { log } from '../lib/logger'
import { useInstallPrompt } from '../state/useInstallPrompt'
import { useToast } from '../state/ToastProvider'
import { Button } from './Button'
import { CloseIcon } from './Icons'
import { IconButton } from './IconButton'
import styles from './InstallBanner.module.css'

const DISMISS_KEY = 'cablenote.installBannerDismissed'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch (error) {
    log.warn('install_banner_state_read_failed', {}, error)
    return false
  }
}

function rememberDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch (error) {
    log.warn('install_banner_state_write_failed', {}, error)
  }
}

/**
 * 홈 화면에 설치하라고 한 번 권하는 줄.
 * 설치할 수 없는 환경이거나 이미 설치했거나 사용자가 닫았으면 나오지 않는다.
 */
export function InstallBanner() {
  const { canInstall, install } = useInstallPrompt()
  const toast = useToast()
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [busy, setBusy] = useState(false)

  if (!canInstall || dismissed) return null

  async function handleInstall(): Promise<void> {
    if (busy) return
    setBusy(true)
    try {
      const outcome = await install()
      if (outcome === 'accepted') {
        toast.show({ message: '홈 화면에 추가했습니다. 이제 아이콘으로 바로 열 수 있습니다.', tone: 'success' })
      } else if (outcome === 'unavailable') {
        toast.show({
          message: '이 브라우저에서는 설치 창을 열 수 없습니다. 크롬 메뉴의 "홈 화면에 추가"를 눌러 주세요.',
          tone: 'error',
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.banner}>
      <img className={styles.icon} src="./icon-192.png" alt="" />

      <div className={styles.text}>
        <span className={styles.title}>홈 화면에 설치하기</span>
        <span className={styles.description}>
          아이콘으로 바로 열리고, 통신이 끊긴 현장에서도 그대로 씁니다.
        </span>
      </div>

      <div className={styles.actions}>
        <Button size="sm" variant="primary" loading={busy} onClick={() => void handleInstall()}>
          설치
        </Button>
        <IconButton
          compact
          label="설치 안내 닫기"
          icon={<CloseIcon size={18} />}
          onClick={() => {
            setDismissed(true)
            rememberDismissed()
          }}
        />
      </div>
    </div>
  )
}
