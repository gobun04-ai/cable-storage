/**
 * 물량 수식 계산기.
 *
 * 현장에서 적는 "2+3+5+10+5+3+2" 같은 식을 그대로 받아 합계를 낸다.
 * 가닥수를 곱하는 "12*3", 자투리를 빼는 "20-1.5", 묶음을 표현하는 "(2+3)*2" 도 받는다.
 *
 * eval 이나 Function 생성자는 쓰지 않는다. 사용자 입력을 코드로 실행하는 통로를 만들지 않기 위해
 * 토큰으로 쪼갠 뒤 직접 계산한다.
 */

export type ExprResult =
  | { ok: true; value: number; terms: number }
  | { ok: false; message: string }

interface NumberToken {
  type: 'number'
  value: number
  pos: number
  raw: string
}

interface SymbolToken {
  type: 'op' | 'lparen' | 'rparen'
  text: string
  pos: number
}

type Token = NumberToken | SymbolToken

/** 곱셈·나눗셈 기호는 사람마다 다르게 적으므로 미리 표준 기호로 바꾼다. */
const SYMBOL_ALIASES: Record<string, string> = {
  '×': '*',
  x: '*',
  X: '*',
  '÷': '/',
  '－': '-',
  '＋': '+',
  '（': '(',
  '）': ')',
}

class ExprError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExprError'
  }
}

/** 소수 연산에서 생기는 0.30000000000000004 같은 찌꺼기를 정리한다. */
function tidy(value: number): number {
  return Math.round(value * 1e9) / 1e9
}

function describePosition(pos: number): string {
  return `${pos + 1}번째 글자`
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const original = input[i] ?? ''

    if (original === ' ' || original === '\t' || original === '\n') {
      i += 1
      continue
    }

    const char = SYMBOL_ALIASES[original] ?? original

    if (char >= '0' && char <= '9') {
      let end = i
      let dots = 0
      while (end < input.length) {
        const c = input[end] ?? ''
        if (c >= '0' && c <= '9') {
          end += 1
          continue
        }
        if (c === '.') {
          dots += 1
          if (dots > 1) {
            throw new ExprError(`${describePosition(end)}의 소수점이 두 번 찍혔습니다. 숫자 하나에 소수점은 한 번만 넣어 주세요.`)
          }
          end += 1
          continue
        }
        break
      }

      const raw = input.slice(i, end)
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        throw new ExprError(`'${raw}' 를 숫자로 읽지 못했습니다.`)
      }
      tokens.push({ type: 'number', value, pos: i, raw })
      i = end
      continue
    }

    if (char === '.') {
      throw new ExprError(`${describePosition(i)}에 소수점만 있습니다. '0.5' 처럼 앞에 숫자를 넣어 주세요.`)
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'op', text: char, pos: i })
      i += 1
      continue
    }

    if (char === '(') {
      tokens.push({ type: 'lparen', text: '(', pos: i })
      i += 1
      continue
    }

    if (char === ')') {
      tokens.push({ type: 'rparen', text: ')', pos: i })
      i += 1
      continue
    }

    throw new ExprError(
      `${describePosition(i)}의 '${original}' 은 쓸 수 없습니다. 숫자와 + - × ÷ ( ) 만 넣어 주세요.`,
    )
  }

  return tokens
}

function symbolOf(op: string): string {
  if (op === '*') return '×'
  if (op === '/') return '÷'
  return op
}

/**
 * 재귀 하강 파서.
 *   expr    := term (('+' | '-') term)*
 *   term    := primary (('*' | '/') primary)*
 *   primary := number | '(' expr ')'
 *
 * 단항 부호(-5)는 일부러 지원하지 않는다. 물량을 적다가 나오는 "2++3", "5*-3" 은
 * 음수를 의도한 것이 아니라 오타일 가능성이 훨씬 높으므로 계산하지 않고 짚어 주는 편이 낫다.
 */
class Parser {
  private index = 0
  /** 맨 바깥 덧셈·뺄셈으로 이어진 항의 개수. "구간 7개" 같은 안내에 쓴다. */
  topLevelTerms = 0

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.parseExpr(true)
    const leftover = this.peek()
    if (leftover) {
      if (leftover.type === 'rparen') {
        throw new ExprError(`${describePosition(leftover.pos)}의 ')' 와 짝이 되는 '(' 가 없습니다.`)
      }
      if (leftover.type === 'number') {
        throw new ExprError(
          `${describePosition(leftover.pos)}의 '${leftover.raw}' 앞에 기호가 없습니다. 더할 값이면 '+' 를 넣어 주세요.`,
        )
      }
      throw new ExprError(`${describePosition(leftover.pos)} 뒤쪽을 이해하지 못했습니다. 식을 다시 확인해 주세요.`)
    }
    return value
  }

  private peek(): Token | undefined {
    return this.tokens[this.index]
  }

  /** 이항 연산자를 소비한 직후, 그 뒤에 계산할 값이 실제로 있는지 확인한다. */
  private requireOperandAfter(operator: SymbolToken): void {
    const next = this.peek()
    const symbol = symbolOf(operator.text)

    if (!next) {
      throw new ExprError(`식이 '${symbol}' 로 끝났습니다. 뒤에 숫자를 넣거나 '${symbol}' 를 지워 주세요.`)
    }
    if (next.type === 'op') {
      throw new ExprError(
        `${describePosition(operator.pos)} 부근에 기호가 연달아 있습니다. 사이에 숫자를 넣거나 하나를 지워 주세요.`,
      )
    }
  }

  private parseExpr(isTopLevel: boolean): number {
    let value = this.parseTerm()
    if (isTopLevel) this.topLevelTerms = 1

    for (;;) {
      const token = this.peek()
      if (!token || token.type !== 'op' || (token.text !== '+' && token.text !== '-')) break

      this.index += 1
      this.requireOperandAfter(token)

      const right = this.parseTerm()
      value = token.text === '+' ? value + right : value - right
      if (isTopLevel) this.topLevelTerms += 1
    }

    return value
  }

  private parseTerm(): number {
    let value = this.parsePrimary()

    for (;;) {
      const token = this.peek()
      if (!token || token.type !== 'op' || (token.text !== '*' && token.text !== '/')) break

      this.index += 1
      this.requireOperandAfter(token)

      const right = this.parsePrimary()
      if (token.text === '/') {
        if (right === 0) {
          throw new ExprError('0 으로 나눌 수 없습니다.')
        }
        value = value / right
      } else {
        value = value * right
      }
    }

    return value
  }

  private parsePrimary(): number {
    const token = this.peek()
    if (!token) {
      throw new ExprError('식이 끝나지 않았습니다. 마지막에 숫자를 넣어 주세요.')
    }

    if (token.type === 'number') {
      this.index += 1
      // "2 3" 처럼 숫자가 연달아 오면 더하기를 빠뜨린 것이다
      const next = this.peek()
      if (next && next.type === 'number') {
        throw new ExprError(
          `${describePosition(next.pos)}의 '${next.raw}' 앞에 기호가 없습니다. 더할 값이면 '+' 를 넣어 주세요.`,
        )
      }
      return token.value
    }

    if (token.type === 'lparen') {
      this.index += 1
      const value = this.parseExpr(false)
      const closing = this.peek()
      if (!closing || closing.type !== 'rparen') {
        throw new ExprError(`${describePosition(token.pos)}에서 연 '(' 가 닫히지 않았습니다.`)
      }
      this.index += 1
      return value
    }

    if (token.type === 'rparen') {
      throw new ExprError(`${describePosition(token.pos)}의 ')' 와 짝이 되는 '(' 가 없습니다.`)
    }

    throw new ExprError(
      `${describePosition(token.pos)}의 '${symbolOf(token.text)}' 앞에 숫자가 없습니다. 숫자로 시작하도록 고쳐 주세요.`,
    )
  }
}

/**
 * 수식을 계산한다. 빈 문자열은 오류가 아니라 "아직 안 적음"으로 본다.
 * 오류일 때는 무엇이 잘못됐고 어떻게 고치는지를 담은 문장을 돌려준다.
 */
export function evaluateQuantity(input: string): ExprResult {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: true, value: 0, terms: 0 }

  try {
    const tokens = tokenize(trimmed)
    if (tokens.length === 0) return { ok: true, value: 0, terms: 0 }

    const parser = new Parser(tokens)
    const value = parser.parse()

    if (!Number.isFinite(value)) {
      return { ok: false, message: '계산 결과가 너무 큽니다. 값을 나눠서 적어 주세요.' }
    }
    if (value < 0) {
      return { ok: false, message: `계산 결과가 ${tidy(value)} 로 음수입니다. 빼는 값이 너무 큰지 확인해 주세요.` }
    }

    return { ok: true, value: tidy(value), terms: parser.topLevelTerms }
  } catch (error) {
    if (error instanceof ExprError) return { ok: false, message: error.message }
    return { ok: false, message: '식을 계산하지 못했습니다. 숫자와 + - × ÷ ( ) 만 써서 다시 적어 주세요.' }
  }
}

/** 여러 수식의 합계. 계산할 수 없는 식은 건너뛰고 몇 건이 빠졌는지 함께 돌려준다. */
export function sumQuantities(expressions: readonly string[]): { total: number; invalid: number } {
  let total = 0
  let invalid = 0

  for (const expression of expressions) {
    const result = evaluateQuantity(expression)
    if (result.ok) total += result.value
    else invalid += 1
  }

  return { total: tidy(total), invalid }
}
