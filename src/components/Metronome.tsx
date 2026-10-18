import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Timer,
  Play,
  Square,
  Volume2,
  VolumeX,
  Zap,
  RotateCcw,
  Music2,
  Settings2,
} from 'lucide-react';
import { backgroundAudio } from '../utils/backgroundAudio';

interface MetronomeProps {
  isRecording: boolean;
  recordingDurationMs: number;
}

type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8';

export const Metronome: React.FC<MetronomeProps> = ({
  isRecording,
  recordingDurationMs,
}) => {
  const [bpm, setBpm] = useState<number>(120);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>('4/4');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoSyncRecording, setAutoSyncRecording] = useState<boolean>(true);
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  const [currentBar, setCurrentBar] = useState<number>(1);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  // Tap tempo state
  const tapTimesRef = useRef<number[]>([]);

  // Web Audio Context for precise scheduling
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentBeatRef = useRef<number>(0);
  const currentBarRef = useRef<number>(1);
  const timerIdRef = useRef<number | null>(null);

  // Get total beats in current time signature
  const getBeatsPerBar = (ts: TimeSignature): number => {
    switch (ts) {
      case '2/4':
        return 2;
      case '3/4':
        return 3;
      case '4/4':
        return 4;
      case '6/8':
        return 6;
      default:
        return 4;
    }
  };

  const totalBeats = getBeatsPerBar(timeSignature);

  // Get Tempo Name description
  const getTempoLabel = (b: number): string => {
    if (b < 60) return 'Largo (Muy lento)';
    if (b < 76) return 'Adagio (Lento)';
    if (b < 108) return 'Andante (Paso tranquilo)';
    if (b < 120) return 'Moderato (Moderado)';
    if (b < 140) return 'Allegro (Rápido y animado)';
    if (b < 168) return 'Presto (Muy rápido)';
    return 'Prestissimo (Ultra rápido)';
  };

  // Play synthetic click sound via Web Audio API
  const playClick = useCallback(
    (beat: number, time: number) => {
      if (!soundEnabled) return;

      try {
        if (!audioCtxRef.current) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          audioCtxRef.current = new AudioCtx();
          backgroundAudio.registerAudioContext(audioCtxRef.current);
        }

        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Accent on beat 1 (higher pitch and slightly louder)
        const isAccent = beat === 0;
        osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
        osc.type = isAccent ? 'triangle' : 'sine';

        gain.gain.setValueAtTime(isAccent ? 0.3 : 0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.05);
      } catch (err) {
        console.warn('Audio click error:', err);
      }
    },
    [soundEnabled]
  );

  // Scheduler lookahead loop
  const scheduler = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    // Schedule ahead 100ms
    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const beat = currentBeatRef.current;
      const time = nextNoteTimeRef.current;

      // Schedule sound
      playClick(beat, time);

      // Trigger UI flash
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => {
        setCurrentBeat(beat);
        setCurrentBar(currentBarRef.current);
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 120);
      }, delayMs);

      // Advance time for next beat
      const secondsPerBeat = 60.0 / bpm;
      nextNoteTimeRef.current += secondsPerBeat;

      // Advance beat index
      currentBeatRef.current = (beat + 1) % totalBeats;
      if (currentBeatRef.current === 0) {
        currentBarRef.current += 1;
      }
    }
  }, [bpm, totalBeats, playClick]);

  // Start Metronome
  const startMetronome = useCallback(() => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
      backgroundAudio.registerAudioContext(audioCtxRef.current);
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    currentBeatRef.current = 0;
    currentBarRef.current = 1;
    setCurrentBeat(0);
    setCurrentBar(1);

    nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05;
    setIsPlaying(true);

    if (timerIdRef.current) clearInterval(timerIdRef.current);
    timerIdRef.current = window.setInterval(scheduler, 25);
  }, [scheduler]);

  // Stop Metronome
  const stopMetronome = useCallback(() => {
    setIsPlaying(false);
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    setCurrentBeat(0);
    setIsFlashing(false);
  }, []);

  // Auto-start / auto-stop metronome when recording starts if autoSyncRecording is enabled
  useEffect(() => {
    if (autoSyncRecording) {
      if (isRecording && !isPlaying) {
        startMetronome();
      } else if (!isRecording && isPlaying) {
        stopMetronome();
      }
    }
  }, [isRecording, autoSyncRecording, isPlaying, startMetronome, stopMetronome]);

  // Update scheduler when BPM or totalBeats change while playing
  useEffect(() => {
    if (isPlaying) {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
      timerIdRef.current = window.setInterval(scheduler, 25);
    }
  }, [bpm, totalBeats, isPlaying, scheduler]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Tap tempo handler
  const handleTapTempo = () => {
    const now = performance.now();
    const times = tapTimesRef.current;

    // Reset if last tap was more than 2 seconds ago
    if (times.length > 0 && now - times[times.length - 1] > 2000) {
      tapTimesRef.current = [now];
      return;
    }

    times.push(now);
    if (times.length > 5) times.shift();

    if (times.length >= 2) {
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }
      const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgIntervalMs);
      const clampedBpm = Math.max(40, Math.min(240, calculatedBpm));
      setBpm(clampedBpm);
    }
  };

  return (
    <div className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm sm:text-base font-semibold text-stone-200">
            Metrónomo Visual & Auditivo para Músicos
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
            {bpm} BPM
          </span>
          <span className="text-[10px] text-stone-400 hidden sm:inline">
            {getTempoLabel(bpm)}
          </span>
        </div>
      </div>

      {/* Main Flashing Visual Display */}
      <div
        className={`p-4 rounded-xl border transition-all duration-100 flex flex-col items-center justify-center gap-3 relative overflow-hidden ${
          isFlashing
            ? currentBeat === 0
              ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20'
              : 'bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-500/40'
            : 'bg-stone-950/80 border-stone-800'
        }`}
      >
        {/* Sync Status Badge */}
        <div className="flex items-center justify-between w-full text-xs text-stone-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Music2 className="w-3.5 h-3.5 text-amber-400" />
            Compás: <strong className="text-stone-200">{timeSignature}</strong>
          </span>
          {isRecording && (
            <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Sincronizado con Grabación (Compás {currentBar})
            </span>
          )}
        </div>

        {/* Flashing Beat Indicators Row */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 my-1">
          {Array.from({ length: totalBeats }).map((_, idx) => {
            const isActive = isPlaying && currentBeat === idx;
            const isAccentBeat = idx === 0;

            return (
              <div
                key={idx}
                className={`flex flex-col items-center gap-1 transition-all duration-100 ${
                  isActive ? 'scale-110' : 'opacity-60 scale-100'
                }`}
              >
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold font-mono text-sm sm:text-base border transition-all ${
                    isActive
                      ? isAccentBeat
                        ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-md shadow-amber-500/50'
                        : 'bg-cyan-400 text-stone-950 border-cyan-300 shadow-md shadow-cyan-500/50'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}
                >
                  {idx + 1}
                </div>
                <span className="text-[10px] font-mono text-stone-400">
                  {isAccentBeat ? 'Acento' : `Golpe ${idx + 1}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tempo Label on mobile */}
        <p className="text-[11px] text-stone-400 text-center font-medium sm:hidden">
          {getTempoLabel(bpm)}
        </p>
      </div>

      {/* Controls Row: BPM Slider, Tap Tempo, Time Signature & Sound Toggle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Left Column: BPM Slider & Presets */}
        <div className="space-y-3 bg-stone-950/40 p-3.5 rounded-xl border border-stone-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-stone-300">
              Velocidad (BPM)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setBpm((prev) => Math.max(40, prev - 1))}
                className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                min="40"
                max="240"
                value={bpm}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 120;
                  setBpm(Math.max(40, Math.min(240, val)));
                }}
                className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold text-center bg-stone-800 border border-stone-700 rounded text-amber-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={() => setBpm((prev) => Math.min(240, prev + 1))}
                className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <input
            type="range"
            min="40"
            max="240"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-stone-800 rounded-lg appearance-none"
          />

          {/* Quick BPM Presets & Tap Tempo */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
            <div className="flex items-center gap-1">
              {[60, 90, 120, 140, 160].map((presetBpm) => (
                <button
                  key={presetBpm}
                  onClick={() => setBpm(presetBpm)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded border transition cursor-pointer ${
                    bpm === presetBpm
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200 border-stone-700'
                  }`}
                >
                  {presetBpm}
                </button>
              ))}
            </div>

            <button
              onClick={handleTapTempo}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 cursor-pointer flex items-center gap-1 transition active:scale-95"
              title="Presiona rítmicamente para calcular el BPM"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              Tocar Tempo (Tap)
            </button>
          </div>
        </div>

        {/* Right Column: Time Signature, Sync & Play/Pause */}
        <div className="space-y-3 bg-stone-950/40 p-3.5 rounded-xl border border-stone-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-stone-300 block">
                Métrica del Compás
              </span>
              <div className="flex items-center gap-1">
                {(['4/4', '3/4', '2/4', '6/8'] as TimeSignature[]).map((ts) => (
                  <button
                    key={ts}
                    onClick={() => setTimeSignature(ts)}
                    className={`px-2.5 py-1 text-xs font-mono font-medium rounded-lg border transition cursor-pointer ${
                      timeSignature === ts
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-stone-800 text-stone-400 hover:text-stone-200 border-stone-700'
                    }`}
                  >
                    {ts}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
                soundEnabled
                  ? 'bg-stone-800 text-amber-300 border-stone-700'
                  : 'bg-stone-900 text-stone-500 border-stone-800'
              }`}
              title={soundEnabled ? 'Sonido de Click activo' : 'Metrónomo en Modo Mudo Visual'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-amber-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-stone-500" />
              )}
              <span className="hidden sm:inline">
                {soundEnabled ? 'Click Activo' : 'Solo Visual'}
              </span>
            </button>
          </div>

          {/* Bottom Actions: Auto-Sync Checkbox & Play/Stop Button */}
          <div className="flex items-center justify-between border-t border-stone-800/60 pt-2.5">
            <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncRecording}
                onChange={(e) => setAutoSyncRecording(e.target.checked)}
                className="rounded accent-amber-500 bg-stone-800 border-stone-700 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Iniciar automático con la grabación</span>
            </label>

            <button
              onClick={isPlaying ? stopMetronome : startMetronome}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                isPlaying
                  ? 'bg-rose-500 hover:bg-rose-600 text-stone-950 border-rose-400 shadow-sm'
                  : 'bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-300 shadow-sm'
              }`}
            >
              {isPlaying ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" /> Detener Metrónomo
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Activar Metrónomo
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
