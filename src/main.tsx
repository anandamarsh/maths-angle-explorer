import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

if (!import.meta.env.PROD) {
  import('./report/testPdfData').then(({ generateTestPdf }) => {
    (window as unknown as Record<string, unknown>).__testGeneratePdf = generateTestPdf;
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
