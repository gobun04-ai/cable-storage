import { describe, expect, it } from 'vitest'
import { deleteBackward, insertText } from './textEdit'

describe('insertText', () => {
  it('맨 뒤에 이어 붙인다', () => {
    expect(insertText('2+3', 3, 3, '+5')).toEqual({ value: '2+3+5', caret: 5 })
  })

  it('커서가 있는 중간에 끼워 넣는다', () => {
    expect(insertText('2+3', 2, 2, '10+')).toEqual({ value: '2+10+3', caret: 5 })
  })

  it('맨 앞에 넣는다', () => {
    expect(insertText('3', 0, 0, '2+')).toEqual({ value: '2+3', caret: 2 })
  })

  it('선택한 부분을 대체한다', () => {
    expect(insertText('2+30', 2, 4, '5')).toEqual({ value: '2+5', caret: 3 })
  })

  it('거꾸로 선택해도(끝에서 앞으로) 같은 결과를 낸다', () => {
    expect(insertText('2+30', 4, 2, '5')).toEqual({ value: '2+5', caret: 3 })
  })

  it('빈 칸에 넣는다', () => {
    expect(insertText('', 0, 0, '7')).toEqual({ value: '7', caret: 1 })
  })

  it('커서 위치가 길이를 넘어가도 안전하게 처리한다', () => {
    expect(insertText('2+3', 99, 99, '+1')).toEqual({ value: '2+3+1', caret: 5 })
  })
})

describe('deleteBackward', () => {
  it('커서 앞 한 글자를 지운다', () => {
    expect(deleteBackward('2+3', 3, 3)).toEqual({ value: '2+', caret: 2 })
  })

  it('중간에서도 앞 글자만 지운다', () => {
    expect(deleteBackward('2+3', 2, 2)).toEqual({ value: '23', caret: 1 })
  })

  it('선택 영역이 있으면 그 부분을 지운다', () => {
    expect(deleteBackward('2+30+5', 2, 4)).toEqual({ value: '2++5', caret: 2 })
  })

  it('맨 앞에서는 아무것도 지우지 않는다', () => {
    expect(deleteBackward('2+3', 0, 0)).toEqual({ value: '2+3', caret: 0 })
  })

  it('빈 칸에서는 아무 일도 없다', () => {
    expect(deleteBackward('', 0, 0)).toEqual({ value: '', caret: 0 })
  })

  it('커서 위치가 길이를 넘어가도 마지막 글자를 지운다', () => {
    expect(deleteBackward('2+3', 99, 99)).toEqual({ value: '2+', caret: 2 })
  })
})
