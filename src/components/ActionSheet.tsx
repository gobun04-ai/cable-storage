import type { ReactNode } from 'react'
import { Sheet } from './Sheet'
import styles from './ActionSheet.module.css'

export interface SheetAction {
  key: string
  label: string
  description?: string
  icon?: ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean
  onClick: () => void
}

interface ActionSheetProps {
  open: boolean
  title: string
  actions: SheetAction[]
  onClose: () => void
}

/** 목록 항목의 ⋮ 메뉴처럼, 선택지를 큰 터치 영역으로 늘어놓는 시트 */
export function ActionSheet({ open, title, actions, onClose }: ActionSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className={styles.list}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={[styles.item, action.tone === 'danger' ? styles.danger : undefined]
              .filter(Boolean)
              .join(' ')}
            disabled={action.disabled === true}
            onClick={() => {
              onClose()
              action.onClick()
            }}
          >
            {action.icon !== undefined && <span className={styles.icon}>{action.icon}</span>}
            <span className={styles.label}>
              {action.label}
              {action.description !== undefined && <span className={styles.description}>{action.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
