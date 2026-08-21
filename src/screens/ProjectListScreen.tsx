import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActionSheet, type SheetAction } from '../components/ActionSheet'
import { AppBar } from '../components/AppBar'
import { Button } from '../components/Button'
import {
  CopyIcon,
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
} from '../components/Icons'
import { IconButton } from '../components/IconButton'
import { InstallBanner } from '../components/InstallBanner'
import { ProjectFormSheet, type ProjectFormValues } from '../components/ProjectFormSheet'
import { EmptyState, ErrorState, ListSkeleton } from '../components/States'
import { deleteProject, listProjects, loadProject, saveProject, StorageError } from '../lib/db'
import { formatRelativeDate } from '../lib/format'
import { log } from '../lib/logger'
import { createEmptyProject, duplicateProject } from '../lib/project'
import { useToast } from '../state/ToastProvider'
import type { Project, ProjectMeta } from '../types'
import styles from './ProjectListScreen.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; projects: ProjectMeta[] }
  | { status: 'error'; message: string }

const GENERIC_ERROR = '목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'

function messageOf(error: unknown, fallback: string): string {
  return error instanceof StorageError ? error.userMessage : fallback
}

export function ProjectListScreen() {
  const navigate = useNavigate()
  const toast = useToast()

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formInitial, setFormInitial] = useState<ProjectFormValues | undefined>(undefined)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [menuTarget, setMenuTarget] = useState<ProjectMeta | null>(null)

  const reload = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const projects = await listProjects()
      setState({ status: 'ready', projects })
    } catch (error) {
      log.error('project_list_load_failed', {}, error)
      setState({ status: 'error', message: messageOf(error, GENERIC_ERROR) })
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  function openCreate(): void {
    setFormMode('create')
    setFormInitial(undefined)
    setEditingId(null)
    setFormOpen(true)
  }

  function openEdit(meta: ProjectMeta): void {
    setFormMode('edit')
    setFormInitial({ name: meta.name, site: meta.site, memo: meta.memo })
    setEditingId(meta.id)
    setFormOpen(true)
  }

  async function handleSubmit(values: ProjectFormValues): Promise<void> {
    if (saving) return // 버튼 두 번 눌림 방지
    setSaving(true)
    try {
      if (formMode === 'create') {
        const project = createEmptyProject(values)
        await saveProject(project)
        log.info('project_created', { projectId: project.id })
        setFormOpen(false)
        navigate(`/p/${project.id}`)
        return
      }

      if (editingId === null) return
      const existing = await loadProject(editingId)
      if (!existing) {
        toast.show({ message: '이미 삭제된 공사입니다.', tone: 'error' })
        setFormOpen(false)
        await reload()
        return
      }

      await saveProject({ ...existing, ...values, updatedAt: Date.now() })
      setFormOpen(false)
      await reload()
      toast.show({ message: '공사 정보를 저장했습니다.', tone: 'success' })
    } catch (error) {
      log.error('project_save_failed', { mode: formMode }, error)
      toast.show({ message: messageOf(error, '저장하지 못했습니다. 다시 시도해 주세요.'), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate(meta: ProjectMeta): Promise<void> {
    try {
      const source = await loadProject(meta.id)
      if (!source) {
        toast.show({ message: '이미 삭제된 공사입니다.', tone: 'error' })
        await reload()
        return
      }
      const copy = duplicateProject(source, `${source.name} (복사본)`)
      await saveProject(copy)
      log.info('project_duplicated', { from: meta.id, to: copy.id })
      await reload()
      toast.show({ message: '공사를 복제했습니다.', tone: 'success' })
    } catch (error) {
      log.error('project_duplicate_failed', { projectId: meta.id }, error)
      toast.show({ message: messageOf(error, '복제하지 못했습니다.'), tone: 'error' })
    }
  }

  async function handleDelete(meta: ProjectMeta): Promise<void> {
    let snapshot: Project | null = null
    try {
      // 되돌리기를 위해 지우기 전에 통째로 들고 있는다
      snapshot = await loadProject(meta.id)
      await deleteProject(meta.id)
      setState((prev) =>
        prev.status === 'ready' ? { ...prev, projects: prev.projects.filter((p) => p.id !== meta.id) } : prev,
      )
    } catch (error) {
      log.error('project_delete_failed', { projectId: meta.id }, error)
      toast.show({ message: messageOf(error, '삭제하지 못했습니다.'), tone: 'error' })
      return
    }

    const restorable = snapshot
    toast.show({
      message: `'${meta.name}' 공사를 삭제했습니다.`,
      action:
        restorable === null
          ? undefined
          : {
              label: '실행 취소',
              onClick: () => {
                void saveProject(restorable)
                  .then(reload)
                  .catch((error: unknown) => {
                    log.error('project_restore_failed', { projectId: restorable.id }, error)
                    toast.show({ message: messageOf(error, '되돌리지 못했습니다.'), tone: 'error' })
                  })
              },
            },
    })
  }

  const menuActions: SheetAction[] =
    menuTarget === null
      ? []
      : [
          {
            key: 'edit',
            label: '공사 정보 수정',
            icon: <PencilIcon />,
            onClick: () => openEdit(menuTarget),
          },
          {
            key: 'duplicate',
            label: '복제',
            description: '항목과 기록을 그대로 복사해 새 공사를 만듭니다',
            icon: <CopyIcon />,
            onClick: () => void handleDuplicate(menuTarget),
          },
          {
            key: 'delete',
            label: '삭제',
            tone: 'danger',
            icon: <TrashIcon />,
            onClick: () => void handleDelete(menuTarget),
          },
        ]

  return (
    <>
      <AppBar
        title="케이블노트"
        subtitle="현장 물량 산출 노트"
        actions={
          <IconButton label="설정" icon={<SettingsIcon />} onClick={() => navigate('/settings')} />
        }
      />

      <main className="app-main">
        <InstallBanner />

        {state.status === 'loading' && <ListSkeleton rows={3} />}

        {state.status === 'error' && (
          <ErrorState
            title="목록을 불러오지 못했습니다"
            description={state.message}
            action={
              <Button variant="primary" onClick={() => void reload()}>
                다시 시도
              </Button>
            }
          />
        )}

        {state.status === 'ready' && state.projects.length === 0 && (
          <EmptyState
            icon={<FolderIcon size={26} />}
            title="아직 등록한 공사가 없습니다"
            description={
              '공사를 하나 만들고 그 아래에 항목을 쌓아 가세요.\n케이블과 장비를 적어 두면 텍스트와 엑셀로 정리해 드립니다.'
            }
            action={
              <Button variant="primary" size="lg" icon={<PlusIcon />} onClick={openCreate}>
                첫 공사 만들기
              </Button>
            }
          />
        )}

        {state.status === 'ready' && state.projects.length > 0 && (
          <ul className={styles.list}>
            {state.projects.map((project) => (
              <li key={project.id} className={styles.card}>
                <Link className={styles.cardLink} to={`/p/${project.id}`}>
                  <span className={styles.name}>{project.name}</span>
                  {project.site !== '' && <span className={styles.site}>{project.site}</span>}
                  <span className={styles.meta}>
                    <span className={styles.chip}>항목 {project.counts.sections}</span>
                    <span className={styles.chip}>케이블 {project.counts.cables}</span>
                    <span className={styles.chip}>장비 {project.counts.equipments}</span>
                    <span>{formatRelativeDate(project.updatedAt)}</span>
                  </span>
                </Link>
                <div className={styles.cardMenu}>
                  <IconButton
                    label={`${project.name} 메뉴`}
                    icon={<MoreVerticalIcon />}
                    onClick={() => setMenuTarget(project)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {state.status === 'ready' && state.projects.length > 0 && (
        <div className={styles.bottomBar}>
          <div className={styles.bottomBarInner}>
            <Button variant="primary" size="lg" fullWidth icon={<PlusIcon />} onClick={openCreate}>
              새 공사
            </Button>
          </div>
        </div>
      )}

      <ProjectFormSheet
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        saving={saving}
        onSubmit={(values) => void handleSubmit(values)}
        onClose={() => setFormOpen(false)}
      />

      <ActionSheet
        open={menuTarget !== null}
        title={menuTarget?.name ?? ''}
        actions={menuActions}
        onClose={() => setMenuTarget(null)}
      />
    </>
  )
}
