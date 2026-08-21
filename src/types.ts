/** 앱 전체가 공유하는 데이터 모델. 저장 형식과 백업(JSON) 형식의 기준이 된다. */

export type Id = string

/** 목록 화면에서 본문을 열지 않고도 규모를 보여주기 위한 요약. 저장할 때마다 다시 센다. */
export interface ProjectCounts {
  sections: number
  cables: number
  equipments: number
}

/** 공사 1건의 머리 정보. 목록 화면은 이것만 읽는다. */
export interface ProjectMeta {
  id: Id
  /** 공사명 */
  name: string
  /** 현장 또는 발주처 */
  site: string
  memo: string
  createdAt: number
  updatedAt: number
  counts: ProjectCounts
}

/** 항목 / 하위항목. parentId 로 깊이 제한 없이 중첩된다. */
export interface Section {
  id: Id
  /** 최상위 항목이면 null */
  parentId: Id | null
  title: string
  memo: string
  /** 같은 부모 안에서의 정렬 순서 (0부터) */
  order: number
}

/** 케이블 기록 1건 */
export interface CableRecord {
  id: Id
  sectionId: Id
  /** 케이블 종류 (예: CV 4C 25sq) */
  cableType: string
  /** 시작점 */
  from: string
  /** 종단 */
  to: string
  /** 물량 수식 원문 (예: "2+3+5+10+5+3+2"). 합계는 계산해서 쓰고 원문은 검산용으로 보존한다. */
  quantityExpr: string
  note: string
  order: number
}

/** 교체가 필요한 장비인지, 새로 설치할 장비인지 */
export type EquipmentKind = 'replace' | 'new'

/** 장비 기록 1건 */
export interface EquipmentRecord {
  id: Id
  sectionId: Id
  kind: EquipmentKind
  name: string
  qty: number
  /** 규격 또는 모델명 */
  spec: string
  note: string
  order: number
}

/** 공사 1건의 본문. 세 종류의 레코드를 평평한 배열로 보관하고 화면에서 트리로 조립한다. */
export interface ProjectBody {
  sections: Section[]
  cables: CableRecord[]
  equipments: EquipmentRecord[]
}

/** 상세 화면이 다루는 공사 1건 전체 */
export interface Project extends ProjectMeta {
  body: ProjectBody
}

export const EMPTY_BODY: ProjectBody = Object.freeze({
  sections: [],
  cables: [],
  equipments: [],
}) as ProjectBody

/** 화면에 그리기 위해 조립한 트리 노드 */
export interface SectionNode {
  section: Section
  /** 화면에 표시할 번호 (예: "1.2.1") */
  numbering: string
  depth: number
  children: SectionNode[]
  cables: CableRecord[]
  equipments: EquipmentRecord[]
}
