import type { ReactNode } from 'react'
import { AlertIcon } from './Icons'
import styles from './States.module.css'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  /** 다음에 무엇을 하면 되는지 안내한다. "데이터가 없습니다"로 끝내지 않는다. */
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      {icon !== undefined && <div className={styles.icon}>{icon}</div>}
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {action !== undefined && <div className={styles.actions}>{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div className={styles.state} role="alert">
      <div className={`${styles.icon} ${styles.iconError}`}>
        <AlertIcon size={26} />
      </div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {action !== undefined && <div className={styles.actions}>{action}</div>}
    </div>
  )
}

/** 스피너 대신 실제 콘텐츠 모양의 회색 틀을 보여 레이아웃이 흔들리지 않게 한다. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.skeletonList} aria-busy="true" aria-live="polite">
      <span className="sr-only">불러오는 중입니다</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.skeletonCard} />
      ))}
    </div>
  )
}
