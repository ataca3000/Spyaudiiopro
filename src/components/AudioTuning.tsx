import React from 'react';
import { Sliders, Shield, VolumeX, Sparkles, Filter } from 'lucide-react';
import { AudioSettings, EqPreset } from '../types';

interface AudioTuningProps {
  settings: AudioSettings;
  onUpdateSettings: (newSettings: Partial<AudioSettings>) => void;
}

export const AudioTuning: React.FC<AudioTuningProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const applyPreset = (preset: EqPreset) => {
    switch (preset) {
      case 'super-ear':
        onUpdateSettings({
          eqPreset: 'super-ear',
          eqLow: -8,
          eqMid: 7,
          eqHigh: 5,
          lowCutEnabled: true,
          noiseGateEnabled: true,
          noiseGateThreshold: -50,
          safetyLimiterEnabled: true,
        });
        break;
      case 'vocal-clarity':
        onUpdateSettings({
          eqPreset: 'vocal-clarity',
          eqLow: -4,
          eqMid: 5,
          eqHigh: 3,
          lowCutEnabled: true,
          safetyLimiterEnabled: true,
        });
        break;
      case 'bass-cut':
        onUpdateSettings({
          eqPreset: 'bass-cut',
          eqLow: -10,
          eqMid: 0,
          eqHigh: 2,
          lowCutEnabled: true,
        });
        break;
      case 'treble-boost':
        onUpdateSettings({
          eqPreset: 'treble-boost',
          eqLow: -2,
          eqMid: 2,
          eqHigh: 8,
        });
        break;
      case 'flat':
      default:
        onUpdateSettings({
          eqPreset: 'flat',
          eqLow: 0,
          eqMid: 0,
          eqHigh: 0,
        });
        break;
    }
  };

  return (
    <div className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm sm:text-base font-semibold text-stone-200">
            Ajustes de Ecualización & Filtro de Ruido
          </h2>
        </div>
        <span className="text-[11px] text-stone-400">Claridad de Voz</span>
      </div>

      {/* Presets Row */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Perfiles Rápidos de Audición
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'super-ear', label: '👂 Super Oído (Espía / Susurros)' },
            { id: 'vocal-clarity', label: '🗣️ Claridad de Voz' },
            { id: 'bass-cut', label: '💨 Anti-Viento / Sin Graves' },
            { id: 'flat', label: '⚖️ Plano / Fiel' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => applyPreset(item.id as EqPreset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                settings.eqPreset === item.id
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                  : 'bg-stone-800 hover:bg-stone-750 text-stone-400 hover:text-stone-200 border-stone-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Band Equalizer Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-950/40 p-4 rounded-xl border border-stone-800/80">
        {/* Lows */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-stone-300 font-medium">Graves (250Hz)</span>
            <span className="font-mono text-[11px] text-amber-400">
              {settings.eqLow > 0 ? `+${settings.eqLow}` : settings.eqLow} dB
            </span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={settings.eqLow}
            onChange={(e) =>
              onUpdateSettings({ eqLow: parseInt(e.target.value, 10), eqPreset: 'flat' })
            }
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
          />
          <p className="text-[10px] text-stone-500">Golpes, vibraciones de mesa</p>
        </div>

        {/* Mids */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-stone-300 font-medium">Medios / Voz (2.2kHz)</span>
            <span className="font-mono text-[11px] text-amber-400">
              {settings.eqMid > 0 ? `+${settings.eqMid}` : settings.eqMid} dB
            </span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={settings.eqMid}
            onChange={(e) =>
              onUpdateSettings({ eqMid: parseInt(e.target.value, 10), eqPreset: 'flat' })
            }
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
          />
          <p className="text-[10px] text-stone-500">Comprensión de palabras y voz</p>
        </div>

        {/* Highs */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-stone-300 font-medium">Agudos (6kHz)</span>
            <span className="font-mono text-[11px] text-amber-400">
              {settings.eqHigh > 0 ? `+${settings.eqHigh}` : settings.eqHigh} dB
            </span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={settings.eqHigh}
            onChange={(e) =>
              onUpdateSettings({ eqHigh: parseInt(e.target.value, 10), eqPreset: 'flat' })
            }
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
          />
          <p className="text-[10px] text-stone-500">Detalles finos, articulación</p>
        </div>
      </div>

      {/* Advanced Audio Protection & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* Safety Limiter Card */}
        <div className="bg-stone-950/40 border border-stone-800/80 p-3.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-stone-200">
                Limitador de Seguridad Acústica
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.safetyLimiterEnabled}
                onChange={(e) => onUpdateSettings({ safetyLimiterEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-stone-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Comprime automáticamente ruidos secos repentinos (aplausos, caídas) para no lastimar tus oídos en los auriculares.
          </p>
        </div>

        {/* Noise Gate Card */}
        <div className="bg-stone-950/40 border border-stone-800/80 p-3.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-stone-200">
                Puerta de Ruido (Filtro de Fondo)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.noiseGateEnabled}
                onChange={(e) => onUpdateSettings({ noiseGateEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-stone-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>
          {settings.noiseGateEnabled && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-stone-400">
                <span>Umbral de silencio</span>
                <span className="font-mono text-amber-400">{settings.noiseGateThreshold} dB</span>
              </div>
              <input
                type="range"
                min="-70"
                max="-25"
                step="1"
                value={settings.noiseGateThreshold}
                onChange={(e) =>
                  onUpdateSettings({ noiseGateThreshold: parseInt(e.target.value, 10) })
                }
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
              />
            </div>
          )}
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Silencia el siseo y ruido blanco ambiental cuando no hay nadie hablando.
          </p>
        </div>
      </div>

      {/* Hardware Mic DSP Switches */}
      <div className="pt-2 border-t border-stone-800/80 space-y-2">
        <span className="text-xs font-medium text-stone-300">
          Procesamiento de Hardware del Micrófono (Dispositivo)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Echo Cancellation */}
          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-stone-800/60 border border-stone-700/60 cursor-pointer hover:bg-stone-800 text-xs text-stone-300">
            <input
              type="checkbox"
              checked={settings.hardwareEchoCancellation}
              onChange={(e) =>
                onUpdateSettings({ hardwareEchoCancellation: e.target.checked })
              }
              className="rounded text-amber-500 accent-amber-500"
            />
            <span>Anti-Eco (Echo Cancel)</span>
          </label>

          {/* Noise Suppression */}
          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-stone-800/60 border border-stone-700/60 cursor-pointer hover:bg-stone-800 text-xs text-stone-300">
            <input
              type="checkbox"
              checked={settings.hardwareNoiseSuppression}
              onChange={(e) =>
                onUpdateSettings({ hardwareNoiseSuppression: e.target.checked })
              }
              className="rounded text-amber-500 accent-amber-500"
            />
            <span>Supresión de Ruido HW</span>
          </label>

          {/* Low-Cut Filter 80Hz */}
          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-stone-800/60 border border-stone-700/60 cursor-pointer hover:bg-stone-800 text-xs text-stone-300">
            <input
              type="checkbox"
              checked={settings.lowCutEnabled}
              onChange={(e) => onUpdateSettings({ lowCutEnabled: e.target.checked })}
              className="rounded text-amber-500 accent-amber-500"
            />
            <span>Filtro Pasa-Altos (80Hz)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
