import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar } from '../components/AppBar'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AlertIcon } from '../components/Icons'
import { SegmentedControl } from '../components/SegmentedControl'
import { exportBackup, parseBackup, restoreProjects } from '../lib/backup'
import { requestPersistentStorage, StorageError, type ThemePreference } from '../lib/db'
import { formatDateTime } from '../lib/format'
import { log } from '../lib/logger'
import { countErasable, eraseAllData } from '../lib/reset'
import { useInstallPrompt } from '../state/useInstallPrompt'
import { useSettings } from '../state/SettingsProvider'
import { useToast } from '../state/ToastProvider'
import type { Project } from '../types'
import styles from './SettingsScreen.module.css'

const THEME_OPTIONS = [
  { value: 'system', label: '기기 설정' },
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
] as const satisfies readonly { value: ThemePreference; label: string }[]

interface StorageInfo {
  usageBytes: number | null
  quotaBytes: number | null
  persisted: boolean
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '확인할 수 없음'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof StorageError ? error.userMessage : fallback
}

export function SettingsScreen() {
  const navigate = useNavigate()
  const toast = useToast()
  const { settings, setTheme, markBackedUp, clearBackupMark } = useSettings()
  const { canInstall, installed, install } = useInstallPrompt()

  const [storage, setStorage] = useState<StorageInfo>({ usageBytes: null, quotaBytes: null, persisted: false })
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<{ projects: Project[]; skipped: number } | null>(null)
  const [installing, setInstalling] = useState(false)
  const [erasing, setErasing] = useState(false)
  const [pendingErase, setPendingErase] = useState<{ projects: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const estimate = (await navigator.storage?.estimate?.()) ?? {}
        const persisted = (await navigator.storage?.persisted?.()) ?? false
        if (cancelled) return
        setStorage({
          usageBytes: estimate.usage ?? null,
          quotaBytes: estimate.quota ?? null,
          persisted,
        })
      } catch (error) {
        log.warn('storage_estimate_failed', {}, error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleBackup(): Promise<void> {
    if (backingUp) return
    setBackingUp(true)
    try {
      const now = Date.now()
      const count = await exportBackup(now)
      markBackedUp(now)
      toast.show({ message: `공사 ${count}건을 백업 파일로 내려받았습니다.`, tone: 'success' })
    } catch (error) {
      log.error('backup_failed', {}, error)
      toast.show({ message: messageOf(error, '백업 파일을 만들지 못했습니다.'), tone: 'error' })
    } finally {
      setBackingUp(false)
    }
  }

  async function handleFileSelected(file: File): Promise<void> {
    try {
      const raw = await file.text()
      const result = parseBackup(raw)

      if (!result.ok) {
        toast.show({ message: result.message, tone: 'error' })
        return
      }
      setPendingRestore({ projects: result.projects, skipped: result.skipped })
    } catch (error) {
      log.error('backup_read_failed', { size: file.size }, error)
      toast.show({ message: '파일을 읽지 못했습니다. 다시 선택해 주세요.', tone: 'error' })
    }
  }

  async function handleConfirmRestore(): Promise<void> {
    if (!pendingRestore || restoring) return
    setRestoring(true)
    try {
      const count = await restoreProjects(pendingRestore.projects)
      setPendingRestore(null)
      toast.show({ message: `공사 ${count}건을 복원했습니다.`, tone: 'success' })
      navigate('/')
    } catch (error) {
      log.error('restore_failed', {}, error)
      toast.show({ message: messageOf(error, '복원하지 못했습니다.'), tone: 'error' })
    } finally {
      setRestoring(false)
    }
  }

  async function handleInstall(): Promise<void> {
    if (installing) return
    setInstalling(true)
    try {
      const outcome = await install()
      if (outcome === 'accepted') {
        toast.show({ message: '홈 화면에 추가했습니다. 이제 아이콘으로 바로 열 수 있습니다.', tone: 'success' })
      } else if (outcome === 'unavailable') {
        toast.show({
          message: '설치 창을 열 수 없습니다. 크롬 메뉴의 "홈 화면에 추가"를 눌러 주세요.',
          tone: 'error',
        })
      }
    } finally {
      setInstalling(false)
    }
  }

  /** 지우기 전에 몇 건이 사라지는지 세어 확인 창에 보여 준다. */
  async function handleEraseRequest(): Promise<void> {
    if (erasing) return
    setErasing(true)
    try {
      setPendingErase({ projects: await countErasable() })
    } catch (error) {
      log.error('erase_count_failed', {}, error)
      toast.show({ message: messageOf(error, '저장된 공사를 확인하지 못했습니다.'), tone: 'error' })
    } finally {
      setErasing(false)
    }
  }

  async function handleConfirmErase(): Promise<void> {
    if (erasing) return
    setErasing(true)
    try {
      const summary = await eraseAllData()
      clearBackupMark()
      setPendingErase(null)
      toast.show({ message: `공사 ${summary.projects}건을 지웠습니다.`, tone: 'success' })
      navigate('/')
    } catch (error) {
      log.error('erase_failed', {}, error)
      toast.show({ message: messageOf(error, '삭제하지 못했습니다.'), tone: 'error' })
    } finally {
      setErasing(false)
    }
  }

  async function handleRequestPersist(): Promise<void> {
    const granted = await requestPersistentStorage()
    setStorage((prev) => ({ ...prev, persisted: granted }))
    toast.show(
      granted
        ? { message: '이제 브라우저가 이 앱의 데이터를 임의로 지우지 않습니다.', tone: 'success' }
        : {
            message: '브라우저가 요청을 받아들이지 않았습니다. 홈 화면에 설치하면 승인될 가능성이 높습니다.',
            tone: 'info',
          },
    )
  }

  return (
    <>
      <AppBar title="설정" onBack={() => navigate('/')} />

      <main className="app-main">
        <div className={styles.stack}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>화면</h2>
            <div className={styles.card}>
              <SegmentedControl
                label="테마"
                value={settings.theme}
                options={THEME_OPTIONS}
                onChange={setTheme}
              />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>홈 화면</h2>
            <div className={styles.card}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>설치 상태</span>
                <span className={styles.infoValue}>
                  {installed ? '홈 화면 앱으로 실행 중' : canInstall ? '설치할 수 있음' : '설치 안 됨'}
                </span>
              </div>

              {canInstall && (
                <Button variant="primary" loading={installing} onClick={() => void handleInstall()}>
                  홈 화면에 설치
                </Button>
              )}

              <p className={styles.sectionHint}>
                {installed
                  ? '아이콘으로 실행 중입니다. 통신이 끊겨도 그대로 열립니다.'
                  : canInstall
                    ? '설치하면 아이콘으로 바로 열리고, 통신이 끊긴 현장에서도 씁니다.'
                    : '이미 설치했거나, 이 브라우저가 설치를 지원하지 않는 경우입니다. 크롬 메뉴의 "홈 화면에 추가"로도 설치할 수 있습니다.'}
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>데이터 관리</h2>

            <div className={styles.notice}>
              <AlertIcon size={18} className={styles.noticeIcon} />
              <span>
                입력한 내용은 이 휴대폰 안에만 저장됩니다. 브라우저 데이터를 지우거나 기기를 바꾸면 사라지므로, 중요한
                공사는 끝난 뒤 백업 파일을 받아 두시거나 정리 내용을 공유해 남겨 두세요.
              </span>
            </div>

            <div className={styles.card}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>마지막 백업</span>
                <span className={styles.infoValue}>
                  {settings.lastBackupAt === null ? '아직 없음' : formatDateTime(settings.lastBackupAt)}
                </span>
              </div>

              <div className={styles.buttonRow}>
                <Button variant="primary" loading={backingUp} onClick={() => void handleBackup()}>
                  백업 파일 받기
                </Button>
                <Button onClick={() => fileInputRef.current?.click()}>백업에서 복원</Button>
              </div>

              <p className={styles.sectionHint}>
                복원하면 기존 공사는 그대로 두고 파일 안의 공사를 새로 추가합니다. 같은 파일을 두 번 복원하면 공사가
                두 벌 생깁니다.
              </p>

              <input
                ref={fileInputRef}
                className={styles.hiddenInput}
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  // 같은 파일을 다시 골라도 이벤트가 오도록 값을 비운다
                  event.target.value = ''
                  if (file) void handleFileSelected(file)
                }}
              />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>저장 공간</h2>
            <div className={styles.card}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>사용 중</span>
                <span className={styles.infoValue}>{formatBytes(storage.usageBytes)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>쓸 수 있는 공간</span>
                <span className={styles.infoValue}>{formatBytes(storage.quotaBytes)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>자동 삭제 방지</span>
                <span className={styles.infoValue}>{storage.persisted ? '켜짐' : '꺼짐'}</span>
              </div>

              {!storage.persisted && (
                <Button onClick={() => void handleRequestPersist()}>자동 삭제 방지 요청</Button>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>기록 지우기</h2>
            <div className={styles.dangerZone}>
              <p className={styles.dangerText}>
                이 기기에 저장된 공사와 이전에 쓴 값 제안을 모두 지웁니다. 테마 설정과 다른 사이트의 자료는
                건드리지 않습니다.
                <br />
                <strong>되돌릴 수 없습니다.</strong>
              </p>
              <Button variant="danger" loading={erasing} onClick={() => void handleEraseRequest()}>
                모든 데이터 삭제
              </Button>
            </div>
          </section>

          <p className={styles.appInfo}>
            케이블노트 v{__APP_VERSION__}
            <br />
            기기 안에서만 동작하며 어떤 정보도 밖으로 보내지 않습니다.
          </p>
        </div>
      </main>

      <ConfirmDialog
        open={pendingRestore !== null}
        title="백업에서 복원"
        description={
          pendingRestore === null
            ? ''
            : `공사 ${pendingRestore.projects.length}건을 추가합니다.\n지금 있는 공사는 지워지지 않습니다.` +
              (pendingRestore.skipped > 0
                ? `\n\n※ 내용이 온전하지 않은 ${pendingRestore.skipped}건은 건너뜁니다.`
                : '')
        }
        confirmLabel="복원하기"
        busy={restoring}
        onConfirm={() => void handleConfirmRestore()}
        onCancel={() => setPendingRestore(null)}
      />

      <ConfirmDialog
        open={pendingErase !== null}
        title="모든 데이터 삭제"
        tone="danger"
        description={
          pendingErase === null
            ? ''
            : `공사 ${pendingErase.projects}건과 이전에 쓴 값 제안이 모두 지워집니다.\n` +
              (settings.lastBackupAt === null
                ? '\n※ 아직 백업 파일을 받은 적이 없습니다. 지우면 되살릴 방법이 없습니다.\n먼저 백업을 받아 두시는 것을 권합니다.'
                : `\n마지막 백업: ${formatDateTime(settings.lastBackupAt)}\n그 뒤에 적은 내용은 백업에 들어 있지 않습니다.`)
        }
        confirmLabel="지우기"
        busy={erasing}
        onConfirm={() => void handleConfirmErase()}
        onCancel={() => setPendingErase(null)}
      />
    </>
  )
}
