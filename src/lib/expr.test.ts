import { describe, expect, it } from 'vitest'
import { evaluateQuantity, shouldShowExpression, sumQuantities } from './expr'

/** 성공을 기대하는 경우의 값만 꺼내는 도우미 */
function value(input: string): number {
  const result = evaluateQuantity(input)
  if (!result.ok) throw new Error(`계산에 실패했습니다: ${result.message}`)
  return result.value
}

function errorOf(input: string): string {
  const result = evaluateQuantity(input)
  if (result.ok) throw new Error(`오류를 기대했지만 ${result.value} 가 나왔습니다.`)
  return result.message
}

describe('evaluateQuantity — 현장에서 실제로 적는 형태', () => {
  it('노트에 적던 방식 그대로 더한다', () => {
    expect(value('2+3+5+10+5+3+2')).toBe(30)
  })

  it('구간이 몇 개인지 함께 알려 준다', () => {
    const result = evaluateQuantity('2+3+5+10+5+3+2')

    expect(result).toEqual({ ok: true, value: 30, terms: 7 })
  })

  it('숫자 하나만 적어도 된다', () => {
    expect(value('10')).toBe(10)
  })

  it('공백이 섞여 있어도 계산한다', () => {
    expect(value(' 10 + 5 + 3 ')).toBe(18)
  })

  it('소수점을 다룬다', () => {
    expect(value('2.5+0.5')).toBe(3)
    expect(value('20-1.5')).toBe(18.5)
  })

  it('소수 계산에서 부동소수점 찌꺼기가 남지 않는다', () => {
    expect(value('0.1+0.2')).toBe(0.3)
  })

  it('가닥수를 곱한다', () => {
    expect(value('12*3')).toBe(36)
  })

  it('곱셈 기호로 x, X, × 를 모두 받는다', () => {
    expect(value('5x3')).toBe(15)
    expect(value('5X3')).toBe(15)
    expect(value('5×3')).toBe(15)
  })

  it('나눗셈과 ÷ 기호를 받는다', () => {
    expect(value('10/4')).toBe(2.5)
    expect(value('10÷4')).toBe(2.5)
  })

  it('괄호로 묶은 구간을 곱한다', () => {
    expect(value('(2+3)*2')).toBe(10)
  })

  it('곱셈을 덧셈보다 먼저 계산한다', () => {
    expect(value('2+3*4')).toBe(14)
  })

  it('맨 바깥 항의 개수만 센다', () => {
    expect(evaluateQuantity('(2+3)*2')).toEqual({ ok: true, value: 10, terms: 1 })
    expect(evaluateQuantity('2*3+4')).toEqual({ ok: true, value: 10, terms: 2 })
  })
})

describe('evaluateQuantity — 비어 있거나 경계에 있는 입력', () => {
  it('빈 칸은 오류가 아니라 0 으로 본다', () => {
    expect(evaluateQuantity('')).toEqual({ ok: true, value: 0, terms: 0 })
    expect(evaluateQuantity('   ')).toEqual({ ok: true, value: 0, terms: 0 })
  })

  it('0 은 그대로 0 이다', () => {
    expect(value('0')).toBe(0)
  })

  it('빼서 정확히 0 이 되는 것은 허용한다', () => {
    expect(value('10-10')).toBe(0)
  })

  it('아주 긴 식도 계산한다', () => {
    const long = Array.from({ length: 200 }, () => '3').join('+')

    expect(value(long)).toBe(600)
  })
})

describe('evaluateQuantity — 잘못된 입력', () => {
  it('결과가 음수면 무엇을 확인해야 하는지 알려 준다', () => {
    expect(errorOf('10-20')).toContain('음수')
  })

  it('기호가 연달아 있으면 위치를 짚어 준다', () => {
    expect(errorOf('2++3')).toContain('기호가 연달아')
  })

  it('식이 기호로 끝나면 무엇을 하라고 알려 준다', () => {
    expect(errorOf('2+')).toContain('숫자를 넣')
  })

  it('숫자 사이에 기호를 빠뜨리면 짚어 준다', () => {
    expect(errorOf('2 3')).toContain('기호가 없습니다')
  })

  it('쓸 수 없는 문자를 알려 준다', () => {
    const message = errorOf('2+a')

    expect(message).toContain('a')
    expect(message).toContain('쓸 수 없습니다')
  })

  it('괄호가 닫히지 않으면 알려 준다', () => {
    expect(errorOf('(2+3')).toContain('닫히지 않았습니다')
  })

  it('짝 없는 닫는 괄호를 알려 준다', () => {
    expect(errorOf('2+3)')).toContain("짝이 되는 '(' 가 없습니다")
  })

  it('식이 기호로 시작하면 숫자로 시작하라고 알려 준다', () => {
    expect(errorOf('-5')).toContain('앞에 숫자가 없습니다')
  })

  it('곱셈 뒤에 붙은 부호를 오타로 보고 막는다', () => {
    expect(errorOf('5*-3')).toContain('기호가 연달아')
  })

  it('괄호 뒤에 숫자가 바로 붙으면 기호를 빠뜨렸다고 알려 준다', () => {
    expect(errorOf('(2+3)4')).toContain('기호가 없습니다')
  })

  it('0 으로 나누면 막는다', () => {
    expect(errorOf('10/0')).toContain('0 으로 나눌 수 없습니다')
  })

  it('소수점이 두 번 찍히면 알려 준다', () => {
    expect(errorOf('1.2.3')).toContain('소수점')
  })

  it('소수점만 적으면 앞에 숫자를 넣으라고 알려 준다', () => {
    expect(errorOf('.5')).toContain('앞에 숫자')
  })

  it('오류 메시지에 내부 구조나 스택을 노출하지 않는다', () => {
    const message = errorOf('2++3')

    expect(message).not.toContain('Error')
    expect(message).not.toContain('at ')
  })
})

describe('shouldShowExpression', () => {
  it('적은 값이 곧 결과면 수식을 덧붙이지 않는다', () => {
    expect(shouldShowExpression('45', 45)).toBe(false)
    expect(shouldShowExpression('  45  ', 45)).toBe(false)
  })

  it('덧셈뿐 아니라 곱셈·나눗셈·괄호가 든 식도 남긴다', () => {
    expect(shouldShowExpression('2+3+5', 10)).toBe(true)
    // 12 m 짜리 세 가닥이라는 뜻이 36 만 남으면 사라진다
    expect(shouldShowExpression('12*3', 36)).toBe(true)
    expect(shouldShowExpression('100/4', 25)).toBe(true)
    expect(shouldShowExpression('(15+8)*2', 46)).toBe(true)
  })

  it('천 단위가 넘어도 적은 값과 같으면 덧붙이지 않는다', () => {
    // 화면에는 1,200 으로 찍히지만 비교는 쉼표 없는 원래 수로 한다
    expect(shouldShowExpression('1200', 1200)).toBe(false)
  })
})

describe('sumQuantities', () => {
  it('여러 식을 합산한다', () => {
    expect(sumQuantities(['2+3', '10', '5*2'])).toEqual({ total: 25, invalid: 0 })
  })

  it('계산할 수 없는 식은 빼고 세어서 알려 준다', () => {
    expect(sumQuantities(['10', '2++3', ''])).toEqual({ total: 10, invalid: 1 })
  })

  it('빈 목록은 0 이다', () => {
    expect(sumQuantities([])).toEqual({ total: 0, invalid: 0 })
  })
})
