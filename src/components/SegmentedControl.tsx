import { useId } from 'react'
import styles from './SegmentedControl.module.css'

interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
}

/** 두세 개 중 하나를 고르는 좁은 선택지. 라디오 버튼보다 손가락으로 누르기 쉽다. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  const labelId = useId()

  return (
    <div className={styles.group}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>
      <div className={styles.segments} role="radiogroup" aria-labelledby={labelId}>
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${styles.segment} ${selected ? styles.selected : ''}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
