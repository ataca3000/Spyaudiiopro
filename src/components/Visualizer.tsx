import React, { useEffect, useRef, useState } from 'react';
import { Activity, BarChart3, AlertTriangle, Mic, VolumeX } from 'lucide-react';
import { AudioEngine } from '../utils/audioEngine';
import { AudioEngineMetrics, AudioRoutingMode, AudioSettings } from '../types';

interface VisualizerProps {
  engine: AudioEngine;
  isMonitoring: boolean;
  metrics: AudioEngineMetrics;
  routingMode: AudioRoutingMode;
  settings?: AudioSettings;
}

export const Visualizer: React.FC<VisualizerProps> = ({
  engine,
  isMonitoring,
  metrics,
  routingMode,
  settings,
}) => {
  const [visualMode, setVisualMode] = useState<'waveform' | 'frequency'>('waveform');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animFrame: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(512);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark sleek background
      ctx.fillStyle = '#141312';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid lines
      ctx.strokeStyle = '#232220';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Horizontal center line
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      // Vertical grid markers
      for (let x = width / 4; x < width; x += width / 4) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();

      if (!isMonitoring) {
        // Idle line
        ctx.strokeStyle = '#44403c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        ctx.fillStyle = '#78716c';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Monitoreo inactivo • Presiona Iniciar Monitoreo para escuchar y ver señal', width / 2, height / 2 - 12);
        return;
      }

      if (visualMode === 'waveform') {
        engine.getVisualizerData('waveform', dataArray);

        ctx.lineWidth = 2;
        ctx.strokeStyle = metrics.isClipping ? '#f43f5e' : '#10b981';
        ctx.beginPath();

        const sliceWidth = width / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0; // 0 to 2
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();

        // Subtle glow effect
        ctx.lineWidth = 4;
        ctx.strokeStyle = metrics.isClipping ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)';
        ctx.stroke();
      } else {
        // Frequency Spectrum Bars
        engine.getVisualizerData('frequency', dataArray);

        const barCount = 48;
        const barWidth = width / barCount - 2;
        const step = Math.floor(dataArray.length / barCount);

        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i * step] / 255; // 0 to 1
          const barHeight = val * (height - 8);
          const x = i * (barWidth + 2) + 1;
          const y = height - barHeight;

          // Gradient color: green to amber to red
          let color = '#10b981';
          if (val > 0.85) color = '#f43f5e';
          else if (val > 0.65) color = '#f59e0b';
          else if (val > 0.35) color = '#38bdf8';

          ctx.fillStyle = color;
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [engine, isMonitoring, visualMode, metrics.isClipping]);

  // Stereo & Mic Meter calculation
  const micPercent = Math.min(Math.max(metrics.rmsLevel * 140, 0), 100);
  const isLeftMuted = routingMode === 'right-only' || settings?.leftSpeakerEnabled === false;
  const isRightMuted = routingMode === 'left-only' || settings?.rightSpeakerEnabled === false;
  const leftPercent = isLeftMuted ? 0 : Math.min(Math.max(metrics.leftRms * 130, 0), 100);
  const rightPercent = isRightMuted ? 0 : Math.min(Math.max(metrics.rightRms * 130, 0), 100);

  return (
    <div className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Visualizer header & mode selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-stone-200">
            Osciloscopio y Medidores de Audio en Vivo
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-stone-800/80 p-1 rounded-lg border border-stone-700/60">
          <button
            onClick={() => setVisualMode('waveform')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              visualMode === 'waveform'
                ? 'bg-stone-700 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Onda</span>
          </button>
          <button
            onClick={() => setVisualMode('frequency')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              visualMode === 'frequency'
                ? 'bg-stone-700 text-white shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Espectro</span>
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="relative w-full h-32 sm:h-36 rounded-xl overflow-hidden border border-stone-800 bg-[#141312]">
        <canvas
          ref={canvasRef}
          width={600}
          height={140}
          className="w-full h-full block"
        />

        {/* Peak dB Badge overlay */}
        {isMonitoring && (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-stone-900/90 border border-stone-700/80 text-[11px] font-mono text-stone-300">
            {metrics.peakDb > -60 ? `${metrics.peakDb} dB` : '-∞ dB'}
          </div>
        )}

        {/* Clipping alert overlay */}
        {metrics.isClipping && isMonitoring && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded bg-rose-950/90 border border-rose-600 text-rose-300 text-xs font-semibold flex items-center gap-1.5 animate-bounce">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>PICO ALTO / SATURACIÓN</span>
          </div>
        )}
      </div>

      {/* 1. Input Microphone Activity Meter (Confirms mic is picking up sound even when speaker is silent) */}
      <div className="bg-stone-950/60 border border-amber-500/25 rounded-xl p-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-amber-300 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-amber-400" />
            Entrada del Micrófono (Captando audio en vivo)
          </span>
          <span className="text-[11px] font-mono text-amber-400 font-bold">
            {isMonitoring ? `${Math.round(micPercent)}% (Activo)` : 'En espera'}
          </span>
        </div>
        <div className="w-full h-2.5 bg-stone-900 rounded-full overflow-hidden p-0.5 border border-stone-800 relative">
          <div
            className={`h-full rounded-full transition-all duration-75 ${
              micPercent > 85 ? 'bg-rose-500' : micPercent > 60 ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: isMonitoring ? `${micPercent}%` : '0%' }}
          />
        </div>
        <p className="text-[10px] text-stone-400">
          El micrófono capta y procesa el sonido del área sin importar si el altavoz de ese audífono está apagado.
        </p>
      </div>

      {/* 2. Stereo VU Meters (L & R) with Bluetooth earbud indication */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
        {/* Left Earbud VU */}
        <div className={`border rounded-xl p-3 space-y-1.5 transition ${
          isLeftMuted ? 'bg-rose-950/15 border-rose-800/40' : 'bg-stone-800/60 border-stone-700/50'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-300 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-[10px] flex items-center justify-center font-bold">
                L
              </span>
              Altavoz Audífono Izquierdo
            </span>
            <span className={`text-[11px] font-mono ${isLeftMuted ? 'text-rose-400 font-semibold' : 'text-stone-400'}`}>
              {isLeftMuted ? '🔇 APAGADO' : `${Math.round(leftPercent)}%`}
            </span>
          </div>
          <div className="w-full h-2.5 bg-stone-900 rounded-full overflow-hidden p-0.5 border border-stone-800 relative">
            <div
              className={`h-full rounded-full transition-all duration-75 ${
                isLeftMuted
                  ? 'bg-transparent'
                  : leftPercent > 85
                  ? 'bg-rose-500'
                  : leftPercent > 65
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: isLeftMuted ? '0%' : `${leftPercent}%` }}
            />
          </div>
          {isLeftMuted && (
            <p className="text-[10px] text-rose-300/80 flex items-center gap-1">
              <VolumeX className="w-3 h-3 text-rose-400 shrink-0" />
              Altavoz mudo (su micrófono sigue captando)
            </p>
          )}
        </div>

        {/* Right Earbud VU */}
        <div className={`border rounded-xl p-3 space-y-1.5 transition ${
          isRightMuted ? 'bg-rose-950/15 border-rose-800/40' : 'bg-stone-800/60 border-stone-700/50'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-300 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-[10px] flex items-center justify-center font-bold">
                R
              </span>
              Altavoz Audífono Derecho
            </span>
            <span className={`text-[11px] font-mono ${isRightMuted ? 'text-rose-400 font-semibold' : 'text-stone-400'}`}>
              {isRightMuted ? '🔇 APAGADO' : `${Math.round(rightPercent)}%`}
            </span>
          </div>
          <div className="w-full h-2.5 bg-stone-900 rounded-full overflow-hidden p-0.5 border border-stone-800 relative">
            <div
              className={`h-full rounded-full transition-all duration-75 ${
                isRightMuted
                  ? 'bg-transparent'
                  : rightPercent > 85
                  ? 'bg-rose-500'
                  : rightPercent > 65
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: isRightMuted ? '0%' : `${rightPercent}%` }}
            />
          </div>
          {isRightMuted && (
            <p className="text-[10px] text-rose-300/80 flex items-center gap-1">
              <VolumeX className="w-3 h-3 text-rose-400 shrink-0" />
              Altavoz mudo (su micrófono sigue captando)
            </p>
          )}
        </div>
      </div>

      {/* When Both Earbuds Speakers are Muted */}
      {isLeftMuted && isRightMuted && (
        <div className="bg-rose-950/30 border border-rose-600/30 rounded-xl p-2.5 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Ambos audífonos en silencio:</strong> Los altavoces de ambos audífonos están apagados (0 ruido hacia afuera).
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded">
            Micrófono captando 100%
          </span>
        </div>
      )}
    </div>
  );
};
