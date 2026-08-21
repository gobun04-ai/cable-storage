import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/global.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root 요소를 찾지 못했습니다. index.html 을 확인하세요.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
