/**
 * 입력칸의 커서 위치를 다루는 계산.
 * 화면 요소와 떼어 놓아야 검증할 수 있어서 순수 함수로 뽑았다.
 */

export interface EditResult {
  value: string
  /** 편집 후 커서를 놓을 위치 */
  caret: number
}

function clamp(position: number, max: number): number {
  if (position < 0) return 0
  if (position > max) return max
  return position
}

/** 커서 자리에 글자를 끼워 넣는다. 선택 영역이 있으면 그 부분을 대체한다. */
export function insertText(value: string, start: number, end: number, text: string): EditResult {
  const from = clamp(Math.min(start, end), value.length)
  const to = clamp(Math.max(start, end), value.length)

  return {
    value: value.slice(0, from) + text + value.slice(to),
    caret: from + text.length,
  }
}

/** 백스페이스. 선택 영역이 있으면 그 부분을, 없으면 커서 앞 한 글자를 지운다. */
export function deleteBackward(value: string, start: number, end: number): EditResult {
  const from = clamp(Math.min(start, end), value.length)
  const to = clamp(Math.max(start, end), value.length)

  if (from !== to) {
    return { value: value.slice(0, from) + value.slice(to), caret: from }
  }
  if (from === 0) {
    return { value, caret: 0 }
  }

  return { value: value.slice(0, from - 1) + value.slice(from), caret: from - 1 }
}
