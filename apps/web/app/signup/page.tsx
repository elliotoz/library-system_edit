'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Library } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DASHBOARD_ROUTES, Role } from '@/types';

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: (i * 41 + 17) % 100,
  y: (i * 59 + 11) % 100,
  size: 1 + (i % 3),
  delay: (i * 0.28) % 5,
  duration: 2.5 + (i % 3) * 0.8,
  opacity: 0.12 + (i % 5) * 0.07,
}));

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.push(DASHBOARD_ROUTES[user.role as Role]);
    }
  }, [isAuthenticated, user, isLoading, router]);

  useEffect(() => {
    authApi.getConfig()
      .then((c) => setGoogleOAuthEnabled(c.googleOAuthEnabled))
      .catch(() => setGoogleOAuthEnabled(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email || !password || !confirmPassword) {
      toast.error('Please fill in all fields'); return;
    }
    if (name.trim().length < 2) { toast.error('Name must be at least 2 characters'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }

    setIsSubmitting(true);
    try {
      const result = await authApi.register({ name: name.trim(), email, password });
      if (!result.emailSent) {
        toast.error('Account created but the verification email could not be sent. Use "Resend Code" on the next page.', { duration: 8000 });
      } else {
        toast.success(result.message);
      }
      router.push(`/verify-email?email=${encodeURIComponent(result.email)}`);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Registration failed';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 12;
    const y = -((e.clientX - rect.left) / rect.width - 0.5) * 12;
    setTilt({ x, y });
  };

  const inputStyle = (field: string) => ({
    background: focusedInput === field ? 'rgba(42,157,157,0.1)' : 'rgba(255,255,255,0.05)',
    border: focusedInput === field ? '1px solid rgba(74,191,191,0.55)' : '1px solid rgba(255,255,255,0.08)',
  });

  return (
    <>
      <style>{`
        @keyframes robot-float-sm {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50%       { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes eye-pulse-sm {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
        @keyframes orbit-sm {
          from { transform: rotateY(0deg) rotateX(25deg); }
          to   { transform: rotateY(360deg) rotateX(25deg); }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: var(--op); }
          50%       { opacity: calc(var(--op) * 2.2); }
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
        @keyframes scan-line {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 0.4; }
          90%  { opacity: 0.4; }
          100% { transform: translateY(600%); opacity: 0; }
        }
        .robot-float-sm { animation: robot-float-sm 5s ease-in-out infinite; }
        .eye-sm         { animation: eye-pulse-sm 2.2s ease-in-out infinite; }
        .scan-sm        { animation: scan-line 4s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen flex overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#020810 0%,#050d1c 35%,#071020 65%,#020810 100%)' }}>

        {/* Starfield */}
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
            LEFT ACCENT PANEL (lg only) — compact robot
        ════════════════════════════════════════════ */}
        <div className="hidden lg:flex lg:w-[38%] flex-col items-center justify-center relative px-10 py-12">

          {/* Ambient glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(42,157,157,0.12) 0%, transparent 65%)' }} />

          {/* Orbit ring */}
          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ perspective: '600px', width: '260px', height: '260px' }}>
            <div style={{ animation: 'orbit-sm 11s linear infinite', transformStyle: 'preserve-3d' }}
              className="absolute inset-0 rounded-full border border-teal-500/20 border-dashed" />
          </div>

          {/* Compact robot */}
          <div className="robot-float-sm relative z-10 mb-6 select-none">
            <svg width="220" height="270" viewBox="0 0 220 270" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="bGrad2" cx="50%" cy="25%" r="75%">
                  <stop offset="0%" stopColor="#1a2f48" />
                  <stop offset="100%" stopColor="#080f1e" />
                </radialGradient>
                <radialGradient id="platGrad2" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#2A9D9D" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#2A9D9D" stopOpacity="0" />
                </radialGradient>
                <filter id="glow2" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feComposite in="SourceGraphic" in2="b" operator="over" />
                </filter>
                <clipPath id="headClip2">
                  <rect x="48" y="36" width="124" height="68" rx="14" />
                </clipPath>
              </defs>

              {/* Platform */}
              <ellipse cx="110" cy="260" rx="55" ry="9" fill="url(#platGrad2)" />

              {/* Legs */}
              <rect x="70" y="180" width="28" height="54" rx="9" fill="url(#bGrad2)" stroke="#2A9D9D" strokeWidth="1.3" />
              <rect x="122" y="180" width="28" height="54" rx="9" fill="url(#bGrad2)" stroke="#2A9D9D" strokeWidth="1.3" />
              <rect x="64" y="225" width="38" height="16" rx="6" fill="#06111f" stroke="#4ABFBF" strokeWidth="1" />
              <rect x="118" y="225" width="38" height="16" rx="6" fill="#06111f" stroke="#4ABFBF" strokeWidth="1" />

              {/* Body */}
              <rect x="54" y="110" width="112" height="78" rx="13" fill="url(#bGrad2)" stroke="#2A9D9D" strokeWidth="1.5" />

              {/* Chest panel */}
              <rect x="70" y="122" width="80" height="54" rx="8" fill="#040d1a" stroke="#4ABFBF" strokeWidth="0.8" />
              <circle cx="90" cy="138" r="6" fill="#2A9D9D" className="eye-sm" style={{ animationDelay: '0s' }} filter="url(#glow2)" />
              <circle cx="110" cy="138" r="6" fill="#4ABFBF" className="eye-sm" style={{ animationDelay: '0.5s' }} filter="url(#glow2)" />
              <circle cx="130" cy="138" r="6" fill="#2A9D9D" className="eye-sm" style={{ animationDelay: '1s' }} filter="url(#glow2)" />
              <line x1="90" y1="144" x2="90" y2="165" stroke="#2A9D9D" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="3 2" />
              <line x1="110" y1="144" x2="110" y2="165" stroke="#4ABFBF" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="3 2" />
              <line x1="130" y1="144" x2="130" y2="165" stroke="#2A9D9D" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="3 2" />
              <line x1="74" y1="155" x2="146" y2="155" stroke="#2A9D9D" strokeWidth="0.7" strokeOpacity="0.25" />

              {/* Arms */}
              <rect x="22" y="114" width="30" height="62" rx="9" fill="url(#bGrad2)" stroke="#2A9D9D" strokeWidth="1.3" />
              <rect x="19" y="163" width="36" height="22" rx="7" fill="#06111f" stroke="#4ABFBF" strokeWidth="1" />
              <rect x="168" y="114" width="30" height="62" rx="9" fill="url(#bGrad2)" stroke="#2A9D9D" strokeWidth="1.3" />
              <rect x="165" y="163" width="36" height="22" rx="7" fill="#06111f" stroke="#4ABFBF" strokeWidth="1" />

              {/* Neck */}
              <rect x="93" y="98" width="34" height="16" rx="5" fill="#0a1628" stroke="#2A9D9D" strokeWidth="1" />

              {/* Head */}
              <rect x="48" y="36" width="124" height="68" rx="14" fill="url(#bGrad2)" stroke="#2A9D9D" strokeWidth="1.8" />
              {/* Corner accents */}
              <rect x="48"  y="36"  width="12" height="3" rx="1.5" fill="#4ABFBF" opacity="0.5" />
              <rect x="160" y="36"  width="12" height="3" rx="1.5" fill="#4ABFBF" opacity="0.5" />
              <rect x="48"  y="101" width="12" height="3" rx="1.5" fill="#4ABFBF" opacity="0.5" />
              <rect x="160" y="101" width="12" height="3" rx="1.5" fill="#4ABFBF" opacity="0.5" />

              {/* Antenna */}
              <rect x="107" y="12" width="6" height="26" rx="3" fill="#4ABFBF" />
              <circle cx="110" cy="9" r="7" fill="#2A9D9D" className="eye-sm" filter="url(#glow2)" />
              <circle cx="110" cy="9" r="3" fill="white" opacity="0.8" />

              {/* Eyes */}
              <rect x="58"  y="52" width="40" height="26" rx="8" fill="#030b15" />
              <rect x="122" y="52" width="40" height="26" rx="8" fill="#030b15" />
              <rect x="61"  y="55" width="34" height="20" rx="6" fill="#2A9D9D" className="eye-sm" />
              <rect x="125" y="55" width="34" height="20" rx="6" fill="#2A9D9D" className="eye-sm" />
              <rect x="71"  y="60" width="12" height="10" rx="3" fill="white" opacity="0.9" />
              <rect x="135" y="60" width="12" height="10" rx="3" fill="white" opacity="0.9" />

              {/* Scan line */}
              <rect x="48" y="0" width="124" height="8" fill="#4ABFBF" opacity="0.1"
                clipPath="url(#headClip2)" className="scan-sm" />

              {/* Mouth */}
              <rect x="80" y="88" width="60" height="12" rx="5" fill="#030b15" stroke="#2A9D9D" strokeWidth="0.8" strokeOpacity="0.5" />
              {[88, 98, 110, 122, 132].map((x, i) => (
                <line key={i} x1={x} y1="88" x2={x} y2="100"
                  stroke={x === 110 ? '#4ABFBF' : '#2A9D9D'}
                  strokeWidth={x === 110 ? 1.2 : 0.8}
                  strokeOpacity={x === 110 ? 0.65 : 0.3} />
              ))}
            </svg>
          </div>

          {/* Text */}
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
              style={{ background: 'rgba(42,157,157,0.1)', border: '1px solid rgba(42,157,157,0.22)' }}>
              <Library className="w-4 h-4 text-teal-400" />
              <span className="text-teal-300/75 text-sm font-medium">Üsküdar University</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Join the Library</h2>
            <p className="text-white/35 text-sm">Create your account and start exploring.</p>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            RIGHT / MAIN PANEL — Sign Up Glass Card
        ════════════════════════════════════════════ */}
        <div className="w-full lg:w-[62%] flex items-center justify-center p-6 relative"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>

          <div className="w-full max-w-md">
            {/* Mobile header */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(42,157,157,0.15)', border: '1px solid rgba(42,157,157,0.35)' }}>
                <Library className="w-5 h-5 text-teal-400" />
              </div>
              <span className="text-white font-semibold">Library System</span>
            </div>

            {/* 3-D tilt card */}
            <div style={{ perspective: '1200px' }}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
              <div style={{
                transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: 'transform 0.15s ease-out',
                transformStyle: 'preserve-3d',
              }}>
                <div className="relative">
                  {/* Traveling border beams */}
                  <div className="absolute -inset-px rounded-2xl overflow-hidden pointer-events-none z-10">
                    <div className="absolute top-0 left-0 h-px w-1/3 bg-gradient-to-r from-transparent via-teal-400 to-transparent"
                      style={{ animation: 'beam-top 3s ease-in-out infinite' }} />
                    <div className="absolute top-0 right-0 h-1/3 w-px bg-gradient-to-b from-transparent via-teal-400 to-transparent"
                      style={{ animation: 'beam-right 3s ease-in-out 0.75s infinite' }} />
                    <div className="absolute bottom-0 right-0 h-px w-1/3 bg-gradient-to-r from-transparent via-teal-400 to-transparent"
                      style={{ animation: 'beam-bottom 3s ease-in-out 1.5s infinite' }} />
                    <div className="absolute bottom-0 left-0 h-1/3 w-px bg-gradient-to-b from-transparent via-teal-400 to-transparent"
                      style={{ animation: 'beam-left 3s ease-in-out 2.25s infinite' }} />
                  </div>

                  {/* Card body */}
                  <div className="relative rounded-2xl p-8 overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      backdropFilter: 'blur(28px)',
                      WebkitBackdropFilter: 'blur(28px)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>

                    {/* Inner grid texture */}
                    <div className="absolute inset-0 opacity-[0.018] pointer-events-none"
                      style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
                        backgroundSize: '36px 36px',
                      }} />

                    {/* Header */}
                    <div className="text-center mb-7 relative">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'rgba(42,157,157,0.12)', border: '1px solid rgba(42,157,157,0.3)' }}>
                        <Library className="w-7 h-7 text-teal-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-1.5">Create Account</h2>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        Sign up for a library account
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Full name */}
                      <div>
                        <label htmlFor="name"
                          className="block text-xs font-semibold mb-1.5 tracking-widest uppercase"
                          style={{ color: 'rgba(255,255,255,0.45)' }}>
                          Full Name
                        </label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
                            style={{ color: focusedInput === 'name' ? '#4ABFBF' : 'rgba(255,255,255,0.25)' }} />
                          <input
                            id="name" type="text" value={name}
                            onChange={(e) => setName(e.target.value)}
                            onFocus={() => setFocusedInput('name')}
                            onBlur={() => setFocusedInput(null)}
                            placeholder="Your full name"
                            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/20 transition-all duration-200 focus:outline-none"
                            style={inputStyle('name')}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

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
                            style={inputStyle('email')}
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
                            placeholder="At least 6 characters"
                            className="w-full pl-10 pr-12 py-3 rounded-xl text-sm text-white placeholder-white/20 transition-all duration-200 focus:outline-none"
                            style={inputStyle('password')}
                            disabled={isSubmitting}
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors hover:text-white/70"
                            style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm password */}
                      <div>
                        <label htmlFor="confirmPassword"
                          className="block text-xs font-semibold mb-1.5 tracking-widest uppercase"
                          style={{ color: 'rgba(255,255,255,0.45)' }}>
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
                            style={{ color: focusedInput === 'confirmPassword' ? '#4ABFBF' : 'rgba(255,255,255,0.25)' }} />
                          <input
                            id="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onFocus={() => setFocusedInput('confirmPassword')}
                            onBlur={() => setFocusedInput(null)}
                            placeholder="Re-enter your password"
                            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/20 transition-all duration-200 focus:outline-none"
                            style={inputStyle('confirmPassword')}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      {/* Submit */}
                      <button type="submit" disabled={isSubmitting}
                        className="relative w-full mt-1 py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #2A9D9D 0%, #1D7A7A 100%)',
                          boxShadow: '0 0 24px rgba(42,157,157,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                        }}>
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        {isSubmitting ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
                        ) : (
                          <><span>Create Account</span><ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                        )}
                      </button>
                    </form>

                    {/* Google */}
                    {googleOAuthEnabled ? (
                      <>
                        <div className="flex items-center gap-3 my-5">
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>or</span>
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                        </div>
                        <a href="/api/auth/google"
                          className="w-full py-3 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-3 transition-all duration-200"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}
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
                      Already have an account?{' '}
                      <Link href="/login" className="text-teal-400 hover:text-teal-300 font-medium transition-colors">
                        Sign in
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
