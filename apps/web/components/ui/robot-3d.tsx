'use client'

import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// ── Brand palette ───────────────────────────────────────────────
const C = {
  navy:     '#0d1c2e',
  navyMid:  '#0a1628',
  navyDark: '#050d1a',
  teal:     '#2A9D9D',
  tealLt:   '#4ABFBF',
  eyeBg:    '#030b15',
}

// ── Layout constants (Three.js units) ──────────────────────────
const BW = 1.12, BH = 0.90, BD = 0.60   // body W/H/D
const HW = 1.00, HH = 0.78, HD = 0.62   // head W/H/D
const NH = 0.18                           // neck height

const BY = 0                              // body   Y
const NY = BY + BH / 2 + NH / 2          // neck   Y = 0.54
const HY = NY + NH / 2 + HH / 2          // head   Y = 1.02
const AY = BY + BH / 2 - 0.35            // arm    Y = 0.10
const GY = AY - 0.35 - 0.11              // hand   Y = -0.36
const LY = BY - BH / 2 - 0.28            // leg    Y = -0.73
const FY = LY - 0.28 - 0.09              // foot   Y = -1.10
const AX = BW / 2 + 0.13                 // arm/hand |X| = 0.69
const LX = 0.23                           // leg/foot |X|

// ── Robot ───────────────────────────────────────────────────────
function RobotMesh() {
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const eyeL = useRef<THREE.MeshStandardMaterial>(null)
  const eyeR = useRef<THREE.MeshStandardMaterial>(null)
  const ant  = useRef<THREE.MeshStandardMaterial>(null)
  const cL   = useRef<THREE.MeshStandardMaterial>(null)
  const cC   = useRef<THREE.MeshStandardMaterial>(null)
  const cR   = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (root.current) root.current.position.y = Math.sin(t * 0.8) * 0.15
    if (head.current) head.current.rotation.y = Math.sin(t * 0.45) * 0.10
    const ep = 1.5 + Math.sin(t * 2.5) * 0.8
    if (eyeL.current) eyeL.current.emissiveIntensity = ep
    if (eyeR.current) eyeR.current.emissiveIntensity = ep
    if (ant.current)  ant.current.emissiveIntensity  = 1.0 + Math.sin(t * 3.0) * 0.5
    if (cL.current)   cL.current.emissiveIntensity   = 0.7 + Math.sin(t * 1.4 + 0.0) * 0.5
    if (cC.current)   cC.current.emissiveIntensity   = 0.7 + Math.sin(t * 1.4 + 1.0) * 0.5
    if (cR.current)   cR.current.emissiveIntensity   = 0.7 + Math.sin(t * 1.4 + 2.0) * 0.5
  })

  return (
    <group ref={root}>

      {/* ── HEAD ── */}
      <group ref={head} position={[0, HY, 0]}>

        {/* Head shell */}
        <mesh>
          <boxGeometry args={[HW, HH, HD]} />
          <meshStandardMaterial color={C.navy} roughness={0.25} metalness={0.75} />
        </mesh>

        {/* Corner accent bars */}
        {([[-1, 1], [1, 1], [-1, -1], [1, -1]] as [number, number][]).map(([sx, sy], i) => (
          <mesh key={i} position={[sx * (HW / 2 - 0.07), sy * (HH / 2), HD / 2 + 0.002]}>
            <boxGeometry args={[0.14, 0.035, 0.008]} />
            <meshStandardMaterial color={C.tealLt} emissive={C.tealLt} emissiveIntensity={0.6} roughness={0.2} />
          </mesh>
        ))}

        {/* Eye sockets */}
        {([-0.23, 0.23] as number[]).map((ex, i) => (
          <mesh key={i} position={[ex, 0.08, HD / 2 + 0.007]}>
            <boxGeometry args={[0.34, 0.22, 0.01]} />
            <meshStandardMaterial color={C.eyeBg} roughness={1} metalness={0} />
          </mesh>
        ))}

        {/* Left eye glow */}
        <mesh position={[-0.23, 0.08, HD / 2 + 0.017]}>
          <boxGeometry args={[0.28, 0.16, 0.01]} />
          <meshStandardMaterial ref={eyeL} color={C.teal} emissive={C.teal} emissiveIntensity={1.5} roughness={0.2} metalness={0.3} />
        </mesh>

        {/* Right eye glow */}
        <mesh position={[0.23, 0.08, HD / 2 + 0.017]}>
          <boxGeometry args={[0.28, 0.16, 0.01]} />
          <meshStandardMaterial ref={eyeR} color={C.teal} emissive={C.teal} emissiveIntensity={1.5} roughness={0.2} metalness={0.3} />
        </mesh>

        {/* Pupils */}
        {([-0.23, 0.23] as number[]).map((ex, i) => (
          <mesh key={i} position={[ex, 0.08, HD / 2 + 0.027]}>
            <boxGeometry args={[0.10, 0.10, 0.005]} />
            <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.9} />
          </mesh>
        ))}

        {/* Mouth grill background */}
        <mesh position={[0, -0.22, HD / 2 + 0.007]}>
          <boxGeometry args={[0.50, 0.10, 0.01]} />
          <meshStandardMaterial color={C.eyeBg} roughness={1} />
        </mesh>

        {/* Mouth grill lines */}
        {([-0.16, -0.06, 0, 0.06, 0.16] as number[]).map((x, i) => (
          <mesh key={i} position={[x, -0.22, HD / 2 + 0.017]}>
            <boxGeometry args={[0.012, 0.08, 0.005]} />
            <meshStandardMaterial
              color={x === 0 ? C.tealLt : C.teal}
              emissive={C.teal}
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}

        {/* Antenna pole */}
        <mesh position={[0, HH / 2 + 0.15, 0]}>
          <cylinderGeometry args={[0.030, 0.030, 0.30, 8]} />
          <meshStandardMaterial color={C.tealLt} emissive={C.tealLt} emissiveIntensity={0.5} roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Antenna ball */}
        <mesh position={[0, HH / 2 + 0.38, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial ref={ant} color={C.teal} emissive={C.teal} emissiveIntensity={1.0} roughness={0.1} metalness={0.5} />
        </mesh>

      </group>

      {/* ── NECK ── */}
      <mesh position={[0, NY, 0]}>
        <boxGeometry args={[0.34, NH, 0.30]} />
        <meshStandardMaterial color={C.navyMid} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Neck front accent */}
      <mesh position={[0, NY, BD / 2 - 0.01]}>
        <boxGeometry args={[0.22, 0.04, 0.008]} />
        <meshStandardMaterial color={C.teal} emissive={C.teal} emissiveIntensity={0.3} />
      </mesh>

      {/* ── BODY ── */}
      <mesh position={[0, BY, 0]}>
        <boxGeometry args={[BW, BH, BD]} />
        <meshStandardMaterial color={C.navy} roughness={0.25} metalness={0.75} />
      </mesh>

      {/* Chest panel */}
      <mesh position={[0, BY + 0.05, BD / 2 + 0.007]}>
        <boxGeometry args={[0.78, 0.62, 0.008]} />
        <meshStandardMaterial color={C.navyDark} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Chest panel top accent line */}
      <mesh position={[0, BY + 0.35, BD / 2 + 0.008]}>
        <boxGeometry args={[0.78, 0.036, 0.008]} />
        <meshStandardMaterial color={C.teal} emissive={C.teal} emissiveIntensity={0.4} />
      </mesh>

      {/* Chest light L */}
      <mesh position={[-0.22, BY + 0.16, BD / 2 + 0.04]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial ref={cL} color={C.teal} emissive={C.teal} emissiveIntensity={0.8} roughness={0.1} metalness={0.5} />
      </mesh>

      {/* Chest light C */}
      <mesh position={[0, BY + 0.16, BD / 2 + 0.04]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial ref={cC} color={C.tealLt} emissive={C.tealLt} emissiveIntensity={0.8} roughness={0.1} metalness={0.5} />
      </mesh>

      {/* Chest light R */}
      <mesh position={[0.22, BY + 0.16, BD / 2 + 0.04]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial ref={cR} color={C.teal} emissive={C.teal} emissiveIntensity={0.8} roughness={0.1} metalness={0.5} />
      </mesh>

      {/* Body side bolts */}
      {([-1, 1] as number[]).flatMap((sx, si) =>
        [-0.28, 0.28].map((y, yi) => (
          <mesh key={`bolt-${si}-${yi}`} position={[sx * (BW / 2 + 0.005), y, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={C.navyMid} roughness={0.3} metalness={0.9} />
          </mesh>
        ))
      )}

      {/* ── ARMS ── */}
      {([-1, 1] as number[]).map((s, i) => (
        <group key={i}>
          <mesh position={[s * AX, AY, 0]}>
            <boxGeometry args={[0.26, 0.70, 0.26]} />
            <meshStandardMaterial color={C.navy} roughness={0.25} metalness={0.75} />
          </mesh>
          <mesh position={[s * AX, GY, 0]}>
            <boxGeometry args={[0.32, 0.22, 0.30]} />
            <meshStandardMaterial color={C.navyDark} roughness={0.35} metalness={0.65} />
          </mesh>
          {/* Shoulder joint */}
          <mesh position={[s * (BW / 2), BY + BH / 2 - 0.12, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color={C.teal} emissive={C.teal} emissiveIntensity={0.25} roughness={0.3} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* ── LEGS ── */}
      {([-1, 1] as number[]).map((s, i) => (
        <group key={i}>
          <mesh position={[s * LX, LY, 0]}>
            <boxGeometry args={[0.28, 0.56, 0.28]} />
            <meshStandardMaterial color={C.navy} roughness={0.25} metalness={0.75} />
          </mesh>
          {/* Knee accent */}
          <mesh position={[s * LX, LY + 0.14, BD / 2 - 0.05]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={C.teal} emissive={C.teal} emissiveIntensity={0.2} roughness={0.3} />
          </mesh>
          {/* Foot */}
          <mesh position={[s * LX, FY, 0.06]}>
            <boxGeometry args={[0.36, 0.18, 0.44]} />
            <meshStandardMaterial color={C.navyDark} roughness={0.35} metalness={0.65} />
          </mesh>
        </group>
      ))}

      {/* ── GROUND GLOW ── */}
      <mesh position={[0, FY - 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 0.5]} />
        <meshStandardMaterial
          color={C.teal}
          emissive={C.teal}
          emissiveIntensity={1.0}
          transparent
          opacity={0.12}
        />
      </mesh>

    </group>
  )
}

// ── Public export ───────────────────────────────────────────────
interface Robot3DProps {
  className?: string
}

export function Robot3D({ className }: Robot3DProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return (
      <div className={`${className ?? ''} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
          <span className="text-teal-400/60 text-xs font-medium tracking-widest uppercase">
            Loading 3D…
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0.3, 4.5], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 8, 5]} intensity={1.4} />
        <directionalLight position={[-3, 2, -4]} intensity={0.4} color={C.teal} />
        <pointLight position={[0, 2, 3]} color={C.teal} intensity={4} />
        <pointLight position={[-2, -1, 2]} color={C.tealLt} intensity={0.8} />

        <RobotMesh />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.8}
          target={[0, 0.3, 0]}
        />
      </Canvas>
    </div>
  )
}
