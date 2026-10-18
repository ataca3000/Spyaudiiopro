import React from 'react';
import {
  Mic,
  Volume2,
  Sliders,
  Headphones,
  CheckCircle2,
  VolumeX,
  Radio,
  Sparkles,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { AudioSettings, AudioRoutingMode, MicChannelMode } from '../types';

interface MonitorControlsProps {
  settings: AudioSettings;
  onUpdateSettings: (newSettings: Partial<AudioSettings>) => void;
  availableDevices: MediaDeviceInfo[];
}

export const MonitorControls: React.FC<MonitorControlsProps> = ({
  settings,
  onUpdateSettings,
  availableDevices,
}) => {
  // Convert gain factor to dB for display
  const gainDb = Math.round(20 * Math.log10(Math.max(settings.gain, 0.01)));

  const handleGainPreset = (factor: number) => {
    onUpdateSettings({ gain: factor });
  };

  // Preset Handlers for quick Spy / Remote Mic configurations
  const applyRemotePreset = (
    preset: 'left-mic-right-listen' | 'right-mic-left-listen' | 'phone-both' | 'both-muted-record' | 'stereo'
  ) => {
    switch (preset) {
      case 'both-muted-record':
        // Both earbud speakers are MUTED (0 sound output);
        // Microphones of BOTH earbuds are 100% active and capturing, recording directly to device.
        onUpdateSettings({
          micChannelMode: 'both',
          leftSpeakerEnabled: false,
          rightSpeakerEnabled: false,
        });
        break;
      case 'left-mic-right-listen':
        // Left Earbud acts as the Microphone capsule; its speaker is MUTED (0 sound output);
        // User listens through the Right Earbud in their ear.
        onUpdateSettings({
          micChannelMode: 'left',
          routingMode: 'right-only',
          leftSpeakerEnabled: false,
          rightSpeakerEnabled: true,
          pan: 1.0,
        });
        break;
      case 'right-mic-left-listen':
        // Right Earbud acts as the Microphone capsule; its speaker is MUTED (0 sound output);
        // User listens through the Left Earbud in their ear.
        onUpdateSettings({
          micChannelMode: 'right',
          routingMode: 'left-only',
          leftSpeakerEnabled: true,
          rightSpeakerEnabled: false,
          pan: -1.0,
        });
        break;
      case 'phone-both':
        // Uses general mic (or phone mic if selected), both earbud speakers active
        onUpdateSettings({
          micChannelMode: 'both',
          routingMode: 'stereo',
          leftSpeakerEnabled: true,
          rightSpeakerEnabled: true,
          pan: 0,
        });
        break;
      case 'stereo':
        onUpdateSettings({
          micChannelMode: 'both',
          routingMode: 'stereo',
          leftSpeakerEnabled: true,
          rightSpeakerEnabled: true,
          pan: 0,
        });
        break;
    }
  };

  // Determine current remote configuration state for visual badge
  const isBothMuted =
    !settings.leftSpeakerEnabled && !settings.rightSpeakerEnabled;

  const isLeftRemote =
    settings.micChannelMode === 'left' &&
    !settings.leftSpeakerEnabled &&
    settings.rightSpeakerEnabled;

  const isRightRemote =
    settings.micChannelMode === 'right' &&
    !settings.rightSpeakerEnabled &&
    settings.leftSpeakerEnabled;

  const isPhoneBoth =
    settings.micChannelMode === 'both' &&
    settings.leftSpeakerEnabled &&
    settings.rightSpeakerEnabled &&
    settings.routingMode === 'stereo';

  return (
    <div id="monitor-controls-panel" className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm sm:text-base font-semibold text-stone-200">
            Control de Micrófono & Desconexión de Altavoces
          </h2>
        </div>
        <span className="text-[11px] text-amber-400/90 font-medium px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
          Entrada & Salida Independientes
        </span>
      </div>

      {/* QUICK PRESETS: One-touch Remote Earbud / Spy Mic Setup */}
      <div className="space-y-3 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 border border-amber-500/20 p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <label className="text-xs sm:text-sm font-semibold text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Configuraciones Rápidas (Un solo toque)
          </label>
          <span className="text-[11px] text-stone-400">Micro elegido + Altavoz apagado</span>
        </div>

        <p className="text-xs text-stone-300 leading-relaxed">
          Puedes elegir cualquier audífono como micrófono y apagar su altavoz por completo para que no emita ningún ruido ni acople, mientras escuchas por el otro audífono en tu oído:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Preset 1: Left earbud mic, left speaker muted, listen on Right */}
          <button
            id="preset-left-mic-right-listen"
            onClick={() => applyRemotePreset('left-mic-right-listen')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
              isLeftRemote
                ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-stone-800/70 hover:bg-stone-800 border-stone-700/70'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-xs text-amber-200 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                Audífono L como Micro
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/60">
                Altavoz L Mudo
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              Altavoz L apagado. Micro L captando audio. Escuchas en tu oído derecho (R).
            </p>
          </button>

          {/* Preset 2: Right earbud mic, right speaker muted, listen on Left */}
          <button
            id="preset-right-mic-left-listen"
            onClick={() => applyRemotePreset('right-mic-left-listen')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
              isRightRemote
                ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-stone-800/70 hover:bg-stone-800 border-stone-700/70'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-xs text-amber-200 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                Audífono R como Micro
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/60">
                Altavoz R Mudo
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              Altavoz R apagado. Micro R captando audio. Escuchas en tu oído izquierdo (L).
            </p>
          </button>

          {/* Preset 3: BOTH EARBUDS MUTED (0 sound), both mics capturing + recording */}
          <button
            id="preset-both-muted-record"
            onClick={() => applyRemotePreset('both-muted-record')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
              isBothMuted
                ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500/40'
                : 'bg-stone-800/70 hover:bg-stone-800 border-stone-700/70'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-xs text-rose-200 flex items-center gap-1.5">
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                Ambos Audífonos Mudos
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/60">
                0% Sonido L+R
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              Altavoces L y R 100% apagados. Micrófono captando en silencio y grabando en el teléfono.
            </p>
          </button>

          {/* Preset 4: Phone mic, listen on both earbuds */}
          <button
            id="preset-phone-both-listen"
            onClick={() => applyRemotePreset('phone-both')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
              isPhoneBoth
                ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-stone-800/70 hover:bg-stone-800 border-stone-700/70'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-xs text-stone-200 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                Normal Estéreo
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-700/60">
                Ambos Oídos
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              Micrófono activo y ambos altavoces reproduciendo normalmente en tus dos oídos.
            </p>
          </button>
        </div>
      </div>

      {/* DETAILED CONTROLS: 1. MICROPHONE INPUT SELECTION */}
      <div className="space-y-3 bg-stone-950/40 border border-stone-800/80 p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <label className="text-xs sm:text-sm font-semibold text-stone-200 flex items-center gap-2">
            <Mic className="w-4 h-4 text-amber-400" />
            1. Selección de Micrófono (Dispositivo de Captación)
          </label>
          <span className="text-[11px] text-stone-400 font-mono">
            {availableDevices.length > 0 ? `${availableDevices.length} mic(s) disponibles` : 'Predeterminado'}
          </span>
        </div>

        <div className="space-y-2">
          <select
            id="audio-input-device-select"
            value={settings.selectedDeviceId}
            onChange={(e) => onUpdateSettings({ selectedDeviceId: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
          >
            <option value="">Micrófono predeterminado (Celular o Auricular Bluetooth conectado)</option>
            {availableDevices.map((dev, idx) => (
              <option key={dev.deviceId || idx} value={dev.deviceId}>
                {dev.label || `Micrófono ${idx + 1} (${dev.deviceId.slice(0, 8)}...)`}
              </option>
            ))}
          </select>
        </div>

        {/* Input Microphone Channel Selection */}
        <div className="pt-2 border-t border-stone-800/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-300">
              Cápsula / Canal del Micrófono:
            </span>
            <span className="text-[11px] text-stone-400">Aislamiento acústico</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              id="mic-channel-both"
              onClick={() => onUpdateSettings({ micChannelMode: 'both' })}
              className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition cursor-pointer ${
                settings.micChannelMode === 'both'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                  : 'bg-stone-800/80 text-stone-400 hover:text-stone-200 border-stone-700'
              }`}
            >
              Ambos Canales (L+R)
            </button>
            <button
              id="mic-channel-left"
              onClick={() => onUpdateSettings({ micChannelMode: 'left' })}
              className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition cursor-pointer ${
                settings.micChannelMode === 'left'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                  : 'bg-stone-800/80 text-stone-400 hover:text-stone-200 border-stone-700'
              }`}
            >
              Solo Micro Izquierdo (L)
            </button>
            <button
              id="mic-channel-right"
              onClick={() => onUpdateSettings({ micChannelMode: 'right' })}
              className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition cursor-pointer ${
                settings.micChannelMode === 'right'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                  : 'bg-stone-800/80 text-stone-400 hover:text-stone-200 border-stone-700'
              }`}
            >
              Solo Micro Derecho (R)
            </button>
          </div>
        </div>
      </div>

      {/* DETAILED CONTROLS: 2. INDEPENDENT SPEAKER POWER / MUTE SWITCHES */}
      <div className="space-y-3 bg-stone-950/40 border border-stone-800/80 p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <label className="text-xs sm:text-sm font-semibold text-stone-200 flex items-center gap-2">
            <Headphones className="w-4 h-4 text-cyan-400" />
            2. Altavoces de los Audífonos (Apagar o Encender Sonido)
          </label>
          <span className="text-[11px] text-cyan-400 font-mono">Control por Audífono</span>
        </div>

        <p className="text-xs text-stone-400 leading-relaxed">
          Apagar el altavoz de un audífono hace que <strong>no emita ningún sonido hacia afuera</strong> (cero ruido en la habitación y cero acople), pero <strong>su micrófono sigue captando y grabando al 100%</strong>:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Left Speaker Switch */}
          <div
            className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
              settings.leftSpeakerEnabled
                ? 'bg-stone-800/60 border-stone-700'
                : 'bg-rose-950/20 border-rose-800/40'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-xs flex items-center justify-center font-bold">
                  L
                </span>
                <span className="text-xs sm:text-sm font-semibold text-stone-200">
                  Altavoz Izquierdo
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                {settings.leftSpeakerEnabled ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Reproduciendo audio en vivo
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <VolumeX className="w-3 h-3" /> APAGADO (Cero sonido emitido)
                  </span>
                )}
              </p>
            </div>

            <button
              id="toggle-left-speaker"
              onClick={() =>
                onUpdateSettings({
                  leftSpeakerEnabled: !settings.leftSpeakerEnabled,
                  // If disabling left, ensure right has routing
                  routingMode: !settings.leftSpeakerEnabled ? 'stereo' : 'right-only',
                })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                settings.leftSpeakerEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
              }`}
            >
              {settings.leftSpeakerEnabled ? 'Apagar Altavoz' : 'Encender Altavoz'}
            </button>
          </div>

          {/* Right Speaker Switch */}
          <div
            className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
              settings.rightSpeakerEnabled
                ? 'bg-stone-800/60 border-stone-700'
                : 'bg-rose-950/20 border-rose-800/40'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-xs flex items-center justify-center font-bold">
                  R
                </span>
                <span className="text-xs sm:text-sm font-semibold text-stone-200">
                  Altavoz Derecho
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                {settings.rightSpeakerEnabled ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Reproduciendo audio en vivo
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <VolumeX className="w-3 h-3" /> APAGADO (Cero sonido emitido)
                  </span>
                )}
              </p>
            </div>

            <button
              id="toggle-right-speaker"
              onClick={() =>
                onUpdateSettings({
                  rightSpeakerEnabled: !settings.rightSpeakerEnabled,
                  // If disabling right, ensure left has routing
                  routingMode: !settings.rightSpeakerEnabled ? 'stereo' : 'left-only',
                })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                settings.rightSpeakerEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
              }`}
            >
              {settings.rightSpeakerEnabled ? 'Apagar Altavoz' : 'Encender Altavoz'}
            </button>
          </div>
        </div>

        {/* Master Both Speakers Toggle Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            id="mute-both-speakers-btn"
            onClick={() =>
              onUpdateSettings({
                leftSpeakerEnabled: false,
                rightSpeakerEnabled: false,
              })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              isBothMuted
                ? 'bg-rose-950/50 border-rose-500/60 text-rose-300 ring-1 ring-rose-500/30'
                : 'bg-stone-800 hover:bg-stone-750 text-stone-300 border-stone-700'
            }`}
          >
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            Apagar Altavoces de Ambos Audífonos (Cero Sonido L+R)
          </button>
          <button
            id="enable-both-speakers-btn"
            onClick={() =>
              onUpdateSettings({
                leftSpeakerEnabled: true,
                rightSpeakerEnabled: true,
                routingMode: 'stereo',
              })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              settings.leftSpeakerEnabled && settings.rightSpeakerEnabled
                ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
                : 'bg-stone-800 hover:bg-stone-750 text-stone-300 border-stone-700'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 text-cyan-400" />
            Encender Ambos Altavoces (Escuchar en L y R)
          </button>
        </div>

        {/* Both Speakers Muted Special Callout */}
        {isBothMuted && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-200">
            <VolumeX className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">
                Altavoces de AMBOS audífonos apagados (Silencio Total en el ambiente)
              </p>
              <p className="text-[11px] text-stone-300 mt-0.5 leading-relaxed">
                Ninguno de los dos audífonos emite sonido alguno hacia afuera (cero riesgo de que te descubran o hagan ruido). <strong>Los micrófonos de ambos audífonos continúan captando al 100%</strong> y la grabadora sigue guardando todo el audio en la memoria del teléfono.
              </p>
            </div>
          </div>
        )}

        {/* Live Audio Routing Confirmation Badge */}
        <div className="mt-3 p-3 rounded-xl bg-stone-900/90 border border-stone-800 flex items-start gap-2.5 text-xs text-stone-300">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-stone-200">
              Estado de la señal en este momento:
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-300">
              <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
                🎙️ Micro: {settings.micChannelMode === 'left' ? 'Canal Izquierdo (L)' : settings.micChannelMode === 'right' ? 'Canal Derecho (R)' : 'Canales L+R'} (Captando al 100%)
              </span>
              <span className={`px-2 py-0.5 rounded border ${
                settings.leftSpeakerEnabled ? 'bg-cyan-950 border-cyan-700 text-cyan-300' : 'bg-rose-950 border-rose-700 text-rose-300'
              }`}>
                {settings.leftSpeakerEnabled ? '🔊 Altavoz L: Activo' : '🔇 Altavoz L: APAGADO'}
              </span>
              <span className={`px-2 py-0.5 rounded border ${
                settings.rightSpeakerEnabled ? 'bg-cyan-950 border-cyan-700 text-cyan-300' : 'bg-rose-950 border-rose-700 text-rose-300'
              }`}>
                {settings.rightSpeakerEnabled ? '🔊 Altavoz R: Activo' : '🔇 Altavoz R: APAGADO'}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300">
                🔴 Grabación: Independiente (graba siempre)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MASTER GAIN & AMPLIFIER SECTION */}
      <div className="space-y-3 bg-stone-950/40 border border-stone-800/80 p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <label className="text-xs sm:text-sm font-medium text-stone-200">
              Potencia de Amplificación en Auriculares (Ganancia)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
              {settings.gain.toFixed(1)}x ({gainDb >= 0 ? `+${gainDb}` : gainDb} dB)
            </span>
          </div>
        </div>

        {/* Range slider */}
        <div className="space-y-1">
          <input
            id="gain-range-slider"
            type="range"
            min="0"
            max="6"
            step="0.1"
            value={settings.gain}
            onChange={(e) => onUpdateSettings({ gain: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-stone-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-stone-500 font-mono">
            <span>0x (Silencio)</span>
            <span>1.0x (Normal)</span>
            <span>2.5x (+8dB)</span>
            <span>4.0x (+12dB)</span>
            <span>6.0x (+15dB Ultra)</span>
          </div>
        </div>

        {/* Quick Gain Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-stone-400 font-medium">Accesos rápidos:</span>
          {[
            { label: 'Normal (1x)', val: 1.0 },
            { label: 'Leve (1.5x)', val: 1.5 },
            { label: 'Medio (2.2x)', val: 2.2 },
            { label: 'Fuerte (3.5x)', val: 3.5 },
            { label: 'Super Oído (5.0x)', val: 5.0 },
          ].map((preset) => (
            <button
              key={preset.val}
              onClick={() => handleGainPreset(preset.val)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                Math.abs(settings.gain - preset.val) < 0.15
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                  : 'bg-stone-800 text-stone-400 hover:text-stone-200 border-stone-700/80 hover:bg-stone-750'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTINUOUS PAN SLIDER */}
      <div className="space-y-2 bg-stone-950/40 border border-stone-800/80 p-4 rounded-xl">
        <div className="flex items-center justify-between text-xs">
          <span className="text-stone-300 font-medium flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            Balance Manual de Oído (Paneo L / R)
          </span>
          <span className="font-mono text-stone-300 text-[11px]">
            {settings.pan === 0
              ? 'Centro (50/50)'
              : settings.pan < 0
              ? `${Math.round(Math.abs(settings.pan) * 100)}% Izquierdo`
              : `${Math.round(settings.pan * 100)}% Derecho`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-stone-400">L</span>
          <input
            id="pan-range-slider"
            type="range"
            min="-1"
            max="1"
            step="0.05"
            value={settings.pan}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdateSettings({
                pan: val,
                routingMode: 'custom-pan',
              });
            }}
            className="w-full accent-cyan-500 cursor-pointer h-2 bg-stone-800 rounded-lg appearance-none"
          />
          <span className="text-[11px] font-bold text-stone-400">R</span>
          <button
            id="center-pan-btn"
            onClick={() => onUpdateSettings({ pan: 0, routingMode: 'stereo' })}
            className="px-2.5 py-1 text-xs rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700 cursor-pointer"
          >
            Centrar
          </button>
        </div>
      </div>
    </div>
  );
};
