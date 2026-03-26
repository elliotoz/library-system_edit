'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Mail, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { authApi } from '@/lib/api';

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: (i * 39 + 17) % 100,
  y: (i * 63 + 5) % 100,
  size: 1 + (i % 3),
  delay: (i * 0.27) % 5,
  duration: 2.5 + (i % 3) * 0.7,
  opacity: 0.12 + (i % 5) * 0.06,
}));

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code.trim()) { toast.error('Please enter your email and verification code'); return; }
    setIsVerifying(true);
    try {
      const result = await authApi.verifyEmail({ email, code: code.trim() });
      toast.success(result.message);
      setVerified(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) { toast.error('Please enter your email address'); return; }
    setIsResending(true);
    try {
      const result = await authApi.resendVerification({ email });
      toast.success(result.message);
      setCooldown(60);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  const pageStyle = { background: 'linear-gradient(135deg,#020810 0%,#050d1c 35%,#071020 65%,#020810 100%)' };

  /* ── Verified success ── */
  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 overflow-hidden" style={pageStyle}>
        <div className="text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(42,157,157,0.15)', border: '1px solid rgba(42,157,157,0.3)' }}>
            <CheckCircle className="w-10 h-10 text-teal-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Email Verified!</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: var(--op); transform: scale(1); }
          50%       { opacity: calc(var(--op) * 2); transform: scale(1.4); }
        }
        @keyframes beam-top { 0% { transform:translateX(-120%); } 100% { transform:translateX(320%); } }
        @keyframes beam-right { 0% { transform:translateY(-120%); } 100% { transform:translateY(320%); } }
        @keyframes beam-bottom { 0% { transform:translateX(120%); } 100% { transform:translateX(-320%); } }
        @keyframes beam-left { 0% { transform:translateY(120%); } 100% { transform:translateY(-320%); } }
      `}</style>

      <div className="min-h-screen flex items-center justify-center p-6 overflow-hidden" style={pageStyle}>
        {/* Starfield */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map((p) => (
            <div key={p.id} className="absolute rounded-full bg-white"
              style={{
                left: `${p.x}%`, top: `${p.y}%`,
                width: `${p.size}px`, height: `${p.size}px`,
                '--op': p.opacity, opacity: p.opacity,
                animation: `star-twinkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
              } as React.CSSProperties} />
          ))}
        </div>

        <div className="relative w-full max-w-md">
          <div className="relative">
            {/* Traveling beams */}
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
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="absolute inset-0 opacity-[0.018] pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '36px 36px' }} />

              {/* Logo */}
              <div className="flex justify-center mb-6 relative">
                <Image src="/uskudar-logo.png" alt="Üsküdar University" width={140} height={40} className="object-contain" />
              </div>

              {/* Header */}
              <div className="text-center mb-7 relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(42,157,157,0.15)', border: '1px solid rgba(42,157,157,0.25)' }}>
                  <Mail className="w-5 h-5 text-teal-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1.5">Verify Your Email</h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Enter the 6-digit code sent to your email
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4 relative">
                {/* Email field — shown only when not pre-filled */}
                {!emailParam && (
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold mb-1.5 tracking-widest uppercase"
                      style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Email address
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
                        disabled={isVerifying}
                      />
                    </div>
                  </div>
                )}

                {emailParam && (
                  <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Code sent to{' '}
                    <span className="font-semibold text-white">{emailParam}</span>
                  </p>
                )}

                {/* Verification code — large mono input */}
                <div>
                  <label htmlFor="code" className="block text-xs font-semibold mb-1.5 tracking-widest uppercase"
                    style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Verification code
                  </label>
                  <input
                    id="code" type="text" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onFocus={() => setFocusedInput('code')}
                    onBlur={() => setFocusedInput(null)}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    className="w-full px-4 py-4 rounded-xl text-white placeholder-white/15 text-center text-3xl tracking-[0.6em] font-mono transition-all duration-200 focus:outline-none"
                    style={{
                      background: focusedInput === 'code' ? 'rgba(42,157,157,0.1)' : 'rgba(255,255,255,0.05)',
                      border: focusedInput === 'code' ? '1px solid rgba(74,191,191,0.55)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                    disabled={isVerifying}
                  />
                </div>

                {/* Verify button */}
                <button
                  type="submit"
                  disabled={isVerifying || code.length !== 6}
                  className="relative w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #2A9D9D 0%, #1D7A7A 100%)',
                    boxShadow: '0 0 24px rgba(42,157,157,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                  }}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {isVerifying ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" />Verify Email</>
                  )}
                </button>
              </form>

              {/* Resend */}
              <div className="text-center mt-5 relative">
                <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Didn&apos;t receive a code?
                </p>
                <button
                  onClick={handleResend}
                  disabled={isResending || cooldown > 0}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors disabled:text-white/25 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : isResending ? 'Sending…' : 'Resend code'}
                </button>
              </div>

              <p className="text-center text-sm mt-4 relative" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Link href="/login"
                  className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-medium transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to login
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.18)' }}>
            © {new Date().getFullYear()} Üsküdar University Library System
          </p>
        </div>
      </div>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#020810 0%,#050d1c 35%,#071020 65%,#020810 100%)' }}>
        <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
