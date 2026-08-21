import { evaluateQuantity } from './expr'
import { formatDate, formatNumber } from './format'
import { summarize, type ProjectSummary } from './summary'
import { buildTree } from './tree'
import type { CableRecord, EquipmentRecord, Project, SectionNode } from '../types'

/**
 * 카카오톡·문자에 그대로 붙여 넣을 정리 텍스트를 만든다.
 *
 * 받는 쪽 글꼴을 알 수 없으므로 공백으로 열을 맞추지 않는다. 대신 구분자와 들여쓰기로 구조를 드러낸다.
 */

const DIVIDER = '─'.repeat(24)
/** 깊이가 깊어져도 들여쓰기가 화면을 밀어내지 않도록 상한을 둔다 */
const MAX_INDENT_DEPTH = 5

function indent(depth: number): string {
  return '  '.repeat(Math.min(depth, MAX_INDENT_DEPTH))
}

/** "2+3+5 = 20 m" 또는 "20 m". 계산이 안 되면 원문과 함께 알린다. */
function quantityText(cable: CableRecord): string {
  const expression = cable.quantityExpr.trim()
  if (expression === '') return ''

  const result = evaluateQuantity(expression)
  if (!result.ok) return `${expression} (계산 불가)`

  const total = `${formatNumber(result.value)} m`
  return result.terms > 1 ? `${expression} = ${total}` : total
}

function cableLine(cable: CableRecord, depth: number): string[] {
  const parts: string[] = [cable.cableType.trim() === '' ? '(종류 미기재)' : cable.cableType.trim()]

  if (cable.from !== '' || cable.to !== '') {
    parts.push(`${cable.from === '' ? '?' : cable.from} → ${cable.to === '' ? '?' : cable.to}`)
  }

  const quantity = quantityText(cable)
  if (quantity !== '') parts.push(quantity)

  const lines = [`${indent(depth)}· ${parts.join(' | ')}`]
  if (cable.note !== '') lines.push(`${indent(depth)}  ※ ${cable.note.replace(/\n/g, ' ')}`)
  return lines
}

function equipmentLine(equipment: EquipmentRecord, depth: number): string[] {
  const badge = equipment.kind === 'replace' ? '[교체]' : '[신규]'
  const spec = equipment.spec === '' ? '' : ` (${equipment.spec})`
  const name = equipment.name.trim() === '' ? '(장비명 미기재)' : equipment.name.trim()

  const lines = [`${indent(depth)}${badge} ${name} × ${equipment.qty}${spec}`]
  if (equipment.note !== '') lines.push(`${indent(depth)}  ※ ${equipment.note.replace(/\n/g, ' ')}`)
  return lines
}

function sectionLines(node: SectionNode): string[] {
  const lines: string[] = []
  const depth = node.depth

  // 최상위는 "1." 처럼 마침표를 붙이고, 하위는 이미 점이 들어 있으므로 "1.1" 그대로 쓴다
  const label = node.numbering.includes('.') ? node.numbering : `${node.numbering}.`
  lines.push(`${indent(depth)}${label} ${node.section.title}`)
  if (node.section.memo !== '') {
    lines.push(`${indent(depth)}  ※ ${node.section.memo.replace(/\n/g, ' ')}`)
  }

  for (const cable of node.cables) lines.push(...cableLine(cable, depth + 1))
  for (const equipment of node.equipments) lines.push(...equipmentLine(equipment, depth + 1))
  for (const child of node.children) lines.push(...sectionLines(child))

  return lines
}

function summaryLines(summary: ProjectSummary): string[] {
  const lines: string[] = ['■ 집계']

  if (summary.totalCableCount > 0) {
    lines.push('')
    lines.push(`[케이블] 총 ${formatNumber(summary.totalCableLength)} m / ${summary.totalCableCount}건`)
    for (const row of summary.cables) {
      const invalid = row.invalidCount > 0 ? ` ※ 계산 불가 ${row.invalidCount}건` : ''
      lines.push(` · ${row.cableType} — ${formatNumber(row.totalLength)} m (${row.count}건)${invalid}`)
    }
  }

  if (summary.replacements.length > 0) {
    lines.push('')
    lines.push(`[교체 장비] 총 ${summary.totalReplacementQty}개 / ${summary.replacements.length}종`)
    for (const row of summary.replacements) {
      const spec = row.spec === '' ? '' : ` (${row.spec})`
      lines.push(` · ${row.name}${spec} — ${row.totalQty}개`)
    }
  }

  if (summary.additions.length > 0) {
    lines.push('')
    lines.push(`[신규 장비] 총 ${summary.totalAdditionQty}개 / ${summary.additions.length}종`)
    for (const row of summary.additions) {
      const spec = row.spec === '' ? '' : ` (${row.spec})`
      lines.push(` · ${row.name}${spec} — ${row.totalQty}개`)
    }
  }

  if (summary.invalidQuantityCount > 0) {
    lines.push('')
    lines.push(`※ 물량 수식 ${summary.invalidQuantityCount}건은 계산할 수 없어 합계에서 빠졌습니다.`)
  }

  return lines
}

export function buildShareText(project: Project, now: number = Date.now()): string {
  const tree = buildTree(project.body)
  const summary = summarize(project.body)

  const lines: string[] = [`■ ${project.name}`]

  if (project.site !== '') lines.push(`현장 : ${project.site}`)
  lines.push(`작성 : ${formatDate(now)}`)

  if (project.memo !== '') {
    lines.push('')
    lines.push('[메모]')
    lines.push(project.memo)
  }

  lines.push('')
  lines.push(DIVIDER)

  if (tree.length === 0) {
    lines.push('(아직 등록한 항목이 없습니다)')
  } else {
    for (const node of tree) {
      lines.push(...sectionLines(node))
      // 최상위 항목 사이에만 빈 줄을 넣어 덩어리를 구분한다
      lines.push('')
    }
    lines.pop()
  }

  lines.push('')
  lines.push(DIVIDER)
  lines.push('')
  lines.push(...summaryLines(summary))

  return lines.join('\n')
}
