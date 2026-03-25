'use client';

import { useState, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiquidGlassSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Show filter chips next to the search bar */
  chips?: { label: string; onRemove: () => void }[];
}

const SPRING = { type: 'spring' as const, stiffness: 340, damping: 28 };

export function LiquidGlassSearch({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  chips = [],
}: LiquidGlassSearchProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  return (
    <motion.div
      layout
      className={cn('flex items-center gap-2 flex-wrap', className)}
      transition={SPRING}
    >
      {/* Glass search pill */}
      <motion.div
        layout
        className="glass-search relative flex items-center gap-2 rounded-2xl px-3 py-2"
        animate={{
          boxShadow: focused
            ? '0 0 0 2px rgba(74,191,191,0.45), 0 4px 20px rgba(0,0,0,0.08)'
            : '0 2px 12px rgba(0,0,0,0.05)',
        }}
        transition={{ duration: 0.2 }}
        style={{ minWidth: 220 }}
      >
        {/* Search icon — morphs to spinner when typing */}
        <motion.div
          animate={{ rotate: focused && value ? 20 : 0, scale: focused ? 1.1 : 1 }}
          transition={SPRING}
        >
          <Search
            className="w-4 h-4 flex-shrink-0"
            style={{ color: focused ? 'rgba(74,191,191,0.9)' : 'rgba(var(--foreground-rgb),0.35)' }}
          />
        </motion.div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none min-w-0"
          style={{
            color: 'rgb(var(--foreground-rgb))',
            caretColor: '#4ABFBF',
          }}
        />

        {/* Clear button — appears with spring when value is not empty */}
        <AnimatePresence>
          {value && (
            <motion.button
              key="clear"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={SPRING}
              type="button"
              onClick={() => { onChange(''); inputRef.current?.focus(); }}
              className="flex-shrink-0 rounded-full p-0.5 transition-colors"
              style={{ color: 'rgba(var(--foreground-rgb),0.4)' }}
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Active filter chips — staggered entrance */}
      <AnimatePresence>
        {chips.map((chip, i) => (
          <motion.div
            key={chip.label}
            initial={{ opacity: 0, scale: 0.75, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.75, x: -8 }}
            transition={{ ...SPRING, delay: i * 0.04 }}
            className="glass-search flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ color: 'rgb(var(--foreground-rgb))' }}
          >
            {chip.label}
            <button
              type="button"
              onClick={chip.onRemove}
              className="rounded-full opacity-50 hover:opacity-100 transition-opacity"
              aria-label={`Remove ${chip.label} filter`}
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
