import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestValues } from '../lib/suggest'
import type { EquipmentInput } from '../lib/records'
import type { EquipmentKind, ProjectBody } from '../types'
import { Button } from './Button'
import { SegmentedControl } from './SegmentedControl'
import { Sheet } from './Sheet'
import { SuggestTextField } from './SuggestTextField'
import { TextField } from './TextField'

interface EquipmentFormSheetProps {
  open: boolean
  sectionLabel: string
  initial?: EquipmentInput | undefined
  /** 새로 추가할 때 미리 선택해 둘 구분 */
  defaultKind?: EquipmentKind | undefined
  body: ProjectBody
  /** keepOpen 이면 시트를 닫지 않는다. 한 항목에 여러 건을 이어서 적을 때 쓴다. */
  onSubmit: (input: EquipmentInput, options: { keepOpen: boolean }) => void
  onClose: () => void
}

const KIND_OPTIONS = [
  { value: 'replace', label: '교체' },
  { value: 'new', label: '신규 설치' },
] as const satisfies readonly { value: EquipmentKind; label: string }[]

const QTY_MAX = 100000

export function EquipmentFormSheet({
  open,
  sectionLabel,
  initial,
  defaultKind = 'replace',
  body,
  onSubmit,
  onClose,
}: EquipmentFormSheetProps) {
  const [kind, setKind] = useState<EquipmentKind>(initial?.kind ?? defaultKind)
  const [name, setName] = useState(initial?.name ?? '')
  // 입력 도중의 빈 칸을 허용해야 하므로 수량은 문자열로 들고 있다가 저장할 때 숫자로 바꾼다
  const [qtyText, setQtyText] = useState(String(initial?.qty ?? 1))
  const [spec, setSpec] = useState(initial?.spec ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  const [nameError, setNameError] = useState<string | undefined>(undefined)
  const [qtyError, setQtyError] = useState<string | undefined>(undefined)
  // 시트를 연 뒤 [계속] 으로 이어 적은 건수. 방금 적은 줄이 시트에 가려 보이지 않으므로 여기에 알린다.
  const [addedCount, setAddedCount] = useState(0)

  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setKind(initial?.kind ?? defaultKind)
    setName(initial?.name ?? '')
    setQtyText(String(initial?.qty ?? 1))
    setSpec(initial?.spec ?? '')
    setNote(initial?.note ?? '')
    setNameError(undefined)
    setQtyError(undefined)
    setAddedCount(0)
  }, [open, initial, defaultKind])

  const nameSuggestions = useMemo(
    () => (open ? suggestValues({ field: 'equipmentName', body, query: name }) : []),
    [open, body, name],
  )
  const specSuggestions = useMemo(
    () => (open ? suggestValues({ field: 'equipmentSpec', body, query: spec }) : []),
    [open, body, spec],
  )

  function validateName(value: string): string | undefined {
    return value.trim() === '' ? '장비명을 입력해 주세요. 예: MCCB 100A' : undefined
  }

  function validateQty(value: string): string | undefined {
    const trimmed = value.trim()
    if (trimmed === '') return '수량을 입력해 주세요. 개수가 정해지지 않았다면 1로 두세요.'

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) return `'${trimmed}' 는 숫자가 아닙니다. 숫자만 입력해 주세요.`
    if (!Number.isInteger(parsed)) return '수량은 낱개 단위이므로 정수로 입력해 주세요. 예: 2'
    if (parsed < 1) return '수량은 1 이상이어야 합니다.'
    if (parsed > QTY_MAX) return `수량이 너무 큽니다. ${QTY_MAX.toLocaleString('ko-KR')} 이하로 입력해 주세요.`
    return undefined
  }

  function handleSubmit(keepOpen: boolean): void {
    const nextNameError = validateName(name)
    const nextQtyError = validateQty(qtyText)

    setNameError(nextNameError)
    setQtyError(nextQtyError)
    if (nextNameError !== undefined || nextQtyError !== undefined) return

    onSubmit(
      {
        kind,
        name: name.trim(),
        qty: Number(qtyText.trim()),
        spec: spec.trim(),
        note: note.trim(),
      },
      { keepOpen },
    )

    if (!keepOpen) return

    // 다음 건을 곧바로 적을 수 있게 칸을 비우고 첫 칸으로 돌아간다.
    // 구분(교체/신규)만은 시트를 열 때 고른 값으로 되돌린다 — 같은 구분을 이어서 적는 경우가 많다.
    setKind(defaultKind)
    setName('')
    setQtyText('1')
    setSpec('')
    setNote('')
    setAddedCount((count) => count + 1)
    nameInputRef.current?.focus()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? '장비 수정' : `장비 추가 · ${sectionLabel}`}
      notice={addedCount > 0 ? `이번에 ${addedCount}건 추가했습니다.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          {initial ? (
            <Button variant="primary" onClick={() => handleSubmit(false)}>
              저장
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => handleSubmit(false)}>
                추가
              </Button>
              <Button variant="primary" onClick={() => handleSubmit(true)}>
                계속
              </Button>
            </>
          )}
        </>
      }
    >
      <SegmentedControl label="구분" value={kind} options={KIND_OPTIONS} onChange={setKind} />

      <SuggestTextField
        label="장비명"
        required
        autoFocus
        inputRef={nameInputRef}
        value={name}
        suggestions={nameSuggestions}
        placeholder="MCCB 100A"
        error={nameError}
        onValueChange={(next) => {
          setName(next)
          if (nameError !== undefined && validateName(next) === undefined) setNameError(undefined)
        }}
        onBlurValue={(value) => setNameError(validateName(value))}
      />

      <TextField
        label="수량"
        required
        value={qtyText}
        inputMode="numeric"
        placeholder="1"
        autoComplete="off"
        error={qtyError}
        onChange={(event) => {
          setQtyText(event.target.value)
          if (qtyError !== undefined) setQtyError(undefined)
        }}
        onBlur={(event) => setQtyError(validateQty(event.target.value))}
      />

      <SuggestTextField
        label="규격 / 모델"
        value={spec}
        suggestions={specSuggestions}
        placeholder="LS산전 ABS103c"
        onValueChange={setSpec}
      />

      <TextField
        label="비고"
        multiline
        value={note}
        placeholder="노후화, 사양 변경 사유 등"
        onChange={(event) => setNote(event.target.value)}
      />
    </Sheet>
  )
}
