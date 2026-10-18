export type AudioRoutingMode = 'stereo' | 'left-only' | 'right-only' | 'mono-both' | 'custom-pan';

export type MicChannelMode = 'both' | 'left' | 'right';

export type EqPreset = 'flat' | 'vocal-clarity' | 'super-ear' | 'bass-cut' | 'treble-boost';

export type RecordingFormat = 'webm' | 'wav';

export interface AudioEffectsSettings {
  enabled: boolean; // Master bypass for effects

  // 1. Eco / Delay
  echoEnabled: boolean;
  echoTime: number; // 0.05 to 1.5 seconds (e.g. 0.3s)
  echoFeedback: number; // 0.0 to 0.85
  echoMix: number; // 0.0 to 1.0

  // 2. Reverberación
  reverbEnabled: boolean;
  reverbDecay: number; // 0.5 to 5.0 seconds
  reverbPreDelay: number; // 0.01 to 0.1 seconds
  reverbMix: number; // 0.0 to 1.0

  // 3. Cambio de tono (Pitch Shift)
  pitchEnabled: boolean;
  pitchSemitones: number; // -12 to +12 semitones
  pitchMix: number; // 0.0 to 1.0

  // 4. Distorsión / Saturación
  distortionEnabled: boolean;
  distortionAmount: number; // 0 to 100
  distortionTone: number; // 800 to 10000 Hz
  distortionMix: number; // 0.0 to 1.0
}

export interface AudioSettings {
  gain: number; // 0.0 to 8.0 (1.0 = normal, 8.0 = 800% / +18dB)
  pan: number; // -1 (left) to 1 (right)
  routingMode: AudioRoutingMode;
  leftSpeakerEnabled: boolean; // Controls whether left earbud speaker emits sound
  rightSpeakerEnabled: boolean; // Controls whether right earbud speaker emits sound
  micChannelMode: MicChannelMode; // Extract L channel, R channel, or both from input microphone
  eqLow: number; // -12 to +12 dB
  eqMid: number; // -12 to +12 dB
  eqHigh: number; // -12 to +12 dB
  eqPreset: EqPreset;
  lowCutEnabled: boolean; // 80Hz highpass filter
  noiseGateEnabled: boolean;
  noiseGateThreshold: number; // -80 to -20 dB
  safetyLimiterEnabled: boolean;
  effects: AudioEffectsSettings; // Sound effects: echo, reverb, pitch shift, distortion
  recordingSource: 'processed' | 'raw';
  recordingFormat: RecordingFormat; // 'webm' (current compressed format) or 'wav' (uncompressed 16-bit PCM)
  hardwareEchoCancellation: boolean;
  hardwareNoiseSuppression: boolean;
  hardwareAutoGain: boolean;
  selectedDeviceId: string;
  selectedOutputDeviceId: string;
  ultraLowLatencyMode: boolean; // Disables heavy OS DSP buffers for instantaneous Bluetooth pass-through
}

export interface SavedRecording {
  id: string;
  name: string;
  timestamp: number;
  duration: number; // in seconds
  size: number; // bytes
  blob: Blob;
  mimeType: string;
  isProcessed: boolean;
}

export interface AudioEngineMetrics {
  rmsLevel: number; // 0 to 1
  peakLevel: number; // 0 to 1
  peakDb: number; // dB
  leftRms: number;
  rightRms: number;
  estimatedLatencyMs: number;
  hardwareLatencyMs: number;
  isClipping: boolean;
}
