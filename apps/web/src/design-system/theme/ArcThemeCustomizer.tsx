import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Sun, Moon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export type ArcThemeMode = 'auto' | 'light' | 'dark';
export type ArcTextureType = 'grain' | 'plain' | 'stipple' | 'frost';

export interface ArcColorSwatch {
  id: string;
  name: string;
  hex: string;
  hue: number;
}

export const ARC_SWATCHES: ArcColorSwatch[] = [
  { id: 'cream', name: 'Alabaster', hex: '#F5EBE1', hue: 35 },
  { id: 'pink', name: 'Rose', hex: '#F472B6', hue: 330 },
  { id: 'plum', name: 'Plum', hex: '#9333EA', hue: 280 },
  { id: 'crimson', name: 'Crimson', hex: '#EF4444', hue: 0 },
  { id: 'orange', name: 'Tangerine', hex: '#F97316', hue: 25 },
  { id: 'yellow', name: 'Amber Gold', hex: '#FBBF24', hue: 45 },
  { id: 'green', name: 'Mint Green', hex: '#10B981', hue: 155 },
  { id: 'cyan', name: 'Sky Cyan', hex: '#06B6D4', hue: 195 },
  { id: 'slate', name: 'Periwinkle Slate', hex: '#6366F1', hue: 235 }
];

export interface ArcTextureDef {
  id: ArcTextureType;
  label: string;
  subtitle: string;
  blendDark: string;
  blendLight: string;
  svgUrl: string;
}

export const ARC_TEXTURE_MAP: Record<ArcTextureType, ArcTextureDef> = {
  grain: {
    id: 'grain',
    label: 'Grain',
    subtitle: 'Classic Film Grain',
    blendDark: 'overlay',
    blendLight: 'multiply',
    svgUrl: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")"
  },
  plain: {
    id: 'plain',
    label: 'Plain',
    subtitle: 'Pure Matte Smooth',
    blendDark: 'normal',
    blendLight: 'normal',
    svgUrl: 'none'
  },
  stipple: {
    id: 'stipple',
    label: 'Stipple',
    subtitle: 'Micro Dot Matrix',
    blendDark: 'soft-light',
    blendLight: 'multiply',
    svgUrl: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='stippleFilter'%3E%3CfeTurbulence type='turbulence' baseFrequency='1.25' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23stippleFilter)'/%3E%3C/svg%3E\")"
  },
  frost: {
    id: 'frost',
    label: 'Frost',
    subtitle: 'Frosted Glass Mist',
    blendDark: 'screen',
    blendLight: 'overlay',
    svgUrl: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='frostFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.05' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23frostFilter)' opacity='0.7'/%3E%3C/svg%3E\")"
  }
};

export const TEXTURE_CYCLE_ORDER: ArcTextureType[] = ['grain', 'plain', 'stipple', 'frost'];

export interface ArcThemeConfig {
  mode: ArcThemeMode;
  swatchId: string;
  hue: number;
  saturation: number; // 0 to 100
  puckX: number; // 0 to 100
  puckY: number; // 0 to 100
  textureIntensity: number; // 0.05 to 0.45
  textureType: ArcTextureType;
}

const STORAGE_KEY = 'proton.arc_theme';

const DEFAULT_THEME: ArcThemeConfig = {
  mode: 'dark',
  swatchId: 'slate',
  hue: 235,
  saturation: 65,
  puckX: 25,
  puckY: 52,
  textureIntensity: 0.25,
  textureType: 'grain'
};

// ── Physical Mechanical Click Sound & Vibration (Haptic Feedback) ──
let audioCtx: AudioContext | null = null;
function triggerHapticFeedback(freq = 1400) {
  // 1. Hardware vibration
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
    } catch {
      // ignore
    }
  }

  // 2. Synthesized physical mechanical dial click sound
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtx && AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.045, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.018);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.019);
    }
  } catch {
    // ignore
  }
}

export function readStoredArcTheme(): ArcThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_THEME, ...parsed };
    }
  } catch {
    // fallback
  }
  return DEFAULT_THEME;
}

export function applyArcThemeToDOM(config: ArcThemeConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const isDark =
    config.mode === 'dark' ||
    (config.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.style.colorScheme = isDark ? 'dark' : 'light';
  root.dataset.theme = isDark ? 'midnight' : 'clinic';

  const h = config.hue;
  const s = config.saturation;
  const texType = config.textureType || 'grain';
  const texDef = ARC_TEXTURE_MAP[texType] || ARC_TEXTURE_MAP.grain;

  // Set the live texture grain intensity, pattern, and blend mode
  const effectiveOpacity = texType === 'plain' ? 0 : config.textureIntensity;
  root.style.setProperty('--arc-texture-opacity', String(effectiveOpacity));
  root.style.setProperty('--arc-texture-image', texDef.svgUrl);
  root.style.setProperty('--arc-texture-blend', isDark ? texDef.blendDark : texDef.blendLight);

  if (isDark) {
    // Arc Dark Palette - High Contrast & Guaranteed WCAG Legibility
    const canvasL = 10 + Math.round((config.puckY / 100) * 7);
    const paperL = canvasL + 4;
    const paper2L = canvasL + 8;
    const ruleL = canvasL + 12;

    root.style.setProperty('--c-canvas', `hsl(${h}, ${Math.round(s * 0.42)}%, ${canvasL}%)`);
    root.style.setProperty('--c-paper', `hsl(${h}, ${Math.round(s * 0.38)}%, ${paperL}%)`);
    root.style.setProperty('--c-paper-2', `hsl(${h}, ${Math.round(s * 0.32)}%, ${paper2L}%)`);
    root.style.setProperty('--c-rule', `hsl(${h}, ${Math.round(s * 0.22)}%, ${ruleL}%)`);
    root.style.setProperty('--c-rule-strong', `hsl(${h}, ${Math.round(s * 0.22)}%, ${ruleL + 8}%)`);

    // Crisp high-contrast ink for dark backgrounds
    root.style.setProperty('--c-ink', `hsl(${h}, 10%, 98%)`);
    root.style.setProperty('--c-ink-2', `hsl(${h}, 12%, 84%)`);
    root.style.setProperty('--c-ink-3', `hsl(${h}, 10%, 68%)`);

    root.style.setProperty('--accent', `hsl(${h}, ${Math.max(50, Math.round(s * 0.95))}%, 62%)`);
    root.style.setProperty('--accent-wash', `hsla(${h}, ${s}%, 60%, 0.18)`);
    root.style.setProperty('--accent-line', `hsla(${h}, ${s}%, 65%, 0.35)`);
    root.style.setProperty('--accent-ink', `hsl(${h}, 35%, 96%)`);

    root.style.setProperty('--c-solid', '#ffffff');
    root.style.setProperty('--c-on-solid', '#090a0f');
  } else {
    // Arc Light Palette - Deep High-Contrast Ink for Light Backgrounds
    const canvasL = 93 + Math.round((config.puckY / 100) * 4);
    const paperL = 100;
    const paper2L = 94;
    const ruleL = 87;

    root.style.setProperty('--c-canvas', `hsl(${h}, ${Math.round(s * 0.45)}%, ${canvasL}%)`);
    root.style.setProperty('--c-paper', `hsl(${h}, 15%, ${paperL}%)`);
    root.style.setProperty('--c-paper-2', `hsl(${h}, ${Math.round(s * 0.35)}%, ${paper2L}%)`);
    root.style.setProperty('--c-rule', `hsl(${h}, ${Math.round(s * 0.25)}%, ${ruleL}%)`);
    root.style.setProperty('--c-rule-strong', `hsl(${h}, ${Math.round(s * 0.25)}%, ${ruleL - 8}%)`);

    // Deep rich charcoal ink for pure white/light backgrounds
    root.style.setProperty('--c-ink', `hsl(${h}, 35%, 8%)`);
    root.style.setProperty('--c-ink-2', `hsl(${h}, 25%, 26%)`);
    root.style.setProperty('--c-ink-3', `hsl(${h}, 18%, 44%)`);

    root.style.setProperty('--accent', `hsl(${h}, ${Math.max(45, s)}%, 42%)`);
    root.style.setProperty('--accent-wash', `hsla(${h}, ${s}%, 50%, 0.12)`);
    root.style.setProperty('--accent-line', `hsla(${h}, ${s}%, 50%, 0.28)`);
    root.style.setProperty('--accent-ink', `hsl(${h}, 60%, 20%)`);

    root.style.setProperty('--c-solid', `hsl(${h}, 35%, 12%)`);
    root.style.setProperty('--c-on-solid', '#ffffff');
  }
}

export interface ArcThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ArcThemeCustomizer({ isOpen, onClose }: ArcThemeCustomizerProps) {
  const [config, setConfig] = useState<ArcThemeConfig>(readStoredArcTheme);
  const padRef = useRef<HTMLDivElement | null>(null);
  const dialRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingPuck, setIsDraggingPuck] = useState(false);
  const [isDraggingDial, setIsDraggingDial] = useState(false);
  const dialPointerStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastDialStep = useRef<number>(0);
  const [activeTextureNotice, setActiveTextureNotice] = useState<string | null>(null);

  const updateConfig = useCallback((updater: (prev: ArcThemeConfig) => ArcThemeConfig) => {
    setConfig(prev => {
      const next = updater(prev);
      applyArcThemeToDOM(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Sync on initial mount
  useEffect(() => {
    applyArcThemeToDOM(config);
  }, []);

  // Cycle texture type with mechanical latch sound and visual feedback
  const cycleTexture = useCallback(() => {
    updateConfig(c => {
      const currentIndex = TEXTURE_CYCLE_ORDER.indexOf(c.textureType || 'grain');
      const nextIndex = (currentIndex + 1) % TEXTURE_CYCLE_ORDER.length;
      const nextType = TEXTURE_CYCLE_ORDER[nextIndex];
      const def = ARC_TEXTURE_MAP[nextType];
      triggerHapticFeedback(1650);
      setActiveTextureNotice(`${def.label} · ${nextType === 'plain' ? 'Matte' : Math.round(c.textureIntensity * 100) + '%'}`);
      setTimeout(() => setActiveTextureNotice(null), 1800);
      return { ...c, textureType: nextType };
    });
  }, [updateConfig]);

  // 2D Color Pad pointer handler
  const handlePadPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const baseHue = ARC_SWATCHES.find(s => s.id === config.swatchId)?.hue ?? config.hue;
    const shiftedHue = (baseHue + Math.round((x - 50) * 0.8) + 360) % 360;
    const adjustedSat = Math.max(25, Math.min(95, Math.round(100 - y * 0.5)));

    updateConfig(c => ({
      ...c,
      puckX: Math.round(x),
      puckY: Math.round(y),
      hue: shiftedHue,
      saturation: adjustedSat
    }));
  };

  // Dial rotation pointer handler with Haptic Feedback
  const handleDialPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radians = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    let degrees = radians * (180 / Math.PI) + 90;
    if (degrees < 0) degrees += 360;

    // Check if dial passed a tick mark (18 ticks around circle, step = 20 deg)
    const currentStep = Math.floor(degrees / 20);
    if (currentStep !== lastDialStep.current) {
      lastDialStep.current = currentStep;
      triggerHapticFeedback(1200 + currentStep * 30);
    }

    const intensity = Math.max(0.05, Math.min(0.45, 0.05 + (degrees / 360) * 0.4));
    updateConfig(c => ({
      ...c,
      textureIntensity: parseFloat(intensity.toFixed(2)),
      // If user rotates while on plain, gently activate grain
      textureType: c.textureType === 'plain' ? 'grain' : c.textureType
    }));
  };

  if (!isOpen) return null;

  const currentTexture = ARC_TEXTURE_MAP[config.textureType || 'grain'];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
    >
      {/* Exact Arc Customizer Modal Card (Substantial, Beautiful Desktop Proportions) */}
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-[390px] sm:w-[425px] rounded-[32px] bg-paper border border-white/20 dark:border-white/10 shadow-[0_28px_80px_rgba(0,0,0,0.45)] p-5 sm:p-6 flex flex-col gap-5"
      >
        {/* Top Segmented Control (✨, ☀️, 🌙) + Close */}
        <div className="relative flex items-center justify-center pt-0.5">
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-paper-2/80 border border-rule/60 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback(1000);
                updateConfig(c => ({ ...c, mode: 'auto' }));
              }}
              title="Auto Match System"
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                config.mode === 'auto'
                  ? 'bg-paper text-ink shadow-xs scale-105'
                  : 'text-ink-3 hover:text-ink hover:bg-paper/40'
              }`}
            >
              <Sparkles size={16} strokeWidth={1.25} />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback(1100);
                updateConfig(c => ({ ...c, mode: 'light' }));
              }}
              title="Light Mode"
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                config.mode === 'light'
                  ? 'bg-paper text-ink shadow-xs scale-105'
                  : 'text-ink-3 hover:text-ink hover:bg-paper/40'
              }`}
            >
              <Sun size={16} strokeWidth={1.25} />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback(1200);
                updateConfig(c => ({ ...c, mode: 'dark' }));
              }}
              title="Dark Mode"
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                config.mode === 'dark'
                  ? 'bg-paper text-ink shadow-xs scale-105'
                  : 'text-ink-3 hover:text-ink hover:bg-paper/40'
              }`}
            >
              <Moon size={16} strokeWidth={1.25} />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 p-2 rounded-full text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={17} strokeWidth={1.25} />
          </button>
        </div>

        {/* 2D Dot-Matrix Color Pad with Draggable Puck (Enlarged & Generous Canvas) */}
        <div
          ref={padRef}
          onPointerDown={e => {
            setIsDraggingPuck(true);
            triggerHapticFeedback(1300);
            handlePadPointer(e);
          }}
          onPointerMove={e => {
            if (isDraggingPuck) handlePadPointer(e);
          }}
          onPointerUp={() => {
            setIsDraggingPuck(false);
            triggerHapticFeedback(900);
          }}
          className="relative h-56 sm:h-64 rounded-2xl border border-rule/50 overflow-hidden cursor-crosshair select-none flex items-center justify-center transition-colors duration-200"
          style={{
            backgroundColor: `hsl(${config.hue}, ${config.saturation}%, ${config.mode === 'dark' ? '30%' : '75%'})`
          }}
        >
          {/* Subtle Dot Matrix Background (Matching Arc Dot Grid) */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: '9px 9px'
            }}
          />

          {/* Draggable Arc Puck (White Halo Disc) */}
          <div
            className="absolute w-9 h-9 rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,0.4)] border-2 border-white pointer-events-none transition-transform duration-75 flex items-center justify-center"
            style={{
              left: `${config.puckX}%`,
              top: `${config.puckY}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div
              className="w-4.5 h-4.5 rounded-full"
              style={{
                backgroundColor: `hsl(${config.hue}, ${config.saturation}%, 60%)`
              }}
            />
          </div>

          {/* Bottom Minus / Plus fine-tuning handles */}
          <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-5 text-sm font-bold text-ink-2">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                triggerHapticFeedback(1000);
                updateConfig(c => ({ ...c, saturation: Math.max(20, c.saturation - 10) }));
              }}
              className="hover:scale-125 transition-transform cursor-pointer px-2 py-0.5 text-ink-2 hover:text-ink"
            >
              –
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                triggerHapticFeedback(1200);
                updateConfig(c => ({ ...c, saturation: Math.min(95, c.saturation + 10) }));
              }}
              className="hover:scale-125 transition-transform cursor-pointer px-2 py-0.5 text-ink-2 hover:text-ink"
            >
              +
            </button>
          </div>
        </div>

        {/* 10 Swatches Carousel (Enlarged Dots) */}
        <div className="flex items-center justify-between gap-1.5 px-0.5">
          <button
            type="button"
            onClick={() => {
              const currentIdx = ARC_SWATCHES.findIndex(s => s.id === config.swatchId);
              const prevIdx = (currentIdx - 1 + ARC_SWATCHES.length) % ARC_SWATCHES.length;
              const prevSwatch = ARC_SWATCHES[prevIdx];
              triggerHapticFeedback(1100);
              updateConfig(c => ({ ...c, swatchId: prevSwatch.id, hue: prevSwatch.hue }));
            }}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} strokeWidth={1.25} />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {ARC_SWATCHES.map(swatch => {
              const active = swatch.id === config.swatchId;
              return (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback(1150);
                    updateConfig(c => ({ ...c, swatchId: swatch.id, hue: swatch.hue }));
                  }}
                  title={swatch.name}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all cursor-pointer relative shrink-0 ${
                    active ? 'scale-115 ring-2 ring-white dark:ring-white ring-offset-2 ring-offset-paper shadow-xs' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const currentIdx = ARC_SWATCHES.findIndex(s => s.id === config.swatchId);
              const nextIdx = (currentIdx + 1) % ARC_SWATCHES.length;
              const nextSwatch = ARC_SWATCHES[nextIdx];
              triggerHapticFeedback(1250);
              updateConfig(c => ({ ...c, swatchId: nextSwatch.id, hue: nextSwatch.hue }));
            }}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronRight size={16} strokeWidth={1.25} />
          </button>
        </div>

        {/* Bottom Row: Slider with Vertical Pill Thumb + Tactile Dial Wheel */}
        <div className="flex items-center justify-between gap-5 pt-1 relative">
          {/* Active Texture Floating Toast Notification */}
          {activeTextureNotice && (
            <div className="absolute -top-7 right-0 px-3 py-1 rounded-full bg-paper-2 border border-rule/80 text-xs font-semibold text-ink shadow-md animate-in fade-in zoom-in-95 pointer-events-none">
              {activeTextureNotice}
            </div>
          )}

          {/* Horizontal Slider with Vertical White Pill Thumb (Exact Arc Look) */}
          <div className="flex-1 relative flex items-center h-8">
            <div className="w-full h-2 bg-paper-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/40 dark:bg-white/30 rounded-full"
                style={{ width: `${config.saturation}%` }}
              />
            </div>
            {/* Draggable vertical pill thumb */}
            <input
              type="range"
              min="20"
              max="95"
              value={config.saturation}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                triggerHapticFeedback(800 + val * 5);
                updateConfig(c => ({ ...c, saturation: val }));
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
            <div
              className="pointer-events-none absolute w-2.5 h-6 rounded-full bg-white shadow-md border border-black/10 -translate-x-1/2"
              style={{ left: `${((config.saturation - 20) / 75) * 100}%` }}
            />
          </div>

          {/* Turning Dial Wheel with 18-Dot Ring & Tap-to-Cycle Texture */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Clickable texture style pill */}
            <button
              type="button"
              onClick={cycleTexture}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-paper-2/80 hover:bg-paper-2 text-ink-2 hover:text-ink border border-rule/60 transition-colors cursor-pointer"
              title="Tap to cycle texture (Grain, Plain, Stipple, Frost)"
            >
              {currentTexture.label}
            </button>

            {/* Turning Dial */}
            <div
              ref={dialRef}
              onPointerDown={e => {
                dialPointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
                setIsDraggingDial(true);
                handleDialPointer(e);
              }}
              onPointerMove={e => {
                if (isDraggingDial) handleDialPointer(e);
              }}
              onPointerUp={e => {
                setIsDraggingDial(false);
                if (dialPointerStart.current) {
                  const dx = Math.abs(e.clientX - dialPointerStart.current.x);
                  const dy = Math.abs(e.clientY - dialPointerStart.current.y);
                  const dt = Date.now() - dialPointerStart.current.time;
                  if (dx < 6 && dy < 6 && dt < 400) {
                    cycleTexture();
                  } else {
                    triggerHapticFeedback(1000);
                  }
                }
              }}
              title={`Tap to cycle texture (${currentTexture.label}) · Rotate to adjust amount`}
              className="relative w-14 h-14 rounded-full bg-paper-2/90 border border-rule/60 flex items-center justify-center cursor-pointer active:cursor-grabbing shadow-inner shrink-0 group"
            >
              {/* Radial 18-Dot Ring */}
              {Array.from({ length: 18 }).map((_, i) => {
                const angle = (i * 360) / 18;
                return (
                  <span
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-ink-3/45"
                    style={{
                      transform: `rotate(${angle}deg) translate(0, -22px)`
                    }}
                  />
                );
              })}

              {/* Dial Center Disc with Rotating White Capsule Notch */}
              <div
                className={`w-9 h-9 rounded-full border border-rule/80 shadow-xs relative flex items-center justify-center transition-transform duration-75 ${
                  config.textureType === 'plain' ? 'bg-paper-2' : 'bg-paper'
                }`}
                style={{
                  transform: `rotate(${Math.round(((config.textureIntensity - 0.05) / 0.4) * 360)}deg)`
                }}
              >
                {/* White Capsule Indicator Notch on Edge */}
                <span className="absolute top-0.5 w-1.5 h-2.5 rounded-full bg-white shadow-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArcThemeCustomizer;
