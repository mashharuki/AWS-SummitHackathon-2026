const BIAS = 0x84;
const CLIP = 32635;
const encodeTable = [
  0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
];

function encodeSample(sample) {
  const sign = (sample >> 8) & 0x80;
  let magnitude = sign !== 0 ? -sample : sample;
  magnitude += BIAS;
  if (magnitude > CLIP) magnitude = CLIP;
  const exponent = encodeTable[(magnitude >> 7) & 0xff];
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa);
}

class RawAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = ({ data }) => {
      switch (data.type) {
        case "setFormat":
          this.isMuted = false;
          this.buffer = [];
          this.bufferSize = data.sampleRate / 4;
          this.format = data.format;
          if (globalThis.LibSampleRate && sampleRate !== data.sampleRate) {
            globalThis.LibSampleRate.create(
              1,
              sampleRate,
              data.sampleRate,
            ).then((resampler) => {
              this.resampler = resampler;
            });
          }
          break;
        case "setMuted":
          this.isMuted = data.isMuted;
          break;
      }
    };
  }

  process(inputs) {
    if (!this.buffer) return true;

    const input = inputs[0];
    if (input.length > 0) {
      let channelData = input[0];
      if (this.resampler) {
        channelData = this.resampler.full(channelData);
      }
      this.buffer.push(...channelData);

      let sum = 0;
      for (const sample of channelData) sum += sample * sample;
      const maxVolume = Math.sqrt(sum / channelData.length);

      if (this.buffer.length >= this.bufferSize) {
        const samples = this.isMuted
          ? new Float32Array(this.buffer.length)
          : new Float32Array(this.buffer);
        const encoded =
          this.format === "ulaw"
            ? new Uint8Array(samples.length)
            : new Int16Array(samples.length);

        for (let index = 0; index < samples.length; index++) {
          const sample = Math.max(-1, Math.min(1, samples[index]));
          let value = sample < 0 ? sample * 32768 : sample * 32767;
          if (this.format === "ulaw") value = encodeSample(Math.round(value));
          encoded[index] = value;
        }

        this.port.postMessage([encoded, maxVolume]);
        this.buffer = [];
      }
    }
    return true;
  }
}

registerProcessor("raw-audio-processor", RawAudioProcessor);
