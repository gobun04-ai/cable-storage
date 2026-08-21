import { useEffect, useRef, type RefObject } from 'react'
import { evaluateQuantity } from '../lib/expr'
import { formatNumber } from '../lib/format'
import { deleteBackward, insertText, type EditResult } from '../lib/textEdit'
import styles from './QuantityKeypad.module.css'

interface QuantityKeypadProps {
  /** 값을 넣을 입력칸. 커서 위치를 읽고 되돌리는 데 쓴다. */
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  onChange: (next: string) => void
  onDone: () => void
}

type KeyKind = 'insert' | 'backspace' | 'clear' | 'done'

interface KeyDef {
  /** 화면에 보이는 글자 */
  label: string
  /** 보조기술이 읽어 줄 이름 */
  aria: string
  kind: KeyKind
  /** insert 일 때 실제로 넣을 문자. 화면 글자와 다를 수 있다(× → *) */
  text?: string
  tone?: 'operator' | 'danger' | 'done'
}

const KEYS: KeyDef[] = [
  { label: '7', aria: '7', kind: 'insert', text: '7' },
  { label: '8', aria: '8', kind: 'insert', text: '8' },
  { label: '9', aria: '9', kind: 'insert', text: '9' },
  { label: '⌫', aria: '한 글자 지우기', kind: 'backspace', tone: 'danger' },

  { label: '4', aria: '4', kind: 'insert', text: '4' },
  { label: '5', aria: '5', kind: 'insert', text: '5' },
  { label: '6', aria: '6', kind: 'insert', text: '6' },
  { label: '+', aria: '더하기', kind: 'insert', text: '+', tone: 'operator' },

  { label: '1', aria: '1', kind: 'insert', text: '1' },
  { label: '2', aria: '2', kind: 'insert', text: '2' },
  { label: '3', aria: '3', kind: 'insert', text: '3' },
  { label: '−', aria: '빼기', kind: 'insert', text: '-', tone: 'operator' },

  { label: '0', aria: '0', kind: 'insert', text: '0' },
  { label: '.', aria: '소수점', kind: 'insert', text: '.' },
  { label: '×', aria: '곱하기', kind: 'insert', text: '*', tone: 'operator' },
  { label: '÷', aria: '나누기', kind: 'insert', text: '/', tone: 'operator' },

  { label: '(', aria: '여는 괄호', kind: 'insert', text: '(', tone: 'operator' },
  { label: ')', aria: '닫는 괄호', kind: 'insert', text: ')', tone: 'operator' },
  { label: '지움', aria: '전체 지우기', kind: 'clear', tone: 'danger' },
  { label: '완료', aria: '물량 입력 마치기', kind: 'done', tone: 'done' },
]

const TONE_CLASS: Record<NonNullable<KeyDef['tone']>, string | undefined> = {
  operator: styles.operator,
  danger: styles.danger,
  done: styles.done,
}

/**
 * 물량 전용 키패드.
 *
 * 시스템 키보드로는 숫자와 사칙연산·괄호만 있는 자판을 만들 수 없어 직접 그린다.
 * 입력칸은 inputMode="none" 으로 두어 이 키패드만 뜨게 한다(PC 물리 키보드 입력은 그대로 된다).
 */
export function QuantityKeypad({ inputRef, value, onChange, onDone }: QuantityKeypadProps) {
  // 값이 바뀐 뒤 커서를 어디에 둘지. 리렌더 후에 적용해야 해서 잠시 들고 있는다.
  const pendingCaret = useRef<number | null>(null)

  useEffect(() => {
    const caret = pendingCaret.current
    if (caret === null) return
    pendingCaret.current = null

    const input = inputRef.current
    if (!input) return
    input.setSelectionRange(caret, caret)
  })

  /** 커서가 없으면(포커스를 잃었으면) 맨 뒤에 이어 붙인다. */
  function selectionRange(): [number, number] {
    const input = inputRef.current
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? start
    return [start, end]
  }

  function applyEdit(result: EditResult): void {
    pendingCaret.current = result.caret
    if (result.value !== value) onChange(result.value)
  }

  function handleKey(key: KeyDef): void {
    const [start, end] = selectionRange()

    if (key.kind === 'insert' && key.text !== undefined) applyEdit(insertText(value, start, end, key.text))
    else if (key.kind === 'backspace') applyEdit(deleteBackward(value, start, end))
    else if (key.kind === 'clear') applyEdit({ value: '', caret: 0 })
    else if (key.kind === 'done') onDone()
  }

  const result = evaluateQuantity(value)

  return (
    <div className={styles.keypad} role="group" aria-label="물량 입력 키패드">
      <div className={styles.readout} aria-live="polite">
        {result.ok ? (
          <>
            <span className={styles.readoutValue}>
              {formatNumber(result.value)}
              <span className={styles.readoutUnit}> m</span>
            </span>
            {result.terms > 1 && <span className={styles.readoutTerms}>구간 {result.terms}개</span>}
          </>
        ) : (
          <>
            <span className={styles.readoutValue} aria-hidden="true">
              —
            </span>
            <span className={styles.readoutError}>{result.message}</span>
          </>
        )}
      </div>

      <div className={styles.grid}>
        {KEYS.map((key) => (
          <button
            key={key.aria}
            type="button"
            className={[styles.key, key.tone ? TONE_CLASS[key.tone] : undefined].filter(Boolean).join(' ')}
            aria-label={key.aria}
            // 키를 누를 때 입력칸의 포커스와 커서가 사라지지 않게 기본 동작을 막는다
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => handleKey(key)}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  )
}
