import React from 'react';
import {
  Wand2,
  Waves,
  Sparkles,
  Flame,
  Music,
  Power,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { AudioEffectsSettings } from '../types';
import { DEFAULT_EFFECTS_SETTINGS } from '../utils/audioEffects';

interface SoundEffectsProps {
  effects: AudioEffectsSettings;
  onUpdateEffects: (newEffects: Partial<AudioEffectsSettings>) => void;
  isMonitoring: boolean;
}

export const SoundEffects: React.FC<SoundEffectsProps> = ({
  effects,
  onUpdateEffects,
  isMonitoring,
}) => {
  // Preset combinados
  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'studio':
        onUpdateEffects({
          enabled: true,
          echoEnabled: false,
          reverbEnabled: true,
          reverbDecay: 1.8,
          reverbMix: 0.3,
          pitchEnabled: false,
          pitchSemitones: 0,
          distortionEnabled: false,
        });
        break;
      case 'space-echo':
        onUpdateEffects({
          enabled: true,
          echoEnabled: true,
          echoTime: 0.38,
          echoFeedback: 0.55,
          echoMix: 0.5,
          reverbEnabled: true,
          reverbDecay: 3.5,
          reverbMix: 0.4,
          pitchEnabled: false,
          distortionEnabled: false,
        });
        break;
      case 'chipmunk':
        onUpdateEffects({
          enabled: true,
          pitchEnabled: true,
          pitchSemitones: 12,
          pitchMix: 1.0,
          echoEnabled: true,
          echoTime: 0.15,
          echoFeedback: 0.25,
          echoMix: 0.25,
          reverbEnabled: false,
          distortionEnabled: false,
        });
        break;
      case 'monster':
        onUpdateEffects({
          enabled: true,
          pitchEnabled: true,
          pitchSemitones: -8,
          pitchMix: 1.0,
          distortionEnabled: true,
          distortionAmount: 40,
          distortionTone: 2800,
          distortionMix: 0.35,
          echoEnabled: false,
          reverbEnabled: true,
          reverbDecay: 2.2,
          reverbMix: 0.25,
        });
        break;
      case 'radio':
        onUpdateEffects({
          enabled: true,
          distortionEnabled: true,
          distortionAmount: 65,
          distortionTone: 2200,
          distortionMix: 0.6,
          echoEnabled: false,
          reverbEnabled: false,
          pitchEnabled: false,
        });
        break;
      case 'reset':
      default:
        onUpdateEffects({ ...DEFAULT_EFFECTS_SETTINGS, enabled: false });
        break;
    }
  };

  return (
    <div className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
      {/* Header with Master Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-stone-200">
              Efectos de Sonido en Tiempo Real & Estudio
            </h2>
            <p className="text-[11px] text-stone-400">
              Eco, reverberación, cambio de tono y distorsión
            </p>
          </div>
        </div>

        {/* Master Live Switch */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateEffects({ enabled: !effects.enabled })}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-2 shadow-xs ${
              effects.enabled
                ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-300 ring-2 ring-amber-500/30'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-400 border-stone-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{effects.enabled ? 'Efectos ACTIVADOS en Vivo' : 'Efectos Desactivados (Bypass)'}</span>
          </button>
        </div>
      </div>

      {/* Real-time status banner */}
      {effects.enabled && isMonitoring && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 px-3.5 flex items-center justify-between text-xs text-amber-200 animate-pulse">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Los efectos se están procesando en vivo hacia tus audífonos y en la grabación.
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/60 border border-amber-700/60 text-amber-300">
            EN VIVO
          </span>
        </div>
      )}

      {/* Preset Combinations Bar */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Perfiles Rápidos de Efectos:
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'studio', label: '🎙️ Estudio Vocal (Reverb Suave)' },
            { id: 'space-echo', label: '🌌 Eco Espacial Cósmico' },
            { id: 'chipmunk', label: '🐿️ Ardilla (+12 semitonos)' },
            { id: 'monster', label: '👹 Monstruo / Robot' },
            { id: 'radio', label: '📻 Megáfono / Radio Vintage' },
            { id: 'reset', label: '⚡ Restablecer Todo' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => applyPreset(item.id)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-stone-800/80 hover:bg-stone-750 text-stone-300 hover:text-white border-stone-700 transition cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* The 4 Effects Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. ECO / DELAY */}
        <div
          className={`p-4 rounded-xl border transition-all space-y-3 ${
            effects.echoEnabled
              ? 'bg-amber-950/20 border-amber-500/50 shadow-sm'
              : 'bg-stone-950/40 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Waves className="w-4 h-4 text-cyan-400" />
              <span className="text-xs sm:text-sm font-semibold text-stone-200">
                1. Eco / Delay
              </span>
            </div>
            <button
              onClick={() => {
                onUpdateEffects({
                  echoEnabled: !effects.echoEnabled,
                  enabled: true,
                });
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                effects.echoEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-stone-800 text-stone-400 border-stone-700'
              }`}
            >
              {effects.echoEnabled ? 'ENCENDIDO' : 'APAGADO'}
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Delay Time */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-300">Tiempo de Retardo:</span>
                <span className="font-mono text-cyan-400 font-semibold">
                  {Math.round(effects.echoTime * 1000)} ms
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.01"
                value={effects.echoTime}
                onChange={(e) =>
                  onUpdateEffects({ echoTime: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
              />
              <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                <span>50ms (Slapback)</span>
                <span>350ms</span>
                <span>1000ms (Largo)</span>
              </div>
            </div>

            {/* Feedback */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-300">Repeticiones (Feedback):</span>
                <span className="font-mono text-cyan-400 font-semibold">
                  {Math.round(effects.echoFeedback * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.85"
                step="0.05"
                value={effects.echoFeedback}
                onChange={(e) =>
                  onUpdateEffects({ echoFeedback: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
              />
            </div>

            {/* Mix */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-300">Intensidad de Mezcla:</span>
                <span className="font-mono text-cyan-400 font-semibold">
                  {Math.round(effects.echoMix * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={effects.echoMix}
                onChange={(e) =>
                  onUpdateEffects({ echoMix: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
              />
            </div>
          </div>
        </div>

        {/* 2. REVERBERACIÓN */}
        <div
          className={`p-4 rounded-xl border transition-all space-y-3 ${
            effects.reverbEnabled
              ? 'bg-amber-950/20 border-amber-500/50 shadow-sm'
              : 'bg-stone-950/40 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs sm:text-sm font-semibold text-stone-200">
                2. Reverberación
              </span>
            </div>
            <button
              onClick={() => {
                onUpdateEffects({
                  reverbEnabled: !effects.reverbEnabled,
                  enabled: true,
                });
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                effects.reverbEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-stone-800 text-stone-400 border-stone-700'
              }`}
            >
              {effects.reverbEnabled ? 'ENCENDIDO' : 'APAGADO'}
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Decay */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-300">Duración del Espacio (Decay):</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {effects.reverbDecay.toFixed(1)} s
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={effects.reverbDecay}
                onChange={(e) =>
                  onUpdateEffects({ reverbDecay: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
              />
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>Habitación (1.0s)</span>
                <span>Sala (2.5s)</span>
                <span>Catedral (5.0s)</span>
              </div>
            </div>

            {/* Mix */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-300">Nivel de Ambiente (Mezcla):</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {Math.round(effects.reverbMix * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={effects.reverbMix}
                onChange={(e) =>
                  onUpdateEffects({ reverbMix: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
              />
            </div>
          </div>
        </div>

        {/* 3. CAMBIO DE TONO (PITCH SHIFT) */}
        <div
          className={`p-4 rounded-xl border transition-all space-y-3 ${
            effects.pitchEnabled
              ? 'bg-amber-950/20 border-amber-500/50 shadow-sm'
              : 'bg-stone-950/40 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-purple-400" />
              <span className="text-xs sm:text-sm font-semibold text-stone-200">
                3. Cambio de Tono (Pitch Shift)
              </span>
            </div>
            <button
              onClick={() => {
                onUpdateEffects({
                  pitchEnabled: !effects.pitchEnabled,
                  enabled: true,
                });
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                effects.pitchEnabled
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                  : 'bg-stone-800 text-stone-400 border-stone-700'
              }`}
            >
              {effects.pitchEnabled ? 'ENCENDIDO' : 'APAGADO'}
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Quick buttons */}
            <div className="grid grid-cols-5 gap-1 pt-0.5">
              {[
                { semitones: -12, label: '👹 -12' },
                { semitones: -5, label: '👨 -5' },
                { semitones: 0, label: '⚖️ 0' },
                { semitones: 5, label: '👧 +5' },
                { semitones: 12, label: '🐿️ +12' },
              ].map((p) => (
                <button
                  key={p.semitones}
                  onClick={() =>
                    onUpdateEffects({
                      pitchSemitones: p.semitones,
                      pitchEnabled: true,
                      enabled: true,
                    })
                  }
                  className={`py-1 text-[11px] font-mono rounded border transition cursor-pointer text-center ${
                    effects.pitchSemitones === p.semitones && effects.pitchEnabled
                      ? 'bg-purple-500/30 text-purple-200 border-purple-400 font-bold'
                      : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-stone-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Slider */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-300">Ajuste de Semitonos:</span>
                <span className="font-mono text-purple-400 font-bold">
                  {effects.pitchSemitones > 0 ? `+${effects.pitchSemitones}` : effects.pitchSemitones}{' '}
                  semitonos (
                  {effects.pitchSemitones > 0
                    ? 'Agudo'
                    : effects.pitchSemitones < 0
                    ? 'Grave'
                    : 'Natural'}
                  )
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={effects.pitchSemitones}
                onChange={(e) =>
                  onUpdateEffects({
                    pitchSemitones: parseInt(e.target.value, 10),
                    pitchEnabled: true,
                    enabled: true,
                  })
                }
                className="w-full accent-purple-400 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
              />
              <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                <span>-12 (Monstruo)</span>
                <span>0 (Normal)</span>
                <span>+12 (Ardilla)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. DISTORSIÓN / SATURACIÓN */}
        <div
          className={`p-4 rounded-xl border transition-all space-y-3 ${
            effects.distortionEnabled
              ? 'bg-amber-950/20 border-amber-500/50 shadow-sm'
              : 'bg-stone-950/40 border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span className="text-xs sm:text-sm font-semibold text-stone-200">
                4. Distorsión / Saturación
              </span>
            </div>
            <button
              onClick={() => {
                onUpdateEffects({
                  distortionEnabled: !effects.distortionEnabled,
                  enabled: true,
                });
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                effects.distortionEnabled
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                  : 'bg-stone-800 text-stone-400 border-stone-700'
              }`}
            >
              {effects.distortionEnabled ? 'ENCENDIDO' : 'APAGADO'}
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Amount / Drive */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-300">Nivel de Ganancia (Drive):</span>
                <span className="font-mono text-rose-400 font-semibold">
                  {Math.round(effects.distortionAmount)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={effects.distortionAmount}
                onChange={(e) =>
                  onUpdateEffects({ distortionAmount: parseInt(e.target.value, 10) })
                }
                className="w-full accent-rose-400 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
              />
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>Calidez analógica</span>
                <span>Overdrive</span>
                <span>Fuzz agresivo</span>
              </div>
            </div>

            {/* Tone Filter */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-300">Filtro de Tono:</span>
                <span className="font-mono text-rose-400 font-semibold">
                  {effects.distortionTone} Hz
                </span>
              </div>
              <input
                type="range"
                min="1000"
                max="8000"
                step="200"
                value={effects.distortionTone}
                onChange={(e) =>
                  onUpdateEffects({ distortionTone: parseInt(e.target.value, 10) })
                }
                className="w-full accent-rose-400 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
