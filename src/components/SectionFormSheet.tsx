import { useEffect, useState } from 'react'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { TextField } from './TextField'

export interface SectionFormValues {
  title: string
  memo: string
}

interface SectionFormSheetProps {
  open: boolean
  /** 시트 제목. 예: "항목 추가", "1.2 하위 항목 추가", "항목 이름 수정" */
  heading: string
  initial?: SectionFormValues | undefined
  submitLabel: string
  onSubmit: (values: SectionFormValues) => void
  onClose: () => void
}

const EMPTY: SectionFormValues = { title: '', memo: '' }
const TITLE_MAX = 120

export function SectionFormSheet({
  open,
  heading,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: SectionFormSheetProps) {
  const [values, setValues] = useState<SectionFormValues>(initial ?? EMPTY)
  const [titleError, setTitleError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    setValues(initial ?? EMPTY)
    setTitleError(undefined)
  }, [open, initial])

  function validateTitle(title: string): string | undefined {
    if (title.trim() === '') return '항목 이름을 입력해 주세요. 예: 1층 전기실'
    if (title.length > TITLE_MAX) return `항목 이름은 ${TITLE_MAX}자까지 넣을 수 있습니다. 현재 ${title.length}자입니다.`
    return undefined
  }

  function handleSubmit(): void {
    const error = validateTitle(values.title)
    setTitleError(error)
    if (error !== undefined) return
    onSubmit({ title: values.title.trim(), memo: values.memo.trim() })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={heading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <TextField
        label="항목 이름"
        required
        autoFocus
        value={values.title}
        placeholder="1층 전기실"
        autoComplete="off"
        enterKeyHint="done"
        error={titleError}
        onChange={(event) => {
          const title = event.target.value
          setValues((prev) => ({ ...prev, title }))
          if (titleError !== undefined && validateTitle(title) === undefined) setTitleError(undefined)
        }}
        onBlur={(event) => setTitleError(validateTitle(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            handleSubmit()
          }
        }}
      />

      <TextField
        label="메모"
        multiline
        value={values.memo}
        placeholder="이 항목에 대한 참고 사항"
        onChange={(event) => setValues((prev) => ({ ...prev, memo: event.target.value }))}
      />
    </Sheet>
  )
}
