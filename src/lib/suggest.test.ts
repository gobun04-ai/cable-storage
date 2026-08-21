import { describe, expect, it } from 'vitest'
import { rememberValue, suggestValues, valuesInProject } from './suggest'
import type { CableRecord, EquipmentRecord, ProjectBody } from '../types'

function cable(cableType: string, from = '', to = ''): CableRecord {
  return { id: cableType + from + to, sectionId: 's1', cableType, from, to, quantityExpr: '', note: '', order: 0 }
}

function equipment(name: string, spec = ''): EquipmentRecord {
  return { id: name + spec, sectionId: 's1', kind: 'replace', name, qty: 1, spec, note: '', order: 0 }
}

function body(overrides: Partial<ProjectBody> = {}): ProjectBody {
  return { sections: [], cables: [], equipments: [], ...overrides }
}

describe('valuesInProject', () => {
  it('많이 쓴 값을 앞에 둔다', () => {
    const source = body({
      cables: [cable('CV 25sq'), cable('HFIX 2.5sq'), cable('CV 25sq'), cable('CV 25sq')],
    })

    expect(valuesInProject(source, 'cableType')).toEqual(['CV 25sq', 'HFIX 2.5sq'])
  })

  it('빈 값과 공백만 있는 값은 세지 않는다', () => {
    const source = body({ cables: [cable('CV 25sq'), cable(''), cable('   ')] })

    expect(valuesInProject(source, 'cableType')).toEqual(['CV 25sq'])
  })

  it('앞뒤 공백을 정리해서 같은 값으로 본다', () => {
    const source = body({ cables: [cable('CV 25sq'), cable(' CV 25sq ')] })

    expect(valuesInProject(source, 'cableType')).toEqual(['CV 25sq'])
  })

  it('시작점과 종단을 따로 모은다', () => {
    const source = body({ cables: [cable('CV', 'MCC반', 'P-101')] })

    expect(valuesInProject(source, 'from')).toEqual(['MCC반'])
    expect(valuesInProject(source, 'to')).toEqual(['P-101'])
  })

  it('장비명과 규격을 따로 모은다', () => {
    const source = body({ equipments: [equipment('MCCB 100A', 'LS ABS103c')] })

    expect(valuesInProject(source, 'equipmentName')).toEqual(['MCCB 100A'])
    expect(valuesInProject(source, 'equipmentSpec')).toEqual(['LS ABS103c'])
  })

  it('기록이 없으면 빈 배열이다', () => {
    expect(valuesInProject(body(), 'cableType')).toEqual([])
  })
})

describe('suggestValues', () => {
  const source = body({
    cables: [cable('CV 4C 25sq'), cable('HFIX 2.5sq'), cable('CVV-SB 10C')],
  })

  it('적은 글자가 들어간 값만 보여 준다', () => {
    const result = suggestValues({ field: 'cableType', body: source, query: 'cv' })

    expect(result).toEqual(['CV 4C 25sq', 'CVV-SB 10C'])
  })

  it('대소문자를 가리지 않는다', () => {
    expect(suggestValues({ field: 'cableType', body: source, query: 'HFIX' })).toEqual(['HFIX 2.5sq'])
    expect(suggestValues({ field: 'cableType', body: source, query: 'hfix' })).toEqual(['HFIX 2.5sq'])
  })

  it('아직 아무것도 안 적었으면 쓰던 값을 모두 보여 준다', () => {
    expect(suggestValues({ field: 'cableType', body: source, query: '' })).toHaveLength(3)
  })

  it('이미 똑같이 적어 놓은 값은 다시 제안하지 않는다', () => {
    const result = suggestValues({ field: 'cableType', body: source, query: 'HFIX 2.5sq' })

    expect(result).toEqual([])
  })

  it('개수 상한을 지킨다', () => {
    const many = body({ cables: Array.from({ length: 20 }, (_, i) => cable(`TYPE-${i}`)) })

    expect(suggestValues({ field: 'cableType', body: many, query: '', limit: 4 })).toHaveLength(4)
  })

  it('일치하는 값이 없으면 빈 배열이다', () => {
    expect(suggestValues({ field: 'cableType', body: source, query: '존재하지않음' })).toEqual([])
  })

  it('localStorage 를 쓸 수 없는 환경에서도 예외를 던지지 않는다', () => {
    // 이 테스트는 node 환경에서 돈다. 즉 localStorage 가 아예 없는 상태를 그대로 재현한다.
    expect(() => rememberValue('cableType', 'CV 25sq')).not.toThrow()
    expect(() => suggestValues({ field: 'cableType', body: source, query: '' })).not.toThrow()
  })
})
