'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/api';

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: (i * 43 + 11) % 100,
  y: (i * 61 + 7) % 100,
  size: 1 + (i % 3),
  delay: (i * 0.33) % 5,
  duration: 2.5 + (i % 3) * 0.7,
  opacity: 0.12 + (i % 5) * 0.06,
}));

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [focusedInput, setFocusedInput] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email address'); return; }
    setIsSubmitting(true);
    try {
      await authApi.forgotPassword({ email });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
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
      `}</style>

      <div
        className="min-h-screen flex items-center justify-center p-6 overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#020810 0%,#050d1c 35%,#071020 65%,#020810 100%)' }}
      >
        {/* Starfield */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full bg-white"
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

        <div className="relative w-full max-w-md">

          {/* Traveling-border card */}
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
            <div
              className="relative rounded-2xl p-8 overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Inner grid texture */}
              <div className="absolute inset-0 opacity-[0.018] pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
                  backgroundSize: '36px 36px',
                }} />

              {/* Logo */}
              <div className="flex justify-center mb-6 relative">
                <Image
                  src="/uskudar-logo.png"
                  alt="Üsküdar University"
                  width={140}
                  height={40}
                  className="object-contain"
                />
              </div>

              {submitted ? (
                /* ── Success state ── */
                <div className="text-center relative">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(42,157,157,0.15)', border: '1px solid rgba(42,157,157,0.3)' }}
                  >
                    <CheckCircle className="w-7 h-7 text-teal-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
                  <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    If an account exists with that email, we&apos;ve sent password reset instructions.
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to login
                  </Link>
                </div>
              ) : (
                /* ── Form state ── */
                <>
                  <div className="text-center mb-7 relative">
                    <h2 className="text-2xl font-bold text-white mb-1.5">Forgot Password?</h2>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      Enter your email and we&apos;ll send you a reset link
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5 relative">
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-xs font-semibold mb-1.5 tracking-widest uppercase"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                      >
                        Email address
                      </label>
                      <div className="relative">
                        <Mail
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
                          style={{ color: focusedInput ? '#4ABFBF' : 'rgba(255,255,255,0.25)' }}
                        />
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onFocus={() => setFocusedInput(true)}
                          onBlur={() => setFocusedInput(false)}
                          placeholder="your@email.com"
                          autoFocus
                          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/20 transition-all duration-200 focus:outline-none"
                          style={{
                            background: focusedInput ? 'rgba(42,157,157,0.1)' : 'rgba(255,255,255,0.05)',
                            border: focusedInput ? '1px solid rgba(74,191,191,0.55)' : '1px solid rgba(255,255,255,0.08)',
                          }}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="relative w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, #2A9D9D 0%, #1D7A7A 100%)',
                        boxShadow: '0 0 24px rgba(42,157,157,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                      }}
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      {isSubmitting ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
                      ) : (
                        <><Send className="w-4 h-4" />Send Reset Link</>
                      )}
                    </button>
                  </form>

                  <p className="text-center text-sm mt-5 relative" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-medium transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to login
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.18)' }}>
            © 2025 Üsküdar University Library System
          </p>
        </div>
      </div>
    </>
  );
}
