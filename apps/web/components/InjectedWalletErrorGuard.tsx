'use client';

import { useEffect } from 'react';

const SUPPRESSED_PATTERNS = [
  'window.ethereum.selectedAddress',
  'selectedAddress = undefined',
];

function isInjectedWalletError(message: string): boolean {
  return SUPPRESSED_PATTERNS.some((pattern) => message.includes(pattern));
}

export default function InjectedWalletErrorGuard() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message && isInjectedWalletError(event.message)) {
        event.preventDefault();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === 'string'
          ? reason
          : reason?.message || reason?.stack || '';
      if (isInjectedWalletError(message)) {
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
