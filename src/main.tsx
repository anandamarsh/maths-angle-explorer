import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

function installIosViewportGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const ua = navigator.userAgent
  const isiOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isiOS) return

  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!viewport) return

  const relaxedViewport = 'width=device-width, initial-scale=1, viewport-fit=cover'
  const lockedViewport =
    'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'

  let resetTimer = 0

  const isEditable = (target: EventTarget | null): target is HTMLElement => {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable) return true
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    )
  }

  const applyViewport = (content: string) => {
    if (viewport.getAttribute('content') !== content) {
      viewport.setAttribute('content', content)
    }
  }

  const resetViewport = () => {
    window.clearTimeout(resetTimer)
    resetTimer = window.setTimeout(() => {
      if (isEditable(document.activeElement)) return
      applyViewport(lockedViewport)
      requestAnimationFrame(() => {
        applyViewport(relaxedViewport)
        requestAnimationFrame(() => {
          window.scrollTo(window.scrollX, window.scrollY)
        })
      })
    }, 180)
  }

  applyViewport(relaxedViewport)
  document.addEventListener('focusin', (event) => {
    if (isEditable(event.target)) {
      window.clearTimeout(resetTimer)
      applyViewport(lockedViewport)
    }
  })
  document.addEventListener('focusout', (event) => {
    if (isEditable(event.target)) {
      resetViewport()
    }
  })
  window.visualViewport?.addEventListener('resize', () => {
    if (!isEditable(document.activeElement)) {
      resetViewport()
    }
  })
  window.addEventListener('orientationchange', resetViewport)
}

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

installIosViewportGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
