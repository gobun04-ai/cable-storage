import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluateQuantity } from '../lib/expr'
import { formatNumber } from '../lib/format'
import { suggestValues } from '../lib/suggest'
import type { CableInput } from '../lib/records'
import type { ProjectBody } from '../types'
import { Button } from './Button'
import { ChevronRightIcon } from './Icons'
import { QuantityKeypad } from './QuantityKeypad'
import { Sheet } from './Sheet'
import { SuggestTextField } from './SuggestTextField'
import { TextField } from './TextField'
import styles from './CableFormSheet.module.css'

interface CableFormSheetProps {
  open: boolean
  /** 시트 제목에 쓸 항목 이름. 예: "1.1 MCC반" */
  sectionLabel: string
  initial?: CableInput | undefined
  /** 자동완성 후보를 뽑을 대상 */
  body: ProjectBody
  onSubmit: (input: CableInput) => void
  onClose: () => void
}

const EMPTY: CableInput = { cableType: '', from: '', to: '', quantityExpr: '', note: '' }

export function CableFormSheet({
  open,
  sectionLabel,
  initial,
  body,
  onSubmit,
  onClose,
}: CableFormSheetProps) {
  const [values, setValues] = useState<CableInput>(initial ?? EMPTY)
  const [typeError, setTypeError] = useState<string | undefined>(undefined)
  const [quantityError, setQuantityError] = useState<string | undefined>(undefined)
  const [keypadOpen, setKeypadOpen] = useState(false)

  const quantityInputRef = useRef<HTMLInputElement>(null)
  const keypadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setValues(initial ?? EMPTY)
    setTypeError(undefined)
    setQuantityError(undefined)
    setKeypadOpen(false)
  }, [open, initial])

  // 키패드가 펼쳐지면 시트 안에서 가려지지 않도록 보이는 위치까지 끌어온다
  useEffect(() => {
    if (!keypadOpen) return
    const timer = setTimeout(() => {
      keypadRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 60)
    return () => clearTimeout(timer)
  }, [keypadOpen])

  const quantity = useMemo(() => evaluateQuantity(values.quantityExpr), [values.quantityExpr])

  const typeSuggestions = useMemo(
    () => (open ? suggestValues({ field: 'cableType', body, query: values.cableType }) : []),
    [open, body, values.cableType],
  )
  const fromSuggestions = useMemo(
    () => (open ? suggestValues({ field: 'from', body, query: values.from }) : []),
    [open, body, values.from],
  )
  const toSuggestions = useMemo(
    () => (open ? suggestValues({ field: 'to', body, query: values.to }) : []),
    [open, body, values.to],
  )

  function validateType(value: string): string | undefined {
    return value.trim() === '' ? '케이블 종류를 입력해 주세요. 예: CV 4C 25sq' : undefined
  }

  function handleSubmit(): void {
    const nextTypeError = validateType(values.cableType)
    const nextQuantityError = quantity.ok ? undefined : quantity.message

    setTypeError(nextTypeError)
    setQuantityError(nextQuantityError)
    if (nextTypeError !== undefined || nextQuantityError !== undefined) return

    onSubmit({
      cableType: values.cableType.trim(),
      from: values.from.trim(),
      to: values.to.trim(),
      quantityExpr: values.quantityExpr.trim(),
      note: values.note.trim(),
    })
  }

  // 입력 도중에는 오류를 새로 띄우지 않고, 계산이 되는 동안만 합계를 보여 준다
  const quantityHint =
    quantity.ok && quantity.terms > 0 ? (
      <span className={styles.total}>
        <span>
          = {formatNumber(quantity.value)}
          <span className={styles.totalUnit}> m</span>
        </span>
        {quantity.terms > 1 && <span className={styles.totalTerms}>구간 {quantity.terms}개</span>}
      </span>
    ) : (
      '적은 그대로 저장됩니다. 예: 2+3+5+10 (곱하기는 12*3)'
    )

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? '케이블 수정' : `케이블 추가 · ${sectionLabel}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {initial ? '저장' : '추가'}
          </Button>
        </>
      }
    >
      <SuggestTextField
        label="케이블 종류"
        required
        autoFocus
        value={values.cableType}
        suggestions={typeSuggestions}
        placeholder="CV 4C 25sq"
        error={typeError}
        onValueChange={(cableType) => {
          setValues((prev) => ({ ...prev, cableType }))
          if (typeError !== undefined && validateType(cableType) === undefined) setTypeError(undefined)
        }}
        onBlurValue={(value) => setTypeError(validateType(value))}
      />

      <div className={styles.pair}>
        <SuggestTextField
          label="시작점 (From)"
          value={values.from}
          suggestions={fromSuggestions}
          placeholder="MCC반"
          onValueChange={(from) => setValues((prev) => ({ ...prev, from }))}
        />
        <span className={styles.arrow} aria-hidden="true">
          <ChevronRightIcon size={18} />
        </span>
        <SuggestTextField
          label="종단 (To)"
          value={values.to}
          suggestions={toSuggestions}
          placeholder="P-101"
          onValueChange={(to) => setValues((prev) => ({ ...prev, to }))}
        />
      </div>

      <TextField
        label="물량"
        value={values.quantityExpr}
        placeholder="2+3+5+10+5+3+2"
        autoComplete="off"
        // 시스템 키보드 대신 아래의 전용 키패드를 쓴다. PC 물리 키보드 입력은 그대로 된다.
        inputMode="none"
        inputRef={quantityInputRef}
        // 키패드가 합계를 보여 주는 동안에는 같은 내용을 두 번 띄우지 않는다
        hint={keypadOpen ? undefined : quantityHint}
        error={quantityError}
        onChange={(event) => {
          setValues((prev) => ({ ...prev, quantityExpr: event.target.value }))
          if (quantityError !== undefined) setQuantityError(undefined)
        }}
        onFocus={() => setKeypadOpen(true)}
        onBlur={(event) => {
          setKeypadOpen(false)
          const result = evaluateQuantity(event.target.value)
          setQuantityError(result.ok ? undefined : result.message)
        }}
      />

      {keypadOpen && (
        <div ref={keypadRef}>
          <QuantityKeypad
            inputRef={quantityInputRef}
            value={values.quantityExpr}
            onChange={(next) => {
              setValues((prev) => ({ ...prev, quantityExpr: next }))
              if (quantityError !== undefined) setQuantityError(undefined)
            }}
            onDone={() => quantityInputRef.current?.blur()}
          />
        </div>
      )}

      <TextField
        label="비고"
        multiline
        value={values.note}
        placeholder="포설 경로, 여장 등"
        onChange={(event) => setValues((prev) => ({ ...prev, note: event.target.value }))}
      />
    </Sheet>
  )
}
