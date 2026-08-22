import { evaluateQuantity } from '../lib/expr'
import { formatNumber } from '../lib/format'
import type { CableRecord, EquipmentRecord, Id } from '../types'
import { Button } from './Button'
import { AlertIcon, CableIcon, EquipmentIcon, MoreVerticalIcon, PlusIcon } from './Icons'
import { IconButton } from './IconButton'
import styles from './RecordList.module.css'

export interface RecordHandlers {
  onAddCable: (sectionId: Id) => void
  onAddEquipment: (sectionId: Id) => void
  onEditCable: (cable: CableRecord) => void
  onCableMenu: (cable: CableRecord) => void
  onEditEquipment: (equipment: EquipmentRecord) => void
  onEquipmentMenu: (equipment: EquipmentRecord) => void
}

interface RecordListProps extends RecordHandlers {
  sectionId: Id
  cables: readonly CableRecord[]
  equipments: readonly EquipmentRecord[]
  /** 방금 추가·복제되어 잠시 강조할 기록. 없으면 null. */
  highlightId: Id | null
}

/** 항목 카드 안에 붙는 케이블·장비 목록과 추가 버튼 */
export function RecordList({ sectionId, cables, equipments, highlightId, ...handlers }: RecordListProps) {
  const replacements = equipments.filter((item) => item.kind === 'replace')
  const additions = equipments.filter((item) => item.kind === 'new')

  return (
    <div className={styles.container}>
      {cables.length > 0 && (
        <div className={styles.group}>
          <span className={styles.groupLabel}>
            <CableIcon size={14} />
            케이블 {cables.length}
          </span>
          {cables.map((cable) => (
            <CableRow
              key={cable.id}
              cable={cable}
              highlighted={cable.id === highlightId}
              onEdit={handlers.onEditCable}
              onMenu={handlers.onCableMenu}
            />
          ))}
        </div>
      )}

      {replacements.length > 0 && (
        <EquipmentGroup
          label={`교체 장비 ${replacements.length}`}
          items={replacements}
          highlightId={highlightId}
          onEdit={handlers.onEditEquipment}
          onMenu={handlers.onEquipmentMenu}
        />
      )}

      {additions.length > 0 && (
        <EquipmentGroup
          label={`신규 장비 ${additions.length}`}
          items={additions}
          highlightId={highlightId}
          onEdit={handlers.onEditEquipment}
          onMenu={handlers.onEquipmentMenu}
        />
      )}

      <div className={styles.addRow}>
        <Button size="sm" icon={<PlusIcon size={16} />} onClick={() => handlers.onAddCable(sectionId)}>
          케이블
        </Button>
        <Button size="sm" icon={<PlusIcon size={16} />} onClick={() => handlers.onAddEquipment(sectionId)}>
          장비
        </Button>
      </div>
    </div>
  )
}

function CableRow({
  cable,
  highlighted,
  onEdit,
  onMenu,
}: {
  cable: CableRecord
  highlighted: boolean
  onEdit: (cable: CableRecord) => void
  onMenu: (cable: CableRecord) => void
}) {
  const hasRoute = cable.from !== '' || cable.to !== ''

  return (
    <div className={[styles.row, highlighted ? styles.rowHighlight : undefined].filter(Boolean).join(' ')}>
      <button type="button" className={styles.rowBody} onClick={() => onEdit(cable)}>
        <span className={styles.headline}>{cable.cableType}</span>

        {hasRoute && (
          <span className={styles.route}>
            <RouteChip value={cable.from} />
            {/* 화면에서는 화살표가, 읽어 주는 기기에서는 조사가 방향을 알린다 */}
            <span className="sr-only">에서</span>
            <span className={styles.routeArrow} aria-hidden="true">
              →
            </span>
            <RouteChip value={cable.to} />
            <span className="sr-only">까지</span>
          </span>
        )}

        <QuantityText expression={cable.quantityExpr} />

        {cable.note !== '' && <span className={styles.note}>{cable.note}</span>}
      </button>

      <div className={styles.rowMenu}>
        <IconButton
          label={`${cable.cableType} 메뉴`}
          icon={<MoreVerticalIcon size={18} />}
          onClick={() => onMenu(cable)}
        />
      </div>
    </div>
  )
}

/** 시작점·종단 한 칸. 아직 적지 않았으면 빈 알약 대신 흐린 줄표로 자리만 남긴다. */
function RouteChip({ value }: { value: string }) {
  const empty = value === ''

  return (
    <span className={[styles.routeChip, empty ? styles.routeChipEmpty : undefined].filter(Boolean).join(' ')}>
      {empty ? '—' : value}
    </span>
  )
}

/** 수식과 합계를 함께 보여 준다. 계산이 안 되는 식은 붉게 표시해 나중에 고칠 수 있게 남긴다. */
function QuantityText({ expression }: { expression: string }) {
  if (expression.trim() === '') return null

  const result = evaluateQuantity(expression)

  if (!result.ok) {
    return (
      <span className={`${styles.quantity} ${styles.quantityInvalid}`}>
        <AlertIcon size={14} />
        {expression} — 계산할 수 없는 식
      </span>
    )
  }

  const total = `${formatNumber(result.value)} m`
  // "10" 처럼 숫자 하나면 수식을 따로 보여 줄 필요가 없다
  const showExpression = result.terms > 1 || expression.trim() !== String(result.value)

  return (
    <span className={styles.quantity}>
      <span className={styles.quantityTotal}>{total}</span>
      {showExpression && <span className={styles.quantityExpr}>({expression})</span>}
    </span>
  )
}

function EquipmentGroup({
  label,
  items,
  highlightId,
  onEdit,
  onMenu,
}: {
  label: string
  items: readonly EquipmentRecord[]
  highlightId: Id | null
  onEdit: (equipment: EquipmentRecord) => void
  onMenu: (equipment: EquipmentRecord) => void
}) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>
        <EquipmentIcon size={14} />
        {label}
      </span>
      {items.map((item) => (
        <div
          key={item.id}
          className={[styles.row, item.id === highlightId ? styles.rowHighlight : undefined]
            .filter(Boolean)
            .join(' ')}
        >
          <button type="button" className={styles.rowBody} onClick={() => onEdit(item)}>
            <span className={styles.headline}>
              <span
                className={`${styles.badge} ${item.kind === 'replace' ? styles.badgeReplace : styles.badgeNew}`}
              >
                {item.kind === 'replace' ? '교체' : '신규'}
              </span>
              <span>{item.name}</span>
              <span className={styles.qty}>{item.qty}개</span>
            </span>

            {item.spec !== '' && <span className={styles.spec}>{item.spec}</span>}
            {item.note !== '' && <span className={styles.note}>{item.note}</span>}
          </button>

          <div className={styles.rowMenu}>
            <IconButton
              label={`${item.name} 메뉴`}
              icon={<MoreVerticalIcon size={18} />}
              onClick={() => onMenu(item)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
