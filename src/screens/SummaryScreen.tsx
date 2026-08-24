import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppBar } from '../components/AppBar'
import { Button } from '../components/Button'
import { AlertIcon, CableIcon, CopyIcon, EquipmentIcon, FolderIcon, ShareIcon } from '../components/Icons'
import { EmptyState, ErrorState, ListSkeleton } from '../components/States'
import { loadProject, StorageError } from '../lib/db'
import { downloadBlob } from '../lib/download'
import { buildShareText } from '../lib/exportText'
import { buildProjectXlsxFile } from '../lib/exportXlsx'
import { formatNumber } from '../lib/format'
import { log } from '../lib/logger'
import { copyText, shareFile, shareText } from '../lib/share'
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

  // 미리 만들어 둔 엑셀. 버튼을 누르는 순간 기다림 없이 공유해야 브라우저가 막지 않는다.
  const [xlsx, setXlsx] = useState<File | null>(null)

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

  /*
   * 버튼을 누른 뒤에 엑셀을 만들면, 만드는 사이 '방금 눌렀음' 상태가 풀려 브라우저가 공유를 막는다.
   * 화면이 떠 있는 동안 미리 만들어 두고 누르는 즉시 넘긴다.
   */
  useEffect(() => {
    if (!project || !hasRecords) return

    let discarded = false
    setXlsx(null)

    void (async () => {
      try {
        const file = await buildProjectXlsxFile(project)
        if (!discarded) setXlsx(file)
      } catch (error) {
        // 미리 만들기가 실패해도 화면은 그대로 쓴다. 버튼을 누를 때 다시 만든다.
        log.warn('xlsx_prebuild_failed', { projectId }, error)
      }
    })()

    return () => {
      discarded = true
    }
  }, [project, hasRecords, projectId])

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
      // 미리 만들어 둔 파일을 그대로 쓴다. 아직 없으면 그 자리에서 만든다.
      const file = xlsx ?? (await buildProjectXlsxFile(project))
      const result = await shareFile(file)

      if (result.outcome === 'unsupported' || result.outcome === 'failed') {
        // 공유가 막힌 기기에서는 내려받기 말고 방법이 없다. 원인을 함께 알려 다음 조치를 정할 수 있게 한다.
        downloadBlob(file, file.name)
        toast.show({
          message: `앱으로 공유하지 못해 파일로 내려받았습니다. (${result.reason ?? '원인 미상'})`,
          tone: 'info',
          durationMs: 7000,
        })
      }
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
                <span className={styles.headlineLabel}>
                  <CableIcon size={14} />
                  케이블 총 물량
                </span>
                <span className={styles.headlineValue}>
                  {formatNumber(summary.totalCableLength)}
                  <span className={styles.headlineUnit}> m</span>
                </span>
                <span className={styles.headlineLabel}>
                  {summary.cables.length}종 · {summary.totalCableCount}건
                </span>
              </div>

              <div className={styles.headlineCard}>
                <span className={styles.headlineLabel}>
                  <EquipmentIcon size={14} />
                  장비
                </span>
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
                <Button loading={exporting} icon={<ShareIcon size={18} />} onClick={() => void handleExcel()}>
                  엑셀 공유
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
