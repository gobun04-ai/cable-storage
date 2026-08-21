import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings, type ThemePreference } from '../lib/db'
import { log } from '../lib/logger'

interface SettingsContextValue {
  settings: AppSettings
  setTheme: (theme: ThemePreference) => void
  markBackedUp: (at: number) => void
  /** 데이터를 모두 지웠을 때. 남은 백업 기록이 오해를 부르지 않게 함께 비운다. */
  clearBackupMark: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/** 'system' 이면 속성을 지워 CSS 의 prefers-color-scheme 판단에 맡긴다. */
function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    let cancelled = false
    void loadSettings().then((loaded) => {
      if (cancelled) return
      setSettings(loaded)
      applyTheme(loaded.theme)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      // 설정 저장 실패는 화면을 막을 정도의 사건이 아니므로 로그만 남긴다.
      void saveSettings(next).catch((error: unknown) => log.warn('settings_save_failed', {}, error))
      return next
    })
  }, [])

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      // 저장을 기다리지 않고 화면부터 바꾼다 (100ms 안에 반응)
      applyTheme(theme)
      update({ theme })
    },
    [update],
  )

  const markBackedUp = useCallback((at: number) => update({ lastBackupAt: at }), [update])
  const clearBackupMark = useCallback(() => update({ lastBackupAt: null }), [update])

  const value = useMemo(
    () => ({ settings, setTheme, markBackedUp, clearBackupMark }),
    [settings, setTheme, markBackedUp, clearBackupMark],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings 는 SettingsProvider 안에서만 쓸 수 있습니다.')
  return context
}
