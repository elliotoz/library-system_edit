'use client'

import { useEffect, useRef, useState } from 'react'
import type { Application } from '@splinetool/runtime'

interface SplineSceneProps {
  scene: string
  className?: string
}

type Status = 'loading' | 'ready' | 'error'

// Uses @splinetool/runtime directly — @splinetool/react-spline accesses
// React internals (ReactCurrentDispatcher) that are incompatible with the
// installed React version.
export function SplineScene({ scene, className }: SplineSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let app: Application | undefined

    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    container.appendChild(canvas)

    setStatus('loading')

    import('@splinetool/runtime')
      .then(({ Application: App }) => {
        if (cancelled) return
        app = new App(canvas)
        return app.load(scene)
      })
      .then(() => { if (!cancelled) setStatus('ready') })
      .catch((err) => {
        if (!cancelled) {
          console.error('[SplineScene] Failed to load scene:', err)
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
      try { app?.dispose() } catch {}
      canvas.remove()
    }
  }, [scene])

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
            <span className="text-teal-400/60 text-xs font-medium tracking-widest uppercase">
              Loading 3D scene…
            </span>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-red-400/60 text-xs font-medium">
            3D scene unavailable
          </span>
        </div>
      )}
    </div>
  )
}
