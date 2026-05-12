// app/layout.tsx
import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import 'katex/dist/katex.min.css';
import { AuthProvider } from '@/hooks/useAuth';

export const metadata: Metadata = {
  title: 'Library System - Üsküdar University',
  description: 'AI-Integrated University Library System',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                style: {
                  background: '#48BB78',
                },
              },
              error: {
                duration: 4000,
                style: {
                  background: '#F56565',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
