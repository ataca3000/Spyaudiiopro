import React from 'react';
import { Volume2, VolumeX, Headphones, Radio, Info, Activity } from 'lucide-react';
import { AudioRoutingMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  isMonitoring: boolean;
  isRecording: boolean;
  latencyMs: number;
  routingMode: AudioRoutingMode;
  onEmergencyMute: () => void;
  onOpenGuide: () => void;
  isMuted: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isMonitoring,
  isRecording,
  latencyMs,
  routingMode,
  onEmergencyMute,
  onOpenGuide,
  isMuted,
}) => {
  const getRoutingLabel = () => {
    switch (routingMode) {
      case 'left-only':
        return 'Auricular L (R Silenciado)';
      case 'right-only':
        return 'Auricular R (L Silenciado)';
      case 'mono-both':
        return 'Mono (Ambos Oídos)';
      case 'custom-pan':
        return 'Balance Personalizado';
      case 'stereo':
      default:
        return 'Estéreo Normal';
    }
  };

  return (
    <header className="w-full bg-stone-900 border-b border-stone-800 px-4 py-3 sticky top-0 z-30 shadow-md">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold text-stone-100 tracking-tight">
                Amplificador & Monitor de Micrófono
              </h1>
              {isMonitoring && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  EN VIVO
                </span>
              )}
              {isRecording && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-950/80 text-rose-400 border border-rose-700/50 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  GRABANDO
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 hidden sm:block">
              Monitoreo en tiempo real con audífonos • Grabación simultánea • Modo Dual/Mono
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Latency badge */}
          {isMonitoring && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-800/80 border border-stone-700/60 text-xs text-stone-300"
              title="Latencia estimada del búfer de audio"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>~{latencyMs} ms latencia</span>
            </div>
          )}

          {/* Earbud mode badge */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-800/80 border border-stone-700/60 text-xs text-stone-300"
            title="Enrutamiento de canal de auricular"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate max-w-[150px]">{getRoutingLabel()}</span>
          </div>

          {/* Guide Button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition text-xs font-medium cursor-pointer"
            title="Guía para usar audífonos Bluetooth y configurar un auricular como micrófono o monitor"
          >
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Guía Bluetooth</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Panic Mute Button */}
          <button
            onClick={onEmergencyMute}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition cursor-pointer border ${
              isMuted
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 ring-2 ring-rose-500/40'
                : 'bg-stone-800 hover:bg-rose-950/60 text-stone-300 hover:text-rose-300 border-stone-700 hover:border-rose-700'
            }`}
            title="Silencio de emergencia contra acoples o pitidos"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMuted ? 'Desmutear' : 'Silencio Rápido'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
