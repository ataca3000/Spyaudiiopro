import { AudioEffectsSettings } from '../types';

export const DEFAULT_EFFECTS_SETTINGS: AudioEffectsSettings = {
  enabled: false,
  // Eco / Delay
  echoEnabled: false,
  echoTime: 0.3,
  echoFeedback: 0.4,
  echoMix: 0.45,
  // Reverberación
  reverbEnabled: false,
  reverbDecay: 2.0,
  reverbPreDelay: 0.02,
  reverbMix: 0.4,
  // Cambio de tono
  pitchEnabled: false,
  pitchSemitones: 0,
  pitchMix: 1.0,
  // Distorsión
  distortionEnabled: false,
  distortionAmount: 35,
  distortionTone: 3500,
  distortionMix: 0.4,
};

/**
 * Creates a soft-to-hard saturation curve for the WaveShaperNode.
 */
export function makeDistortionCurve(amount: number): Float32Array {
  const k = Math.max(0, Math.min(100, amount));
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;

  if (k === 0) {
    for (let i = 0; i < n_samples; ++i) {
      curve[i] = (i * 2) / n_samples - 1;
    }
    return curve;
  }

  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    // Sigmoid curve with adjustable saturation
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * Generates an impulse response buffer for realistic synthetic convolution reverb.
 */
export function createReverbImpulse(
  ctx: BaseAudioContext,
  decaySeconds: number,
  preDelaySeconds: number
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(sampleRate * 0.1, Math.floor(sampleRate * decaySeconds));
  const preDelaySamples = Math.floor(sampleRate * preDelaySeconds);
  const impulse = ctx.createBuffer(2, length, sampleRate);

  const leftChannel = impulse.getChannelData(0);
  const rightChannel = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    if (i < preDelaySamples) {
      leftChannel[i] = 0;
      rightChannel[i] = 0;
    } else {
      const t = (i - preDelaySamples) / (length - preDelaySamples);
      // Exponential decay
      const envelope = Math.exp(-3 * t);
      // Gaussian noise with stereo decorrelation
      leftChannel[i] = (Math.random() * 2 - 1) * envelope;
      rightChannel[i] = (Math.random() * 2 - 1) * envelope;
    }
  }

  return impulse;
}

/**
 * Real-time Live Effects Chain for Web Audio.
 * Connects into the AudioEngine pipeline:
 * Input -> (Distortion -> Pitch Shifter -> Delay/Echo -> Reverb) -> Output
 */
export class LiveEffectsChain {
  private ctx: BaseAudioContext;
  public inputNode: GainNode;
  public outputNode: GainNode;

  // Master bypass nodes
  private dryMasterGain: GainNode;
  private wetMasterGain: GainNode;

  // 1. Distortion Sub-chain
  private distInputGain: GainNode;
  private distWaveShaper: WaveShaperNode;
  private distToneFilter: BiquadFilterNode;
  private distDryGain: GainNode;
  private distWetGain: GainNode;
  private distOutputGain: GainNode;

  // 2. Pitch Shifter Sub-chain (Granular Delay Crossfading)
  private pitchInputGain: GainNode;
  private pitchOutputGain: GainNode;
  private pitchProcessor: ScriptProcessorNode | null = null;
  private pitchRingBuffer: Float32Array;
  private pitchWriteIndex: number = 0;
  private pitchReadIndexFloat: number = 0;
  private currentSemitones: number = 0;

  // 3. Echo / Delay Sub-chain
  private echoInputGain: GainNode;
  private echoDelayNode: DelayNode;
  private echoFeedbackGain: GainNode;
  private echoDryGain: GainNode;
  private echoWetGain: GainNode;
  private echoOutputGain: GainNode;

  // 4. Reverb Sub-chain
  private reverbInputGain: GainNode;
  private reverbConvolver: ConvolverNode;
  private reverbDryGain: GainNode;
  private reverbWetGain: GainNode;
  private reverbOutputGain: GainNode;

  private currentDecay: number = 2.0;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;

    // Master nodes
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryMasterGain = ctx.createGain();
    this.wetMasterGain = ctx.createGain();

    // 1. Distortion Nodes
    this.distInputGain = ctx.createGain();
    this.distWaveShaper = ctx.createWaveShaper();
    this.distWaveShaper.oversample = '4x';
    this.distToneFilter = ctx.createBiquadFilter();
    this.distToneFilter.type = 'lowpass';
    this.distToneFilter.frequency.value = 3500;
    this.distDryGain = ctx.createGain();
    this.distWetGain = ctx.createGain();
    this.distOutputGain = ctx.createGain();

    // Wire Distortion
    this.distInputGain.connect(this.distDryGain);
    this.distDryGain.connect(this.distOutputGain);
    this.distInputGain.connect(this.distWaveShaper);
    this.distWaveShaper.connect(this.distToneFilter);
    this.distToneFilter.connect(this.distWetGain);
    this.distWetGain.connect(this.distOutputGain);

    // 2. Pitch Shifter Setup (Granular Ring Buffer Pitch Shifter)
    this.pitchInputGain = ctx.createGain();
    this.pitchOutputGain = ctx.createGain();
    const ringBufferSize = 16384;
    this.pitchRingBuffer = new Float32Array(ringBufferSize);

    try {
      this.pitchProcessor = ctx.createScriptProcessor(2048, 1, 1);
      this.pitchProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const outputData = e.outputBuffer.getChannelData(0);
        const bufferLen = inputData.length;

        // If pitch shift is not active (semitones === 0), pass through transparently
        if (this.currentSemitones === 0) {
          outputData.set(inputData);
          return;
        }

        const pitchRatio = Math.pow(2, this.currentSemitones / 12);
        const ringLen = this.pitchRingBuffer.length;

        // Write input into ring buffer
        for (let i = 0; i < bufferLen; i++) {
          this.pitchRingBuffer[this.pitchWriteIndex] = inputData[i];
          this.pitchWriteIndex = (this.pitchWriteIndex + 1) % ringLen;
        }

        // Read out with pitchRatio speed, wrapping around smoothly
        for (let i = 0; i < bufferLen; i++) {
          const indexFloor = Math.floor(this.pitchReadIndexFloat);
          const fraction = this.pitchReadIndexFloat - indexFloor;
          const s1 = this.pitchRingBuffer[indexFloor % ringLen];
          const s2 = this.pitchRingBuffer[(indexFloor + 1) % ringLen];

          // Linear interpolation for clean sound
          outputData[i] = s1 + fraction * (s2 - s1);

          this.pitchReadIndexFloat += pitchRatio;
          if (this.pitchReadIndexFloat >= ringLen) {
            this.pitchReadIndexFloat -= ringLen;
          }

          // Keep read pointer from drifting too far from write pointer
          const distance = (this.pitchWriteIndex - this.pitchReadIndexFloat + ringLen) % ringLen;
          if (distance > 6000 || distance < 200) {
            this.pitchReadIndexFloat = (this.pitchWriteIndex - 2048 + ringLen) % ringLen;
          }
        }
      };

      this.distOutputGain.connect(this.pitchInputGain);
      this.pitchInputGain.connect(this.pitchProcessor);
      this.pitchProcessor.connect(this.pitchOutputGain);
    } catch {
      // Fallback if ScriptProcessor is restricted
      this.distOutputGain.connect(this.pitchInputGain);
      this.pitchInputGain.connect(this.pitchOutputGain);
    }

    // 3. Echo / Delay Nodes
    this.echoInputGain = ctx.createGain();
    this.echoDelayNode = ctx.createDelay(2.0);
    this.echoFeedbackGain = ctx.createGain();
    this.echoDryGain = ctx.createGain();
    this.echoWetGain = ctx.createGain();
    this.echoOutputGain = ctx.createGain();

    // Wire Echo
    this.pitchOutputGain.connect(this.echoInputGain);
    this.echoInputGain.connect(this.echoDryGain);
    this.echoDryGain.connect(this.echoOutputGain);

    this.echoInputGain.connect(this.echoDelayNode);
    this.echoDelayNode.connect(this.echoWetGain);
    this.echoWetGain.connect(this.echoOutputGain);

    // Feedback loop
    this.echoDelayNode.connect(this.echoFeedbackGain);
    this.echoFeedbackGain.connect(this.echoDelayNode);

    // 4. Reverb Nodes
    this.reverbInputGain = ctx.createGain();
    this.reverbConvolver = ctx.createConvolver();
    this.reverbDryGain = ctx.createGain();
    this.reverbWetGain = ctx.createGain();
    this.reverbOutputGain = ctx.createGain();

    // Initialize default impulse
    try {
      this.reverbConvolver.buffer = createReverbImpulse(ctx, 2.0, 0.02);
    } catch (e) {
      console.warn('Convolver buffer init warning:', e);
    }

    // Wire Reverb
    this.echoOutputGain.connect(this.reverbInputGain);
    this.reverbInputGain.connect(this.reverbDryGain);
    this.reverbDryGain.connect(this.reverbOutputGain);

    this.reverbInputGain.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.reverbOutputGain);

    // Wire Reverb Output into Wet Master Gain
    this.reverbOutputGain.connect(this.wetMasterGain);

    // Wire Master Dry / Wet into Output
    this.inputNode.connect(this.dryMasterGain);
    this.dryMasterGain.connect(this.outputNode);

    this.inputNode.connect(this.distInputGain);
    this.wetMasterGain.connect(this.outputNode);

    // Initial default settings: bypass is active (dryMaster = 1, wetMaster = 0)
    this.dryMasterGain.gain.value = 1.0;
    this.wetMasterGain.gain.value = 0.0;
  }

  public update(effects: AudioEffectsSettings) {
    const now = this.ctx.currentTime;
    const isMasterActive = effects.enabled;

    // Master Bypass
    this.dryMasterGain.gain.cancelScheduledValues(now);
    this.wetMasterGain.gain.cancelScheduledValues(now);
    if (!isMasterActive) {
      this.dryMasterGain.gain.linearRampToValueAtTime(1.0, now + 0.03);
      this.wetMasterGain.gain.linearRampToValueAtTime(0.0, now + 0.03);
      return;
    } else {
      this.dryMasterGain.gain.linearRampToValueAtTime(0.0, now + 0.03);
      this.wetMasterGain.gain.linearRampToValueAtTime(1.0, now + 0.03);
    }

    // 1. Distortion
    if (effects.distortionEnabled) {
      this.distWaveShaper.curve = makeDistortionCurve(effects.distortionAmount) as unknown as Float32Array<ArrayBuffer>;
      this.distToneFilter.frequency.setValueAtTime(effects.distortionTone, now);
      const wet = Math.max(0, Math.min(1, effects.distortionMix));
      this.distDryGain.gain.setValueAtTime(1.0 - wet * 0.5, now);
      this.distWetGain.gain.setValueAtTime(wet, now);
    } else {
      this.distDryGain.gain.setValueAtTime(1.0, now);
      this.distWetGain.gain.setValueAtTime(0.0, now);
    }

    // 2. Pitch Shifter
    if (effects.pitchEnabled) {
      this.currentSemitones = effects.pitchSemitones;
    } else {
      this.currentSemitones = 0;
    }

    // 3. Echo / Delay
    if (effects.echoEnabled) {
      const delayTime = Math.max(0.01, Math.min(1.5, effects.echoTime));
      const feedback = Math.max(0, Math.min(0.85, effects.echoFeedback));
      const mix = Math.max(0, Math.min(1, effects.echoMix));

      this.echoDelayNode.delayTime.cancelScheduledValues(now);
      this.echoDelayNode.delayTime.linearRampToValueAtTime(delayTime, now + 0.05);

      this.echoFeedbackGain.gain.cancelScheduledValues(now);
      this.echoFeedbackGain.gain.linearRampToValueAtTime(feedback, now + 0.05);

      this.echoDryGain.gain.setValueAtTime(1.0, now);
      this.echoWetGain.gain.setValueAtTime(mix, now);
    } else {
      this.echoDryGain.gain.setValueAtTime(1.0, now);
      this.echoWetGain.gain.setValueAtTime(0.0, now);
      this.echoFeedbackGain.gain.setValueAtTime(0.0, now);
    }

    // 4. Reverb
    if (effects.reverbEnabled) {
      const mix = Math.max(0, Math.min(1, effects.reverbMix));
      this.reverbDryGain.gain.setValueAtTime(1.0 - mix * 0.4, now);
      this.reverbWetGain.gain.setValueAtTime(mix, now);

      // Regenerate impulse if decay changed significantly
      if (Math.abs(this.currentDecay - effects.reverbDecay) > 0.3) {
        this.currentDecay = effects.reverbDecay;
        try {
          this.reverbConvolver.buffer = createReverbImpulse(
            this.ctx,
            effects.reverbDecay,
            effects.reverbPreDelay
          );
        } catch {
          // ignore
        }
      }
    } else {
      this.reverbDryGain.gain.setValueAtTime(1.0, now);
      this.reverbWetGain.gain.setValueAtTime(0.0, now);
    }
  }

  public disconnect() {
    try {
      this.inputNode.disconnect();
      this.outputNode.disconnect();
      if (this.pitchProcessor) {
        this.pitchProcessor.disconnect();
        this.pitchProcessor.onaudioprocess = null;
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Offline / Recorded Audio Processor:
 * Applies distortion, pitch shifting, echo/delay, and reverb to an AudioBuffer,
 * returning a new pristine processed AudioBuffer.
 */
export async function applyEffectsToAudioBuffer(
  inputBuffer: AudioBuffer,
  effects: AudioEffectsSettings
): Promise<AudioBuffer> {
  // If master bypass is enabled and no effects are active, return original clone
  if (
    !effects.enabled ||
    (!effects.echoEnabled &&
      !effects.reverbEnabled &&
      !effects.pitchEnabled &&
      !effects.distortionEnabled)
  ) {
    return inputBuffer;
  }

  const sampleRate = inputBuffer.sampleRate;
  const numChannels = inputBuffer.numberOfChannels;

  // First apply Pitch Shift to the buffer if enabled
  let sourceBuffer = inputBuffer;
  if (effects.pitchEnabled && effects.pitchSemitones !== 0) {
    sourceBuffer = pitchShiftAudioBuffer(inputBuffer, effects.pitchSemitones);
  }

  // Calculate extra tail for Reverb and Echo so notes don't get abruptly cut off
  let extraTailSeconds = 0;
  if (effects.echoEnabled) extraTailSeconds = Math.max(extraTailSeconds, effects.echoTime * 3);
  if (effects.reverbEnabled) extraTailSeconds = Math.max(extraTailSeconds, effects.reverbDecay);

  const totalLength = sourceBuffer.length + Math.floor(sampleRate * extraTailSeconds);

  // Use OfflineAudioContext for ultrafast rendering
  const offlineCtx = new OfflineAudioContext(numChannels, totalLength, sampleRate);

  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = sourceBuffer;

  const chain = new LiveEffectsChain(offlineCtx);
  chain.update(effects);

  bufferSource.connect(chain.inputNode);
  chain.outputNode.connect(offlineCtx.destination);

  bufferSource.start(0);
  const renderedBuffer = await offlineCtx.startRendering();

  return renderedBuffer;
}

/**
 * High-quality Granular Time-Domain Pitch Shifter on AudioBuffer.
 * Alters pitch by semitones (-12 to +12) while preserving duration and tempo.
 */
export function pitchShiftAudioBuffer(
  inputBuffer: AudioBuffer,
  semitones: number
): AudioBuffer {
  if (semitones === 0) return inputBuffer;

  const sampleRate = inputBuffer.sampleRate;
  const numChannels = inputBuffer.numberOfChannels;
  const length = inputBuffer.length;

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const tempCtx = new AudioCtx();
  const outputBuffer = tempCtx.createBuffer(numChannels, length, sampleRate);
  tempCtx.close().catch(() => {});

  const pitchRatio = Math.pow(2, semitones / 12);
  const grainSize = Math.floor(sampleRate * 0.04); // 40ms grain size
  const hopSize = Math.floor(grainSize / 4);

  // Hann window array
  const windowTable = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    windowTable[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
  }

  for (let ch = 0; ch < numChannels; ch++) {
    const inputData = inputBuffer.getChannelData(ch);
    const outputData = outputBuffer.getChannelData(ch);
    const normFactor = new Float32Array(length);

    let readPos = 0;
    for (let outPos = 0; outPos + grainSize < length; outPos += hopSize) {
      const inPosFloor = Math.floor(readPos);

      if (inPosFloor + grainSize < length) {
        for (let i = 0; i < grainSize; i++) {
          const sample = inputData[inPosFloor + i] * windowTable[i];
          outputData[outPos + i] += sample;
          normFactor[outPos + i] += windowTable[i];
        }
      }

      readPos += hopSize * pitchRatio;
      if (readPos + grainSize >= length) break;
    }

    // Normalize overlapping windows to prevent amplitude modulation
    for (let i = 0; i < length; i++) {
      if (normFactor[i] > 0.0001) {
        outputData[i] /= normFactor[i];
      }
    }
  }

  return outputBuffer;
}
