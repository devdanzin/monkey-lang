/**
 * Tiny WAV Parser
 * 
 * Read and create WAV audio files:
 * - Parse WAV headers
 * - Extract PCM audio data
 * - Create WAV buffers from samples
 * - Channel/sample rate/bit depth info
 * - Generate test tones (sine, square, sawtooth)
 */

function parseWav(buffer) {
  const view = new DataView(buffer.buffer || buffer);
  
  // RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') throw new Error('Not a WAV file');
  
  const fileSize = view.getUint32(4, true);
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (wave !== 'WAVE') throw new Error('Not a WAV file');
  
  // Find fmt chunk
  let offset = 12;
  let format = null;
  let data = null;
  
  while (offset < buffer.length) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);
    
    if (chunkId === 'fmt ') {
      format = {
        audioFormat: view.getUint16(offset + 8, true),
        numChannels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        byteRate: view.getUint32(offset + 16, true),
        blockAlign: view.getUint16(offset + 20, true),
        bitsPerSample: view.getUint16(offset + 22, true),
      };
    }
    
    if (chunkId === 'data') {
      data = new Uint8Array(buffer.buffer || buffer, offset + 8, chunkSize);
    }
    
    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // padding
  }
  
  if (!format) throw new Error('No fmt chunk');
  
  // Convert raw data to samples
  const samples = extractSamples(data, format);
  
  return { format, samples, duration: samples.length / format.numChannels / format.sampleRate };
}

function extractSamples(data, format) {
  if (!data) return new Float32Array(0);
  const { bitsPerSample, numChannels } = format;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(data.length / bytesPerSample);
  const samples = new Float32Array(numSamples);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  
  for (let i = 0; i < numSamples; i++) {
    const offset = i * bytesPerSample;
    if (bitsPerSample === 8) {
      samples[i] = (view.getUint8(offset) - 128) / 128;
    } else if (bitsPerSample === 16) {
      samples[i] = view.getInt16(offset, true) / 32768;
    } else if (bitsPerSample === 32) {
      samples[i] = view.getInt32(offset, true) / 2147483648;
    }
  }
  return samples;
}

function createWav(samples, opts = {}) {
  const sampleRate = opts.sampleRate || 44100;
  const numChannels = opts.numChannels || 1;
  const bitsPerSample = opts.bitsPerSample || 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const bufferSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write samples
  for (let i = 0; i < samples.length; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    if (bitsPerSample === 16) {
      view.setInt16(44 + i * 2, val * 32767, true);
    } else if (bitsPerSample === 8) {
      view.setUint8(44 + i, (val + 1) * 128);
    }
  }
  
  return new Uint8Array(buffer);
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Tone generators
function sine(freq, duration, sampleRate = 44100) {
  const samples = new Float32Array(Math.floor(duration * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return samples;
}

function square(freq, duration, sampleRate = 44100) {
  const samples = new Float32Array(Math.floor(duration * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin(2 * Math.PI * freq * i / sampleRate) >= 0 ? 1 : -1;
  }
  return samples;
}

function sawtooth(freq, duration, sampleRate = 44100) {
  const samples = new Float32Array(Math.floor(duration * sampleRate));
  const period = sampleRate / freq;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 2 * ((i % period) / period) - 1;
  }
  return samples;
}

module.exports = { parseWav, createWav, sine, square, sawtooth };
