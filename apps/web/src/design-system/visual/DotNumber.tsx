/**
 * Dot-matrix numerals and sparklines.
 *
 * The dashboard's signature detail: values are drawn as a 5×7 dot matrix so a
 * number reads as instrument output rather than body copy. Everything is plain
 * SVG/markup with an accessible text fallback.
 */

const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000']
};

export interface DotNumberProps {
  value: string | number;
  /** Dot radius in px. */
  dot?: number;
  /** Center-to-center pitch in px. */
  pitch?: number;
  color?: string;
  className?: string;
  /** Spoken value; defaults to the rendered string. */
  label?: string;
}

export function DotNumber({
  value,
  dot = 1.7,
  pitch = 5.2,
  color = 'currentColor',
  className = '',
  label
}: DotNumberProps) {
  const text = String(value);
  const glyphWidth = 5 * pitch;
  const charGap = pitch * 0.85;

  const circles: Array<{ cx: number; cy: number; key: string }> = [];

  text.split('').forEach((character, charIndex) => {
    const glyph = GLYPHS[character];
    if (!glyph) return;
    const originX = charIndex * (glyphWidth + charGap);

    glyph.forEach((row, rowIndex) => {
      row.split('').forEach((bit, columnIndex) => {
        if (bit !== '1') return;
        circles.push({
          key: `${charIndex}-${rowIndex}-${columnIndex}`,
          cx: originX + columnIndex * pitch + pitch / 2,
          cy: rowIndex * pitch + pitch / 2
        });
      });
    });
  });

  const width = text.length * glyphWidth + Math.max(0, text.length - 1) * charGap;
  const height = 7 * pitch;

  return (
    <span className={`inline-flex ${className}`}>
      <span className="sr-only">{label ?? text}</span>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ color }}
        className="overflow-visible"
      >
        {circles.map((circle) => (
          <circle key={circle.key} cx={circle.cx} cy={circle.cy} r={dot} fill="currentColor" />
        ))}
      </svg>
    </span>
  );
}

export interface DotWaveProps {
  /** Normalised samples, 0–1. */
  values: number[];
  color?: string;
  dot?: number;
  className?: string;
}

/** Dotted trend line. Absolute dots keep circles round at any width. */
export function DotWave({ values, color = 'currentColor', dot = 2.5, className = '' }: DotWaveProps) {
  if (values.length < 2) return null;

  return (
    <div className={`relative ${className}`} aria-hidden="true">
      {values.map((value, index) => {
        const clamped = Math.min(1, Math.max(0, value));
        return (
          <span
            key={index}
            className="absolute rounded-full"
            style={{
              left: `${(index / (values.length - 1)) * 100}%`,
              top: `${(1 - clamped) * 100}%`,
              width: dot,
              height: dot,
              background: color,
              transform: 'translate(-50%, -50%)',
              opacity: 0.55 + clamped * 0.45
            }}
          />
        );
      })}
    </div>
  );
}

export interface DotScaleProps {
  /** Number of dots. */
  count?: number;
  /** How many dots are filled. */
  filled: number;
  color?: string;
  className?: string;
}

/** Compact dotted meter — used where a bar chart would be too heavy. */
export function DotScale({ count = 11, filled, color = 'currentColor', className = '' }: DotScaleProps) {
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          className="w-[2px] rounded-full"
          style={{
            height: 4 + index * 1.6,
            background: color,
            opacity: index < filled ? 0.95 : 0.22
          }}
        />
      ))}
    </div>
  );
}
