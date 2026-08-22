import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /** 화면에 글자가 없으므로 라벨은 필수다. 보조기술과 툴팁이 함께 쓴다. */
  label: string
  icon: ReactNode
}

export function IconButton({ label, icon, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button {...rest} type={type} className={styles.iconButton} aria-label={label} title={label}>
      {icon}
    </button>
  )
}
