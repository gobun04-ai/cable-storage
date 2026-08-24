import type { Row, SheetData, Sheet } from 'write-excel-file/browser'
import { safeFileName } from './download'
import { evaluateQuantity } from './expr'
import { formatDate } from './format'
import { log } from './logger'
import { summarize } from './summary'
import { buildTree, flattenTree } from './tree'
import type { Project, SectionNode } from '../types'

/**
 * 견적서 작성에 바로 쓸 수 있도록 표 형태로 내보낸다.
 * 시트를 케이블 / 장비 / 집계 셋으로 나눠, 각 시트에서 엑셀 필터와 정렬을 그대로 쓸 수 있게 한다.
 */

const HEADER_BACKGROUND = '#EBEFF3'

/** 공유받은 앱이 엑셀 파일로 알아보게 하려면 형식을 정확히 붙여야 한다. */
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function headerRow(labels: readonly string[]): Row {
  return labels.map((label) => ({
    value: label,
    type: String,
    fontWeight: 'bold' as const,
    backgroundColor: HEADER_BACKGROUND,
    align: 'center' as const,
  }))
}

function text(value: string): Row[number] {
  return value === '' ? null : { value, type: String }
}

function number(value: number | null): Row[number] {
  return value === null ? null : { value, type: Number }
}

/** "1층 전기실 > MCC반" 처럼 상위 항목을 이어 붙인 경로 */
function pathOf(node: SectionNode, parents: ReadonlyMap<string, SectionNode>): string {
  const names: string[] = []
  let current: SectionNode | undefined = node

  while (current !== undefined) {
    names.unshift(current.section.title)
    const parentId: string | null = current.section.parentId
    current = parentId === null ? undefined : parents.get(parentId)
  }

  return names.join(' > ')
}

function buildCableSheet(nodes: SectionNode[], parents: Map<string, SectionNode>): SheetData {
  const rows: SheetData = [
    headerRow(['번호', '항목 경로', '케이블 종류', '시작점(From)', '종단(To)', '물량 수식', '합계(m)', '비고', '확인']),
  ]

  for (const node of nodes) {
    for (const cable of node.cables) {
      const result = evaluateQuantity(cable.quantityExpr)
      rows.push([
        text(node.numbering),
        text(pathOf(node, parents)),
        text(cable.cableType),
        text(cable.from),
        text(cable.to),
        text(cable.quantityExpr),
        number(result.ok ? result.value : null),
        text(cable.note),
        result.ok ? null : text('수식 확인 필요'),
      ])
    }
  }

  if (rows.length === 1) rows.push([text('등록된 케이블이 없습니다')])
  return rows
}

function buildEquipmentSheet(nodes: SectionNode[], parents: Map<string, SectionNode>): SheetData {
  const rows: SheetData = [headerRow(['번호', '항목 경로', '구분', '장비명', '수량', '규격/모델', '비고'])]

  for (const node of nodes) {
    for (const equipment of node.equipments) {
      rows.push([
        text(node.numbering),
        text(pathOf(node, parents)),
        text(equipment.kind === 'replace' ? '교체' : '신규'),
        text(equipment.name),
        number(equipment.qty),
        text(equipment.spec),
        text(equipment.note),
      ])
    }
  }

  if (rows.length === 1) rows.push([text('등록된 장비가 없습니다')])
  return rows
}

function buildSummarySheet(project: Project, now: number): SheetData {
  const summary = summarize(project.body)
  const rows: SheetData = []

  const titleCell = (value: string): Row => [{ value, type: String, fontWeight: 'bold' as const }]

  rows.push(titleCell(project.name))
  if (project.site !== '') rows.push([text('현장'), text(project.site)])
  rows.push([text('작성일'), text(formatDate(now))])
  rows.push([])

  rows.push(titleCell('케이블 종류별'))
  rows.push(headerRow(['케이블 종류', '총 길이(m)', '건수', '계산 불가']))
  for (const row of summary.cables) {
    rows.push([
      text(row.cableType),
      number(row.totalLength),
      number(row.count),
      row.invalidCount > 0 ? number(row.invalidCount) : null,
    ])
  }
  rows.push([
    { value: '합계', type: String, fontWeight: 'bold' as const },
    { value: summary.totalCableLength, type: Number, fontWeight: 'bold' as const },
    { value: summary.totalCableCount, type: Number, fontWeight: 'bold' as const },
    summary.invalidQuantityCount > 0 ? number(summary.invalidQuantityCount) : null,
  ])
  rows.push([])

  rows.push(titleCell('장비별'))
  rows.push(headerRow(['구분', '장비명', '규격/모델', '총 수량', '건수']))
  for (const row of [...summary.replacements, ...summary.additions]) {
    rows.push([
      text(row.kind === 'replace' ? '교체' : '신규'),
      text(row.name),
      text(row.spec),
      number(row.totalQty),
      number(row.count),
    ])
  }
  rows.push([
    { value: '합계', type: String, fontWeight: 'bold' as const },
    null,
    null,
    { value: summary.totalReplacementQty + summary.totalAdditionQty, type: Number, fontWeight: 'bold' as const },
    null,
  ])

  if (summary.invalidQuantityCount > 0) {
    rows.push([])
    rows.push([text(`※ 물량 수식 ${summary.invalidQuantityCount}건은 계산할 수 없어 합계에서 빠졌습니다.`)])
  }

  return rows
}

/**
 * 통합문서에 들어갈 시트 세 장을 만든다.
 * 파일 생성과 떼어 놓아야 내용이 맞는지 검증할 수 있어 따로 뽑았다.
 */
export function buildWorkbookSheets(project: Project, now: number = Date.now()): Sheet<Blob>[] {
  const tree = buildTree(project.body)
  const nodes = flattenTree(tree)
  const parents = new Map(nodes.map((node) => [node.section.id, node]))

  // 타입 인자는 이미지 삽입 기능용 파일 형식이다. 이 앱은 표만 쓰므로 Blob 으로 둔다.
  return [
    {
      sheet: '케이블',
      data: buildCableSheet(nodes, parents),
      columns: [
        { width: 8 },
        { width: 28 },
        { width: 20 },
        { width: 16 },
        { width: 16 },
        { width: 24 },
        { width: 12 },
        { width: 24 },
        { width: 14 },
      ],
    },
    {
      sheet: '장비',
      data: buildEquipmentSheet(nodes, parents),
      columns: [{ width: 8 }, { width: 28 }, { width: 8 }, { width: 22 }, { width: 8 }, { width: 20 }, { width: 24 }],
    },
    {
      sheet: '집계',
      data: buildSummarySheet(project, now),
      columns: [{ width: 24 }, { width: 22 }, { width: 20 }, { width: 12 }, { width: 10 }],
    },
  ]
}

/**
 * 엑셀 파일을 만들어 넘긴다.
 * 다른 앱으로 보낼지 기기에 저장할지는 부르는 쪽이 정한다.
 */
export async function buildProjectXlsxFile(project: Project, now: number = Date.now()): Promise<File> {
  const sheets = buildWorkbookSheets(project, now)

  // 엑셀 생성기는 70KB 가까이 된다. 내보내기를 누른 순간에만 받아 와 첫 화면을 가볍게 유지한다.
  const { default: writeXlsxFile } = await import('write-excel-file/browser')

  const blob = await writeXlsxFile(sheets).toBlob()
  const file = new File([blob], safeFileName(`${project.name} 물량`, 'xlsx'), { type: XLSX_MIME })

  log.info('xlsx_built', {
    projectId: project.id,
    bytes: file.size,
    cables: project.body.cables.length,
    equipments: project.body.equipments.length,
  })

  return file
}
