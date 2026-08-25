import type { PointerEvent as ReactPointerEvent } from 'react'
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, CopyIcon, MoreVerticalIcon } from './Icons'
import { IconButton } from './IconButton'
import { RecordList, type RecordHandlers } from './RecordList'
import { countSubtree } from '../lib/tree'
import type { DragState } from '../state/useDragReorder'
import type { Id, SectionNode } from '../types'
import styles from './SectionTree.module.css'

interface SectionTreeProps {
  nodes: SectionNode[]
  collapsed: ReadonlySet<Id>
  /** 순서 바꾸기 모드에서는 메뉴 대신 위/아래 버튼을 보여 주고, 기록 목록은 감춘다 */
  reorderMode: boolean
  onToggle: (id: Id) => void
  onMenu: (node: SectionNode) => void
  onMove: (id: Id, direction: -1 | 1) => void
  /** 이 항목만 텍스트로 복사한다. 공사 전체가 아니라 한 구역만 보낼 때 쓴다. */
  onCopy: (node: SectionNode) => void
  records: RecordHandlers
  /** 방금 추가·복제되어 잠시 강조할 항목이나 기록. 없으면 null. */
  highlightId: Id | null
  /** 끌어서 옮기는 중인 항목. 없으면 null. */
  drag: DragState | null
  onDragStart: (event: ReactPointerEvent<HTMLElement>, target: { id: Id; index: number }) => void
}

export function SectionTree(props: SectionTreeProps) {
  return <SectionList {...props} nested={false} />
}

/**
 * 같은 부모를 둔 형제 목록.
 * 끌어 옮길 자리는 형제 단위로 계산하므로, 끌고 있는 카드가 이 그룹에 속할 때만 자리 표시를 그린다.
 */
function SectionList({ nested, ...props }: SectionTreeProps & { nested: boolean }) {
  const { nodes, reorderMode, drag } = props
  const dragging = drag !== null && nodes.some((node) => node.section.id === drag.id) ? drag : null

  const className = nested ? styles.children : [styles.tree, reorderMode ? styles.reordering : ''].join(' ')

  return (
    <ul className={className}>
      {nodes.map((node, index) => (
        <SectionNodeView
          key={node.section.id}
          node={node}
          index={index}
          isFirst={index === 0}
          isLast={index === nodes.length - 1}
          dropLine={dropLineFor(dragging, index)}
          lifted={dragging !== null && dragging.id === node.section.id ? dragging.offsetY : null}
          {...props}
        />
      ))}
    </ul>
  )
}

/** 놓을 자리를 가리키는 선을 이 카드의 위에 그릴지 아래에 그릴지 */
function dropLineFor(drag: DragState | null, index: number): 'before' | 'after' | null {
  if (drag === null || drag.toIndex === drag.from || index !== drag.toIndex) return null
  return drag.toIndex < drag.from ? 'before' : 'after'
}

interface NodeViewProps extends SectionTreeProps {
  node: SectionNode
  index: number
  isFirst: boolean
  isLast: boolean
  dropLine: 'before' | 'after' | null
  /** 끌고 있는 카드라면 움직인 거리(px), 아니면 null */
  lifted: number | null
}

/** 접었을 때 안에 무엇이 얼마나 들었는지 한 줄로 알린다. 없는 종류는 뺀다. */
function collapsedSummary(counts: ReturnType<typeof countSubtree>): string {
  const parts: string[] = []
  if (counts.descendants > 0) parts.push(`하위 ${counts.descendants}`)
  if (counts.cables > 0) parts.push(`케이블 ${counts.cables}`)
  if (counts.equipments > 0) parts.push(`장비 ${counts.equipments}`)
  return parts.join(' · ')
}

function SectionNodeView({ node, index, isFirst, isLast, dropLine, lifted, ...shared }: NodeViewProps) {
  const { collapsed, reorderMode, onToggle, onMenu, onMove, onCopy, records, highlightId, onDragStart } = shared

  const counts = countSubtree(node)
  const summary = collapsedSummary(counts)
  const hasChildren = node.children.length > 0
  const hasOwnRecords = node.cables.length > 0 || node.equipments.length > 0
  const canCollapse = hasChildren || hasOwnRecords
  const isCollapsed = collapsed.has(node.section.id)
  const expanded = canCollapse ? !isCollapsed : true

  const nodeClass = [
    styles.node,
    dropLine === 'before' ? styles.dropBefore : undefined,
    dropLine === 'after' ? styles.dropAfter : undefined,
  ]
    .filter(Boolean)
    .join(' ')

  const cardClass = [
    styles.card,
    node.section.id === highlightId ? styles.cardHighlight : undefined,
    lifted !== null ? styles.lifted : undefined,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={nodeClass}
      // 끌기는 형제 목록(<ul>) 안에서 계산하므로 <li> 에서 시작해야 한다
      onPointerDown={(event) => onDragStart(event, { id: node.section.id, index })}
    >
      <div className={cardClass} style={lifted === null ? undefined : { transform: `translateY(${lifted}px)` }}>
        <div className={styles.row}>
          <button
            type="button"
            className={[styles.twisty, expanded ? styles.twistyExpanded : undefined].filter(Boolean).join(' ')}
            disabled={!canCollapse}
            aria-expanded={canCollapse ? expanded : undefined}
            aria-label={canCollapse ? (expanded ? '내용 접기' : '내용 펼치기') : '접을 내용 없음'}
            onClick={() => onToggle(node.section.id)}
          >
            {/* 펼쳐지면 CSS 가 90도 돌려 아래를 가리키게 한다 */}
            <ChevronRightIcon />
          </button>

          <button
            type="button"
            className={styles.main}
            onClick={() => (canCollapse ? onToggle(node.section.id) : onMenu(node))}
          >
            <span className={styles.titleLine}>
              <span className={styles.numbering}>{node.numbering}</span>
              <span className={styles.title}>{node.section.title}</span>
            </span>

            {node.section.memo !== '' && <span className={styles.memo}>{node.section.memo}</span>}

            {/* 접었을 때는 안에 무엇이 얼마나 들었는지만 요약해서 보여 준다 */}
            {!expanded && summary !== '' && <span className={styles.summary}>{summary}</span>}
          </button>

          {/* 버튼을 누르는 것은 끌기가 아니다 */}
          <div className={styles.controls} onPointerDown={(event) => event.stopPropagation()}>
            {reorderMode ? (
              <>
                <IconButton
                  label={`${node.section.title} 위로`}
                  icon={<ArrowUpIcon size={18} />}
                  disabled={isFirst}
                  onClick={() => onMove(node.section.id, -1)}
                />
                <IconButton
                  label={`${node.section.title} 아래로`}
                  icon={<ArrowDownIcon size={18} />}
                  disabled={isLast}
                  onClick={() => onMove(node.section.id, 1)}
                />
              </>
            ) : (
              <>
                <IconButton
                  label={`${node.section.title} 복사`}
                  icon={<CopyIcon size={18} />}
                  onClick={() => onCopy(node)}
                />
                <IconButton
                  label={`${node.section.title} 메뉴`}
                  icon={<MoreVerticalIcon size={18} />}
                  onClick={() => onMenu(node)}
                />
              </>
            )}
          </div>
        </div>

        {/* 순서를 바꾸는 동안에는 목록을 감춰 화면을 단순하게 유지한다 */}
        {expanded && !reorderMode && (
          <RecordList
            sectionId={node.section.id}
            cables={node.cables}
            equipments={node.equipments}
            highlightId={highlightId}
            {...records}
          />
        )}
      </div>

      {hasChildren && expanded && <SectionList {...shared} nodes={node.children} nested />}
    </li>
  )
}
