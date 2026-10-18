/**
 * Audio Export & Conversion Utility
 * Supports converting Web Audio recordings to 16-bit PCM WAV and MP3,
 * downloading directly to device, and triggering the native browser share menu (Web Share API).
 */

import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Utility to convert any Web Audio Blob (webm, ogg, mp4, etc.) to a standard 16-bit PCM WAV Blob.
 */
export async function convertBlobToWavBlob(audioBlob: Blob): Promise<Blob> {
  if (audioBlob.type === 'audio/wav' || audioBlob.type === 'audio/wave' || audioBlob.type === 'audio/x-wav') {
    return audioBlob;
  }

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioCtx();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return encodeAudioBufferToWav(audioBuffer);
  } finally {
    if (audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
  }
}

/**
 * Directly encodes raw uncompressed Float32Array PCM chunks (captured live from Web Audio API)
 * into a lossless 16-bit PCM WAV Blob without passing through any lossy codec.
 */
export function encodePcmChunksToWav(
  leftChunks: Float32Array[],
  rightChunks: Float32Array[],
  sampleRate: number
): Blob {
  const numChannels = rightChunks.length > 0 ? 2 : 1;
  const totalSamplesPerChannel = leftChunks.reduce((acc, chunk) => acc + chunk.length, 0);

  const leftMerged = new Float32Array(totalSamplesPerChannel);
  let offset = 0;
  for (const chunk of leftChunks) {
    leftMerged.set(chunk, offset);
    offset += chunk.length;
  }

  let interleaved: Float32Array;
  if (numChannels === 2) {
    const rightMerged = new Float32Array(totalSamplesPerChannel);
    let rOffset = 0;
    for (const chunk of rightChunks) {
      rightMerged.set(chunk, rOffset);
      rOffset += chunk.length;
    }
    interleaved = interleaveChannels(leftMerged, rightMerged);
  } else {
    interleaved = leftMerged;
  }

  const format = 1; // 1 = 16-bit PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataByteLength = interleaved.length * bytesPerSample;
  const bufferLength = 44 + dataByteLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(view, 8, 'WAVE');

  // fmt Sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data Sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  let writeOffset = 44;
  for (let i = 0; i < interleaved.length; i++, writeOffset += 2) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(writeOffset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Utility to convert any Web Audio Blob (webm, ogg, mp4, etc.) to a standard MP3 Blob.
 */
export async function convertBlobToMp3Blob(audioBlob: Blob, kbps: number = 192): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioCtx();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return encodeAudioBufferToMp3(audioBuffer, kbps);
  } finally {
    if (audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
  }
}

/**
 * Encodes an AudioBuffer into an MP3 Blob using LAME MP3 Encoder.
 */
export function encodeAudioBufferToMp3(buffer: AudioBuffer, kbps: number = 192): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);

  const leftChannel = buffer.getChannelData(0);
  const leftInt16 = convertFloat32ToInt16(leftChannel);

  let rightInt16: Int16Array | null = null;
  if (channels >= 2) {
    rightInt16 = convertFloat32ToInt16(buffer.getChannelData(1));
  }

  const mp3Data: Uint8Array[] = [];
  const chunkSize = 1152; // Standard MP3 frame size

  for (let i = 0; i < leftInt16.length; i += chunkSize) {
    const leftChunk = leftInt16.subarray(i, i + chunkSize);
    let chunk: Uint8Array;
    if (channels >= 2 && rightInt16) {
      const rightChunk = rightInt16.subarray(i, i + chunkSize);
      chunk = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      chunk = encoder.encodeBuffer(leftChunk);
    }
    if (chunk.length > 0) {
      mp3Data.push(chunk);
    }
  }

  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) {
    mp3Data.push(finalChunk);
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

function convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
  const length = float32Array.length;
  const int16Array = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

/**
 * Encodes an AudioBuffer into a WAV Blob (16-bit PCM)
 */
export function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = 16-bit PCM
  const bitDepth = 16;

  let interleaved: Float32Array;
  if (numChannels === 2) {
    interleaved = interleaveChannels(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    interleaved = buffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataByteLength = interleaved.length * bytesPerSample;
  const bufferLength = 44 + dataByteLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true); // File size minus 8
  writeString(view, 8, 'WAVE');

  // fmt Sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data Sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true); // Subchunk2Size

  // Write PCM audio samples (16-bit integer)
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function interleaveChannels(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);

  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }

  return result;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Downloads a Blob directly to the user's device with a given filename.
 */
export function downloadBlobToDevice(blob: Blob, fileName: string): void {
  const cleanName = fileName.replace(/[^\w\s.-]/gi, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Triggers the browser's native share menu using the Web Share API.
 */
export async function shareAudioFile({
  blob,
  fileName,
  title,
  text,
}: {
  blob: Blob;
  fileName: string;
  title?: string;
  text?: string;
}): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return {
      success: false,
      error: 'Tu navegador o dispositivo no soporta el menú nativo de compartir.',
    };
  }

  try {
    const cleanName = fileName.replace(/[^\w\s.-]/gi, '_');
    const mimeType = blob.type || (cleanName.endsWith('.mp3') ? 'audio/mp3' : 'audio/wav');
    const file = new File([blob], cleanName, { type: mimeType });

    // Verify if navigator.canShare supports files on this device
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return {
        success: false,
        error: 'El navegador no admite compartir archivos directamente mediante el menú del sistema.',
      };
    }

    await navigator.share({
      files: [file],
      title: title || cleanName,
      text: text || 'Audio grabado con AudioLive PWA.',
    });

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      // User simply closed the share sheet
      return { success: false, cancelled: true };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error inesperado al compartir.',
    };
  }
}
