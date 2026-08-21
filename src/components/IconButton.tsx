import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /** 화면에 글자가 없으므로 라벨은 필수다. 보조기술과 툴팁이 함께 쓴다. */
  label: string
  icon: ReactNode
  /** 목록 안에 촘촘히 놓을 때 40px 로 줄인다. 그래도 주변 여백까지 합해 손가락이 닿는다. */
  compact?: boolean
}

export function IconButton({ label, icon, compact = false, type = 'button', ...rest }: IconButtonProps) {
  const classes = [styles.iconButton, compact ? styles.compact : undefined].filter(Boolean).join(' ')

  return (
    <button {...rest} type={type} className={classes} aria-label={label} title={label}>
      {icon}
    </button>
  )
}
