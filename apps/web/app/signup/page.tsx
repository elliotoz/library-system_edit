'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { authApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DASHBOARD_ROUTES, Role } from '@/types';
import { SplineScene } from '@/components/ui/spline-scene';
import { Spotlight } from '@/components/ui/spotlight';

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
            LEFT ACCENT PANEL (lg only) — 3D AI Robot (Spline)
        ════════════════════════════════════════════ */}
        <div className="hidden lg:flex lg:w-[38%] flex-col items-center justify-center relative px-10 py-12">

          {/* Spline 3D scene */}
          <div className="relative w-full flex-1 min-h-0">
            <Spotlight className="-top-40 left-0 md:left-20 md:-top-20" fill="rgba(42,157,157,0.4)" />
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full"
            />
          </div>

          {/* Text */}
          <div className="relative z-10 text-center mt-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
              style={{ background: 'rgba(42,157,157,0.1)', border: '1px solid rgba(42,157,157,0.22)' }}>
              <Image
                src="https://uskudar.edu.tr/assets/kurumsal/logo/png/uskudar-universitesi-logo.png"
                alt="Üsküdar University"
                width={20}
                height={20}
                className="object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                style={{ background: 'rgba(42,157,157,0.15)', border: '1px solid rgba(42,157,157,0.35)' }}>
                <Image
                  src="https://uskudar.edu.tr/assets/kurumsal/logo/png/uskudar-universitesi-logo.png"
                  alt="Üsküdar University"
                  width={28}
                  height={28}
                  className="object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </div>
              <span className="text-white font-semibold">Library System</span>
            </div>

            {/* 3-D tilt card */}
            <div
              onMouseMove={handleCardMouseMove}
              onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
              <div style={{
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: 'transform 0.15s ease-out',
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
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden"
                        style={{ background: 'rgba(42,157,157,0.12)', border: '1px solid rgba(42,157,157,0.3)' }}>
                        <Image
                          src="https://uskudar.edu.tr/assets/kurumsal/logo/png/uskudar-universitesi-logo.png"
                          alt="Üsküdar University"
                          width={40}
                          height={40}
                          className="object-contain"
                          style={{ filter: 'brightness(0) invert(1)' }}
                        />
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
