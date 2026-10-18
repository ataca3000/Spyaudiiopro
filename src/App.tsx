import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { Visualizer } from './components/Visualizer';
import { MonitorControls } from './components/MonitorControls';
import { RecorderSection } from './components/RecorderSection';
import { Metronome } from './components/Metronome';
import { AudioTuning } from './components/AudioTuning';
import { SoundEffects } from './components/SoundEffects';
import { RecordingsList } from './components/RecordingsList';
import { BluetoothGuideModal } from './components/BluetoothGuideModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AudioEngine } from './utils/audioEngine';
import { DEFAULT_EFFECTS_SETTINGS } from './utils/audioEffects';
import {
  AudioSettings,
  AudioEngineMetrics,
  SavedRecording,
} from './types';
import {
  getAllRecordingsFromDB,
  saveRecordingToDB,
  deleteRecordingFromDB,
  updateRecordingNameInDB,
} from './utils/storage';
import { AlertCircle } from 'lucide-react';

const INITIAL_SETTINGS: AudioSettings = {
  gain: 2.0,
  pan: 0,
  routingMode: 'stereo',
  leftSpeakerEnabled: true,
  rightSpeakerEnabled: true,
  micChannelMode: 'both',
  eqLow: 0,
  eqMid: 2,
  eqHigh: 3,
  eqPreset: 'vocal-clarity',
  lowCutEnabled: true,
  noiseGateEnabled: false,
  noiseGateThreshold: -50,
  safetyLimiterEnabled: true,
  effects: DEFAULT_EFFECTS_SETTINGS,
  recordingSource: 'processed',
  recordingFormat: 'webm',
  hardwareEchoCancellation: false,
  hardwareNoiseSuppression: false,
  hardwareAutoGain: false,
  selectedDeviceId: '',
  selectedOutputDeviceId: '',
  ultraLowLatencyMode: true, // Ultra-low latency mode enabled by default for minimal delay
};

const INITIAL_METRICS: AudioEngineMetrics = {
  rmsLevel: 0,
  peakLevel: 0,
  peakDb: -60,
  leftRms: 0,
  rightRms: 0,
  estimatedLatencyMs: 10,
  hardwareLatencyMs: 8,
  isClipping: false,
};

export default function App() {
  const [settings, setSettings] = useState<AudioSettings>(INITIAL_SETTINGS);
  const [metrics, setMetrics] = useState<AudioEngineMetrics>(INITIAL_METRICS);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState<boolean>(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState<number>(0);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [availableOutputDevices, setAvailableOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [lastSavedRecording, setLastSavedRecording] = useState<SavedRecording | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AudioEngine();
  }
  const engine = engineRef.current;

  // Load saved recordings from IndexedDB on initial mount
  useEffect(() => {
    getAllRecordingsFromDB()
      .then((recs) => {
        setSavedRecordings(recs);
        if (recs.length > 0) {
          setLastSavedRecording(recs[0]);
        }
      })
      .catch((err) => console.error('Error loading recordings from IndexedDB:', err));

    refreshDevices();

    // Listen to device change (e.g. plugging/unplugging headphones or bluetooth)
    const handleDeviceChange = () => {
      refreshDevices();
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
      engine.stop();
    };
  }, []);

  const refreshDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
      setAvailableDevices(audioInputs);
      setAvailableOutputDevices(audioOutputs);
    } catch (err) {
      console.warn('Unable to enumerate audio devices:', err);
    }
  };

  const handleUpdateSettings = useCallback(
    (newPartial: Partial<AudioSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newPartial };

        // Handle output device routing
        if (newPartial.selectedOutputDeviceId !== undefined && engine.isRunning) {
          engine.setOutputDevice(newPartial.selectedOutputDeviceId);
        }

        // Handle hardware constraints restart if ultraLowLatencyMode or selectedDeviceId changes
        if (
          (newPartial.ultraLowLatencyMode !== undefined ||
            newPartial.selectedDeviceId !== undefined) &&
          engine.isRunning &&
          !engine.isRecording
        ) {
          engine.stop();
          engine.start(updated, (newMetrics) => setMetrics(newMetrics)).catch(console.error);
        } else if (engine.isRunning) {
          engine.updateSettings(updated);
        }

        return updated;
      });

      // If user toggled mute back to regular volume
      if (newPartial.gain && newPartial.gain > 0 && isMuted) {
        setIsMuted(false);
      }
    },
    [engine, isMuted]
  );

  // START RECORDING AND LISTENING SIMULTANEOUSLY
  const handleStartRecordAndListen = async () => {
    setErrorMessage(null);

    // 1. Ensure engine is running and streaming to headphones
    if (!engine.isRunning) {
      try {
        await engine.start(settings, (newMetrics) => {
          setMetrics(newMetrics);
        });
        setIsMonitoring(true);
        setIsMuted(false);
        refreshDevices();
      } catch (err: unknown) {
        console.error('Error starting audio engine:', err);
        const error = err as Error;
        setErrorMessage(
          `No se pudo iniciar el micrófono: ${error.message || 'Verifica los permisos de audio.'}`
        );
        return;
      }
    }

    // 2. Start recording in parallel with selected format ('webm' or uncompressed 'wav')
    const recordSuccess = engine.startRecording(
      settings.recordingSource,
      (dur) => {
        setRecordingDurationMs(dur);
      },
      settings.recordingFormat
    );

    if (recordSuccess) {
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordingDurationMs(0);
    } else {
      setErrorMessage('No se pudo iniciar la grabación.');
    }
  };

  // TOGGLE LISTEN ONLY (MONITOR WITHOUT RECORDING)
  const handleToggleListenOnly = async () => {
    setErrorMessage(null);

    if (isMonitoring) {
      // If currently recording as well, stop recording first
      if (isRecording) {
        await handleStopRecording();
      }
      engine.stop();
      setIsMonitoring(false);
      setMetrics(INITIAL_METRICS);
    } else {
      try {
        await engine.start(settings, (newMetrics) => {
          setMetrics(newMetrics);
        });
        setIsMonitoring(true);
        setIsMuted(false);
        refreshDevices();
      } catch (err: unknown) {
        console.error('Error starting monitoring:', err);
        const error = err as Error;
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setErrorMessage(
            'Permiso de micrófono denegado. Por favor, autoriza el acceso al micrófono en tu navegador.'
          );
        } else {
          setErrorMessage(`Error al activar el monitoreo: ${error.message}`);
        }
        setIsMonitoring(false);
      }
    }
  };

  const handlePauseRecording = () => {
    engine.pauseRecording();
    setIsRecordingPaused(true);
  };

  const handleResumeRecording = () => {
    engine.resumeRecording();
    setIsRecordingPaused(false);
  };

  // STOP RECORDING
  const handleStopRecording = async () => {
    try {
      const result = await engine.stopRecording();
      setIsRecording(false);
      setIsRecordingPaused(false);
      setRecordingDurationMs(0);

      const timestamp = Date.now();
      const dateStr = new Date(timestamp).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });
      const timeStr = new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const newRec: SavedRecording = {
        id: `rec_${timestamp}`,
        name: `Grabación ${dateStr} ${timeStr}`,
        timestamp,
        duration: result.duration,
        size: result.blob.size,
        blob: result.blob,
        mimeType: result.mimeType,
        isProcessed: settings.recordingSource === 'processed',
      };

      await saveRecordingToDB(newRec);
      setSavedRecordings((prev) => [newRec, ...prev]);
      setLastSavedRecording(newRec);
    } catch (err) {
      console.error('Error stopping recording:', err);
      setIsRecording(false);
    }
  };

  const handleEmergencyMute = () => {
    if (isMuted) {
      // Restore previous gain
      handleUpdateSettings({ gain: settings.gain <= 0 ? 2.0 : settings.gain });
      setIsMuted(false);
    } else {
      // Mute immediately to silence feedback
      engine.emergencyMute();
      handleUpdateSettings({ gain: 0 });
      setIsMuted(true);
    }
  };

  const handleDeleteRecording = async (id: string) => {
    try {
      await deleteRecordingFromDB(id);
      setSavedRecordings((prev) => prev.filter((r) => r.id !== id));
      if (lastSavedRecording?.id === id) {
        setLastSavedRecording(null);
      }
    } catch (err) {
      console.error('Error deleting recording:', err);
    }
  };

  const handleRenameRecording = async (id: string, newName: string) => {
    try {
      await updateRecordingNameInDB(id, newName);
      setSavedRecordings((prev) =>
        prev.map((r) => (r.id === id ? { ...r, name: newName } : r))
      );
      if (lastSavedRecording?.id === id) {
        setLastSavedRecording((prev) => (prev ? { ...prev, name: newName } : null));
      }
    } catch (err) {
      console.error('Error renaming recording:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e0d] text-stone-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Application Header */}
      <Header
        isMonitoring={isMonitoring}
        isRecording={isRecording}
        latencyMs={metrics.hardwareLatencyMs || metrics.estimatedLatencyMs}
        routingMode={settings.routingMode}
        onEmergencyMute={handleEmergencyMute}
        onOpenGuide={() => setIsGuideOpen(true)}
        isMuted={isMuted}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3.5 sm:p-6 space-y-6">
        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-rose-950/70 border border-rose-700/80 text-rose-200 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 font-bold px-2 py-0.5 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Real-time Oscilloscope & Spectrum Visualizer */}
        <Visualizer
          engine={engine}
          isMonitoring={isMonitoring || isRecording}
          metrics={metrics}
          routingMode={settings.routingMode}
          settings={settings}
        />

        {/* Simultaneous Record & Real-Time Live Playback Hub */}
        <RecorderSection
          isMonitoring={isMonitoring}
          isRecording={isRecording}
          isRecordingPaused={isRecordingPaused}
          recordingDurationMs={recordingDurationMs}
          settings={settings}
          latencyMs={metrics.estimatedLatencyMs}
          hardwareLatencyMs={metrics.hardwareLatencyMs}
          lastSavedRecording={lastSavedRecording}
          availableInputDevices={availableDevices}
          availableOutputDevices={availableOutputDevices}
          onUpdateSettings={handleUpdateSettings}
          onStartRecordAndListen={handleStartRecordAndListen}
          onToggleListenOnly={handleToggleListenOnly}
          onPauseRecording={handlePauseRecording}
          onResumeRecording={handleResumeRecording}
          onStopRecording={handleStopRecording}
          onOpenBluetoothGuide={() => setIsGuideOpen(true)}
        />

        {/* Visual & Audio Metronome for Musicians */}
        <Metronome
          isRecording={isRecording}
          recordingDurationMs={recordingDurationMs}
        />

        {/* Channel Routing & Input/Output Gain Controls */}
        <MonitorControls
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          availableDevices={availableDevices}
        />

        {/* Real-time & Studio Sound Effects (Echo, Reverb, Pitch Shift, Distortion) */}
        <SoundEffects
          effects={settings.effects}
          onUpdateEffects={(newEffects) => {
            handleUpdateSettings({
              effects: { ...settings.effects, ...newEffects },
            });
          }}
          isMonitoring={isMonitoring}
        />

        {/* Audio Equalizer, Noise Gate & Safety Limiter */}
        <AudioTuning
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />

        {/* Library of Saved Recordings */}
        <RecordingsList
          recordings={savedRecordings}
          onDeleteRecording={handleDeleteRecording}
          onRenameRecording={handleRenameRecording}
          onSaveProcessedRecording={async (newRec) => {
            await saveRecordingToDB(newRec);
            setSavedRecordings((prev) => [newRec, ...prev]);
            setLastSavedRecording(newRec);
          }}
        />
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-stone-800/80 py-4 px-4 text-center text-xs text-stone-500">
        Amplificador de Micrófono & Monitoreo en Tiempo Real • Soporte de Audio Dual/Mono para Audífonos Bluetooth
      </footer>

      {/* Bluetooth & Dual Earbud Guide Modal */}
      <BluetoothGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
