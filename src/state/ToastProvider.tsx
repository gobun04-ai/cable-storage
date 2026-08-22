import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertIcon, CloseIcon } from '../components/Icons'
import { newId } from '../lib/id'
import styles from '../components/Toast.module.css'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  message: string
  tone?: ToastTone | undefined
  /** 되돌리기 같은 즉시 행동. 파괴적 동작에는 확인 대화상자 대신 이쪽을 우선 쓴다. */
  action?: ToastAction | undefined
  durationMs?: number | undefined
}

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
  durationMs: number
  action: ToastAction | null
  /** 퇴장 애니메이션이 도는 중. 이 동안에는 화면에 남아 있다. */
  leaving: boolean
}

interface ToastContextValue {
  show: (options: ToastOptions) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION: Record<ToastTone, number> = {
  info: 3500,
  success: 3000,
  // 오류는 읽을 시간이 더 필요하다
  error: 7000,
}

/** 퇴장 애니메이션 길이. Toast.module.css 의 --dur-base 와 맞춘다. */
const LEAVE_MS = 200

/** 퇴장 타이머를 자동 닫힘 타이머와 구분해 담아 두는 키 */
const leaveKey = (id: string): string => `${id}:leave`

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const clearTimer = useCallback((key: string) => {
    const timer = timers.current.get(key)
    if (timer === undefined) return
    clearTimeout(timer)
    timers.current.delete(key)
  }, [])

  const remove = useCallback(
    (id: string) => {
      clearTimer(id)
      clearTimer(leaveKey(id))
      setToasts((prev) => prev.filter((t) => t.id !== id))
    },
    [clearTimer],
  )

  const dismiss = useCallback(
    (id: string) => {
      // 자동 닫힘 타이머부터 멈춘다. 사용자가 먼저 닫았을 수 있다.
      clearTimer(id)
      // 이미 나가는 중이면 애니메이션을 다시 시작하지 않는다
      if (timers.current.has(leaveKey(id))) return

      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
      timers.current.set(
        leaveKey(id),
        setTimeout(() => remove(id), LEAVE_MS),
      )
    },
    [clearTimer, remove],
  )

  const show = useCallback(
    (options: ToastOptions): string => {
      const tone = options.tone ?? 'info'
      const id = newId()
      // 되돌리기가 붙은 알림은 누를 시간을 넉넉히 준다
      const duration = options.durationMs ?? (options.action ? 7000 : DEFAULT_DURATION[tone])

      const item: ToastItem = {
        id,
        message: options.message,
        tone,
        durationMs: duration,
        action: options.action ?? null,
        leaving: false,
      }

      // 화면을 덮지 않도록 최근 3개만 유지한다
      setToasts((prev) => [...prev.slice(-2), item])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
      return id
    },
    [dismiss],
  )

  // 컴포넌트가 사라질 때 남은 타이머를 반드시 정리한다
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[styles.toast, styles[toast.tone], toast.leaving ? styles.leaving : undefined]
              .filter(Boolean)
              .join(' ')}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
          >
            {toast.tone === 'error' && <AlertIcon size={18} className={styles.icon} />}
            <span className={styles.message}>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" className={styles.close} onClick={() => dismiss(toast.id)} aria-label="알림 닫기">
              <CloseIcon size={18} />
            </button>

            {/* 되돌릴 수 있는 알림에만 남은 시간을 보여 준다. 언제까지 누를 수 있는지가 드러난다. */}
            {toast.action && !toast.leaving && (
              <span
                className={styles.timebar}
                style={{ animationDuration: `${toast.durationMs}ms` }}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast 는 ToastProvider 안에서만 쓸 수 있습니다.')
  return context
}
