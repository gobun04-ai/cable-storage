import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Id } from '../types'

/**
 * 꾹 눌러 끌어서 형제 안의 순서를 바꾼다.
 *
 * 브라우저 기본 끌기(HTML5 drag and drop)는 휴대폰 터치에서 동작하지 않으므로
 * 포인터 이벤트로 직접 다룬다. 마우스·터치·펜이 같은 코드로 처리된다.
 *
 * 좌표는 모두 문서 기준(뷰포트 좌표 + 스크롤량)으로 다룬다.
 * 끄는 도중 화면이 자동으로 스크롤되기 때문에, 뷰포트 기준으로 재면 자리 계산이 어긋난다.
 */

/** 이만큼 누르고 있어야 끌기가 시작된다. 그 전에 손가락이 움직이면 화면 스크롤로 본다. */
const HOLD_MS = 400
/** 누른 채 이만큼(px) 넘게 움직이면 스크롤로 판단해 끌기를 포기한다 */
const SLOP = 8
/** 화면 위아래 끝에서 이 거리(px) 안으로 들어오면 자동으로 스크롤한다 */
const EDGE = 72
/** 자동 스크롤 한 프레임당 이동량(px) */
const SCROLL_STEP = 12
/** 끌기가 시작될 때의 짧은 진동(ms). 지원하지 않는 기기에서는 조용히 넘어간다. */
const HAPTIC_MS = 12
/** 끌기 직후 뒤따라오는 클릭을 기다리는 시간(ms) */
const CLICK_GUARD_MS = 300

export interface DragState {
  /** 끌고 있는 항목 */
  id: Id
  /** 원래 자리에서 움직인 거리(px). 카드를 그만큼 밀어 손가락을 따라가게 한다. */
  offsetY: number
  /** 시작할 때의 자리 */
  from: number
  /** 지금 놓으면 들어갈 자리 */
  toIndex: number
}

interface Session {
  id: Id
  from: number
  pointerId: number
  element: HTMLElement
  /** 누르기 시작한 지점(문서 기준) */
  startPoint: number
  /** 최신 손가락 위치(문서 기준) */
  point: number
  /** 최신 손가락 위치(화면 기준). 자동 스크롤 판정에 쓴다. */
  viewportY: number
  /** 형제들의 중심 좌표(문서 기준) */
  centers: number[]
  /** 끌기 대상의 원래 중심(문서 기준) */
  origin: number
  holdTimer: ReturnType<typeof setTimeout> | null
  frame: number | null
  started: boolean
}

interface DragTarget {
  id: Id
  /** 형제 안에서의 지금 자리 */
  index: number
}

interface Options {
  /** 순서 바꾸기 모드에서만 켠다. 평소에는 카드를 눌러 접고 펴야 한다. */
  enabled: boolean
  onReorder: (id: Id, toIndex: number) => void
}

function documentY(clientY: number): number {
  return clientY + window.scrollY
}

/** 끌고 있는 카드의 중심이 어느 형제를 지났는지로 들어갈 자리를 정한다. */
function indexFor(session: Session, center: number): number {
  let to = session.from

  session.centers.forEach((siblingCenter, index) => {
    if (index === session.from) return
    if (index < session.from && center < siblingCenter) to = Math.min(to, index)
    if (index > session.from && center > siblingCenter) to = Math.max(to, index)
  })

  return to
}

export function useDragReorder({ enabled, onReorder }: Options): {
  drag: DragState | null
  handlePointerDown: (event: ReactPointerEvent<HTMLElement>, target: DragTarget) => void
} {
  const [drag, setDrag] = useState<DragState | null>(null)
  const session = useRef<Session | null>(null)

  /** 타이머·프레임·리스너를 모두 풀고 화면을 원래대로 돌린다. 어느 경로로 끝나든 반드시 지난다. */
  const finish = useCallback((): Session | null => {
    const current = session.current
    session.current = null

    if (current === null) return null

    if (current.holdTimer !== null) clearTimeout(current.holdTimer)
    if (current.frame !== null) cancelAnimationFrame(current.frame)

    if (current.started) {
      document.body.style.touchAction = ''
      if (current.element.hasPointerCapture(current.pointerId)) {
        current.element.releasePointerCapture(current.pointerId)
      }

      /*
       * 손을 떼면 브라우저가 클릭을 뒤따라 보낸다.
       * 그대로 두면 방금 끌어 옮긴 항목이 접히거나 펴진다. 그 한 번만 삼킨다.
       * 클릭이 오지 않는 경우도 있으므로 잠시 뒤 반드시 거둔다 — 남겨 두면 다음 진짜 클릭을 먹는다.
       */
      const swallowClick = (clickEvent: MouseEvent): void => {
        clickEvent.preventDefault()
        clickEvent.stopPropagation()
      }
      window.addEventListener('click', swallowClick, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallowClick, { capture: true }), CLICK_GUARD_MS)
    }

    setDrag(null)
    return current
  }, [])

  // 끌던 도중 화면을 벗어나면(뒤로가기 등) 잠긴 스크롤을 반드시 풀어야 한다
  useEffect(
    () => () => {
      finish()
    },
    [finish],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, target: DragTarget): void => {
      // 마우스는 왼쪽 버튼만. 이미 끌고 있는 중이면 새로 시작하지 않는다.
      if (!enabled || event.button !== 0 || session.current !== null) return

      // 하위 항목에서 시작한 누르기가 상위 항목까지 올라가 두 번 잡히지 않게 한다
      event.stopPropagation()

      const element = event.currentTarget
      const pointerId = event.pointerId
      const startPoint = documentY(event.clientY)

      const current: Session = {
        id: target.id,
        from: target.index,
        pointerId,
        element,
        startPoint,
        point: startPoint,
        viewportY: event.clientY,
        centers: [],
        origin: 0,
        holdTimer: null,
        frame: null,
        started: false,
      }
      session.current = current

      const update = (): void => {
        const center = current.origin + (current.point - current.startPoint)
        setDrag({
          id: current.id,
          offsetY: current.point - current.startPoint,
          from: current.from,
          toIndex: indexFor(current, center),
        })
      }

      /** 화면 끝에 손가락이 닿아 있는 동안 계속 스크롤한다. 목록이 길어도 끝까지 옮길 수 있어야 한다. */
      const autoScroll = (): void => {
        if (session.current !== current || !current.started) return

        const above = current.viewportY - EDGE
        const below = current.viewportY - (window.innerHeight - EDGE)
        const step = above < 0 ? -SCROLL_STEP : below > 0 ? SCROLL_STEP : 0

        if (step !== 0) {
          const before = window.scrollY
          window.scrollBy(0, step)
          // 실제로 스크롤된 만큼만 손가락 위치(문서 기준)를 따라 옮긴다. 끝에 닿으면 0이다.
          current.point += window.scrollY - before
          update()
        }

        current.frame = requestAnimationFrame(autoScroll)
      }

      const begin = (): void => {
        if (session.current !== current) return

        const parent = element.parentElement
        const siblings = parent === null ? [element] : Array.from(parent.children)
        current.centers = siblings.map((sibling) => {
          const rect = sibling.getBoundingClientRect()
          return documentY(rect.top) + rect.height / 2
        })
        current.origin = current.centers[current.from] ?? documentY(element.getBoundingClientRect().top)
        current.started = true

        // 끌기가 시작됐음을 손으로 알린다. 지원하지 않는 기기에서는 아무 일도 일어나지 않는다.
        navigator.vibrate?.(HAPTIC_MS)

        // 끄는 동안에는 화면이 손가락을 따라 스크롤되면 안 된다. 스크롤은 아래 autoScroll 이 맡는다.
        document.body.style.touchAction = 'none'
        element.setPointerCapture(pointerId)

        update()
        current.frame = requestAnimationFrame(autoScroll)
      }

      const onMove = (moveEvent: PointerEvent): void => {
        if (session.current !== current || moveEvent.pointerId !== pointerId) return

        current.point = documentY(moveEvent.clientY)
        current.viewportY = moveEvent.clientY

        if (!current.started) {
          // 아직 끌기 전이다. 손가락이 움직였다면 화면을 스크롤하려는 것이다.
          if (Math.abs(current.point - current.startPoint) > SLOP) finish()
          return
        }

        // 끄는 동안의 기본 동작(스크롤·글자 선택)을 막는다
        moveEvent.preventDefault()
        update()
      }

      const onUp = (upEvent: PointerEvent): void => {
        if (session.current !== current || upEvent.pointerId !== pointerId) return

        const ended = finish()
        if (ended === null || !ended.started) return

        const center = ended.origin + (ended.point - ended.startPoint)
        const toIndex = indexFor(ended, center)
        if (toIndex !== ended.from) onReorder(ended.id, toIndex)
      }

      const onCancel = (cancelEvent: PointerEvent): void => {
        if (cancelEvent.pointerId === pointerId) finish()
      }

      window.addEventListener('pointermove', onMove, { passive: false })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)

      // 위 리스너는 이 포인터가 끝날 때 한 번만 정리하면 된다
      const detach = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
      }
      window.addEventListener('pointerup', detach, { once: true })
      window.addEventListener('pointercancel', detach, { once: true })

      current.holdTimer = setTimeout(begin, HOLD_MS)
    },
    [enabled, finish, onReorder],
  )

  return { drag, handlePointerDown }
}
