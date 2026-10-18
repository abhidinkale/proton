import React, { useEffect, useRef, useState } from 'react';

const PROCESSOR_MODULE = '/worklets/volume-level-processor.js';
const WORKLET_NAME = 'proton-volume-level';

interface AudioLevelMeterProps {
  stream: MediaStream | null;
  isRecording: boolean;
  isPaused?: boolean;
  bars?: number;
}

export const AudioLevelMeter: React.FC<AudioLevelMeterProps> = ({
  stream,
  isRecording,
  isPaused = false,
  bars = 8,
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const [peakVolume, setPeakVolume] = useState<number>(0.05);

  useEffect(() => {
    let isCancelled = false;

    const cleanup = () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      setVolume(0);
      setPeakVolume(0.05);
    };

    if (!isRecording || isPaused || !stream) {
      cleanup();
      return;
    }

    const startMonitoring = async () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        try {
          await ctx.audioWorklet.addModule(PROCESSOR_MODULE);
        } catch (workletErr) {
          console.warn('AudioWorklet module load skipped, falling back to basic audio monitor:', workletErr);
          return;
        }

        if (isCancelled) {
          ctx.close().catch(() => {});
          return;
        }

        const microphone = ctx.createMediaStreamSource(stream);
        const node = new AudioWorkletNode(ctx, WORKLET_NAME);

        node.port.onmessage = (event) => {
          if (isCancelled) return;
          const currentVol = event.data?.volume ?? 0;
          setVolume(currentVol);
          setPeakVolume((prev) => Math.max(prev * 0.98, currentVol, 0.05));
        };

        microphone.connect(node);
      } catch (err) {
        console.warn('Audio metering unavailable:', err);
      }
    };

    void startMonitoring();

    return () => {
      isCancelled = true;
      cleanup();
    };
  }, [stream, isRecording, isPaused]);

  const normalized = Math.min(Math.max((volume / (peakVolume || 0.1)), 0), 1);
  const activeCount = Math.round(normalized * bars);

  return (
    <div className="flex items-center gap-1 h-5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mr-1">
        {isPaused ? 'Paused' : 'Input'}
      </span>
      <div className="flex items-end gap-[2px] h-3">
        {Array.from({ length: bars }).map((_, i) => {
          const isActive = !isPaused && i < activeCount;
          let color = 'bg-emerald-500';
          if (i >= bars - 2) color = 'bg-amber-500';
          if (i === bars - 1) color = 'bg-rose-500';

          return (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-all duration-75 ${
                isActive ? color : 'bg-slate-300 dark:bg-slate-600'
              }`}
              style={{
                height: `${Math.max(25, ((i + 1) / bars) * 100)}%`,
                opacity: isActive ? 1 : 0.35,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
