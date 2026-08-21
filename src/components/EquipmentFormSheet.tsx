import { useEffect, useMemo, useState } from 'react'
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
  onSubmit: (input: EquipmentInput) => void
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

  useEffect(() => {
    if (!open) return
    setKind(initial?.kind ?? defaultKind)
    setName(initial?.name ?? '')
    setQtyText(String(initial?.qty ?? 1))
    setSpec(initial?.spec ?? '')
    setNote(initial?.note ?? '')
    setNameError(undefined)
    setQtyError(undefined)
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

  function handleSubmit(): void {
    const nextNameError = validateName(name)
    const nextQtyError = validateQty(qtyText)

    setNameError(nextNameError)
    setQtyError(nextQtyError)
    if (nextNameError !== undefined || nextQtyError !== undefined) return

    onSubmit({
      kind,
      name: name.trim(),
      qty: Number(qtyText.trim()),
      spec: spec.trim(),
      note: note.trim(),
    })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? '장비 수정' : `장비 추가 · ${sectionLabel}`}
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
      <SegmentedControl label="구분" value={kind} options={KIND_OPTIONS} onChange={setKind} />

      <SuggestTextField
        label="장비명"
        required
        autoFocus
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
