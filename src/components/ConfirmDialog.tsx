import { Button } from './Button'
import { Sheet } from './Sheet'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** 무슨 일이 일어나는지 구체적으로 적는다. 되돌릴 수 있는지도 함께 알린다. */
  description: string
  confirmLabel: string
  cancelLabel?: string
  /** 되돌릴 수 없는 동작이면 'danger' 로 확인 버튼을 붉게 한다 */
  tone?: 'default' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 되돌리기 어려운 동작에만 쓴다.
 * 취소할 수 있는 삭제는 이 대화상자 대신 알림의 "실행 취소"를 쓴다.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className={styles.description}>{description}</p>
    </Sheet>
  )
}
