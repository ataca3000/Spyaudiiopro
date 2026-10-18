import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  Wand2,
  Download,
  Save,
  RotateCcw,
  Sparkles,
  Waves,
  Music,
  Flame,
  Volume2,
  Check,
  Loader2,
} from 'lucide-react';
import { SavedRecording, AudioEffectsSettings } from '../types';
import {
  DEFAULT_EFFECTS_SETTINGS,
  LiveEffectsChain,
  applyEffectsToAudioBuffer,
} from '../utils/audioEffects';
import { encodeAudioBufferToWav, encodeAudioBufferToMp3, downloadBlobToDevice } from '../utils/audioWav';

interface RecordedAudioEffectsModalProps {
  recording: SavedRecording | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveProcessedRecording: (newRecording: SavedRecording) => Promise<void>;
}

export const RecordedAudioEffectsModal: React.FC<RecordedAudioEffectsModalProps> = ({
  recording,
  isOpen,
  onClose,
  onSaveProcessedRecording,
}) => {
  const [effects, setEffects] = useState<AudioEffectsSettings>({
    ...DEFAULT_EFFECTS_SETTINGS,
    enabled: true,
  });

  // Audio Playback & Preview State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Audio nodes for live preview
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const effectsChainRef = useRef<LiveEffectsChain | null>(null);
  const originalAudioBufferRef = useRef<AudioBuffer | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Load and decode original recording when modal opens
  useEffect(() => {
    if (!isOpen || !recording) {
      stopPlayback();
      return;
    }

    let isCancelled = false;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    recording.blob
      .arrayBuffer()
      .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
      .then((decodedBuffer) => {
        if (isCancelled) return;
        originalAudioBufferRef.current = decodedBuffer;
        setDuration(decodedBuffer.duration);
        pauseOffsetRef.current = 0;
        setCurrentTime(0);
      })
      .catch((err) => {
        console.error('Error decoding recording buffer:', err);
      });

    return () => {
      isCancelled = true;
      stopPlayback();
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    };
  }, [isOpen, recording]);

  // Update live preview effects chain when sliders change
  useEffect(() => {
    if (effectsChainRef.current) {
      effectsChainRef.current.update(effects);
    }
  }, [effects]);

  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
  };

  const startPlayback = (offsetSeconds: number = 0) => {
    if (!originalAudioBufferRef.current || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    stopPlayback();

    // Recreate source
    const source = ctx.createBufferSource();
    source.buffer = originalAudioBufferRef.current;

    // Create or reuse effects chain
    if (!effectsChainRef.current) {
      effectsChainRef.current = new LiveEffectsChain(ctx);
    }
    effectsChainRef.current.update(effects);

    source.connect(effectsChainRef.current.inputNode);
    effectsChainRef.current.outputNode.connect(ctx.destination);

    sourceNodeRef.current = source;
    playbackStartTimeRef.current = ctx.currentTime - offsetSeconds;
    pauseOffsetRef.current = offsetSeconds;

    source.onended = () => {
      setIsPlaying(false);
      pauseOffsetRef.current = 0;
      setCurrentTime(0);
    };

    source.start(0, offsetSeconds);
    setIsPlaying(true);

    const updateTimer = () => {
      if (!audioCtxRef.current || !sourceNodeRef.current) return;
      const current = audioCtxRef.current.currentTime - playbackStartTimeRef.current;
      if (current >= duration) {
        setCurrentTime(duration);
        setIsPlaying(false);
      } else {
        setCurrentTime(Math.min(current, duration));
        animFrameRef.current = requestAnimationFrame(updateTimer);
      }
    };
    animFrameRef.current = requestAnimationFrame(updateTimer);
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (audioCtxRef.current) {
        pauseOffsetRef.current = audioCtxRef.current.currentTime - playbackStartTimeRef.current;
      }
      stopPlayback();
    } else {
      if (pauseOffsetRef.current >= duration) {
        pauseOffsetRef.current = 0;
      }
      startPlayback(pauseOffsetRef.current);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    pauseOffsetRef.current = newTime;
    if (isPlaying) {
      startPlayback(newTime);
    }
  };

  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'studio':
        setEffects({
          enabled: true,
          echoEnabled: false,
          echoTime: 0.3,
          echoFeedback: 0.4,
          echoMix: 0.45,
          reverbEnabled: true,
          reverbDecay: 1.8,
          reverbPreDelay: 0.02,
          reverbMix: 0.35,
          pitchEnabled: false,
          pitchSemitones: 0,
          pitchMix: 1.0,
          distortionEnabled: false,
          distortionAmount: 35,
          distortionTone: 3500,
          distortionMix: 0.4,
        });
        break;
      case 'space-echo':
        setEffects({
          enabled: true,
          echoEnabled: true,
          echoTime: 0.38,
          echoFeedback: 0.55,
          echoMix: 0.5,
          reverbEnabled: true,
          reverbDecay: 3.5,
          reverbPreDelay: 0.03,
          reverbMix: 0.4,
          pitchEnabled: false,
          pitchSemitones: 0,
          pitchMix: 1.0,
          distortionEnabled: false,
          distortionAmount: 35,
          distortionTone: 3500,
          distortionMix: 0.4,
        });
        break;
      case 'chipmunk':
        setEffects({
          enabled: true,
          pitchEnabled: true,
          pitchSemitones: 12,
          pitchMix: 1.0,
          echoEnabled: true,
          echoTime: 0.15,
          echoFeedback: 0.25,
          echoMix: 0.25,
          reverbEnabled: false,
          reverbDecay: 2.0,
          reverbPreDelay: 0.02,
          reverbMix: 0.35,
          distortionEnabled: false,
          distortionAmount: 35,
          distortionTone: 3500,
          distortionMix: 0.4,
        });
        break;
      case 'monster':
        setEffects({
          enabled: true,
          pitchEnabled: true,
          pitchSemitones: -8,
          pitchMix: 1.0,
          distortionEnabled: true,
          distortionAmount: 40,
          distortionTone: 2800,
          distortionMix: 0.35,
          echoEnabled: false,
          echoTime: 0.3,
          echoFeedback: 0.4,
          echoMix: 0.45,
          reverbEnabled: true,
          reverbDecay: 2.5,
          reverbPreDelay: 0.02,
          reverbMix: 0.3,
        });
        break;
      case 'radio':
        setEffects({
          enabled: true,
          distortionEnabled: true,
          distortionAmount: 65,
          distortionTone: 2200,
          distortionMix: 0.65,
          echoEnabled: false,
          echoTime: 0.3,
          echoFeedback: 0.4,
          echoMix: 0.45,
          reverbEnabled: false,
          reverbDecay: 2.0,
          reverbPreDelay: 0.02,
          reverbMix: 0.35,
          pitchEnabled: false,
          pitchSemitones: 0,
          pitchMix: 1.0,
        });
        break;
      case 'reset':
      default:
        setEffects({ ...DEFAULT_EFFECTS_SETTINGS, enabled: true });
        break;
    }
  };

  // Render and save new recording into database
  const handleSaveAsNew = async () => {
    if (!originalAudioBufferRef.current || !recording) return;
    setIsProcessing(true);
    setStatusMessage('Procesando efectos en el audio grabado...');

    try {
      const renderedBuffer = await applyEffectsToAudioBuffer(
        originalAudioBufferRef.current,
        effects
      );
      const wavBlob = encodeAudioBufferToWav(renderedBuffer);

      const timestamp = Date.now();
      const newRec: SavedRecording = {
        id: `rec_${timestamp}`,
        name: `${recording.name} (Con Efectos)`,
        timestamp,
        duration: renderedBuffer.duration,
        size: wavBlob.size,
        blob: wavBlob,
        mimeType: 'audio/wav',
        isProcessed: true,
      };

      await onSaveProcessedRecording(newRec);
      setStatusMessage('¡Guardado con éxito en tu biblioteca!');
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Error processing audio with effects:', err);
      setStatusMessage('Ocurrió un error al procesar el audio.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Render and trigger direct download
  const handleDownloadWithEffects = async () => {
    if (!originalAudioBufferRef.current || !recording) return;
    setIsProcessing(true);
    setStatusMessage('Generando archivo de audio WAV de alta fidelidad...');

    try {
      const renderedBuffer = await applyEffectsToAudioBuffer(
        originalAudioBufferRef.current,
        effects
      );
      const wavBlob = encodeAudioBufferToWav(renderedBuffer);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = recording.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
      a.download = `${safeName}_con_efectos.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage('Descarga iniciada.');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err) {
      console.error('Error rendering WAV for download:', err);
      setStatusMessage('Error al exportar audio.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Render and trigger direct MP3 download
  const handleDownloadMp3WithEffects = async () => {
    if (!originalAudioBufferRef.current || !recording) return;
    setIsProcessing(true);
    setStatusMessage('Generando archivo de audio MP3 (192 kbps)...');

    try {
      const renderedBuffer = await applyEffectsToAudioBuffer(
        originalAudioBufferRef.current,
        effects
      );
      const mp3Blob = encodeAudioBufferToMp3(renderedBuffer, 192);

      const safeName = recording.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
      downloadBlobToDevice(mp3Blob, `${safeName}_con_efectos.mp3`);

      setStatusMessage('Descarga MP3 iniciada.');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err) {
      console.error('Error rendering MP3 for download:', err);
      setStatusMessage('Error al exportar audio en MP3.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !recording) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-800 bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Wand2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-100 flex items-center gap-2">
                Estudio de Efectos para Audio Grabado
              </h3>
              <p className="text-xs text-stone-400 truncate max-w-xs sm:max-w-md">
                {recording.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopPlayback();
              onClose();
            }}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Real-time Audio Preview Bar */}
          <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center font-bold shadow-md transition cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-stone-950" />
                  ) : (
                    <Play className="w-4 h-4 fill-stone-950 ml-0.5" />
                  )}
                </button>
                <div>
                  <span className="text-xs font-semibold text-stone-200">
                    Previsualizar con Efectos
                  </span>
                  <p className="text-[11px] text-stone-400">
                    Escucha el resultado mientras ajustas los controles en tiempo real
                  </p>
                </div>
              </div>

              <div className="text-right font-mono text-xs text-amber-400">
                {Math.floor(currentTime / 60)}:
                {Math.floor(currentTime % 60)
                  .toString()
                  .padStart(2, '0')}{' '}
                /{' '}
                {Math.floor(duration / 60)}:
                {Math.floor(duration % 60)
                  .toString()
                  .padStart(2, '0')}
              </div>
            </div>

            {/* Scrubber Range */}
            <input
              type="range"
              min="0"
              max={duration || 1}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none"
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Perfiles Rápidos:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'studio', label: '🎙️ Estudio Vocal' },
                { id: 'space-echo', label: '🌌 Eco Espacial' },
                { id: 'chipmunk', label: '🐿️ Ardilla (+12 semitonos)' },
                { id: 'monster', label: '👹 Monstruo / Grave' },
                { id: 'radio', label: '📻 Megáfono' },
                { id: 'reset', label: '⚡ Original' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className="px-2.5 py-1 text-xs rounded-lg border bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white border-stone-700 transition cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4 Effects Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. ECO / DELAY */}
            <div
              className={`p-3.5 rounded-xl border transition ${
                effects.echoEnabled
                  ? 'bg-cyan-950/20 border-cyan-500/40'
                  : 'bg-stone-950/40 border-stone-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
                <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-cyan-400" /> Eco / Delay
                </span>
                <button
                  onClick={() =>
                    setEffects((prev) => ({ ...prev, echoEnabled: !prev.echoEnabled }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                    effects.echoEnabled
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}
                >
                  {effects.echoEnabled ? 'ENCENDIDO' : 'APAGADO'}
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-stone-400">Retardo:</span>
                    <span className="font-mono text-cyan-400">
                      {Math.round(effects.echoTime * 1000)} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.02"
                    value={effects.echoTime}
                    onChange={(e) =>
                      setEffects((prev) => ({
                        ...prev,
                        echoTime: parseFloat(e.target.value),
                        echoEnabled: true,
                      }))
                    }
                    className="w-full accent-cyan-400 h-1 bg-stone-800 rounded appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-stone-400">Feedback:</span>
                    <span className="font-mono text-cyan-400">
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
                      setEffects((prev) => ({
                        ...prev,
                        echoFeedback: parseFloat(e.target.value),
                        echoEnabled: true,
                      }))
                    }
                    className="w-full accent-cyan-400 h-1 bg-stone-800 rounded appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 2. REVERBERACIÓN */}
            <div
              className={`p-3.5 rounded-xl border transition ${
                effects.reverbEnabled
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-stone-950/40 border-stone-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
                <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Reverberación
                </span>
                <button
                  onClick={() =>
                    setEffects((prev) => ({
                      ...prev,
                      reverbEnabled: !prev.reverbEnabled,
                    }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                    effects.reverbEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}
                >
                  {effects.reverbEnabled ? 'ENCENDIDO' : 'APAGADO'}
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-stone-400">Decaimiento:</span>
                    <span className="font-mono text-emerald-400">
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
                      setEffects((prev) => ({
                        ...prev,
                        reverbDecay: parseFloat(e.target.value),
                        reverbEnabled: true,
                      }))
                    }
                    className="w-full accent-emerald-400 h-1 bg-stone-800 rounded appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-stone-400">Mezcla:</span>
                    <span className="font-mono text-emerald-400">
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
                      setEffects((prev) => ({
                        ...prev,
                        reverbMix: parseFloat(e.target.value),
                        reverbEnabled: true,
                      }))
                    }
                    className="w-full accent-emerald-400 h-1 bg-stone-800 rounded appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 3. CAMBIO DE TONO (PITCH SHIFT) */}
            <div
              className={`p-3.5 rounded-xl border transition ${
                effects.pitchEnabled
                  ? 'bg-purple-950/20 border-purple-500/40'
                  : 'bg-stone-950/40 border-stone-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
                <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-purple-400" /> Cambio de Tono
                </span>
                <button
                  onClick={() =>
                    setEffects((prev) => ({
                      ...prev,
                      pitchEnabled: !prev.pitchEnabled,
                    }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                    effects.pitchEnabled
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}
                >
                  {effects.pitchEnabled ? 'ENCENDIDO' : 'APAGADO'}
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {/* Direct quick buttons */}
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { semitones: -12, label: '👹 -12' },
                    { semitones: -5, label: '👨 -5' },
                    { semitones: 0, label: '0' },
                    { semitones: 5, label: '👧 +5' },
                    { semitones: 12, label: '🐿️ +12' },
                  ].map((btn) => (
                    <button
                      key={btn.semitones}
                      onClick={() =>
                        setEffects((prev) => ({
                          ...prev,
                          pitchSemitones: btn.semitones,
                          pitchEnabled: true,
                        }))
                      }
                      className={`py-0.5 text-[10px] rounded border font-mono transition cursor-pointer ${
                        effects.pitchSemitones === btn.semitones && effects.pitchEnabled
                          ? 'bg-purple-500/30 text-purple-200 border-purple-400 font-bold'
                          : 'bg-stone-800 text-stone-400 border-stone-700'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-stone-400">Semitonos:</span>
                    <span className="font-mono text-purple-400 font-bold">
                      {effects.pitchSemitones > 0
                        ? `+${effects.pitchSemitones}`
                        : effects.pitchSemitones}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={effects.pitchSemitones}
                    onChange={(e) =>
                      setEffects((prev) => ({
                        ...prev,
                        pitchSemitones: parseInt(e.target.value, 10),
                        pitchEnabled: true,
                      }))
                    }
                    className="w-full accent-purple-400 h-1 bg-stone-800 rounded appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 4. DISTORSIÓN */}
            <div
              className={`p-3.5 rounded-xl border transition ${
                effects.distortionEnabled
                  ? 'bg-rose-950/20 border-rose-500/40'
                  : 'bg-stone-950/40 border-stone-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
                <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-400" /> Distorsión / Overdrive
                </span>
                <button
                  onClick={() =>
                    setEffects((prev) => ({
                      ...prev,
                      distortionEnabled: !prev.distortionEnabled,
                    }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                    effects.distortionEnabled
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}
                >
                  {effects.distortionEnabled ? 'ENCENDIDO' : 'APAGADO'}
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-stone-400">Saturación (Drive):</span>
                    <span className="font-mono text-rose-400">
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
                      setEffects((prev) => ({
                        ...prev,
                        distortionAmount: parseInt(e.target.value, 10),
                        distortionEnabled: true,
                      }))
                    }
                    className="w-full accent-rose-400 h-1 bg-stone-800 rounded appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-stone-400">Tono:</span>
                    <span className="font-mono text-rose-400">
                      {effects.distortionTone} Hz
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="8000"
                    step="250"
                    value={effects.distortionTone}
                    onChange={(e) =>
                      setEffects((prev) => ({
                        ...prev,
                        distortionTone: parseInt(e.target.value, 10),
                        distortionEnabled: true,
                      }))
                    }
                    className="w-full accent-rose-400 h-1 bg-stone-800 rounded appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="p-3 bg-stone-800/90 border border-amber-500/40 rounded-xl text-center text-xs text-amber-300 font-medium">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-800 bg-stone-950/80 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              stopPlayback();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 border border-stone-700/60 hover:bg-stone-800 transition cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Download WAV Button */}
            <button
              disabled={isProcessing}
              onClick={handleDownloadWithEffects}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Descargar audio renderizado en formato WAV (sin pérdidas)"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>WAV</span>
            </button>

            {/* Download MP3 Button */}
            <button
              disabled={isProcessing}
              onClick={handleDownloadMp3WithEffects}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Descargar audio renderizado en formato MP3 comprimido (192 kbps)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>MP3</span>
            </button>

            {/* Save as New Recording Button */}
            <button
              disabled={isProcessing}
              onClick={handleSaveAsNew}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar como Nueva Grabación</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
