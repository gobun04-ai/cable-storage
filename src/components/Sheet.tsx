import { useEffect, useRef, type ReactNode } from 'react'
import { useBackDismiss } from '../state/useBackDismiss'
import { CloseIcon } from './Icons'
import { IconButton } from './IconButton'
import styles from './Sheet.module.css'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** 본문 맨 위에 붙는 진행 상황 줄. 연속 추가 건수처럼 시트를 닫지 않고 알릴 내용에 쓴다. */
  notice?: ReactNode
  /** 확인/취소 버튼 영역 */
  footer?: ReactNode
}

/**
 * 바텀시트 형태의 모달.
 * 네이티브 <dialog> 를 쓰므로 포커스 가두기, Esc 닫기, 닫은 뒤 포커스 복귀를 브라우저가 처리한다.
 */
export function Sheet({ open, onClose, title, children, notice, footer }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // 안드로이드 뒤로가기 버튼은 화면을 벗어나지 않고 이 시트만 닫아야 한다
  useBackDismiss(open, onClose)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  // 모달이 열린 동안 뒤 배경이 스크롤되지 않게 한다
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={title}
      // Esc 키와 브라우저의 닫기 요청을 부모에게 알린다
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // 패널 바깥(어두운 배경)을 누르면 닫는다
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className={styles.panel}>
        <div className={styles.grip} aria-hidden="true" />
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <IconButton label="닫기" icon={<CloseIcon />} onClick={onClose} />
        </div>
        <div className={styles.body}>
          {notice !== undefined && (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          )}
          {children}
        </div>
        {footer !== undefined && <div className={styles.footer}>{footer}</div>}
      </div>
    </dialog>
  )
}
