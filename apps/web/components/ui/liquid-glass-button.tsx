'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LiquidGlassButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  /** 'primary' = teal accent + beams (one per screen max). 'secondary' = achromatic glass. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Show traveling border beams — only meaningful on primary variant */
  beams?: boolean;
  children: React.ReactNode;
}

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 22 };

export function LiquidGlassButton({
  variant = 'secondary',
  beams = false,
  className,
  children,
  disabled,
  ...props
}: LiquidGlassButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.025 }}
      whileTap={disabled  ? {} : { scale: 0.93 }}
      transition={SPRING}
      disabled={disabled}
      className={cn(
        'glass-button inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold',
        variant === 'primary'   && 'glass-button-primary',
        variant === 'ghost'     && 'border-transparent bg-transparent shadow-none backdrop-filter-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {/* Traveling beams — primary only */}
      {beams && variant === 'primary' && !disabled && (
        <div
          aria-hidden="true"
          className="absolute -inset-px overflow-hidden pointer-events-none z-20"
          style={{ borderRadius: 'inherit' }}
        >
          <div className="beam beam-top"    />
          <div className="beam beam-right"  />
          <div className="beam beam-bottom" />
          <div className="beam beam-left"   />
        </div>
      )}
      {children}
    </motion.button>
  );
}
