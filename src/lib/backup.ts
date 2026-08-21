import { loadAllProjects, putProjects } from './db'
import { downloadBlob, safeFileName } from './download'
import { newId } from './id'
import { log } from './logger'
import { cloneBody } from './project'
import type { CableRecord, EquipmentRecord, Project, ProjectBody, Section } from '../types'

/**
 * 앱 데이터 전체를 JSON 파일로 내보내고 되돌린다.
 *
 * 브라우저 저장소는 사용자가 사이트 데이터를 지우거나 기기를 바꾸면 사라진다.
 * 이 백업이 유일한 대비책이므로, 읽어 들일 때는 외부 파일이라 여기고 값을 하나하나 확인한다.
 */

const APP_TAG = 'cablenote'
const BACKUP_VERSION = 1

export interface BackupFile {
  app: typeof APP_TAG
  version: number
  exportedAt: string
  projects: Project[]
}

export type ParseResult =
  | { ok: true; projects: Project[]; skipped: number; exportedAt: string | null }
  | { ok: false; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asPositiveInt(value: unknown, fallback: number): number {
  const parsed = asNumber(value, fallback)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function parseSection(raw: unknown): Section | null {
  if (!isRecord(raw)) return null
  const id = asString(raw['id'])
  if (id === '') return null

  const parentId = raw['parentId']
  return {
    id,
    parentId: typeof parentId === 'string' && parentId !== '' ? parentId : null,
    title: asString(raw['title'], '(이름 없음)'),
    memo: asString(raw['memo']),
    order: asPositiveInt(raw['order'], 0),
  }
}

function parseCable(raw: unknown): CableRecord | null {
  if (!isRecord(raw)) return null
  const id = asString(raw['id'])
  const sectionId = asString(raw['sectionId'])
  if (id === '' || sectionId === '') return null

  return {
    id,
    sectionId,
    cableType: asString(raw['cableType']),
    from: asString(raw['from']),
    to: asString(raw['to']),
    quantityExpr: asString(raw['quantityExpr']),
    note: asString(raw['note']),
    order: asPositiveInt(raw['order'], 0),
  }
}

function parseEquipment(raw: unknown): EquipmentRecord | null {
  if (!isRecord(raw)) return null
  const id = asString(raw['id'])
  const sectionId = asString(raw['sectionId'])
  if (id === '' || sectionId === '') return null

  return {
    id,
    sectionId,
    kind: raw['kind'] === 'new' ? 'new' : 'replace',
    name: asString(raw['name']),
    qty: Math.max(0, asPositiveInt(raw['qty'], 1)),
    spec: asString(raw['spec']),
    note: asString(raw['note']),
    order: asPositiveInt(raw['order'], 0),
  }
}

function parseBody(raw: unknown): ProjectBody {
  if (!isRecord(raw)) return { sections: [], cables: [], equipments: [] }

  const sections = Array.isArray(raw['sections'])
    ? raw['sections'].map(parseSection).filter((row): row is Section => row !== null)
    : []
  const cables = Array.isArray(raw['cables'])
    ? raw['cables'].map(parseCable).filter((row): row is CableRecord => row !== null)
    : []
  const equipments = Array.isArray(raw['equipments'])
    ? raw['equipments'].map(parseEquipment).filter((row): row is EquipmentRecord => row !== null)
    : []

  // 사라진 항목을 가리키는 기록은 화면에 나올 자리가 없으므로 버린다
  const known = new Set(sections.map((section) => section.id))
  return {
    sections,
    cables: cables.filter((cable) => known.has(cable.sectionId)),
    equipments: equipments.filter((equipment) => known.has(equipment.sectionId)),
  }
}

function parseProject(raw: unknown, now: number): Project | null {
  if (!isRecord(raw)) return null

  const name = asString(raw['name']).trim()
  if (name === '') return null

  const body = parseBody(raw['body'])
  const createdAt = asNumber(raw['createdAt'], now)

  return {
    id: asString(raw['id'], newId()),
    name,
    site: asString(raw['site']),
    memo: asString(raw['memo']),
    createdAt,
    updatedAt: asNumber(raw['updatedAt'], createdAt),
    counts: {
      sections: body.sections.length,
      cables: body.cables.length,
      equipments: body.equipments.length,
    },
    body,
  }
}

/** 백업 파일 내용을 읽어 공사 목록으로 바꾼다. 형식이 아니면 이유를 돌려준다. */
export function parseBackup(rawText: string, now: number = Date.now()): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { ok: false, message: '백업 파일을 읽지 못했습니다. 이 앱에서 내려받은 .json 파일이 맞는지 확인해 주세요.' }
  }

  if (!isRecord(parsed)) {
    return { ok: false, message: '백업 파일의 형식이 올바르지 않습니다.' }
  }
  if (parsed['app'] !== APP_TAG) {
    return { ok: false, message: '이 앱에서 만든 백업 파일이 아닙니다. 다른 파일을 선택해 주세요.' }
  }

  const version = asNumber(parsed['version'], 0)
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      message: `더 새로운 버전(${version})의 백업 파일입니다. 앱을 최신으로 업데이트한 뒤 다시 시도해 주세요.`,
    }
  }
  if (!Array.isArray(parsed['projects'])) {
    return { ok: false, message: '백업 파일 안에 공사 목록이 없습니다.' }
  }

  const rawProjects = parsed['projects']
  const projects = rawProjects.map((row) => parseProject(row, now)).filter((row): row is Project => row !== null)

  if (projects.length === 0) {
    return { ok: false, message: '백업 파일에 복원할 공사가 없습니다.' }
  }

  return {
    ok: true,
    projects,
    skipped: rawProjects.length - projects.length,
    exportedAt: typeof parsed['exportedAt'] === 'string' ? parsed['exportedAt'] : null,
  }
}

/** 저장된 모든 공사를 JSON 파일로 내려받는다. */
export async function exportBackup(now: number = Date.now()): Promise<number> {
  const projects = await loadAllProjects()

  const file: BackupFile = {
    app: APP_TAG,
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    projects,
  }

  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const stamp = new Date(now).toISOString().slice(0, 10)
  downloadBlob(blob, safeFileName(`케이블노트 백업 ${stamp}`, 'json'))

  log.info('backup_exported', { projects: projects.length, bytes: blob.size })
  return projects.length
}

/**
 * 백업에서 읽은 공사를 저장한다.
 * 기존 데이터를 절대 덮어쓰지 않도록 식별자를 모두 새로 발급해 별도의 공사로 추가한다.
 */
export async function restoreProjects(projects: Project[]): Promise<number> {
  const fresh = projects.map((project) => ({
    ...project,
    id: newId(),
    body: cloneBody(project.body),
  }))

  await putProjects(fresh)
  return fresh.length
}
