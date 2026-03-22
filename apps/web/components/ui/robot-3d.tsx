'use client'

import dynamic from 'next/dynamic'

// Load the Three.js scene only on the client — R3F crashes during SSR
const Robot3DScene = dynamic(
  () => import('./robot-3d-scene').then((m) => ({ default: m.Robot3DScene })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
          <span className="text-teal-400/60 text-xs font-medium tracking-widest uppercase">
            Loading 3D…
          </span>
        </div>
      </div>
    ),
  }
)

interface Robot3DProps {
  className?: string
}

export function Robot3D({ className }: Robot3DProps) {
  return (
    <div className={className}>
      <Robot3DScene />
    </div>
  )
}
