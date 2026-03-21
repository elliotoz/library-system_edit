// app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Library } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { DASHBOARD_ROUTES, Role } from '@/types';

// Deterministic particles — no Math.random() to avoid hydration mismatch
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: (i * 37 + 13) % 100,
  y: (i * 53 + 7) % 100,
  size: 1 + (i % 3),
  delay: (i * 0.31) % 5,
  duration: 2.5 + (i % 3) * 0.7,
  opacity: 0.15 + (i % 5) * 0.07,
}));

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const { login, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    authApi.getConfig()
      .then((c) => setGoogleOAuthEnabled(c.googleOAuthEnabled))
      .catch(() => setGoogleOAuthEnabled(false));
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.push(DASHBOARD_ROUTES[user.role as Role]);
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setIsSubmitting(true);
    try {
      await login({ email, password });
      toast.success('Welcome back!');
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Login failed';
      if (message.toLowerCase().includes('verify your email')) {
        toast.error('Your account is not verified. Check your inbox or request a new code.', { duration: 6000 });
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else if (message.toLowerCase().includes('deactivated')) {
        toast.error('Your account has been deactivated. Please contact the administrator.');
      } else if (message.toLowerCase().includes('invalid email or password')) {
        setPassword('');
        toast.error('Incorrect email or password — please try again.');
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 14;
    const y = -((e.clientX - rect.left) / rect.width - 0.5) * 14;
    setTilt({ x, y });
  };

  return (
    <>
      <style>{`
        @keyframes robot-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-18px); }
        }
        @keyframes eye-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes eye-scan {
          0%, 80%, 100% { transform: translateX(0); }
          40%           { transform: translateX(5px); }
        }
        @keyframes scan-line {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 0.5; }
          90%  { opacity: 0.5; }
          100% { transform: translateY(600%); opacity: 0; }
        }
        @keyframes platform-pulse {
          0%, 100% { opacity: 0.45; rx: 70; }
          50%       { opacity: 0.85; rx: 80; }
        }
        @keyframes orbit-ring {
          from { transform: rotateY(0deg) rotateX(20deg); }
          to   { transform: rotateY(360deg) rotateX(20deg); }
        }
        @keyframes orbit-ring2 {
          from { transform: rotateY(60deg) rotateX(-15deg); }
          to   { transform: rotateY(420deg) rotateX(-15deg); }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: var(--op); transform: scale(1); }
          50%       { opacity: calc(var(--op) * 2); transform: scale(1.4); }
        }
        @keyframes beam-top {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        @keyframes beam-right {
          0%   { transform: translateY(-120%); }
          100% { transform: translateY(320%); }
        }
        @keyframes beam-bottom {
          0%   { transform: translateX(120%); }
          100% { transform: translateX(-320%); }
        }
        @keyframes beam-left {
          0%   { transform: translateY(120%); }
          100% { transform: translateY(-320%); }
        }
        @keyframes chest-blink {
          0%, 90%, 100% { opacity: 1; }
          95%            { opacity: 0.2; }
        }
        .robot-float    { animation: robot-float 4.2s ease-in-out infinite; }
        .eye-pulse      { animation: eye-pulse 2s ease-in-out infinite; }
        .eye-scan       { animation: eye-scan 3.5s ease-in-out infinite; }
        .scan-line-anim { animation: scan-line 3.5s ease-in-out infinite; }
        .platform-anim  { animation: platform-pulse 3s ease-in-out infinite; }
        .chest-blink    { animation: chest-blink 2.4s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen flex overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#020810 0%,#050d1c 35%,#071020 65%,#020810 100%)' }}>

        {/* ── Starfield ── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map((p) => (
            <div key={p.id} className="absolute rounded-full bg-white"
              style={{
                left: `${p.x}%`, top: `${p.y}%`,
                width: `${p.size}px`, height: `${p.size}px`,
                '--op': p.opacity,
                opacity: p.opacity,
                animation: `star-twinkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* ════════════════════════════════════════════
            LEFT PANEL — AI Robot
        ════════════════════════════════════════════ */}
        <div className="hidden lg:flex lg:w-[58%] flex-col items-center justify-center relative px-12 py-10">

          {/* Ambient radial glow behind robot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[480px] h-[480px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(42,157,157,0.13) 0%, transparent 65%)' }} />

          {/* 3-D orbital rings */}
          <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ perspective: '700px', width: '340px', height: '340px' }}>
            <div style={{ animation: 'orbit-ring 9s linear infinite', transformStyle: 'preserve-3d' }}
              className="absolute inset-0 rounded-full border border-teal-500/25 border-dashed" />
            <div style={{ animation: 'orbit-ring2 14s linear infinite', transformStyle: 'preserve-3d' }}
              className="absolute -inset-10 rounded-full border border-teal-400/15" />
          </div>

          {/* ── Robot SVG ── */}
          <div className="robot-float relative z-10 select-none mb-6">
            <svg width="300" height="360" viewBox="0 0 300 360" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="bodyGrad" cx="50%" cy="25%" r="75%">
                  <stop offset="0%" stopColor="#1a2f48" />
                  <stop offset="100%" stopColor="#080f1e" />
                </radialGradient>
                <radialGradient id="platGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#2A9D9D" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#2A9D9D" stopOpacity="0" />
                </radialGradient>
                <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feComposite in="SourceGraphic" in2="b" operator="over" />
                </filter>
                <clipPath id="headClip">
                  <rect x="72" y="50" width="156" height="88" rx="18" />
                </clipPath>
                <clipPath id="visorClip">
                  <rect x="80" y="72" width="140" height="40" rx="8" />
                </clipPath>
              </defs>

              {/* Glow platform */}
              <ellipse cx="150" cy="348" rx="72" ry="11" fill="url(#platGrad)" className="platform-anim" />

              {/* ── Legs ── */}
              <rect x="96" y="238" width="38" height="72" rx="11" fill="url(#bodyGrad)" stroke="#2A9D9D" strokeWidth="1.5" />
              <rect x="166" y="238" width="38" height="72" rx="11" fill="url(#bodyGrad)" stroke="#2A9D9D" strokeWidth="1.5" />
              {/* Feet */}
              <rect x="88"  y="298" width="52" height="20" rx="8" fill="#06111f" stroke="#4ABFBF" strokeWidth="1.2" />
              <rect x="160" y="298" width="52" height="20" rx="8" fill="#06111f" stroke="#4ABFBF" strokeWidth="1.2" />
              {/* Knee joints */}
              <circle cx="115" cy="260" r="5" fill="#2A9D9D" opacity="0.5" />
              <circle cx="185" cy="260" r="5" fill="#2A9D9D" opacity="0.5" />

              {/* ── Body ── */}
              <rect x="72" y="142" width="156" height="106" rx="16" fill="url(#bodyGrad)" stroke="#2A9D9D" strokeWidth="1.8" />

              {/* Chest panel background */}
              <rect x="95" y="158" width="110" height="76" rx="10" fill="#040d1a" stroke="#4ABFBF" strokeWidth="1" />

              {/* Chest accent line top */}
              <rect x="95" y="158" width="110" height="4" rx="2" fill="#2A9D9D" opacity="0.4" />

              {/* Chest lights */}
              <circle cx="123" cy="178" r="7" fill="#2A9D9D" className="chest-blink eye-pulse" style={{ animationDelay: '0s' }} filter="url(#glow)" />
              <circle cx="150" cy="178" r="7" fill="#4ABFBF" className="chest-blink eye-pulse" style={{ animationDelay: '0.5s' }} filter="url(#glow)" />
              <circle cx="177" cy="178" r="7" fill="#2A9D9D" className="chest-blink eye-pulse" style={{ animationDelay: '1s' }} filter="url(#glow)" />

              {/* Circuit lines */}
              <line x1="123" y1="185" x2="123" y2="222" stroke="#2A9D9D" strokeWidth="1" strokeOpacity="0.45" strokeDasharray="4 3" />
              <line x1="150" y1="185" x2="150" y2="222" stroke="#4ABFBF" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 3" />
              <line x1="177" y1="185" x2="177" y2="222" stroke="#2A9D9D" strokeWidth="1" strokeOpacity="0.45" strokeDasharray="4 3" />
              <line x1="100" y1="203" x2="200" y2="203" stroke="#2A9D9D" strokeWidth="0.8" strokeOpacity="0.3" />
              <line x1="100" y1="215" x2="200" y2="215" stroke="#2A9D9D" strokeWidth="0.8" strokeOpacity="0.2" />

              {/* Body side bolts */}
              <circle cx="80"  cy="165" r="4" fill="#0d1c2e" stroke="#2A9D9D" strokeWidth="1" />
              <circle cx="80"  cy="235" r="4" fill="#0d1c2e" stroke="#2A9D9D" strokeWidth="1" />
              <circle cx="220" cy="165" r="4" fill="#0d1c2e" stroke="#2A9D9D" strokeWidth="1" />
              <circle cx="220" cy="235" r="4" fill="#0d1c2e" stroke="#2A9D9D" strokeWidth="1" />

              {/* ── Arms ── */}
              {/* Left arm */}
              <rect x="32" y="148" width="38" height="84" rx="12" fill="url(#bodyGrad)" stroke="#2A9D9D" strokeWidth="1.5" />
              <rect x="28" y="218" width="46" height="28" rx="9" fill="#06111f" stroke="#4ABFBF" strokeWidth="1.2" />
              <circle cx="51" cy="171" r="5" fill="#2A9D9D" opacity="0.3" />

              {/* Right arm */}
              <rect x="230" y="148" width="38" height="84" rx="12" fill="url(#bodyGrad)" stroke="#2A9D9D" strokeWidth="1.5" />
              <rect x="226" y="218" width="46" height="28" rx="9" fill="#06111f" stroke="#4ABFBF" strokeWidth="1.2" />
              <circle cx="249" cy="171" r="5" fill="#2A9D9D" opacity="0.3" />

              {/* ── Neck ── */}
              <rect x="126" y="126" width="48" height="20" rx="7" fill="#0a1628" stroke="#2A9D9D" strokeWidth="1.2" />
              <rect x="133" y="130" width="34" height="4" rx="2" fill="#2A9D9D" opacity="0.3" />

              {/* ── Head ── */}
              <rect x="72" y="50" width="156" height="88" rx="18" fill="url(#bodyGrad)" stroke="#2A9D9D" strokeWidth="2" />

              {/* Head corner accents */}
              <rect x="72"  y="50"  width="16" height="4" rx="2" fill="#4ABFBF" opacity="0.6" />
              <rect x="212" y="50"  width="16" height="4" rx="2" fill="#4ABFBF" opacity="0.6" />
              <rect x="72"  y="134" width="16" height="4" rx="2" fill="#4ABFBF" opacity="0.6" />
              <rect x="212" y="134" width="16" height="4" rx="2" fill="#4ABFBF" opacity="0.6" />

              {/* ── Antenna ── */}
              <rect x="147" y="18" width="6" height="34" rx="3" fill="#4ABFBF" />
              <circle cx="150" cy="14" r="9" fill="#2A9D9D" className="eye-pulse" filter="url(#glow)" />
              <circle cx="150" cy="14" r="5" fill="#4ABFBF" />
              <circle cx="150" cy="14" r="2" fill="white" opacity="0.8" />

              {/* ── Visor / Eyes ── */}
              {/* Eye sockets */}
              <rect x="82"  y="68" width="50" height="34" rx="10" fill="#030b15" />
              <rect x="168" y="68" width="50" height="34" rx="10" fill="#030b15" />

              {/* Eye glow */}
              <rect x="85"  y="71" width="44" height="28" rx="8" fill="#2A9D9D" className="eye-pulse" opacity="0.9" />
              <rect x="171" y="71" width="44" height="28" rx="8" fill="#2A9D9D" className="eye-pulse" opacity="0.9" />

              {/* Eye pupils */}
              <rect x="98"  y="78" width="16" height="14" rx="4" fill="white" opacity="0.92" className="eye-scan" />
              <rect x="184" y="78" width="16" height="14" rx="4" fill="white" opacity="0.92" className="eye-scan" />

              {/* Pupil highlight */}
              <rect x="101" y="80" width="6" height="5" rx="2" fill="white" opacity="0.5" />
              <rect x="187" y="80" width="6" height="5" rx="2" fill="white" opacity="0.5" />

              {/* Scan line across head */}
              <rect x="72" y="0" width="156" height="10" fill="#4ABFBF" opacity="0.12"
                clipPath="url(#headClip)" className="scan-line-anim" />

              {/* ── Mouth grill ── */}
              <rect x="110" y="114" width="80" height="16" rx="6" fill="#030b15" stroke="#2A9D9D" strokeWidth="1" strokeOpacity="0.5" />
              {[118, 130, 142, 150, 162, 174, 182].map((x, i) => (
                <line key={i} x1={x} y1="114" x2={x} y2="130"
                  stroke={x === 150 ? '#4ABFBF' : '#2A9D9D'}
                  strokeWidth={x === 150 ? 1.5 : 1}
                  strokeOpacity={x === 150 ? 0.7 : 0.35} />
              ))}
            </svg>
          </div>

          {/* Branding text */}
          <div className="relative z-10 text-center max-w-md">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-4"
              style={{ background: 'rgba(42,157,157,0.1)', border: '1px solid rgba(42,157,157,0.25)' }}>
              <Library className="w-4 h-4 text-teal-400" />
              <span className="text-teal-300/80 text-sm font-medium">Üsküdar University</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
              AI-Integrated Library System
            </h1>
            <p className="text-white/40 text-sm mb-6 leading-relaxed">
              Your intelligent academic companion. Browse thousands of books,<br />
              get AI-powered study guidance, and manage your learning.
            </p>
            <div className="flex items-center justify-center gap-5 text-xs text-white/35">
              {['Smart Catalog', 'AI Study Help', 'Book Scanning'].map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" style={{ boxShadow: '0 0 4px #2A9D9D' }} />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            RIGHT PANEL — Glass Form
        ════════════════════════════════════════════ */}
        <div className="w-full lg:w-[42%] flex items-center justify-center p-6 relative"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>

          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(42,157,157,0.15)', border: '1px solid rgba(42,157,157,0.35)' }}>
                <Library className="w-5 h-5 text-teal-400" />
              </div>
              <span className="text-white font-semibold">Library System</span>
            </div>

            {/* 3-D tilt card wrapper */}
            <div
              onMouseMove={handleCardMouseMove}
              onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
              <div style={{
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: 'transform 0.15s ease-out',
              }}>
                {/* Traveling border beams container */}
                <div className="relative">
                  <div className="absolute -inset-px rounded-2xl overflow-hidden pointer-events-none z-10">
                    <div className="absolute top-0 left-0 h-px w-1/3 bg-gradient-to-r from-transparent via-teal-400 to-transparent"
                      style={{ animation: 'beam-top 2.8s ease-in-out infinite' }} />
                    <div className="absolute top-0 right-0 h-1/3 w-px bg-gradient-to-b from-transparent via-teal-400 to-transparent"
                      style={{ animation: 'beam-right 2.8s ease-in-out 0.7s infinite' }} />
                    <div className="absolute bottom-0 right-0 h-px w-1/3 bg-gradient-to-r from-transparent via-teal-400 to-transparent"
                      style={{ animation: 'beam-bottom 2.8s ease-in-out 1.4s infinite' }} />
                    <div className="absolute bottom-0 left-0 h-1/3 w-px bg-gradient-to-b from-transparent via-teal-400 to-transparent"
                      style={{ animation: 'beam-left 2.8s ease-in-out 2.1s infinite' }} />
                  </div>

                  {/* Card */}
                  <div className="relative rounded-2xl p-8 overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      backdropFilter: 'blur(28px)',
                      WebkitBackdropFilter: 'blur(28px)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>

                    {/* Subtle inner grid */}
                    <div className="absolute inset-0 opacity-[0.018] pointer-events-none"
                      style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
                        backgroundSize: '36px 36px',
                      }} />

                    {/* Card header */}
                    <div className="text-center mb-8 relative">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'rgba(42,157,157,0.12)', border: '1px solid rgba(42,157,157,0.3)' }}>
                        <Library className="w-7 h-7 text-teal-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-1.5">Welcome Back</h2>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        Sign in to access your library account
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Email */}
                      <div>
                        <label htmlFor="email"
                          className="block text-xs font-semibold mb-1.5 tracking-widest uppercase"
                          style={{ color: 'rgba(255,255,255,0.45)' }}>
                          Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
                            style={{ color: focusedInput === 'email' ? '#4ABFBF' : 'rgba(255,255,255,0.25)' }} />
                          <input
                            id="email" type="email" value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => setFocusedInput('email')}
                            onBlur={() => setFocusedInput(null)}
                            placeholder="your@email.com"
                            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/20 transition-all duration-200 focus:outline-none"
                            style={{
                              background: focusedInput === 'email' ? 'rgba(42,157,157,0.1)' : 'rgba(255,255,255,0.05)',
                              border: focusedInput === 'email' ? '1px solid rgba(74,191,191,0.55)' : '1px solid rgba(255,255,255,0.08)',
                            }}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label htmlFor="password"
                          className="block text-xs font-semibold mb-1.5 tracking-widest uppercase"
                          style={{ color: 'rgba(255,255,255,0.45)' }}>
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
                            style={{ color: focusedInput === 'password' ? '#4ABFBF' : 'rgba(255,255,255,0.25)' }} />
                          <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setFocusedInput('password')}
                            onBlur={() => setFocusedInput(null)}
                            placeholder="••••••••"
                            className="w-full pl-10 pr-12 py-3 rounded-xl text-sm text-white placeholder-white/20 transition-all duration-200 focus:outline-none"
                            style={{
                              background: focusedInput === 'password' ? 'rgba(42,157,157,0.1)' : 'rgba(255,255,255,0.05)',
                              border: focusedInput === 'password' ? '1px solid rgba(74,191,191,0.55)' : '1px solid rgba(255,255,255,0.08)',
                            }}
                            disabled={isSubmitting}
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors hover:text-white/70"
                            style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Remember + Forgot */}
                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded accent-teal-500"
                            style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }} />
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Remember me</span>
                        </label>
                        <Link href="/forgot-password"
                          className="text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors">
                          Forgot password?
                        </Link>
                      </div>

                      {/* Submit */}
                      <button type="submit" disabled={isSubmitting}
                        className="relative w-full mt-2 py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #2A9D9D 0%, #1D7A7A 100%)',
                          boxShadow: '0 0 24px rgba(42,157,157,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                        }}>
                        {/* Shimmer on hover */}
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        {isSubmitting ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
                        ) : (
                          <><span>Sign In</span><ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                        )}
                      </button>
                    </form>

                    {/* Google OAuth */}
                    {googleOAuthEnabled ? (
                      <>
                        <div className="flex items-center gap-3 my-5">
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>or</span>
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                        </div>
                        <a href="/api/auth/google"
                          className="w-full py-3 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-3 transition-all duration-200"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.75)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          Continue with Google
                        </a>
                      </>
                    ) : (
                      <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        Google sign-in is disabled by the administrator.
                      </p>
                    )}

                    <p className="text-center text-sm mt-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Don&apos;t have an account?{' '}
                      <Link href="/signup" className="text-teal-400 hover:text-teal-300 font-medium transition-colors">
                        Sign up
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.18)' }}>
              © 2025 Üsküdar University Library System
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
