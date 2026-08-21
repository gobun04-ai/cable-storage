import type { ReactNode } from 'react'
import { ArrowLeftIcon } from './Icons'
import { IconButton } from './IconButton'
import styles from './AppBar.module.css'

interface AppBarProps {
  title: string
  subtitle?: string | undefined
  /** 지정하면 왼쪽에 뒤로가기 버튼이 나온다. 현재 위치에서 빠져나갈 길을 항상 남긴다. */
  onBack?: (() => void) | undefined
  actions?: ReactNode | undefined
}

export function AppBar({ title, subtitle, onBack, actions }: AppBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        {onBack !== undefined && <IconButton label="뒤로" icon={<ArrowLeftIcon />} onClick={onBack} />}
        <div className={styles.titles}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle !== undefined && subtitle !== '' && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions !== undefined && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  )
}
