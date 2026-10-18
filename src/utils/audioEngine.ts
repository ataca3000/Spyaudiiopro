import { AudioSettings, AudioEngineMetrics, MicChannelMode, RecordingFormat } from '../types';
import { LiveEffectsChain } from './audioEffects';
import { backgroundAudio } from './backgroundAudio';
import { encodePcmChunksToWav, convertBlobToWavBlob } from './audioWav';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  // Mic Input Channel Selector Nodes
  private inputPreNode: GainNode | null = null;
  private inputSplitter: ChannelSplitterNode | null = null;
  private micLeftGain: GainNode | null = null;
  private micRightGain: GainNode | null = null;
  private micMixGain: GainNode | null = null;

  // Filters & Processing
  private lowCutFilter: BiquadFilterNode | null = null;
  private eqLowNode: BiquadFilterNode | null = null;
  private eqMidNode: BiquadFilterNode | null = null;
  private eqHighNode: BiquadFilterNode | null = null;
  private noiseGateGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;

  // Live Sound Effects Chain (Distortion, Pitch Shift, Echo/Delay, Reverb)
  private effectsChain: LiveEffectsChain | null = null;

  // Routing Nodes
  private micInputSplitter: ChannelSplitterNode | null = null;
  private micInputMerger: ChannelMergerNode | null = null;
  private micLeftGainNode: GainNode | null = null;
  private micRightGainNode: GainNode | null = null;
  private channelSplitter: ChannelSplitterNode | null = null;
  private channelMerger: ChannelMergerNode | null = null;
  private leftGainNode: GainNode | null = null;
  private rightGainNode: GainNode | null = null;

  // Analyser
  private analyserNode: AnalyserNode | null = null;
  private recordDestination: MediaStreamAudioDestinationNode | null = null;

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingFormat: RecordingFormat = 'webm';
  private pcmProcessorNode: ScriptProcessorNode | null = null;
  private pcmSilentGainNode: GainNode | null = null;
  private pcmLeftChunks: Float32Array[] = [];
  private pcmRightChunks: Float32Array[] = [];
  private recordingStartTime: number = 0;
  private totalPausedMs: number = 0;
  private pauseStartMs: number = 0;
  private recordingTimerInterval: number | null = null;
  private onRecordingTick?: (durationMs: number) => void;

  // Noise Gate State
  private isGateOpen: boolean = true;
  private gateCheckInterval: number | null = null;

  // Callbacks
  private onMetricsCallback?: (metrics: AudioEngineMetrics) => void;
  private metricsAnimFrame: number | null = null;

  public isRunning: boolean = false;
  public isRecording: boolean = false;
  public isRecordingPaused: boolean = false;

  constructor() {}

  public async start(
    settings: AudioSettings,
    onMetrics?: (metrics: AudioEngineMetrics) => void
  ): Promise<{ sampleRate: number; latencyMs: number }> {
    if (this.isRunning) {
      this.updateSettings(settings);
      return {
        sampleRate: this.audioCtx?.sampleRate || 48000,
        latencyMs: this.getEstimatedLatency().estimatedLatencyMs,
      };
    }

    this.onMetricsCallback = onMetrics;

    // Create AudioContext with low-latency hint
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextClass({
      latencyHint: settings.ultraLowLatencyMode ? 0 : 'interactive',
    });

    // Register AudioContext with background keep-alive controller
    backgroundAudio.registerAudioContext(this.audioCtx);

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // Output Device Routing (setSinkId if supported by browser)
    if (settings.selectedOutputDeviceId && 'setSinkId' in this.audioCtx) {
      try {
        await (this.audioCtx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(
          settings.selectedOutputDeviceId
        );
      } catch (e) {
        console.warn('Error setting initial audio output device:', e);
      }
    }

    // Request microphone stream with ultra-low latency constraints when enabled
    const audioConstraints: MediaTrackConstraints = settings.ultraLowLatencyMode
      ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 2 },
          sampleRate: { ideal: 48000 },
        }
      : {
          echoCancellation: settings.hardwareEchoCancellation,
          noiseSuppression: settings.hardwareNoiseSuppression,
          autoGainControl: settings.hardwareAutoGain,
        };

    if (settings.selectedDeviceId) {
      audioConstraints.deviceId = { exact: settings.selectedDeviceId };
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });

    // Build Graph
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

    // 0. Mic Input Channel Routing (allows isolating Left or Right mic capsules)
    this.micInputSplitter = this.audioCtx.createChannelSplitter(2);
    this.micInputMerger = this.audioCtx.createChannelMerger(2);
    this.micLeftGainNode = this.audioCtx.createGain();
    this.micRightGainNode = this.audioCtx.createGain();

    this.sourceNode.connect(this.micInputSplitter);
    this.micInputSplitter.connect(this.micLeftGainNode, 0);
    const micChannelCount = this.sourceNode.channelCount;
    if (micChannelCount >= 2) {
      this.micInputSplitter.connect(this.micRightGainNode, 1);
    } else {
      this.micInputSplitter.connect(this.micRightGainNode, 0);
    }
    this.micLeftGainNode.connect(this.micInputMerger, 0, 0);
    this.micRightGainNode.connect(this.micInputMerger, 0, 1);
    this.applyMicInputRouting(settings);

    // 1. Low-cut / Highpass (80 Hz) - removes handling noise & wind
    this.lowCutFilter = this.audioCtx.createBiquadFilter();
    this.lowCutFilter.type = 'highpass';
    this.lowCutFilter.frequency.value = settings.lowCutEnabled ? 80 : 10;
    this.lowCutFilter.Q.value = 0.7;

    // Connect input merger to low-cut filter
    this.micInputMerger.connect(this.lowCutFilter);

    // 2. 3-Band Equalizer
    this.eqLowNode = this.audioCtx.createBiquadFilter();
    this.eqLowNode.type = 'lowshelf';
    this.eqLowNode.frequency.value = 250;
    this.eqLowNode.gain.value = settings.eqLow;

    this.eqMidNode = this.audioCtx.createBiquadFilter();
    this.eqMidNode.type = 'peaking';
    this.eqMidNode.frequency.value = 2200;
    this.eqMidNode.Q.value = 1.0;
    this.eqMidNode.gain.value = settings.eqMid;

    this.eqHighNode = this.audioCtx.createBiquadFilter();
    this.eqHighNode.type = 'highshelf';
    this.eqHighNode.frequency.value = 6000;
    this.eqHighNode.gain.value = settings.eqHigh;

    // 3. Noise Gate Gain
    this.noiseGateGainNode = this.audioCtx.createGain();
    this.noiseGateGainNode.gain.value = 1.0;

    // 4. Master Gain (Amplifier)
    this.masterGainNode = this.audioCtx.createGain();
    this.masterGainNode.gain.value = settings.gain;

    // 5. Safety Limiter / Compressor (protects hearing against sudden spikes)
    this.limiterNode = this.audioCtx.createDynamicsCompressor();
    if (settings.safetyLimiterEnabled) {
      this.limiterNode.threshold.value = -6; // dB
      this.limiterNode.knee.value = 3;
      this.limiterNode.ratio.value = 16;
      this.limiterNode.attack.value = 0.003;
      this.limiterNode.release.value = 0.08;
    } else {
      this.limiterNode.threshold.value = 0;
      this.limiterNode.ratio.value = 1;
    }

    // 6. Channel Splitting & Earbud Routing
    this.channelSplitter = this.audioCtx.createChannelSplitter(2);
    this.channelMerger = this.audioCtx.createChannelMerger(2);
    this.leftGainNode = this.audioCtx.createGain();
    this.rightGainNode = this.audioCtx.createGain();

    this.applyRouting(settings);

    // 7. Analyser Node for visualizer and meters
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 1024;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // 8. Recording Destination
    this.recordDestination = this.audioCtx.createMediaStreamDestination();

    // 9. Sound Effects Chain (Distortion -> Pitch Shift -> Delay/Echo -> Reverb)
    this.effectsChain = new LiveEffectsChain(this.audioCtx);
    if (settings.effects) {
      this.effectsChain.update(settings.effects);
    }

    // CONNECT THE GRAPH
    // Mic Input Merger -> LowCut -> EQ Low -> EQ Mid -> EQ High -> NoiseGate -> Master Gain -> Effects -> Limiter
    this.lowCutFilter.connect(this.eqLowNode);
    this.eqLowNode.connect(this.eqMidNode);
    this.eqMidNode.connect(this.eqHighNode);
    this.eqHighNode.connect(this.noiseGateGainNode);
    this.noiseGateGainNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.effectsChain.inputNode);
    this.effectsChain.outputNode.connect(this.limiterNode);

    // Limiter connects to Analyser and Record Destination
    // NOTE: Analyser & Recording are tapped HERE, BEFORE the Left/Right speaker output gains!
    // This guarantees that even if an earbud speaker is 100% MUTED/TURNED OFF,
    // the microphone input continues capturing, analyzing, and recording at 100% quality!
    this.limiterNode.connect(this.analyserNode);
    this.limiterNode.connect(this.recordDestination);

    // Limiter connects to Channel Splitter for L/R Earbud Isolation
    this.limiterNode.connect(this.channelSplitter);

    // L output -> Left Gain -> Merger input 0
    this.channelSplitter.connect(this.leftGainNode, 0);
    this.leftGainNode.connect(this.channelMerger, 0, 0);

    // R output (or mono duplicated) -> Right Gain -> Merger input 1
    // Fallback: in mono mic, input 0 also feeds right channel if needed
    const channelCount = this.sourceNode.channelCount;
    if (channelCount >= 2) {
      this.channelSplitter.connect(this.rightGainNode, 1);
    } else {
      this.channelSplitter.connect(this.rightGainNode, 0);
    }
    this.rightGainNode.connect(this.channelMerger, 0, 1);

    // Channel Merger connects to Audio Destination (Headphones/Speakers)
    this.channelMerger.connect(this.audioCtx.destination);

    this.isRunning = true;

    // Start background keep-alive loop to prevent mobile OS/screen lock from freezing audio
    backgroundAudio.startKeepAlive({
      title: '🎧 Monitoreo de Audio en Vivo',
      isRecording: false,
    });

    // Start Metrics loop & Noise gate loop
    this.startMetricsLoop();
    this.startNoiseGateCheck(settings);

    return {
      sampleRate: this.audioCtx.sampleRate,
      latencyMs: this.getEstimatedLatency().estimatedLatencyMs,
    };
  }

  public updateSettings(settings: AudioSettings) {
    if (!this.audioCtx || !this.isRunning) return;

    const now = this.audioCtx.currentTime;

    // Master Gain
    if (this.masterGainNode) {
      this.masterGainNode.gain.cancelScheduledValues(now);
      this.masterGainNode.gain.linearRampToValueAtTime(settings.gain, now + 0.05);
    }

    // Low cut
    if (this.lowCutFilter) {
      this.lowCutFilter.frequency.setValueAtTime(settings.lowCutEnabled ? 80 : 10, now);
    }

    // EQ
    if (this.eqLowNode) {
      this.eqLowNode.gain.cancelScheduledValues(now);
      this.eqLowNode.gain.linearRampToValueAtTime(settings.eqLow, now + 0.05);
    }
    if (this.eqMidNode) {
      this.eqMidNode.gain.cancelScheduledValues(now);
      this.eqMidNode.gain.linearRampToValueAtTime(settings.eqMid, now + 0.05);
    }
    if (this.eqHighNode) {
      this.eqHighNode.gain.cancelScheduledValues(now);
      this.eqHighNode.gain.linearRampToValueAtTime(settings.eqHigh, now + 0.05);
    }

    // Safety Limiter
    if (this.limiterNode) {
      if (settings.safetyLimiterEnabled) {
        this.limiterNode.threshold.setValueAtTime(-6, now);
        this.limiterNode.ratio.setValueAtTime(16, now);
      } else {
        this.limiterNode.threshold.setValueAtTime(0, now);
        this.limiterNode.ratio.setValueAtTime(1, now);
      }
    }

    // Input Mic Channel Routing
    this.applyMicInputRouting(settings);

    // Earbud Channel Routing
    this.applyRouting(settings);

    // Live Sound Effects (Distortion, Pitch Shift, Echo/Delay, Reverb)
    if (this.effectsChain && settings.effects) {
      this.effectsChain.update(settings.effects);
    }
  }

  private applyMicInputRouting(settings: AudioSettings) {
    if (!this.micLeftGainNode || !this.micRightGainNode || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    let targetMicL = 1.0;
    let targetMicR = 1.0;

    if (settings.micChannelMode === 'left') {
      targetMicL = 1.0;
      targetMicR = 0.0;
    } else if (settings.micChannelMode === 'right') {
      targetMicL = 0.0;
      targetMicR = 1.0;
    }

    this.micLeftGainNode.gain.cancelScheduledValues(now);
    this.micLeftGainNode.gain.linearRampToValueAtTime(targetMicL, now + 0.03);

    this.micRightGainNode.gain.cancelScheduledValues(now);
    this.micRightGainNode.gain.linearRampToValueAtTime(targetMicR, now + 0.03);
  }

  private applyRouting(settings: AudioSettings) {
    if (!this.leftGainNode || !this.rightGainNode || !this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    let targetLeft = 1.0;
    let targetRight = 1.0;

    switch (settings.routingMode) {
      case 'left-only':
        // Left Earbud active, Right Earbud totally MUTED
        targetLeft = 1.0;
        targetRight = 0.0;
        break;
      case 'right-only':
        // Right Earbud active, Left Earbud totally MUTED
        targetLeft = 0.0;
        targetRight = 1.0;
        break;
      case 'mono-both':
        // Mono evenly to both earbuds
        targetLeft = 0.85;
        targetRight = 0.85;
        break;
      case 'custom-pan': {
        // Continuous pan between -1 and +1
        // Constant power pan curve
        const angle = ((settings.pan + 1) * Math.PI) / 4;
        targetLeft = Math.cos(angle);
        targetRight = Math.sin(angle);
        break;
      }
      case 'stereo':
      default:
        targetLeft = 1.0;
        targetRight = 1.0;
        break;
    }

    // Explicit Speaker Mute Overrides:
    // If the user turns off an earbud speaker, its speaker gain is set to 0.0.
    // The microphone of that earbud is NEVER affected because it is captured before this stage.
    if (settings.leftSpeakerEnabled === false) {
      targetLeft = 0.0;
    }
    if (settings.rightSpeakerEnabled === false) {
      targetRight = 0.0;
    }

    this.leftGainNode.gain.cancelScheduledValues(now);
    this.leftGainNode.gain.linearRampToValueAtTime(targetLeft, now + 0.03);

    this.rightGainNode.gain.cancelScheduledValues(now);
    this.rightGainNode.gain.linearRampToValueAtTime(targetRight, now + 0.03);
  }

  private startNoiseGateCheck(settings: AudioSettings) {
    if (this.gateCheckInterval) {
      clearInterval(this.gateCheckInterval);
    }

    const buffer = new Float32Array(512);

    this.gateCheckInterval = window.setInterval(() => {
      if (!this.analyserNode || !this.noiseGateGainNode || !this.audioCtx) return;
      if (!settings.noiseGateEnabled) {
        if (!this.isGateOpen) {
          const now = this.audioCtx.currentTime;
          this.noiseGateGainNode.gain.cancelScheduledValues(now);
          this.noiseGateGainNode.gain.linearRampToValueAtTime(1.0, now + 0.05);
          this.isGateOpen = true;
        }
        return;
      }

      this.analyserNode.getFloatTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const rmsDb = 20 * Math.log10(Math.max(rms, 0.00001));

      const now = this.audioCtx.currentTime;
      const threshold = settings.noiseGateThreshold;

      if (rmsDb < threshold) {
        // Below threshold: soft gate mute
        if (this.isGateOpen) {
          this.noiseGateGainNode.gain.cancelScheduledValues(now);
          this.noiseGateGainNode.gain.linearRampToValueAtTime(0.04, now + 0.06); // Smooth cut to avoid clicks
          this.isGateOpen = false;
        }
      } else {
        // Above threshold: open gate
        if (!this.isGateOpen) {
          this.noiseGateGainNode.gain.cancelScheduledValues(now);
          this.noiseGateGainNode.gain.linearRampToValueAtTime(1.0, now + 0.02);
          this.isGateOpen = true;
        }
      }
    }, 40);
  }

  private startMetricsLoop() {
    const timeDomainData = new Float32Array(512);

    const update = () => {
      if (!this.isRunning || !this.analyserNode) return;

      this.analyserNode.getFloatTimeDomainData(timeDomainData);

      let peak = 0;
      let sumSq = 0;
      for (let i = 0; i < timeDomainData.length; i++) {
        const val = Math.abs(timeDomainData[i]);
        if (val > peak) peak = val;
        sumSq += val * val;
      }

      const rms = Math.sqrt(sumSq / timeDomainData.length);
      const peakDb = 20 * Math.log10(Math.max(peak, 0.0001));

      const leftGainVal = this.leftGainNode?.gain.value ?? 1;
      const rightGainVal = this.rightGainNode?.gain.value ?? 1;

      const latencyInfo = this.getEstimatedLatency();

      const metrics: AudioEngineMetrics = {
        rmsLevel: Math.min(rms, 1),
        peakLevel: Math.min(peak, 1),
        peakDb: Math.round(peakDb),
        leftRms: Math.min(rms * leftGainVal, 1),
        rightRms: Math.min(rms * rightGainVal, 1),
        estimatedLatencyMs: latencyInfo.estimatedLatencyMs,
        hardwareLatencyMs: latencyInfo.hardwareLatencyMs,
        isClipping: peak >= 0.98,
      };

      if (this.onMetricsCallback) {
        this.onMetricsCallback(metrics);
      }

      this.metricsAnimFrame = requestAnimationFrame(update);
    };

    this.metricsAnimFrame = requestAnimationFrame(update);
  }

  public getVisualizerData(type: 'waveform' | 'frequency', buffer: Uint8Array) {
    if (!this.analyserNode) return;
    if (type === 'waveform') {
      this.analyserNode.getByteTimeDomainData(buffer as unknown as Uint8Array<ArrayBuffer>);
    } else {
      this.analyserNode.getByteFrequencyData(buffer as unknown as Uint8Array<ArrayBuffer>);
    }
  }

  public getEstimatedLatency(): { hardwareLatencyMs: number; estimatedLatencyMs: number } {
    if (!this.audioCtx) return { hardwareLatencyMs: 8, estimatedLatencyMs: 12 };
    const baseLatency = (this.audioCtx as unknown as { baseLatency?: number }).baseLatency || 0.004;
    const outputLatency = (this.audioCtx as unknown as { outputLatency?: number }).outputLatency || 0.008;
    const hardwareMs = Math.round((baseLatency + outputLatency) * 1000);
    return {
      hardwareLatencyMs: hardwareMs,
      estimatedLatencyMs: Math.max(hardwareMs, 8),
    };
  }

  public async setOutputDevice(deviceId: string): Promise<boolean> {
    if (!this.audioCtx || !('setSinkId' in this.audioCtx)) {
      return false;
    }
    try {
      await (this.audioCtx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
      return true;
    } catch (err) {
      console.warn('Could not set output device:', err);
      return false;
    }
  }

  // Quick panic mute (e.g. for sudden acoustic feedback)
  public emergencyMute() {
    if (this.masterGainNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.masterGainNode.gain.cancelScheduledValues(now);
      this.masterGainNode.gain.setValueAtTime(0, now);
    }
  }

  // RECORDING METHODS
  private cleanupPcmRecorder() {
    if (this.pcmProcessorNode) {
      try {
        this.pcmProcessorNode.onaudioprocess = null;
        this.pcmProcessorNode.disconnect();
      } catch {
        // ignore
      }
      this.pcmProcessorNode = null;
    }
    if (this.pcmSilentGainNode) {
      try {
        this.pcmSilentGainNode.disconnect();
      } catch {
        // ignore
      }
      this.pcmSilentGainNode = null;
    }
  }

  public startRecording(
    source: 'processed' | 'raw',
    onTick?: (durationMs: number) => void,
    format: RecordingFormat = 'webm'
  ): boolean {
    if (this.isRecording) return false;
    if (!this.audioCtx || !this.mediaStream) return false;

    this.onRecordingTick = onTick;
    this.recordedChunks = [];
    this.recordingFormat = format;
    this.pcmLeftChunks = [];
    this.pcmRightChunks = [];
    this.cleanupPcmRecorder();

    // When recording in uncompressed WAV format, tap raw Float32 PCM directly from Web Audio graph
    if (format === 'wav') {
      try {
        const tapNode: AudioNode | null =
          source === 'processed' ? this.limiterNode : this.micInputMerger || this.sourceNode;
        if (tapNode && this.audioCtx) {
          this.pcmProcessorNode = this.audioCtx.createScriptProcessor(4096, 2, 2);
          this.pcmSilentGainNode = this.audioCtx.createGain();
          this.pcmSilentGainNode.gain.value = 0;

          this.pcmProcessorNode.onaudioprocess = (e: AudioProcessingEvent) => {
            if (!this.isRecording || this.isRecordingPaused) return;
            const inputBuffer = e.inputBuffer;
            const left = inputBuffer.getChannelData(0);
            this.pcmLeftChunks.push(new Float32Array(left));
            if (inputBuffer.numberOfChannels >= 2) {
              const right = inputBuffer.getChannelData(1);
              this.pcmRightChunks.push(new Float32Array(right));
            }
          };

          tapNode.connect(this.pcmProcessorNode);
          this.pcmProcessorNode.connect(this.pcmSilentGainNode);
          this.pcmSilentGainNode.connect(this.audioCtx.destination);
        }
      } catch (err) {
        console.warn('Direct PCM capture setup warning, will use WAV conversion fallback:', err);
      }
    }

    let streamToRecord: MediaStream;
    if (source === 'processed' && this.recordDestination) {
      streamToRecord = this.recordDestination.stream;
    } else {
      streamToRecord = this.mediaStream;
    }

    // Supported MIME types
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    let selectedMime = '';
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    try {
      this.mediaRecorder = new MediaRecorder(
        streamToRecord,
        selectedMime ? { mimeType: selectedMime } : undefined
      );
    } catch (err) {
      console.warn('Failed with selected mimeType, falling back to default:', err);
      this.mediaRecorder = new MediaRecorder(streamToRecord);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(250); // Slice every 250ms
    this.isRecording = true;
    this.isRecordingPaused = false;
    this.recordingStartTime = Date.now();
    this.totalPausedMs = 0;
    this.pauseStartMs = 0;

    // Update lock screen controls and status
    backgroundAudio.updateMediaSession({
      title: '🔴 Grabando Audio en Vivo',
      isRecording: true,
      onStopRequest: () => {
        this.stopRecording().catch(() => {});
      },
    });

    // Wall-clock elapsed duration: accurate even when browser tab is throttled in the background
    this.recordingTimerInterval = window.setInterval(() => {
      if (this.isRecording) {
        const now = Date.now();
        const effectiveDuration = this.isRecordingPaused
          ? this.pauseStartMs - this.recordingStartTime - this.totalPausedMs
          : now - this.recordingStartTime - this.totalPausedMs;
        if (this.onRecordingTick) {
          this.onRecordingTick(Math.max(0, effectiveDuration));
        }
      }
    }, 100);

    return true;
  }

  public pauseRecording() {
    if (this.mediaRecorder && this.isRecording && !this.isRecordingPaused) {
      this.mediaRecorder.pause();
      this.isRecordingPaused = true;
      this.pauseStartMs = Date.now();
      backgroundAudio.updateMediaSession({
        title: '⏸️ Grabación en Pausa',
        isRecording: true,
      });
    }
  }

  public resumeRecording() {
    if (this.mediaRecorder && this.isRecording && this.isRecordingPaused) {
      this.mediaRecorder.resume();
      this.isRecordingPaused = false;
      if (this.pauseStartMs > 0) {
        this.totalPausedMs += Date.now() - this.pauseStartMs;
        this.pauseStartMs = 0;
      }
      backgroundAudio.updateMediaSession({
        title: '🔴 Grabando Audio en Vivo',
        isRecording: true,
      });
    }
  }

  public stopRecording(): Promise<{ blob: Blob; mimeType: string; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No active recording'));
        return;
      }

      if (this.recordingTimerInterval) {
        clearInterval(this.recordingTimerInterval);
        this.recordingTimerInterval = null;
      }

      this.cleanupPcmRecorder();

      // Calculate exact non-paused duration using wall-clock
      const currentPause = this.isRecordingPaused && this.pauseStartMs > 0 ? Date.now() - this.pauseStartMs : 0;
      const totalDuration = Math.max(0, (Date.now() - this.recordingStartTime - this.totalPausedMs - currentPause) / 1000);
      this.totalPausedMs = 0;
      this.pauseStartMs = 0;

      // Restore monitoring title on lock-screen
      backgroundAudio.updateMediaSession({
        title: '🎧 Monitoreo de Audio en Vivo',
        isRecording: false,
      });

      const targetFormat = this.recordingFormat;
      const capturedLeft = this.pcmLeftChunks;
      const capturedRight = this.pcmRightChunks;
      const currentSampleRate = this.audioCtx?.sampleRate || 48000;
      this.pcmLeftChunks = [];
      this.pcmRightChunks = [];

      this.mediaRecorder.onstop = async () => {
        const rawMimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const rawBlob = new Blob(this.recordedChunks, { type: rawMimeType });
        this.recordedChunks = [];
        this.isRecording = false;
        this.isRecordingPaused = false;
        this.mediaRecorder = null;

        if (targetFormat === 'wav') {
          try {
            if (capturedLeft.length > 0) {
              const wavBlob = encodePcmChunksToWav(capturedLeft, capturedRight, currentSampleRate);
              resolve({
                blob: wavBlob,
                mimeType: 'audio/wav',
                duration: totalDuration,
              });
              return;
            } else {
              const wavBlob = await convertBlobToWavBlob(rawBlob);
              resolve({
                blob: wavBlob,
                mimeType: 'audio/wav',
                duration: totalDuration,
              });
              return;
            }
          } catch (err) {
            console.warn('Error encoding WAV on stop, falling back to raw blob:', err);
          }
        }

        resolve({
          blob: rawBlob,
          mimeType: rawMimeType,
          duration: totalDuration,
        });
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  public stop() {
    // Release background audio keep-alive and locks
    backgroundAudio.stopKeepAlive();

    if (this.metricsAnimFrame) {
      cancelAnimationFrame(this.metricsAnimFrame);
      this.metricsAnimFrame = null;
    }

    if (this.gateCheckInterval) {
      clearInterval(this.gateCheckInterval);
      this.gateCheckInterval = null;
    }

    this.cleanupPcmRecorder();
    this.pcmLeftChunks = [];
    this.pcmRightChunks = [];

    if (this.isRecording) {
      try {
        this.mediaRecorder?.stop();
      } catch {
        // ignore
      }
      if (this.recordingTimerInterval) {
        clearInterval(this.recordingTimerInterval);
        this.recordingTimerInterval = null;
      }
      this.isRecording = false;
      this.isRecordingPaused = false;
    }

    if (this.effectsChain) {
      this.effectsChain.disconnect();
      this.effectsChain = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioCtx) {
      backgroundAudio.unregisterAudioContext(this.audioCtx);
      this.audioCtx.close();
      this.audioCtx = null;
    }

    this.isRunning = false;
  }
}
