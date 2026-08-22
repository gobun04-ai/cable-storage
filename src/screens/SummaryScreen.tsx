import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar } from '../components/AppBar'
import { Button } from '../components/Button'
import { AlertIcon, CopyIcon, FolderIcon } from '../components/Icons'
import { EmptyState, ErrorState, ListSkeleton } from '../components/States'
import { loadProject, StorageError } from '../lib/db'
import { buildShareText } from '../lib/exportText'
import { exportProjectToXlsx } from '../lib/exportXlsx'
import { formatNumber } from '../lib/format'
import { log } from '../lib/logger'
import { copyText, shareText } from '../lib/share'
import { summarize } from '../lib/summary'
import { useToast } from '../state/ToastProvider'
import type { Project } from '../types'
import styles from './SummaryScreen.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; project: Project }

function messageOf(error: unknown, fallback: string): string {
  return error instanceof StorageError ? error.userMessage : fallback
}

export function SummaryScreen() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [sharing, setSharing] = useState(false)
  const [exporting, setExporting] = useState(false)

  const reload = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const project = await loadProject(projectId)
      setState(project ? { status: 'ready', project } : { status: 'missing' })
    } catch (error) {
      log.error('summary_load_failed', { projectId }, error)
      setState({ status: 'error', message: messageOf(error, '공사를 불러오지 못했습니다.') })
    }
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const project = state.status === 'ready' ? state.project : null
  const summary = useMemo(() => (project ? summarize(project.body) : null), [project])
  const text = useMemo(() => (project ? buildShareText(project) : ''), [project])

  const hasRecords =
    summary !== null && (summary.totalCableCount > 0 || summary.replacements.length > 0 || summary.additions.length > 0)

  async function handleShare(): Promise<void> {
    if (!project || sharing) return
    setSharing(true)
    try {
      const outcome = await shareText({ title: project.name, text })
      if (outcome === 'copied') toast.show({ message: '정리 내용을 복사했습니다. 붙여넣기 하세요.', tone: 'success' })
      else if (outcome === 'failed')
        toast.show({ message: '공유하지 못했습니다. 아래 미리보기를 길게 눌러 직접 복사해 주세요.', tone: 'error' })
    } finally {
      setSharing(false)
    }
  }

  async function handleCopy(): Promise<void> {
    const copied = await copyText(text)
    toast.show(
      copied
        ? { message: '정리 내용을 복사했습니다.', tone: 'success' }
        : { message: '복사하지 못했습니다. 미리보기를 길게 눌러 직접 복사해 주세요.', tone: 'error' },
    )
  }

  async function handleExcel(): Promise<void> {
    if (!project || exporting) return
    setExporting(true)
    try {
      await exportProjectToXlsx(project)
      toast.show({ message: '엑셀 파일을 내려받았습니다.', tone: 'success' })
    } catch (error) {
      log.error('xlsx_export_failed', { projectId }, error)
      toast.show({ message: '엑셀 파일을 만들지 못했습니다. 다시 시도해 주세요.', tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <AppBar
        title="정리 · 공유"
        subtitle={project?.name}
        onBack={() => navigate(`/p/${projectId}`)}
      />

      <main className="app-main">
        {state.status === 'loading' && <ListSkeleton rows={3} />}

        {state.status === 'missing' && (
          <ErrorState
            title="공사를 찾을 수 없습니다"
            description="삭제되었거나 주소가 잘못되었습니다."
            action={
              <Button variant="primary" onClick={() => navigate('/')}>
                목록으로
              </Button>
            }
          />
        )}

        {state.status === 'error' && (
          <ErrorState
            title="불러오지 못했습니다"
            description={state.message}
            action={
              <Button variant="primary" onClick={() => void reload()}>
                다시 시도
              </Button>
            }
          />
        )}

        {project && summary && !hasRecords && (
          <EmptyState
            icon={<FolderIcon size={26} />}
            title="아직 정리할 내용이 없습니다"
            description={'항목 안에 케이블이나 장비를 적으면\n여기에서 집계와 공유 텍스트를 만들어 드립니다.'}
            action={
              <Button variant="primary" onClick={() => navigate(`/p/${projectId}`)}>
                기록하러 가기
              </Button>
            }
          />
        )}

        {project && summary && hasRecords && (
          <div className={styles.stack}>
            <div className={styles.headline}>
              <div className={styles.headlineCard}>
                <span className={styles.headlineLabel}>케이블 총 물량</span>
                <span className={styles.headlineValue}>
                  {formatNumber(summary.totalCableLength)}
                  <span className={styles.headlineUnit}> m</span>
                </span>
                <span className={styles.headlineLabel}>
                  {summary.cables.length}종 · {summary.totalCableCount}건
                </span>
              </div>

              <div className={styles.headlineCard}>
                <span className={styles.headlineLabel}>장비</span>
                <span className={styles.headlineValue}>
                  {summary.totalReplacementQty + summary.totalAdditionQty}
                  <span className={styles.headlineUnit}> 개</span>
                </span>
                <span className={styles.headlineLabel}>
                  교체 {summary.totalReplacementQty} · 신규 {summary.totalAdditionQty}
                </span>
              </div>
            </div>

            {summary.invalidQuantityCount > 0 && (
              <div className={styles.warning} role="alert">
                <AlertIcon size={18} className={styles.warningIcon} />
                <span>
                  물량 수식 {summary.invalidQuantityCount}건을 계산하지 못해 합계에서 빠졌습니다. 기록 화면에서 빨간색으로
                  표시된 항목을 확인해 주세요.
                </span>
              </div>
            )}

            {summary.cables.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  케이블 종류별
                  <span className={styles.sectionTotal}>{formatNumber(summary.totalCableLength)} m</span>
                </h2>
                <div className={styles.rows}>
                  {summary.cables.map((row) => (
                    <div key={row.cableType} className={styles.row}>
                      <span className={styles.rowName}>
                        {row.cableType}
                        {row.invalidCount > 0 && (
                          <span className={styles.rowSpec}>계산하지 못한 기록 {row.invalidCount}건</span>
                        )}
                      </span>
                      <span className={styles.rowValue}>
                        {formatNumber(row.totalLength)} m <span className={styles.rowCount}>({row.count}건)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(summary.replacements.length > 0 || summary.additions.length > 0) && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  장비별
                  <span className={styles.sectionTotal}>
                    {summary.totalReplacementQty + summary.totalAdditionQty}개
                  </span>
                </h2>
                <div className={styles.rows}>
                  {[...summary.replacements, ...summary.additions].map((row) => (
                    <div key={`${row.kind}-${row.name}-${row.spec}`} className={styles.row}>
                      <span className={styles.rowName}>
                        <span
                          className={`${styles.badgeKind} ${
                            row.kind === 'replace' ? styles.badgeReplace : styles.badgeNew
                          }`}
                        >
                          {row.kind === 'replace' ? '교체' : '신규'}
                        </span>
                        {row.name}
                        {row.spec !== '' && <span className={styles.rowSpec}>{row.spec}</span>}
                      </span>
                      <span className={styles.rowValue}>
                        {row.totalQty}개 <span className={styles.rowCount}>({row.count}건)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>공유할 내용 미리보기</h2>
              <pre className={styles.preview}>{text}</pre>
              <div className={styles.actions}>
                <Button icon={<CopyIcon size={18} />} onClick={() => void handleCopy()}>
                  복사
                </Button>
                <Button loading={exporting} onClick={() => void handleExcel()}>
                  엑셀 받기
                </Button>
              </div>
            </section>
          </div>
        )}
      </main>

      {project && hasRecords && (
        <div className="bottom-bar">
          <div className="bottom-bar-inner">
            <Button variant="primary" size="lg" fullWidth loading={sharing} onClick={() => void handleShare()}>
              공유하기
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
