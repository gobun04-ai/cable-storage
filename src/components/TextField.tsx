import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react'
import styles from './TextField.module.css'

interface CommonProps {
  label: string
  /** 입력칸 아래에 늘 보이는 도움말 */
  hint?: ReactNode | undefined
  /**
   * 오류 메시지. 무엇이 잘못됐는지와 어떻게 고치는지를 함께 적는다.
   * 입력 도중이 아니라 필드를 벗어났을 때(blur) 채우는 것을 원칙으로 한다.
   */
  error?: string | undefined
  required?: boolean | undefined
}

type InputProps = CommonProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> & {
    multiline?: false
    /** 전용 키패드처럼 바깥에서 커서를 다뤄야 할 때 쓴다 */
    inputRef?: Ref<HTMLInputElement> | undefined
  }

type TextareaProps = CommonProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> & { multiline: true }

export function TextField(props: InputProps | TextareaProps) {
  const generatedId = useId()
  const { label, hint, error, required = false } = props

  const inputId = `${generatedId}-input`
  const hintId = `${generatedId}-hint`
  const errorId = `${generatedId}-error`

  const describedBy = [hint !== undefined ? hintId : null, error !== undefined ? errorId : null]
    .filter(Boolean)
    .join(' ')

  const shared = {
    id: inputId,
    'aria-invalid': error !== undefined || undefined,
    'aria-describedby': describedBy === '' ? undefined : describedBy,
    'aria-required': required || undefined,
  } as const

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>

      {props.multiline === true ? (
        <textarea
          {...stripCommon(props)}
          {...shared}
          className={[styles.control, styles.textarea, error !== undefined ? styles.invalid : undefined]
            .filter(Boolean)
            .join(' ')}
        />
      ) : (
        <input
          {...stripCommon(props)}
          {...shared}
          ref={props.inputRef}
          className={[styles.control, error !== undefined ? styles.invalid : undefined]
            .filter(Boolean)
            .join(' ')}
        />
      )}

      {hint !== undefined && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}

      {error !== undefined && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** label·hint·error·multiline·inputRef 는 DOM 속성이 아니므로 걸러낸다. */
function stripCommon<T extends InputProps | TextareaProps>(props: T) {
  const {
    label: _label,
    hint: _hint,
    error: _error,
    multiline: _multiline,
    required: _required,
    ...rest
  } = props

  if ('inputRef' in rest) {
    const { inputRef: _inputRef, ...withoutRef } = rest
    return withoutRef
  }
  return rest
}
