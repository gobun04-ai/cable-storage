import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ActionSheet, type SheetAction } from '../components/ActionSheet'
import { AppBar } from '../components/AppBar'
import { Button } from '../components/Button'
import { CableFormSheet } from '../components/CableFormSheet'
import { EquipmentFormSheet } from '../components/EquipmentFormSheet'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
} from '../components/Icons'
import { IconButton } from '../components/IconButton'
import { ProjectFormSheet, type ProjectFormValues } from '../components/ProjectFormSheet'
import type { RecordHandlers } from '../components/RecordList'
import { SectionFormSheet, type SectionFormValues } from '../components/SectionFormSheet'
import { SectionTree } from '../components/SectionTree'
import { EmptyState, ErrorState, ListSkeleton } from '../components/States'
import { loadProject, saveProject, StorageError } from '../lib/db'
import { log } from '../lib/logger'
import {
  addCable,
  addEquipment,
  duplicateCable,
  duplicateEquipment,
  moveCable,
  moveEquipment,
  removeCable,
  removeEquipment,
  updateCable,
  updateEquipment,
  type CableInput,
  type EquipmentInput,
} from '../lib/records'
import { rememberValue } from '../lib/suggest'
import {
  addSection,
  buildTree,
  collectSubtreeIds,
  flattenTree,
  moveSection,
  removeSection,
  updateSection,
} from '../lib/tree'
import { useCollapsedSections } from '../state/useCollapsedSections'
import { useToast } from '../state/ToastProvider'
import type { CableRecord, EquipmentKind, EquipmentRecord, Id, Project, ProjectBody, SectionNode } from '../types'
import styles from './ProjectScreen.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; project: Project }

type SectionFormState =
  | { mode: 'closed' }
  | { mode: 'add'; parentId: Id | null; heading: string }
  | { mode: 'edit'; sectionId: Id; initial: SectionFormValues }

type CableFormState =
  | { mode: 'closed' }
  | { mode: 'add'; sectionId: Id; sectionLabel: string }
  | { mode: 'edit'; cable: CableRecord; sectionLabel: string }

type EquipmentFormState =
  | { mode: 'closed' }
  | { mode: 'add'; sectionId: Id; sectionLabel: string; kind: EquipmentKind }
  | { mode: 'edit'; equipment: EquipmentRecord; sectionLabel: string }

function messageOf(error: unknown, fallback: string): string {
  return error instanceof StorageError ? error.userMessage : fallback
}

export function ProjectScreen() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reorderMode, setReorderMode] = useState(false)
  const [sectionForm, setSectionForm] = useState<SectionFormState>({ mode: 'closed' })
  const [cableForm, setCableForm] = useState<CableFormState>({ mode: 'closed' })
  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormState>({ mode: 'closed' })
  const [menuNode, setMenuNode] = useState<SectionNode | null>(null)
  const [cableMenu, setCableMenu] = useState<CableRecord | null>(null)
  const [equipmentMenu, setEquipmentMenu] = useState<EquipmentRecord | null>(null)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
  const [appMenuOpen, setAppMenuOpen] = useState(false)

  const { collapsed, toggle, collapseAll, expandAll } = useCollapsedSections(projectId)

  // 저장 실패로 되돌릴 때 쓸 직전 상태
  const lastSaved = useRef<Project | null>(null)

  const reload = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const project = await loadProject(projectId)
      if (!project) {
        setState({ status: 'missing' })
        return
      }
      lastSaved.current = project
      setState({ status: 'ready', project })
    } catch (error) {
      log.error('project_load_failed', { projectId }, error)
      setState({ status: 'error', message: messageOf(error, '공사를 불러오지 못했습니다.') })
    }
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  /**
   * 화면을 먼저 바꾸고 저장은 뒤따르게 한다(낙관적 업데이트).
   * 저장에 실패하면 직전 상태로 되돌리고 사용자에게 알린다.
   */
  const commit = useCallback(
    (next: Project, onFailMessage: string) => {
      const previous = lastSaved.current
      setState({ status: 'ready', project: next })

      void saveProject(next)
        .then(() => {
          lastSaved.current = next
        })
        .catch((error: unknown) => {
          log.error('project_autosave_failed', { projectId: next.id }, error)
          if (previous) setState({ status: 'ready', project: previous })
          toast.show({ message: messageOf(error, onFailMessage), tone: 'error' })
        })
    },
    [toast],
  )

  const applyBody = useCallback(
    (project: Project, updater: (body: ProjectBody) => ProjectBody, failMessage: string): void => {
      commit({ ...project, body: updater(project.body), updatedAt: Date.now() }, failMessage)
    },
    [commit],
  )

  const project = state.status === 'ready' ? state.project : null
  const tree = useMemo(() => (project ? buildTree(project.body) : []), [project])
  const flat = useMemo(() => flattenTree(tree), [tree])

  const labelOf = useCallback(
    (sectionId: Id): string => {
      const node = flat.find((item) => item.section.id === sectionId)
      return node ? `${node.numbering} ${node.section.title}` : ''
    },
    [flat],
  )

  /** 삭제를 되돌릴 수 있도록 직전 본문을 통째로 안고 알림을 띄운다. */
  function showUndoableDelete(project: Project, before: ProjectBody, message: string): void {
    toast.show({
      message,
      action: {
        label: '실행 취소',
        onClick: () => commit({ ...project, body: before, updatedAt: Date.now() }, '되돌리지 못했습니다.'),
      },
    })
  }

  // ---------- 항목 ----------

  function handleAddSection(values: SectionFormValues): void {
    if (!project || sectionForm.mode !== 'add') return
    const parentId = sectionForm.parentId
    const result = addSection(project.body, parentId, values.title)
    const withMemo =
      values.memo === '' ? result.body : updateSection(result.body, result.sectionId, { memo: values.memo })

    applyBody(project, () => withMemo, '항목을 추가하지 못했습니다.')
    setSectionForm({ mode: 'closed' })

    // 하위 항목을 넣었는데 부모가 접혀 있으면 방금 만든 것이 보이지 않는다
    if (parentId !== null && collapsed.has(parentId)) toggle(parentId)
  }

  function handleEditSection(values: SectionFormValues): void {
    if (!project || sectionForm.mode !== 'edit') return
    const sectionId = sectionForm.sectionId
    applyBody(project, (body) => updateSection(body, sectionId, values), '항목을 수정하지 못했습니다.')
    setSectionForm({ mode: 'closed' })
  }

  function handleDeleteSection(node: SectionNode): void {
    if (!project) return
    const before = project.body
    const removedIds = collectSubtreeIds(before.sections, node.section.id)
    const removedCables = before.cables.filter((c) => removedIds.has(c.sectionId)).length
    const removedEquipments = before.equipments.filter((e) => removedIds.has(e.sectionId)).length

    applyBody(project, (body) => removeSection(body, node.section.id), '항목을 삭제하지 못했습니다.')

    const extra: string[] = []
    if (removedIds.size > 1) extra.push(`하위 ${removedIds.size - 1}개`)
    if (removedCables > 0) extra.push(`케이블 ${removedCables}건`)
    if (removedEquipments > 0) extra.push(`장비 ${removedEquipments}건`)

    showUndoableDelete(
      project,
      before,
      extra.length === 0
        ? `'${node.section.title}' 항목을 삭제했습니다.`
        : `'${node.section.title}' 항목과 ${extra.join(', ')}을 삭제했습니다.`,
    )
  }

  function handleMoveSection(sectionId: Id, direction: -1 | 1): void {
    if (!project) return
    applyBody(project, (body) => moveSection(body, sectionId, direction), '순서를 바꾸지 못했습니다.')
  }

  // ---------- 케이블 ----------

  function handleCableSubmit(input: CableInput): void {
    if (!project || cableForm.mode === 'closed') return

    // 다음 입력 때 바로 꺼내 쓸 수 있게 이번에 적은 값을 기억해 둔다
    rememberValue('cableType', input.cableType)
    rememberValue('from', input.from)
    rememberValue('to', input.to)

    if (cableForm.mode === 'add') {
      const sectionId = cableForm.sectionId
      applyBody(project, (body) => addCable(body, sectionId, input), '케이블을 추가하지 못했습니다.')
    } else {
      const cableId = cableForm.cable.id
      applyBody(project, (body) => updateCable(body, cableId, input), '케이블을 수정하지 못했습니다.')
    }
    setCableForm({ mode: 'closed' })
  }

  function handleDeleteCable(cable: CableRecord): void {
    if (!project) return
    const before = project.body
    applyBody(project, (body) => removeCable(body, cable.id), '케이블을 삭제하지 못했습니다.')
    showUndoableDelete(project, before, `'${cable.cableType}' 케이블을 삭제했습니다.`)
  }

  // ---------- 장비 ----------

  function handleEquipmentSubmit(input: EquipmentInput): void {
    if (!project || equipmentForm.mode === 'closed') return

    rememberValue('equipmentName', input.name)
    rememberValue('equipmentSpec', input.spec)

    if (equipmentForm.mode === 'add') {
      const sectionId = equipmentForm.sectionId
      applyBody(project, (body) => addEquipment(body, sectionId, input), '장비를 추가하지 못했습니다.')
    } else {
      const equipmentId = equipmentForm.equipment.id
      applyBody(project, (body) => updateEquipment(body, equipmentId, input), '장비를 수정하지 못했습니다.')
    }
    setEquipmentForm({ mode: 'closed' })
  }

  function handleDeleteEquipment(equipment: EquipmentRecord): void {
    if (!project) return
    const before = project.body
    applyBody(project, (body) => removeEquipment(body, equipment.id), '장비를 삭제하지 못했습니다.')
    showUndoableDelete(project, before, `'${equipment.name}' 장비를 삭제했습니다.`)
  }

  // ---------- 공사 정보 ----------

  async function handleProjectFormSubmit(values: ProjectFormValues): Promise<void> {
    if (!project || savingProject) return
    setSavingProject(true)
    try {
      const next: Project = { ...project, ...values, updatedAt: Date.now() }
      await saveProject(next)
      lastSaved.current = next
      setState({ status: 'ready', project: next })
      setProjectFormOpen(false)
      toast.show({ message: '공사 정보를 저장했습니다.', tone: 'success' })
    } catch (error) {
      log.error('project_meta_save_failed', { projectId }, error)
      toast.show({ message: messageOf(error, '저장하지 못했습니다.'), tone: 'error' })
    } finally {
      setSavingProject(false)
    }
  }

  const recordHandlers: RecordHandlers = {
    onAddCable: (sectionId) => setCableForm({ mode: 'add', sectionId, sectionLabel: labelOf(sectionId) }),
    onAddEquipment: (sectionId) =>
      setEquipmentForm({ mode: 'add', sectionId, sectionLabel: labelOf(sectionId), kind: 'replace' }),
    onEditCable: (cable) => setCableForm({ mode: 'edit', cable, sectionLabel: labelOf(cable.sectionId) }),
    onCableMenu: setCableMenu,
    onEditEquipment: (equipment) =>
      setEquipmentForm({ mode: 'edit', equipment, sectionLabel: labelOf(equipment.sectionId) }),
    onEquipmentMenu: setEquipmentMenu,
  }

  const nodeMenuActions: SheetAction[] =
    menuNode === null
      ? []
      : [
          {
            key: 'add-child',
            label: '하위 항목 추가',
            icon: <PlusIcon />,
            onClick: () =>
              setSectionForm({
                mode: 'add',
                parentId: menuNode.section.id,
                heading: `${menuNode.numbering} ${menuNode.section.title} 아래에 항목 추가`,
              }),
          },
          {
            key: 'add-cable',
            label: '케이블 추가',
            icon: <PlusIcon />,
            onClick: () => recordHandlers.onAddCable(menuNode.section.id),
          },
          {
            key: 'add-equipment',
            label: '장비 추가',
            icon: <PlusIcon />,
            onClick: () => recordHandlers.onAddEquipment(menuNode.section.id),
          },
          {
            key: 'edit',
            label: '이름·메모 수정',
            icon: <PencilIcon />,
            onClick: () =>
              setSectionForm({
                mode: 'edit',
                sectionId: menuNode.section.id,
                initial: { title: menuNode.section.title, memo: menuNode.section.memo },
              }),
          },
          {
            key: 'up',
            label: '위로 이동',
            icon: <ArrowUpIcon />,
            onClick: () => handleMoveSection(menuNode.section.id, -1),
          },
          {
            key: 'down',
            label: '아래로 이동',
            icon: <ArrowDownIcon />,
            onClick: () => handleMoveSection(menuNode.section.id, 1),
          },
          {
            key: 'delete',
            label: '삭제',
            description: '하위 항목과 그 안의 기록까지 함께 지웁니다',
            icon: <TrashIcon />,
            tone: 'danger',
            onClick: () => handleDeleteSection(menuNode),
          },
        ]

  const cableMenuActions: SheetAction[] =
    cableMenu === null || project === null
      ? []
      : [
          {
            key: 'edit',
            label: '수정',
            icon: <PencilIcon />,
            onClick: () => setCableForm({ mode: 'edit', cable: cableMenu, sectionLabel: labelOf(cableMenu.sectionId) }),
          },
          {
            key: 'duplicate',
            label: '복제',
            description: '같은 규격을 다른 구간에 적을 때',
            icon: <CopyIcon />,
            onClick: () =>
              applyBody(project, (body) => duplicateCable(body, cableMenu.id), '복제하지 못했습니다.'),
          },
          {
            key: 'up',
            label: '위로 이동',
            icon: <ArrowUpIcon />,
            onClick: () => applyBody(project, (body) => moveCable(body, cableMenu.id, -1), '순서를 바꾸지 못했습니다.'),
          },
          {
            key: 'down',
            label: '아래로 이동',
            icon: <ArrowDownIcon />,
            onClick: () => applyBody(project, (body) => moveCable(body, cableMenu.id, 1), '순서를 바꾸지 못했습니다.'),
          },
          {
            key: 'delete',
            label: '삭제',
            icon: <TrashIcon />,
            tone: 'danger',
            onClick: () => handleDeleteCable(cableMenu),
          },
        ]

  const equipmentMenuActions: SheetAction[] =
    equipmentMenu === null || project === null
      ? []
      : [
          {
            key: 'edit',
            label: '수정',
            icon: <PencilIcon />,
            onClick: () =>
              setEquipmentForm({
                mode: 'edit',
                equipment: equipmentMenu,
                sectionLabel: labelOf(equipmentMenu.sectionId),
              }),
          },
          {
            key: 'duplicate',
            label: '복제',
            icon: <CopyIcon />,
            onClick: () =>
              applyBody(project, (body) => duplicateEquipment(body, equipmentMenu.id), '복제하지 못했습니다.'),
          },
          {
            key: 'up',
            label: '위로 이동',
            icon: <ArrowUpIcon />,
            onClick: () =>
              applyBody(project, (body) => moveEquipment(body, equipmentMenu.id, -1), '순서를 바꾸지 못했습니다.'),
          },
          {
            key: 'down',
            label: '아래로 이동',
            icon: <ArrowDownIcon />,
            onClick: () =>
              applyBody(project, (body) => moveEquipment(body, equipmentMenu.id, 1), '순서를 바꾸지 못했습니다.'),
          },
          {
            key: 'delete',
            label: '삭제',
            icon: <TrashIcon />,
            tone: 'danger',
            onClick: () => handleDeleteEquipment(equipmentMenu),
          },
        ]

  const appMenuActions: SheetAction[] = [
    {
      key: 'summary',
      label: '정리 · 공유',
      description: '집계를 보고 텍스트·엑셀로 내보냅니다',
      icon: <ShareIcon />,
      onClick: () => navigate(`/p/${projectId}/summary`),
    },
    {
      key: 'edit-project',
      label: '공사 정보 수정',
      icon: <PencilIcon />,
      onClick: () => setProjectFormOpen(true),
    },
    {
      key: 'reorder',
      label: reorderMode ? '순서 바꾸기 끝내기' : '항목 순서 바꾸기',
      icon: <ArrowUpIcon />,
      onClick: () => setReorderMode((prev) => !prev),
    },
    {
      key: 'collapse',
      label: '모두 접기',
      icon: <FolderIcon />,
      disabled: flat.length === 0,
      onClick: () => collapseAll(flat.map((n) => n.section.id)),
    },
    {
      key: 'expand',
      label: '모두 펼치기',
      icon: <FolderIcon />,
      disabled: collapsed.size === 0,
      onClick: expandAll,
    },
  ]

  return (
    <>
      <AppBar
        title={project?.name ?? '공사'}
        subtitle={project?.site}
        onBack={() => navigate('/')}
        actions={
          <>
            <IconButton
              label="정리하고 공유"
              icon={<ShareIcon />}
              disabled={state.status !== 'ready'}
              onClick={() => navigate(`/p/${projectId}/summary`)}
            />
            <IconButton
              label="공사 메뉴"
              icon={<MoreVerticalIcon />}
              disabled={state.status !== 'ready'}
              onClick={() => setAppMenuOpen(true)}
            />
          </>
        }
      />

      <main className="app-main">
        {state.status === 'loading' && <ListSkeleton rows={4} />}

        {state.status === 'missing' && (
          <ErrorState
            title="공사를 찾을 수 없습니다"
            description="삭제되었거나 주소가 잘못되었습니다. 목록으로 돌아가 확인해 주세요."
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

        {project && (
          <>
            {project.memo !== '' && <p className={styles.projectMemo}>{project.memo}</p>}

            {reorderMode && (
              <div className={styles.modeBanner}>
                <span>화살표로 같은 단계 안에서 순서를 바꿉니다.</span>
                <Button size="sm" onClick={() => setReorderMode(false)}>
                  끝내기
                </Button>
              </div>
            )}

            {tree.length === 0 ? (
              <EmptyState
                icon={<FolderIcon size={26} />}
                title="항목을 추가해 시작하세요"
                description={
                  '먼저 큰 구역(예: 1층 전기실)을 항목으로 만들고,\n그 안에 케이블과 장비를 적어 나가면 됩니다.'
                }
                action={
                  <Button
                    variant="primary"
                    size="lg"
                    icon={<PlusIcon />}
                    onClick={() => setSectionForm({ mode: 'add', parentId: null, heading: '항목 추가' })}
                  >
                    첫 항목 만들기
                  </Button>
                }
              />
            ) : (
              <>
                <div className={styles.toolbar}>
                  <span className={styles.toolbarInfo}>
                    항목 {project.body.sections.length}개
                    {project.body.cables.length > 0 && ` · 케이블 ${project.body.cables.length}건`}
                    {project.body.equipments.length > 0 && ` · 장비 ${project.body.equipments.length}건`}
                  </span>
                  <div className={styles.toolbarActions}>
                    <Button size="sm" onClick={() => setReorderMode((prev) => !prev)}>
                      {reorderMode ? '순서 바꾸기 끝' : '순서 바꾸기'}
                    </Button>
                  </div>
                </div>

                <SectionTree
                  nodes={tree}
                  collapsed={collapsed}
                  reorderMode={reorderMode}
                  onToggle={toggle}
                  onMenu={setMenuNode}
                  onMove={handleMoveSection}
                  records={recordHandlers}
                />
              </>
            )}
          </>
        )}
      </main>

      {project && tree.length > 0 && (
        <div className={styles.bottomBar}>
          <div className={styles.bottomBarInner}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={<PlusIcon />}
              onClick={() => setSectionForm({ mode: 'add', parentId: null, heading: '항목 추가' })}
            >
              항목 추가
            </Button>
          </div>
        </div>
      )}

      <SectionFormSheet
        open={sectionForm.mode !== 'closed'}
        heading={
          sectionForm.mode === 'add' ? sectionForm.heading : sectionForm.mode === 'edit' ? '항목 수정' : ''
        }
        initial={sectionForm.mode === 'edit' ? sectionForm.initial : undefined}
        submitLabel={sectionForm.mode === 'edit' ? '저장' : '추가'}
        onSubmit={sectionForm.mode === 'edit' ? handleEditSection : handleAddSection}
        onClose={() => setSectionForm({ mode: 'closed' })}
      />

      {project && (
        <>
          <CableFormSheet
            open={cableForm.mode !== 'closed'}
            sectionLabel={cableForm.mode === 'closed' ? '' : cableForm.sectionLabel}
            initial={
              cableForm.mode === 'edit'
                ? {
                    cableType: cableForm.cable.cableType,
                    from: cableForm.cable.from,
                    to: cableForm.cable.to,
                    quantityExpr: cableForm.cable.quantityExpr,
                    note: cableForm.cable.note,
                  }
                : undefined
            }
            body={project.body}
            onSubmit={handleCableSubmit}
            onClose={() => setCableForm({ mode: 'closed' })}
          />

          <EquipmentFormSheet
            open={equipmentForm.mode !== 'closed'}
            sectionLabel={equipmentForm.mode === 'closed' ? '' : equipmentForm.sectionLabel}
            defaultKind={equipmentForm.mode === 'add' ? equipmentForm.kind : undefined}
            initial={
              equipmentForm.mode === 'edit'
                ? {
                    kind: equipmentForm.equipment.kind,
                    name: equipmentForm.equipment.name,
                    qty: equipmentForm.equipment.qty,
                    spec: equipmentForm.equipment.spec,
                    note: equipmentForm.equipment.note,
                  }
                : undefined
            }
            body={project.body}
            onSubmit={handleEquipmentSubmit}
            onClose={() => setEquipmentForm({ mode: 'closed' })}
          />
        </>
      )}

      <ActionSheet
        open={menuNode !== null}
        title={menuNode === null ? '' : `${menuNode.numbering} ${menuNode.section.title}`}
        actions={nodeMenuActions}
        onClose={() => setMenuNode(null)}
      />

      <ActionSheet
        open={cableMenu !== null}
        title={cableMenu?.cableType ?? ''}
        actions={cableMenuActions}
        onClose={() => setCableMenu(null)}
      />

      <ActionSheet
        open={equipmentMenu !== null}
        title={equipmentMenu?.name ?? ''}
        actions={equipmentMenuActions}
        onClose={() => setEquipmentMenu(null)}
      />

      <ActionSheet
        open={appMenuOpen}
        title={project?.name ?? ''}
        actions={appMenuActions}
        onClose={() => setAppMenuOpen(false)}
      />

      {project && (
        <ProjectFormSheet
          open={projectFormOpen}
          mode="edit"
          initial={{ name: project.name, site: project.site, memo: project.memo }}
          saving={savingProject}
          onSubmit={(values) => void handleProjectFormSubmit(values)}
          onClose={() => setProjectFormOpen(false)}
        />
      )}
    </>
  )
}
