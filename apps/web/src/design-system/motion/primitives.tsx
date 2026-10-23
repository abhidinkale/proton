/**
 * Proton Motion Primitives
 *
 * One opinionated motion layer so the product moves like a single system
 * instead of a pile of ad-hoc transitions.
 *
 * Rules:
 *   1. Motion communicates state change (arrival, elevation, focus). It never
 *      decorates a clinical fact.
 *   2. Nothing runs longer than 420ms. Clinicians are the users; latency reads
 *      as unreliability.
 *   3. `prefers-reduced-motion` is honoured globally through
 *      <MotionConfig reducedMotion="user"> in AppShell, and every component here
 *      also degrades on its own.
 *   4. Springs share the same damping; the easing curve matches
 *      PDS_TOKENS.motion.
 */

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants
} from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';

/** Shared curve. Mirrors PDS_TOKENS.motion.transition. */
export const PROTON_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const PROTON_SPRING = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.8
} as const;

const REVEAL_HIDDEN = { opacity: 0, y: 10, filter: 'blur(4px)' } as const;
const REVEAL_VISIBLE = { opacity: 1, y: 0, filter: 'blur(0px)' } as const;

function revealVariants(delay: number): Variants {
  return {
    hidden: REVEAL_HIDDEN,
    visible: {
      ...REVEAL_VISIBLE,
      transition: { duration: 0.4, ease: PROTON_EASE, delay }
    }
  };
}

const REVEAL_REDUCED: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } }
};

export interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
  /** Seconds. Keep under 0.35 so long lists stay responsive. */
  delay?: number;
}

/**
 * Fade + rise + de-blur on mount. Use for page sections and cards.
 */
export function Reveal({ children, delay = 0, className = '', ...rest }: RevealProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={reduced ? REVEAL_REDUCED : revealVariants(delay)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** Seconds between children. 0.05–0.08 reads as intentional, not slow. */
  stagger?: number;
  delayChildren?: number;
}

/**
 * Container that cascades <StaggerItem> children.
 */
export function Stagger({
  children,
  className = '',
  stagger = 0.06,
  delayChildren = 0.04
}: StaggerProps) {
  const reduced = useReducedMotion();

  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduced ? 0 : stagger,
        delayChildren: reduced ? 0 : delayChildren
      }
    }
  };

  return (
    <motion.div className={className} initial="hidden" animate="visible" variants={variants}>
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
}

export function StaggerItem({ children, className = '', ...rest }: StaggerItemProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={reduced ? REVEAL_REDUCED : revealVariants(0)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Route-level entrance. Replays on navigation, enter-only.
 * Exit animations make a clinical workstation feel sluggish.
 */
export function PageTransition({
  children,
  routeKey,
  className = ''
}: {
  children: ReactNode;
  routeKey: string;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      key={routeKey}
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: PROTON_EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Card/button lift. Translates and springs back; never scales text.
 */
export function HoverLift({
  children,
  className = '',
  disabled = false,
  ...rest
}: RevealProps & { disabled?: boolean }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={disabled || reduced ? undefined : { y: -2 }}
      whileTap={disabled || reduced ? undefined : { y: 0, scale: 0.995 }}
      transition={PROTON_SPRING}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * A status dot that breathes. Used for "live capture" / "connected" states.
 * With reduced motion it renders a solid dot instead of pulsing.
 */
export function LiveDot({
  className = '',
  color = '#10B981',
  size = 8
}: {
  className?: string;
  color?: string;
  size?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {!reduced && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: color }}
          animate={{ scale: [1, 2.4, 1], opacity: [0.45, 0, 0.45] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <span className="relative rounded-full" style={{ width: size, height: size, backgroundColor: color }} />
    </span>
  );
}

/** Cubic ease-out used by numeric tickers. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Number that counts up once on mount. Used for KPI tiles.
 * Jumps straight to the final value when reduced motion is requested.
 */
export function CountUp({
  value,
  duration = 0.9,
  decimals = 0,
  suffix = '',
  prefix = ''
}: {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }

    const startedAt = performance.now();
    setDisplay(0);

    // setInterval rather than requestAnimationFrame: tickers must still settle
    // when the tab is backgrounded or the page is not being painted.
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / (duration * 1000));
      setDisplay(value * easeOut(progress));
      if (progress >= 1) window.clearInterval(timer);
    }, 16);

    return () => window.clearInterval(timer);
  }, [value, duration, reduced]);

  return (
    <span className="tabular-nums">
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export { motion, useReducedMotion };
