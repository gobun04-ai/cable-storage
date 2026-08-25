import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, CopyIcon, MoreVerticalIcon } from './Icons'
import { IconButton } from './IconButton'
import { RecordList, type RecordHandlers } from './RecordList'
import { countSubtree } from '../lib/tree'
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
}

export function SectionTree(props: SectionTreeProps) {
  const { nodes, reorderMode } = props

  return (
    <ul className={`${styles.tree} ${reorderMode ? styles.reordering : ''}`}>
      {nodes.map((node, index) => (
        <SectionNodeView
          key={node.section.id}
          node={node}
          isFirst={index === 0}
          isLast={index === nodes.length - 1}
          {...props}
        />
      ))}
    </ul>
  )
}

interface NodeViewProps extends SectionTreeProps {
  node: SectionNode
  isFirst: boolean
  isLast: boolean
}

/** 접었을 때 안에 무엇이 얼마나 들었는지 한 줄로 알린다. 없는 종류는 뺀다. */
function collapsedSummary(counts: ReturnType<typeof countSubtree>): string {
  const parts: string[] = []
  if (counts.descendants > 0) parts.push(`하위 ${counts.descendants}`)
  if (counts.cables > 0) parts.push(`케이블 ${counts.cables}`)
  if (counts.equipments > 0) parts.push(`장비 ${counts.equipments}`)
  return parts.join(' · ')
}

function SectionNodeView({ node, isFirst, isLast, ...shared }: NodeViewProps) {
  const { collapsed, reorderMode, onToggle, onMenu, onMove, onCopy, records, highlightId } = shared

  const counts = countSubtree(node)
  const summary = collapsedSummary(counts)
  const hasChildren = node.children.length > 0
  const hasOwnRecords = node.cables.length > 0 || node.equipments.length > 0
  const canCollapse = hasChildren || hasOwnRecords
  const isCollapsed = collapsed.has(node.section.id)
  const expanded = canCollapse ? !isCollapsed : true

  return (
    <li className={styles.node}>
      <div
        className={[styles.card, node.section.id === highlightId ? styles.cardHighlight : undefined]
          .filter(Boolean)
          .join(' ')}
      >
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

          <div className={styles.controls}>
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

      {hasChildren && expanded && (
        <ul className={styles.children}>
          {node.children.map((child, index) => (
            <SectionNodeView
              key={child.section.id}
              node={child}
              isFirst={index === 0}
              isLast={index === node.children.length - 1}
              {...shared}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
