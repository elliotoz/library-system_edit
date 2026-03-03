'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Mail, Library, CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/api';

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

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !code.trim()) {
      toast.error('Please enter your email and verification code');
      return;
    }

    setIsVerifying(true);

    try {
      const result = await authApi.verifyEmail({ email, code: code.trim() });
      toast.success(result.message);
      setVerified(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Verification failed';
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsResending(true);

    try {
      const result = await authApi.resendVerification({ email });
      toast.success(result.message);
      setCooldown(60);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Failed to resend code';
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
          <p className="text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
            <Library className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-gray-900">Library System</span>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
            <p className="text-gray-500">
              Enter the 6-digit code sent to your email
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            {/* Email (pre-filled or manual) */}
            {!emailParam && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  disabled={isVerifying}
                />
              </div>
            )}

            {emailParam && (
              <p className="text-sm text-gray-600 text-center">
                Code sent to <span className="font-medium text-gray-900">{emailParam}</span>
              </p>
            )}

            {/* Verification Code */}
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1.5">
                Verification code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all text-gray-900 placeholder-gray-400 text-center text-2xl tracking-[0.5em] font-mono"
                disabled={isVerifying}
                autoFocus
              />
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          {/* Resend */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-500 mb-2">Didn&apos;t receive a code?</p>
            <button
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : isResending ? 'Sending...' : 'Resend code'}
            </button>
          </div>

          {/* Back to login */}
          <p className="text-center text-sm text-gray-500 mt-4">
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Back to login
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2025 Üsküdar University Library System
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
