import { useState, type FocusEvent, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { TextField } from './TextField'
import styles from './SuggestTextField.module.css'

type PassThrough = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'id' | 'value' | 'onChange' | 'onFocus' | 'onBlur'
>

interface SuggestTextFieldProps extends PassThrough {
  label: string
  value: string
  onValueChange: (value: string) => void
  /** 이전에 쓴 값들. 비어 있으면 제안 줄 자체가 나오지 않는다. */
  suggestions: string[]
  hint?: ReactNode | undefined
  error?: string | undefined
  required?: boolean | undefined
  onBlurValue?: ((value: string) => void) | undefined
  /** 바깥에서 포커스를 옮겨야 할 때 쓴다. 예: 연속 추가 뒤 첫 칸으로 되돌리기 */
  inputRef?: Ref<HTMLInputElement> | undefined
}

/** 입력칸 아래에 "이전에 쓴 값"을 칩으로 보여 주고, 누르면 그대로 채워 넣는다. */
export function SuggestTextField({
  label,
  value,
  onValueChange,
  suggestions,
  hint,
  error,
  required,
  onBlurValue,
  inputRef,
  ...rest
}: SuggestTextFieldProps) {
  const [focused, setFocused] = useState(false)

  const visible = focused && suggestions.length > 0

  function handleBlur(event: FocusEvent<HTMLInputElement>): void {
    setFocused(false)
    onBlurValue?.(event.target.value)
  }

  return (
    <div className={styles.wrapper}>
      <TextField
        {...rest}
        label={label}
        inputRef={inputRef}
        value={value}
        hint={hint}
        error={error}
        required={required}
        autoComplete="off"
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
      />

      {visible && (
        <div className={styles.chips}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={styles.chip}
              // 칩을 누르는 순간 입력칸의 포커스가 빠지면서 목록이 사라지므로 기본 동작을 막는다
              onPointerDown={(event) => {
                event.preventDefault()
                onValueChange(suggestion)
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
