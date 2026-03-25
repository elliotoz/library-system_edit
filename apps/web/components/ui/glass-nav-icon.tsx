'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

interface GlassNavIconProps {
  icon: ComponentType<LucideProps>;
  active?: boolean;
  /** Size in px — defaults to 36 */
  size?: number;
  className?: string;
}

/**
 * Layered glass nav icon — 4 composited layers:
 *   1. Gradient background blob (teal, visible only when active)
 *   2. Frosted glass disc
 *   3. Crisp Lucide icon symbol
 *   4. Specular highlight arc (top edge)
 */
export function GlassNavIcon({ icon: Icon, active = false, size = 36, className }: GlassNavIconProps) {
  return (
    <motion.div
      className={cn('relative flex-shrink-0 flex items-center justify-center rounded-xl', className)}
      style={{ width: size, height: size }}
      animate={{ scale: active ? 1 : 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
    >
      {/* Layer 1 — gradient glow (active only) */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(42,157,157,0.9) 0%, rgba(23,102,102,0.95) 100%)',
          filter: 'blur(0px)',
        }}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Layer 2 — frosted glass disc */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: active
            ? 'rgba(255,255,255,0.15)'
            : 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: active
            ? '1px solid rgba(255,255,255,0.25)'
            : '1px solid rgba(255,255,255,0.08)',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      />

      {/* Layer 3 — symbol */}
      <Icon
        className="relative z-10"
        style={{
          width: size * 0.44,
          height: size * 0.44,
          color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
          transition: 'color 0.2s',
        }}
      />

      {/* Layer 4 — specular highlight (top edge) */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top: 3,
          left: '20%',
          right: '20%',
          height: 1,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.55)',
          opacity: active ? 0.7 : 0.35,
          transition: 'opacity 0.2s',
        }}
      />
    </motion.div>
  );
}
