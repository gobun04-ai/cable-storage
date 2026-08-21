/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages는 https://<계정>.github.io/<저장소>/ 로 서비스되므로 하위 경로가 붙는다.
// 배포 단계에서 VITE_BASE=/저장소이름/ 을 넘겨 빌드한다. 로컬 개발은 루트('/')를 쓴다.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // 새 버전이 나와도 작업 중에 갑자기 새로고침되지 않도록, 알림을 띄우고 사용자가 고르게 한다.
      registerType: 'prompt',
      // 등록 코드는 직접 넣는다(업데이트 알림을 앱 토스트로 보여 주기 위해).
      injectRegister: null,
      // 아이콘·favicon 은 아래 globPatterns 가 이미 잡으므로 includeAssets 를 따로 두지 않는다
      manifest: {
        name: '케이블노트 — 현장 물량 산출',
        short_name: '케이블노트',
        description: '현장에서 공사 케이블 물량과 장비 목록을 정리하고 텍스트·엑셀로 공유합니다.',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#0f49a8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱을 이루는 파일을 모두 미리 받아 둬야 통신이 끊긴 현장에서도 열린다.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  define: {
    // 설정 화면에 표시할 버전. npm 이 실행할 때 넣어 주는 값을 그대로 쓴다.
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  server: {
    // 같은 와이파이의 휴대폰에서 개발 중인 화면을 열어볼 수 있게 한다.
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    // 순수 계산 로직(트리 조립, 수식 파서, 집계, 텍스트 생성)만 검증하므로 DOM 이 필요 없다.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
