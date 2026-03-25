'use client';

import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Show traveling teal border beams */
  beams?: boolean;
  /** Apply SVG liquid-glass turbulence filter to the border */
  liquid?: boolean;
}

/**
 * GlassCard — frosted glass surface with optional border beams and liquid filter.
 *
 * Uses CSS variables (--glass-bg, --glass-border, etc.) that auto-switch
 * between light and dark mode via .dark class on <html>.
 *
 * For Link/button wrappers, nest this inside the interactive element:
 *   <Link href="..."><GlassCard>…</GlassCard></Link>
 */
export function GlassCard({ beams = false, liquid = false, className, children, ...props }: GlassCardProps) {
  return (
    <div
      className={cn('glass-card', liquid && 'glass-liquid', className)}
      {...props}
    >
      {/* Traveling border beams */}
      {beams && (
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
    </div>
  );
}
