import { useEffect, useState } from 'react'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { TextField } from './TextField'

export interface ProjectFormValues {
  name: string
  site: string
  memo: string
}

interface ProjectFormSheetProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: ProjectFormValues | undefined
  saving?: boolean | undefined
  onSubmit: (values: ProjectFormValues) => void
  onClose: () => void
}

const EMPTY: ProjectFormValues = { name: '', site: '', memo: '' }
const NAME_MAX = 100

export function ProjectFormSheet({
  open,
  mode,
  initial,
  saving = false,
  onSubmit,
  onClose,
}: ProjectFormSheetProps) {
  const [values, setValues] = useState<ProjectFormValues>(initial ?? EMPTY)
  const [nameError, setNameError] = useState<string | undefined>(undefined)

  // 시트를 다시 열 때마다 대상 공사에 맞춰 초기화한다
  useEffect(() => {
    if (!open) return
    setValues(initial ?? EMPTY)
    setNameError(undefined)
  }, [open, initial])

  function validateName(name: string): string | undefined {
    if (name.trim() === '') return '공사명을 입력해 주세요. 예: 2026년 A공장 증설공사'
    if (name.length > NAME_MAX) return `공사명은 ${NAME_MAX}자까지 넣을 수 있습니다. 현재 ${name.length}자입니다.`
    return undefined
  }

  function handleSubmit(): void {
    const error = validateName(values.name)
    setNameError(error)
    if (error !== undefined) return

    onSubmit({ name: values.name.trim(), site: values.site.trim(), memo: values.memo.trim() })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'create' ? '새 공사' : '공사 정보 수정'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {mode === 'create' ? '만들기' : '저장'}
          </Button>
        </>
      }
    >
      <TextField
        label="공사명"
        required
        value={values.name}
        placeholder="2026년 A공장 증설공사"
        autoComplete="off"
        enterKeyHint="next"
        error={nameError}
        onChange={(event) => {
          const name = event.target.value
          setValues((prev) => ({ ...prev, name }))
          // 입력 도중에는 빨간 오류를 새로 띄우지 않고, 이미 떠 있던 것만 지운다
          if (nameError !== undefined && validateName(name) === undefined) setNameError(undefined)
        }}
        onBlur={(event) => setNameError(validateName(event.target.value))}
      />

      <TextField
        label="현장 / 발주처"
        value={values.site}
        placeholder="A공장 1공장동"
        autoComplete="off"
        onChange={(event) => setValues((prev) => ({ ...prev, site: event.target.value }))}
      />

      <TextField
        label="메모"
        multiline
        value={values.memo}
        placeholder="현장 특이사항, 담당자 연락 방법 등"
        hint="여기 적은 내용은 공유 텍스트 맨 위에 함께 나갑니다."
        onChange={(event) => setValues((prev) => ({ ...prev, memo: event.target.value }))}
      />
    </Sheet>
  )
}
