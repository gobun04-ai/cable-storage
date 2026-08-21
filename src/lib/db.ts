import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project, ProjectBody, ProjectCounts, ProjectMeta } from '../types'
import { log } from './logger'

export function countBody(body: ProjectBody): ProjectCounts {
  return {
    sections: body.sections.length,
    cables: body.cables.length,
    equipments: body.equipments.length,
  }
}

const DB_NAME = 'cablenote'
const DB_VERSION = 1

export type ThemePreference = 'system' | 'light' | 'dark'

export interface AppSettings {
  theme: ThemePreference
  /** 마지막으로 JSON 백업을 내려받은 시각. 없으면 null */
  lastBackupAt: number | null
}

export const DEFAULT_SETTINGS: AppSettings = { theme: 'system', lastBackupAt: null }

const SETTINGS_KEY = 'app'

interface CableNoteDB extends DBSchema {
  /** 공사 머리 정보. 목록 화면은 이 스토어만 읽는다. */
  projects: {
    key: string
    value: ProjectMeta
    indexes: { updatedAt: number }
  }
  /** 공사 본문. 키는 공사 id */
  bodies: {
    key: string
    value: ProjectBody
  }
  settings: {
    key: string
    value: AppSettings
  }
}

/** 저장소 관련 실패를 사용자에게 보여줄 문구와 함께 감싼다. */
export class StorageError extends Error {
  readonly userMessage: string

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage, cause === undefined ? undefined : { cause })
    this.name = 'StorageError'
    this.userMessage = userMessage
  }
}

function toStorageError(operation: string, cause: unknown): StorageError {
  const name = cause instanceof Error ? cause.name : ''

  if (name === 'QuotaExceededError') {
    log.error('storage_quota_exceeded', { operation }, cause)
    return new StorageError(
      '휴대폰 저장 공간이 부족해 저장하지 못했습니다. 다른 앱의 사진이나 파일을 정리한 뒤 다시 시도해 주세요.',
      cause,
    )
  }

  log.error('storage_operation_failed', { operation }, cause)
  return new StorageError(
    '데이터를 저장하지 못했습니다. 앱을 다시 열어 보시고, 계속 실패하면 브라우저의 시크릿 모드가 아닌지 확인해 주세요.',
    cause,
  )
}

let dbPromise: Promise<IDBPDatabase<CableNoteDB>> | null = null

function getDb(): Promise<IDBPDatabase<CableNoteDB>> {
  if (dbPromise) return dbPromise

  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new StorageError(
        '이 브라우저에서는 데이터를 저장할 수 없습니다. 크롬 등 최신 브라우저에서 열어 주세요.',
      ),
    )
  }

  dbPromise = openDB<CableNoteDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      log.info('db_upgrade', { oldVersion, newVersion: DB_VERSION })

      if (oldVersion < 1) {
        const projects = db.createObjectStore('projects', { keyPath: 'id' })
        projects.createIndex('updatedAt', 'updatedAt')
        db.createObjectStore('bodies')
        db.createObjectStore('settings')
      }
      // 스키마를 바꿀 때는 여기에 oldVersion < 2 … 블록을 이어 붙인다.
    },
    blocked() {
      log.warn('db_blocked', { reason: '다른 탭이 이전 버전의 DB를 잡고 있음' })
    },
    blocking() {
      // 다른 탭이 업그레이드를 기다리는 중이면 이 탭의 연결을 놓아 준다.
      log.warn('db_blocking')
      void getDb().then((db) => db.close())
      dbPromise = null
    },
    terminated() {
      log.error('db_terminated', { reason: '브라우저가 연결을 강제 종료함' })
      dbPromise = null
    },
  }).catch((cause: unknown) => {
    dbPromise = null
    log.error('db_open_failed', {}, cause)
    throw new StorageError(
      '저장소를 열지 못했습니다. 브라우저의 시크릿 모드이거나 사이트 데이터가 차단된 상태일 수 있습니다.',
      cause,
    )
  })

  return dbPromise
}

/** 브라우저가 저장 공간을 임의로 비우지 않도록 요청한다. 거절되어도 앱은 정상 동작한다. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    const granted = await navigator.storage.persist()
    log.info('storage_persist_requested', { granted })
    return granted
  } catch (cause) {
    log.warn('storage_persist_failed', {}, cause)
    return false
  }
}

/** 공사 목록. 최근에 고친 것이 위로 온다. */
export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    const db = await getDb()
    const rows = await db.getAllFromIndex('projects', 'updatedAt')
    return rows.reverse()
  } catch (cause) {
    if (cause instanceof StorageError) throw cause
    throw toStorageError('listProjects', cause)
  }
}

/** 공사 1건 전체를 읽는다. 없으면 null */
export async function loadProject(id: string): Promise<Project | null> {
  try {
    const db = await getDb()
    const tx = db.transaction(['projects', 'bodies'], 'readonly')
    const [meta, body] = await Promise.all([
      tx.objectStore('projects').get(id),
      tx.objectStore('bodies').get(id),
    ])
    await tx.done

    if (!meta) return null
    return { ...meta, body: body ?? { sections: [], cables: [], equipments: [] } }
  } catch (cause) {
    if (cause instanceof StorageError) throw cause
    throw toStorageError('loadProject', cause)
  }
}

/** 머리 정보와 본문을 한 트랜잭션으로 저장한다. 둘 중 하나만 저장되는 일이 없어야 한다. */
export async function saveProject(project: Project): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction(['projects', 'bodies'], 'readwrite')
    const { body, ...rest } = project
    // 목록 화면이 본문을 열지 않고도 규모를 보여줄 수 있게, 저장 시점에 개수를 다시 센다.
    const meta: ProjectMeta = { ...rest, counts: countBody(body) }
    await Promise.all([
      tx.objectStore('projects').put(meta),
      tx.objectStore('bodies').put(body, meta.id),
      tx.done,
    ])
    log.debug('project_saved', {
      projectId: meta.id,
      sections: body.sections.length,
      cables: body.cables.length,
      equipments: body.equipments.length,
    })
  } catch (cause) {
    if (cause instanceof StorageError) throw cause
    throw toStorageError('saveProject', cause)
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction(['projects', 'bodies'], 'readwrite')
    await Promise.all([
      tx.objectStore('projects').delete(id),
      tx.objectStore('bodies').delete(id),
      tx.done,
    ])
    log.info('project_deleted', { projectId: id })
  } catch (cause) {
    if (cause instanceof StorageError) throw cause
    throw toStorageError('deleteProject', cause)
  }
}

/** 저장된 공사를 모두 지운다. 되돌릴 수 없다. */
export async function clearAllProjects(): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction(['projects', 'bodies'], 'readwrite')
    await Promise.all([tx.objectStore('projects').clear(), tx.objectStore('bodies').clear(), tx.done])
    log.warn('all_projects_cleared')
  } catch (cause) {
    if (cause instanceof StorageError) throw cause
    throw toStorageError('clearAllProjects', cause)
  }
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const db = await getDb()
    const saved = await db.get('settings', SETTINGS_KEY)
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch (cause) {
    // 설정을 못 읽는 것으로 앱을 막지는 않는다.
    log.warn('settings_load_failed', {}, cause)
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const db = await getDb()
    await db.put('settings', settings, SETTINGS_KEY)
  } catch (cause) {
    throw toStorageError('saveSettings', cause)
  }
}

/** 백업/복원용. 저장된 공사를 전부 읽어 온다. */
export async function loadAllProjects(): Promise<Project[]> {
  try {
    const db = await getDb()
    const tx = db.transaction(['projects', 'bodies'], 'readonly')
    const metas = await tx.objectStore('projects').getAll()
    const bodyStore = tx.objectStore('bodies')
    const projects = await Promise.all(
      metas.map(async (meta): Promise<Project> => {
        const body = await bodyStore.get(meta.id)
        return { ...meta, body: body ?? { sections: [], cables: [], equipments: [] } }
      }),
    )
    await tx.done
    return projects
  } catch (cause) {
    if (cause instanceof StorageError) throw cause
    throw toStorageError('loadAllProjects', cause)
  }
}

/** 복원용. 넘어온 공사들을 한 트랜잭션으로 저장한다. */
export async function putProjects(projects: Project[]): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction(['projects', 'bodies'], 'readwrite')
    const projectStore = tx.objectStore('projects')
    const bodyStore = tx.objectStore('bodies')
    for (const project of projects) {
      const { body, ...rest } = project
      const meta: ProjectMeta = { ...rest, counts: countBody(body) }
      void projectStore.put(meta)
      void bodyStore.put(body, meta.id)
    }
    await tx.done
    log.info('projects_restored', { count: projects.length })
  } catch (cause) {
    if (cause instanceof StorageError) throw cause
    throw toStorageError('putProjects', cause)
  }
}
