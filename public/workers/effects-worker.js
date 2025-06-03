/**
 * Effects Worker - Background Audio Effects Processing
 *
 * Handles advanced audio effects processing in a background thread
 * for complex effects like reverb, delay, and real-time filtering.
 *
 * Part of Story 2.1: Subtask 3.5 - Tone.js worker threads for background audio processing
 */

class EffectsWorker {
  constructor() {
    this.isInitialized = false;
    this.config = null;
    this.audioContextState = null;
    this.sampleRate = 48000;
    this.bufferSize = 1024;

    // Effects processing
    this.effects = new Map();
    this.delayLines = new Map();
    this.filterStates = new Map();

    // Performance monitoring
    this.metrics = {
      processedBuffers: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0,
      errorCount: 0,
      activeEffects: 0,
    };
  }

  async initialize(payload) {
    try {
      this.config = payload.config;
      this.audioContextState = payload.audioContextState;
      this.sampleRate = payload.audioContextState.sampleRate;
      this.bufferSize = payload.audioContextState.bufferSize;

      // Initialize effects processors
      this.initializeEffects();

      this.isInitialized = true;
      this.sendMessage('init_complete', {
        status: 'initialized',
        capabilities: this.getCapabilities(),
      });
    } catch (error) {
      this.handleError('initialization', error);
    }
  }

  processAudio(payload) {
    if (!this.isInitialized) {
      this.handleError('processing', new Error('Worker not initialized'));
      return;
    }

    const startTime = performance.now();

    try {
      const { audioData, processingType, parameters = {} } = payload;
      let processedData = audioData;

      switch (processingType) {
        case 'effects':
          processedData = this.applyEffects(audioData, parameters);
          break;
        case 'reverb':
          processedData = this.applyReverb(audioData, parameters);
          break;
        case 'delay':
          processedData = this.applyDelay(audioData, parameters);
          break;
        case 'chorus':
          processedData = this.applyChorus(audioData, parameters);
          break;
        case 'eq':
          processedData = this.applyEqualizer(audioData, parameters);
          break;
        default:
          // Pass through
          break;
      }

      const processingTime = performance.now() - startTime;
      this.updateMetrics(processingTime);

      // Transfer ownership back to main thread
      const transferables = processedData.map((buffer) => buffer.buffer);

      this.sendMessage(
        'processing_complete',
        {
          audioData: processedData,
          processingTime,
          bufferSize: audioData[0]?.length || 0,
          processingType,
        },
        transferables,
      );
    } catch (error) {
      this.handleError('processing', error);
    }
  }

  // Effects processing methods

  applyEffects(audioData, parameters) {
    // General effects processing pipeline
    let processedData = audioData;

    if (parameters.reverb > 0) {
      processedData = this.applyReverb(processedData, {
        wetness: parameters.reverb,
        roomSize: parameters.reverbRoom || 0.5,
        damping: parameters.reverbDamping || 0.5,
      });
    }

    if (parameters.delay > 0) {
      processedData = this.applyDelay(processedData, {
        wetness: parameters.delay,
        delayTime: parameters.delayTime || 0.25,
        feedback: parameters.delayFeedback || 0.3,
      });
    }

    if (parameters.chorus > 0) {
      processedData = this.applyChorus(processedData, {
        wetness: parameters.chorus,
        rate: parameters.chorusRate || 2.0,
        depth: parameters.chorusDepth || 0.5,
      });
    }

    return processedData;
  }

  applyReverb(audioData, parameters) {
    const { wetness = 0.3, roomSize = 0.5, damping = 0.5 } = parameters;

    return audioData.map((channelData, channelIndex) => {
      const processed = new Float32Array(channelData.length);
      const reverbBuffer = this.getOrCreateDelayLine(
        `reverb_${channelIndex}`,
        Math.floor(this.sampleRate * 2),
      ); // 2 second max reverb

      for (let i = 0; i < channelData.length; i++) {
        const input = channelData[i];

        // Simple Schroeder reverb approximation
        const delayedSample = reverbBuffer.read(
          Math.floor(roomSize * this.sampleRate * 0.5),
        );
        const reverbSample = input + delayedSample * (1 - damping) * 0.7;

        reverbBuffer.write(reverbSample);

        // Mix wet and dry signals
        processed[i] = input * (1 - wetness) + reverbSample * wetness;
      }

      return processed;
    });
  }

  applyDelay(audioData, parameters) {
    const { wetness = 0.3, delayTime = 0.25, feedback = 0.3 } = parameters;
    const delaySamples = Math.floor(delayTime * this.sampleRate);

    return audioData.map((channelData, channelIndex) => {
      const processed = new Float32Array(channelData.length);
      const delayBuffer = this.getOrCreateDelayLine(
        `delay_${channelIndex}`,
        delaySamples * 2,
      );

      for (let i = 0; i < channelData.length; i++) {
        const input = channelData[i];
        const delayedSample = delayBuffer.read(delaySamples);
        const delaySample = input + delayedSample * feedback;

        delayBuffer.write(delaySample);

        // Mix wet and dry signals
        processed[i] = input * (1 - wetness) + delayedSample * wetness;
      }

      return processed;
    });
  }

  applyChorus(audioData, parameters) {
    const { wetness = 0.3, rate = 2.0, depth = 0.5 } = parameters;
    const maxDelay = Math.floor(this.sampleRate * 0.02); // 20ms max delay

    return audioData.map((channelData, channelIndex) => {
      const processed = new Float32Array(channelData.length);
      const chorusBuffer = this.getOrCreateDelayLine(
        `chorus_${channelIndex}`,
        maxDelay * 2,
      );

      for (let i = 0; i < channelData.length; i++) {
        const input = channelData[i];

        // LFO for modulation
        const lfoPhase = (i / this.sampleRate) * rate * 2 * Math.PI;
        const modulation = Math.sin(lfoPhase) * depth;
        const delaySamples = Math.floor(maxDelay * 0.5 * (1 + modulation));

        const delayedSample = chorusBuffer.read(delaySamples);
        chorusBuffer.write(input);

        // Mix wet and dry signals
        processed[i] = input * (1 - wetness) + delayedSample * wetness;
      }

      return processed;
    });
  }

  applyEqualizer(audioData, parameters) {
    const { lowGain = 1.0, midGain = 1.0, highGain = 1.0 } = parameters;

    return audioData.map((channelData, channelIndex) => {
      const processed = new Float32Array(channelData.length);
      const filterState = this.getOrCreateFilterState(`eq_${channelIndex}`);

      for (let i = 0; i < channelData.length; i++) {
        const input = channelData[i];

        // Simple 3-band EQ using state variable filters
        const lowpass = this.processFilter(input, filterState.low, 200);
        const highpass = this.processFilter(input, filterState.high, 2000);
        const bandpass = input - lowpass - highpass;

        processed[i] =
          lowpass * lowGain + bandpass * midGain + highpass * highGain;
      }

      return processed;
    });
  }

  // Utility methods

  initializeEffects() {
    // Initialize effect processors
    this.effects.set('reverb', { active: false, parameters: {} });
    this.effects.set('delay', { active: false, parameters: {} });
    this.effects.set('chorus', { active: false, parameters: {} });
    this.effects.set('eq', { active: false, parameters: {} });
  }

  getOrCreateDelayLine(id, maxLength) {
    if (!this.delayLines.has(id)) {
      this.delayLines.set(id, new CircularBuffer(maxLength));
    }
    return this.delayLines.get(id);
  }

  getOrCreateFilterState(id) {
    if (!this.filterStates.has(id)) {
      this.filterStates.set(id, {
        low: { x1: 0, x2: 0, y1: 0, y2: 0 },
        high: { x1: 0, x2: 0, y1: 0, y2: 0 },
      });
    }
    return this.filterStates.get(id);
  }

  processFilter(input, state, cutoff) {
    // Simple biquad filter implementation
    const freq = cutoff / this.sampleRate;
    const q = 0.707; // Butterworth response

    const omega = 2 * Math.PI * freq;
    const sin = Math.sin(omega);
    const cos = Math.cos(omega);
    const alpha = sin / (2 * q);

    const b0 = (1 - cos) / 2;
    const b1 = 1 - cos;
    const b2 = (1 - cos) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cos;
    const a2 = 1 - alpha;

    const output =
      (b0 / a0) * input +
      (b1 / a0) * state.x1 +
      (b2 / a0) * state.x2 -
      (a1 / a0) * state.y1 -
      (a2 / a0) * state.y2;

    state.x2 = state.x1;
    state.x1 = input;
    state.y2 = state.y1;
    state.y1 = output;

    return output;
  }

  updateMetrics(processingTime) {
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.processedBuffers++;
    this.metrics.averageProcessingTime =
      this.metrics.averageProcessingTime * 0.9 + processingTime * 0.1;
    this.metrics.activeEffects = Array.from(this.effects.values()).filter(
      (effect) => effect.active,
    ).length;

    // Send metrics update occasionally
    if (this.metrics.processedBuffers % 15 === 0) {
      this.sendMessage('metrics_update', this.metrics);
    }
  }

  getCapabilities() {
    return {
      supportedEffects: ['reverb', 'delay', 'chorus', 'eq'],
      maxChannels: 8,
      maxBufferSize: 8192,
      supportedSampleRates: [44100, 48000, 96000],
      lowLatencyMode: true,
    };
  }

  handleError(context, error) {
    this.metrics.errorCount++;

    const errorMessage = {
      context,
      message: error.message,
      stack: error.stack,
      timestamp: performance.now(),
      metrics: this.metrics,
    };

    this.sendMessage('error', errorMessage);
  }

  sendMessage(type, payload, transferables = []) {
    const message = {
      id: this.generateMessageId(),
      type,
      payload,
      timestamp: performance.now(),
    };

    if (transferables.length > 0) {
      postMessage(message, transferables);
    } else {
      postMessage(message);
    }
  }

  generateMessageId() {
    return `effects-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy() {
    try {
      // Clean up delay lines and filters
      this.delayLines.clear();
      this.filterStates.clear();
      this.effects.clear();

      this.sendMessage('destroy_complete', { status: 'destroyed' });
    } catch (error) {
      this.handleError('destruction', error);
    }
  }
}

// Simple circular buffer for delay effects
class CircularBuffer {
  constructor(length) {
    this.buffer = new Float32Array(length);
    this.writeIndex = 0;
    this.length = length;
  }

  write(sample) {
    this.buffer[this.writeIndex] = sample;
    this.writeIndex = (this.writeIndex + 1) % this.length;
  }

  read(delaySamples) {
    const readIndex =
      (this.writeIndex - delaySamples + this.length) % this.length;
    return this.buffer[readIndex];
  }
}

// Initialize worker
const effectsWorker = new EffectsWorker();

// Message handler
onmessage = function (event) {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      effectsWorker.initialize(payload);
      break;
    case 'process_audio':
      effectsWorker.processAudio(payload);
      break;
    case 'configure':
      effectsWorker.config = { ...effectsWorker.config, ...payload };
      effectsWorker.sendMessage('configure_complete', { status: 'configured' });
      break;
    case 'destroy':
      effectsWorker.destroy();
      break;
    default:
      effectsWorker.handleError(
        'unknown_message',
        new Error(`Unknown message type: ${type}`),
      );
  }
};

// Error handler
onerror = function (error) {
  effectsWorker.handleError('worker_error', error);
};
