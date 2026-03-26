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
  /** Pass current dark mode state so icon contrast is correct in both modes */
  darkMode?: boolean;
}

/**
 * Layered glass nav icon — 4 composited layers:
 *   1. Gradient background blob (teal, visible only when active)
 *   2. Frosted glass disc
 *   3. Crisp Lucide icon symbol
 *   4. Specular highlight arc (top edge)
 */
export function GlassNavIcon({ icon: Icon, active = false, size = 36, className, darkMode = false }: GlassNavIconProps) {
  // Icon color: dark mode keeps white; light mode uses teal (active) or dark gray (inactive)
  const iconColor = active
    ? darkMode ? 'rgba(255,255,255,0.95)' : 'rgba(20,140,140,1)'
    : darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(70,85,105,0.75)';

  // Disc bg: dark mode uses white overlay; light mode uses subtle dark overlay
  const discBg = active
    ? 'rgba(255,255,255,0.15)'
    : darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  const discBorder = active
    ? 'rgba(255,255,255,0.25)'
    : darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

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
          background: darkMode
            ? 'linear-gradient(135deg, rgba(42,157,157,0.9) 0%, rgba(23,102,102,0.95) 100%)'
            : 'linear-gradient(135deg, rgba(42,157,157,0.18) 0%, rgba(23,102,102,0.22) 100%)',
          filter: 'blur(0px)',
        }}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Layer 2 — frosted glass disc */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: discBg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${discBorder}`,
          transition: 'background 0.2s, border-color 0.2s',
        }}
      />

      {/* Layer 3 — symbol */}
      <Icon
        className="relative z-10"
        style={{
          width: size * 0.44,
          height: size * 0.44,
          color: iconColor,
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
