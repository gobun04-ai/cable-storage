import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  /** 처리 중 표시. 이 동안 버튼은 눌리지 않으므로 중복 요청이 생기지 않는다. */
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

const SIZE_CLASS: Record<Size, string | undefined> = {
  sm: styles.sizeSm,
  md: undefined,
  lg: styles.sizeLg,
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], SIZE_CLASS[size], fullWidth ? styles.fullWidth : undefined]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}
