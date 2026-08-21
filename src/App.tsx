import { useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { requestPersistentStorage } from './lib/db'
import { ProjectListScreen } from './screens/ProjectListScreen'
import { ProjectScreen } from './screens/ProjectScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { SettingsProvider } from './state/SettingsProvider'
import { ToastProvider } from './state/ToastProvider'
import { useAppUpdate } from './state/useAppUpdate'

/** 알림을 쓰는 앱 전역 준비 작업은 ToastProvider 안쪽에서 해야 한다. */
function AppShell({ children }: { children: ReactNode }) {
  useAppUpdate()

  // 브라우저가 저장 공간을 임의로 비우지 않도록 시작할 때 한 번 요청한다
  useEffect(() => {
    void requestPersistentStorage()
  }, [])

  return <div className="app-shell">{children}</div>
}

export function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        {/*
          GitHub Pages 처럼 하위 경로에서 서비스되는 정적 호스팅에서는
          새로고침 시 404 가 나지 않도록 해시 라우팅을 쓴다.
        */}
        <HashRouter>
          <AppShell>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<ProjectListScreen />} />
                <Route path="/p/:projectId" element={<ProjectScreen />} />
                <Route path="/p/:projectId/summary" element={<SummaryScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </AppShell>
        </HashRouter>
      </ToastProvider>
    </SettingsProvider>
  )
}
