import React, { useState, useRef, useEffect } from 'react';
import {
  Disc,
  Square,
  Pause,
  Play,
  Headphones,
  Zap,
  Radio,
  CheckCircle2,
  Music2,
  Volume2,
  Sliders,
  AlertCircle,
  Clock,
  ArrowRight,
  Download,
  FileAudio,
  Loader2,
} from 'lucide-react';
import { AudioSettings, AudioRoutingMode, SavedRecording, RecordingFormat } from '../types';
import { convertBlobToWavBlob, downloadBlobToDevice } from '../utils/audioWav';

interface RecorderSectionProps {
  isMonitoring: boolean;
  isRecording: boolean;
  isRecordingPaused: boolean;
  recordingDurationMs: number;
  settings: AudioSettings;
  latencyMs: number;
  hardwareLatencyMs: number;
  lastSavedRecording: SavedRecording | null;
  availableInputDevices: MediaDeviceInfo[];
  availableOutputDevices: MediaDeviceInfo[];
  onUpdateSettings: (newSettings: Partial<AudioSettings>) => void;
  onStartRecordAndListen: () => void;
  onToggleListenOnly: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  onOpenBluetoothGuide: () => void;
}

export const RecorderSection: React.FC<RecorderSectionProps> = ({
  isMonitoring,
  isRecording,
  isRecordingPaused,
  recordingDurationMs,
  settings,
  latencyMs,
  hardwareLatencyMs,
  lastSavedRecording,
  availableInputDevices,
  availableOutputDevices,
  onUpdateSettings,
  onStartRecordAndListen,
  onToggleListenOnly,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onOpenBluetoothGuide,
}) => {
  const [isPlayingLast, setIsPlayingLast] = useState(false);
  const [quickExportFormat, setQuickExportFormat] = useState<RecordingFormat>(
    settings.recordingFormat || 'wav'
  );
  const [isExportingLast, setIsExportingLast] = useState(false);
  const lastAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setQuickExportFormat(settings.recordingFormat);
  }, [settings.recordingFormat]);

  useEffect(() => {
    return () => {
      if (lastAudioRef.current) {
        lastAudioRef.current.pause();
        lastAudioRef.current = null;
      }
    };
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centis = Math.floor((ms % 1000) / 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${centis}`;
  };

  const handleTogglePlayLast = () => {
    if (!lastSavedRecording) return;
    if (isPlayingLast && lastAudioRef.current) {
      lastAudioRef.current.pause();
      setIsPlayingLast(false);
    } else {
      if (!lastAudioRef.current) {
        lastAudioRef.current = new Audio(URL.createObjectURL(lastSavedRecording.blob));
        lastAudioRef.current.onended = () => setIsPlayingLast(false);
      } else {
        lastAudioRef.current.src = URL.createObjectURL(lastSavedRecording.blob);
      }
      lastAudioRef.current.play();
      setIsPlayingLast(true);
    }
  };

  const handleDownloadLast = async () => {
    if (!lastSavedRecording || isExportingLast) return;

    const baseName = lastSavedRecording.name.trim().replace(/\s+/g, '_');

    if (quickExportFormat === 'wav') {
      setIsExportingLast(true);
      try {
        const wavBlob = await convertBlobToWavBlob(lastSavedRecording.blob);
        downloadBlobToDevice(wavBlob, `${baseName}.wav`);
      } catch (err) {
        console.error('Error al exportar en formato WAV sin compresión:', err);
      } finally {
        setIsExportingLast(false);
      }
    } else {
      const ext = lastSavedRecording.mimeType.includes('wav')
        ? 'wav'
        : lastSavedRecording.mimeType.includes('ogg')
        ? 'ogg'
        : lastSavedRecording.mimeType.includes('mp4')
        ? 'm4a'
        : 'webm';
      downloadBlobToDevice(lastSavedRecording.blob, `${baseName}.${ext}`);
    }
  };

  return (
    <div className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
      {/* Title & Live Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Disc className={`w-4 h-4 ${isRecording ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-stone-100 flex items-center gap-2">
              Grabación & Reproducción en Tiempo Real
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                Baja Latencia
              </span>
            </h2>
            <p className="text-[11px] text-stone-400">
              Graba el audio del micrófono y escúchalo simultáneamente por tus audífonos sin retardo.
            </p>
          </div>
        </div>

        {/* Live status badge */}
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-950/90 text-rose-300 border border-rose-600 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              REC & ESCUCHA: {formatTime(recordingDurationMs)}
            </span>
          )}
          {isMonitoring && !isRecording && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              ESCUCHANDO EN AURICULARES
            </span>
          )}
        </div>
      </div>

      {/* Main Dual Action Hub: Start Record + Listen */}
      <div className="p-4 sm:p-5 rounded-2xl bg-stone-950/70 border border-stone-800/90 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Status info with live wave indicator */}
          <div className="flex items-center gap-3.5">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
                isRecording
                  ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-950/50 scale-105 ring-2 ring-rose-500/30'
                  : isMonitoring
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                  : 'bg-stone-800/80 border-stone-700 text-stone-400'
              }`}
            >
              {isRecording ? (
                <Radio className="w-7 h-7 animate-pulse" />
              ) : (
                <Headphones className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-stone-100 tracking-wider">
                {isRecording ? formatTime(recordingDurationMs) : '00:00.0'}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {isRecording ? (
                  <span className="text-rose-300 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                    {isRecordingPaused
                      ? 'Grabación pausada (escucha activa)'
                      : 'Grabando y reproduciendo en directo por audífonos'}
                  </span>
                ) : isMonitoring ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Monitoreo en vivo activo (sin grabar)
                  </span>
                ) : (
                  <span className="text-stone-400">
                    Listo. Presiona el botón para grabar y escuchar a la vez.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!isRecording ? (
              <>
                {/* Primary Button: RECORD & LISTEN SIMULTANEOUSLY */}
                <button
                  onClick={onStartRecordAndListen}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-950/60 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] ring-2 ring-rose-500/30"
                >
                  <Disc className="w-4 h-4" />
                  <span>GRABAR Y ESCUCHAR EN DIRECTO</span>
                </button>

                {/* Secondary Button: LISTEN ONLY */}
                <button
                  onClick={onToggleListenOnly}
                  className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer border ${
                    isMonitoring
                      ? 'bg-stone-800 hover:bg-stone-750 text-stone-200 border-stone-700'
                      : 'bg-emerald-700/80 hover:bg-emerald-600 text-white border-emerald-600/60'
                  }`}
                  title="Solo activar el monitoreo por auriculares sin iniciar grabación"
                >
                  <Headphones className="w-4 h-4" />
                  <span>{isMonitoring ? 'Detener Escucha' : 'Solo Escuchar'}</span>
                </button>
              </>
            ) : (
              <>
                {/* Recording Controls when active */}
                {isRecordingPaused ? (
                  <button
                    onClick={onResumeRecording}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-semibold transition cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Reanudar</span>
                  </button>
                ) : (
                  <button
                    onClick={onPauseRecording}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs sm:text-sm font-semibold transition cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pausar</span>
                  </button>
                )}

                {/* Stop & Save Recording Button */}
                <button
                  onClick={onStopRecording}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-100 hover:bg-white text-stone-950 font-bold text-xs sm:text-sm shadow-md transition cursor-pointer active:scale-95"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>DETENER Y GUARDAR</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Audio Flow Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-stone-800/70 text-xs">
          {/* Micro state */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-stone-900/60 border border-stone-800/80">
            <span
              className={`w-2 h-2 rounded-full ${
                isMonitoring || isRecording ? 'bg-emerald-400 animate-ping' : 'bg-stone-600'
              }`}
            ></span>
            <span className="text-stone-300">
              Micrófono: <strong>{isMonitoring || isRecording ? 'Captando' : 'En reposo'}</strong>
            </span>
          </div>

          {/* Headphone state */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-stone-900/60 border border-stone-800/80">
            <span
              className={`w-2 h-2 rounded-full ${
                isMonitoring || isRecording ? 'bg-cyan-400' : 'bg-stone-600'
              }`}
            ></span>
            <span className="text-stone-300">
              Auriculares:{' '}
              <strong>
                {isMonitoring || isRecording ? 'Reproduciendo en Vivo' : 'En reposo'}
              </strong>
            </span>
          </div>

          {/* Latency state */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-stone-900/60 border border-stone-800/80">
            <div className="flex items-center gap-1.5 text-stone-300">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Búfer de Audio:</span>
            </div>
            <span className="font-mono font-bold text-amber-400">
              ~{hardwareLatencyMs || 8} ms
            </span>
          </div>
        </div>
      </div>

      {/* Just Recorded Highlight Banner (appears immediately after stopping) */}
      {lastSavedRecording && !isRecording && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-amber-950/30 border border-amber-500/50 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-300">
                  ¡Grabación guardada correctamente!
                </span>
                <span className="text-[10px] text-stone-400">
                  ({Math.round(lastSavedRecording.duration)} seg)
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-stone-900/90 text-amber-300 border border-amber-500/30">
                  {lastSavedRecording.mimeType.includes('wav') ? 'WAV 16-bit PCM' : 'WebM / Opus'}
                </span>
              </div>
              <p className="text-xs text-stone-300 font-medium truncate max-w-xs sm:max-w-md">
                {lastSavedRecording.name}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTogglePlayLast}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition cursor-pointer"
            >
              {isPlayingLast ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlayingLast ? 'Pausar' : 'Escuchar Grabación'}</span>
            </button>

            {/* Quick Format Selector + Direct Export Button */}
            <div className="flex items-center rounded-lg bg-stone-900/90 border border-stone-700 p-0.5">
              <select
                value={quickExportFormat}
                onChange={(e) => setQuickExportFormat(e.target.value as RecordingFormat)}
                aria-label="Seleccionar formato de exportación"
                className="bg-transparent text-stone-200 text-xs font-medium px-2 py-1 focus:outline-hidden cursor-pointer"
              >
                <option value="wav" className="bg-stone-900 text-stone-100">
                  WAV Sin Compresión (.wav)
                </option>
                <option value="webm" className="bg-stone-900 text-stone-100">
                  Formato Actual (.{lastSavedRecording.mimeType.includes('wav') ? 'wav' : 'webm'})
                </option>
              </select>
              <button
                onClick={handleDownloadLast}
                disabled={isExportingLast}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-amber-300 hover:text-amber-200 border border-stone-700 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                title="Exportar archivo en el formato seleccionado"
              >
                {isExportingLast ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Exportar {quickExportFormat === 'wav' ? 'WAV' : 'Actual'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bluetooth & Ultra-Low Latency Optimization Settings */}
      <div className="bg-stone-950/40 border border-stone-800/80 p-4 rounded-xl space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-stone-200">
              Optimizador de Latencia para Bluetooth
            </h3>
          </div>
          <button
            onClick={onOpenBluetoothGuide}
            className="text-[11px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
          >
            ¿Cómo reducir el retraso en mis audífonos?
          </button>
        </div>

        {/* Low Latency Switch */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-stone-900/80 border border-stone-800">
          <div className="space-y-0.5 pr-2">
            <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
              <span>Modo Ultra-Baja Latencia Directo</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                RECOMENDADO
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              Desactiva el búfer de filtros del navegador para que el sonido viaje de inmediato del
              micrófono a tus audífonos Bluetooth (~8 ms de latencia interna).
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={settings.ultraLowLatencyMode}
              onChange={(e) => onUpdateSettings({ ultraLowLatencyMode: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>

        {/* Output Device Selection (Bluetooth Headset routing) */}
        {availableOutputDevices.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-cyan-400" />
              Dispositivo de Salida de Audio (Tus Audífonos):
            </label>
            <select
              value={settings.selectedOutputDeviceId}
              onChange={(e) => onUpdateSettings({ selectedOutputDeviceId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-200 text-xs focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="">Salida predeterminada del sistema (Bluetooth / Auriculares)</option>
              {availableOutputDevices.map((dev, idx) => (
                <option key={dev.deviceId || idx} value={dev.deviceId}>
                  {dev.label || `Salida de audio ${idx + 1} (${dev.deviceId.slice(0, 8)}...)`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Track Source Selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
          <Music2 className="w-3.5 h-3.5 text-amber-400" />
          ¿Qué sonido guardar en el archivo grabado?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            onClick={() => onUpdateSettings({ recordingSource: 'processed' })}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
              settings.recordingSource === 'processed'
                ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-stone-800/60 hover:bg-stone-800 border-stone-700/60'
            }`}
          >
            <div className="mt-0.5">
              <CheckCircle2
                className={`w-4 h-4 ${
                  settings.recordingSource === 'processed' ? 'text-amber-400' : 'text-stone-600'
                }`}
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-200">
                Audio Amplificado & Procesado
              </div>
              <p className="text-[11px] text-stone-400">
                Graba con la amplificación y ecualización tal como lo escuchas en tus audífonos.
              </p>
            </div>
          </button>

          <button
            onClick={() => onUpdateSettings({ recordingSource: 'raw' })}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
              settings.recordingSource === 'raw'
                ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-stone-800/60 hover:bg-stone-800 border-stone-700/60'
            }`}
          >
            <div className="mt-0.5">
              <CheckCircle2
                className={`w-4 h-4 ${
                  settings.recordingSource === 'raw' ? 'text-amber-400' : 'text-stone-600'
                }`}
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-200">
                Micrófono Directo (Sin Procesar)
              </div>
              <p className="text-[11px] text-stone-400">
                Graba la señal pura original del micrófono sin cambios de volumen ni filtros.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Recording & Export Format Selector (Uncompressed WAV vs Current Format) */}
      <div className="space-y-2 pt-2 border-t border-stone-800/70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
            <FileAudio className="w-3.5 h-3.5 text-amber-400" />
            Formato de Grabación y Exportación de Audio:
          </label>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 border border-stone-700 text-amber-300">
            Activo: {settings.recordingFormat === 'wav' ? 'WAV Sin Compresión (PCM 16-bit)' : 'Formato Actual (WebM / Opus)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Option 1: Uncompressed WAV */}
          <button
            type="button"
            disabled={isRecording}
            onClick={() => onUpdateSettings({ recordingFormat: 'wav' })}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
              isRecording ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            } ${
              settings.recordingFormat === 'wav'
                ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-stone-800/60 hover:bg-stone-800 border-stone-700/60'
            }`}
          >
            <div className="mt-0.5">
              <CheckCircle2
                className={`w-4 h-4 ${
                  settings.recordingFormat === 'wav' ? 'text-amber-400' : 'text-stone-600'
                }`}
              />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5 flex-wrap">
                <span>WAV Sin Compresión (.wav)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                  PCM 16-BIT LOSSLESS
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                Captura y exporta audio puro de estudio sin compresión ni pérdida de frecuencias. Ideal para edición profesional.
              </p>
            </div>
          </button>

          {/* Option 2: Current Standard Compressed Format (WebM / Opus) */}
          <button
            type="button"
            disabled={isRecording}
            onClick={() => onUpdateSettings({ recordingFormat: 'webm' })}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
              isRecording ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            } ${
              settings.recordingFormat === 'webm'
                ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-stone-800/60 hover:bg-stone-800 border-stone-700/60'
            }`}
          >
            <div className="mt-0.5">
              <CheckCircle2
                className={`w-4 h-4 ${
                  settings.recordingFormat === 'webm' ? 'text-amber-400' : 'text-stone-600'
                }`}
              />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5 flex-wrap">
                <span>Formato Actual (WebM / Opus)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-300 border border-stone-700 font-mono">
                  COMPRIMIDO LIGERO
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                Formato nativo comprimido de alta eficiencia. Ocupa menos espacio y permite exportar a WAV o MP3 después.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
