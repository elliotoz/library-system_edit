'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ── GLSL: Classic Perlin Noise 2D ─────────────────────────────────── */
const NOISE_GLSL = /* glsl */`
  vec4 _permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec2 _fade(vec2 t)     { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

  float cnoise(vec2 P) {
    vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
    vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
    Pi = mod(Pi, 289.0);
    vec4 ix = Pi.xzxz;
    vec4 iy = Pi.yyww;
    vec4 fx = Pf.xzxz;
    vec4 fy = Pf.yyww;
    vec4 i  = _permute(_permute(ix) + iy);
    vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0;
    vec4 gy = abs(gx) - 0.5;
    gx = gx - floor(gx + 0.5);
    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
      vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11));
    g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
    float n00 = dot(g00, vec2(fx.x, fy.x));
    float n10 = dot(g10, vec2(fx.y, fy.y));
    float n01 = dot(g01, vec2(fx.z, fy.z));
    float n11 = dot(g11, vec2(fx.w, fy.w));
    vec2  fade_xy = _fade(Pf.xy);
    vec2  n_x     = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
    return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
  }
`;

/* ── Vertex Shader — wave displacement ─────────────────────────────── */
const VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.z += sin(pos.x * 1.8  + uTime * 0.35) * 0.08;
    pos.z += sin(pos.y * 2.4  + uTime * 0.25) * 0.06;
    pos.z += sin((pos.x + pos.y) * 1.3 + uTime * 0.2) * 0.035;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

/* ── Fragment Shader — gradient + noise + moving orbs ──────────────── */
const FRAGMENT_SHADER = /* glsl */`
  ${NOISE_GLSL}

  varying vec2 vUv;
  uniform float uTime;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;

  void main() {
    float n  = cnoise(vUv * 2.4 + uTime * 0.055) * 0.5 + 0.5;
    float n2 = cnoise(vUv * 4.2 - uTime * 0.038) * 0.5 + 0.5;

    vec3 col = mix(uColorA, uColorB, vUv.x + n  * 0.28);
    col      = mix(col,     uColorC, vUv.y * 0.65 + n2 * 0.18);

    /* Orb 1 — top-right, orbits slowly */
    vec2  o1 = vec2(0.72 + sin(uTime * 0.18) * 0.14, 0.78 + cos(uTime * 0.13) * 0.09);
    float d1 = 1.0 - smoothstep(0.0, 0.42, distance(vUv, o1));
    col += mix(uColorA, uColorC, 0.5) * d1 * 0.18;

    /* Orb 2 — bottom-left */
    vec2  o2 = vec2(0.18 + cos(uTime * 0.22) * 0.09, 0.25 + sin(uTime * 0.17) * 0.11);
    float d2 = 1.0 - smoothstep(0.0, 0.38, distance(vUv, o2));
    col += uColorB * d2 * 0.14;

    /* Orb 3 — centre drift */
    vec2  o3 = vec2(0.5 + sin(uTime * 0.11) * 0.18, 0.52 + cos(uTime * 0.09) * 0.14);
    float d3 = 1.0 - smoothstep(0.0, 0.55, distance(vUv, o3));
    col += mix(uColorB, uColorC, 0.3) * d3 * 0.08;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ── Color palettes ─────────────────────────────────────────────────── */
const LIGHT = {
  a: new THREE.Color('#dbeafe'), // soft azure
  b: new THREE.Color('#ecfdf5'), // soft mint
  c: new THREE.Color('#faf5ff'), // soft lavender
};
const DARK = {
  a: new THREE.Color('#0b1120'),
  b: new THREE.Color('#0d1f3c'),
  c: new THREE.Color('#0f172a'),
};

/* ── Component ──────────────────────────────────────────────────────── */
export function WebGLBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Renderer */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio * 0.75, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);

    /* Scene & camera (orthographic — background plane fills NDC) */
    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    /* Geometry */
    const geometry = new THREE.PlaneGeometry(2, 2, 64, 64);

    /* Uniforms */
    const isDark   = () => document.documentElement.classList.contains('dark');
    const palette  = () => (isDark() ? DARK : LIGHT);
    const p        = palette();
    const uniforms = {
      uTime:   { value: 0 },
      uColorA: { value: p.a.clone() },
      uColorB: { value: p.b.clone() },
      uColorC: { value: p.c.clone() },
    };

    /* Material */
    const material = new THREE.ShaderMaterial({
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
    });

    scene.add(new THREE.Mesh(geometry, material));

    /* Animation loop */
    const clock = new THREE.Clock();
    let animId: number;
    let paused = false;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      if (paused || reduced) return;
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };
    tick();

    /* Pause when tab hidden */
    const onVisibility = () => { paused = document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    /* React to dark-mode class toggle */
    const observer = new MutationObserver(() => {
      const pal = palette();
      uniforms.uColorA.value.copy(pal.a);
      uniforms.uColorB.value.copy(pal.b);
      uniforms.uColorC.value.copy(pal.c);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    /* Resize */
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: -10, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
