/**
 * Audio Worker - Background Audio Processing
 *
 * Handles audio buffer processing, effects, and real-time analysis
 * in a background thread for optimal performance.
 *
 * Part of Story 2.1: Subtask 3.5 - Tone.js worker threads for background audio processing
 */

class AudioWorker {
  constructor() {
    this.isInitialized = false;
    this.config = null;
    this.audioContextState = null;
    this.sampleRate = 48000;
    this.bufferSize = 1024;
    this.channelCount = 2;

    // Processing modules
    this.processors = new Map();
    this.analysisBuffer = new Array(1024).fill(0);
    this.fftSize = 2048;

    // Performance monitoring
    this.metrics = {
      processedBuffers: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0,
      errorCount: 0,
      cpuUsage: 0,
      memoryUsage: 0,
    };
  }

  async initialize(payload) {
    try {
      this.config = payload.config;
      this.audioContextState = payload.audioContextState;
      this.sampleRate = payload.audioContextState.sampleRate;
      this.bufferSize = payload.audioContextState.bufferSize;
      this.channelCount = payload.audioContextState.channelCount;

      // Initialize audio processors
      this.initializeProcessors();

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
          processedData = this.processEffects(audioData, parameters);
          break;
        case 'analysis': {
          const analysisResult = this.performAnalysis(audioData, parameters);
          this.sendAnalysisResult(analysisResult);
          processedData = audioData; // Pass through for analysis
          break;
        }
        case 'normalization':
          processedData = this.normalizeAudio(audioData, parameters);
          break;
        case 'filtering':
          processedData = this.applyFiltering(audioData, parameters);
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

  // Audio processing methods

  processEffects(audioData, parameters) {
    const processedData = audioData.map((channelData) => {
      const processedChannel = new Float32Array(channelData.length);

      for (let i = 0; i < channelData.length; i++) {
        let sample = channelData[i];

        // Apply gain
        if (parameters.gain !== undefined) {
          sample *= parameters.gain;
        }

        // Apply distortion
        if (parameters.distortion > 0) {
          const distortionAmount = parameters.distortion;
          sample = Math.tanh(sample * distortionAmount) / distortionAmount;
        }

        // Apply compression
        if (parameters.compression > 0) {
          const threshold = parameters.compressionThreshold || 0.7;
          const ratio = parameters.compressionRatio || 4;

          if (Math.abs(sample) > threshold) {
            const excess = Math.abs(sample) - threshold;
            const compressedExcess = excess / ratio;
            sample = Math.sign(sample) * (threshold + compressedExcess);
          }
        }

        // Clamp to prevent clipping
        processedChannel[i] = Math.max(-1, Math.min(1, sample));
      }

      return processedChannel;
    });

    return processedData;
  }

  performAnalysis(audioData, parameters) {
    const analysis = {
      timestamp: performance.now(),
      rms: [],
      peak: [],
      spectralData: null,
      frequencyBins: [],
    };

    // Analyze each channel
    audioData.forEach((channelData, channelIndex) => {
      // Calculate RMS (Root Mean Square) for volume level
      let sumSquares = 0;
      let peak = 0;

      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        sumSquares += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }

      const rms = Math.sqrt(sumSquares / channelData.length);
      analysis.rms[channelIndex] = rms;
      analysis.peak[channelIndex] = peak;

      // Frequency analysis (simplified FFT)
      if (parameters.includeFrequencyAnalysis) {
        analysis.frequencyBins[channelIndex] = this.performFFT(channelData);
      }
    });

    return analysis;
  }

  performFFT(audioData) {
    // Simplified FFT implementation for basic frequency analysis
    // In a production environment, you'd use a more sophisticated FFT library
    const fftSize = Math.min(this.fftSize, audioData.length);
    const frequencyBins = new Array(fftSize / 2).fill(0);

    for (let k = 0; k < fftSize / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let n = 0; n < fftSize; n++) {
        const angle = (-2 * Math.PI * k * n) / fftSize;
        real += audioData[n] * Math.cos(angle);
        imag += audioData[n] * Math.sin(angle);
      }

      frequencyBins[k] = Math.sqrt(real * real + imag * imag);
    }

    return frequencyBins;
  }

  normalizeAudio(audioData, parameters) {
    const targetLevel = parameters.targetLevel || 0.8;

    // Find global peak across all channels
    let globalPeak = 0;
    audioData.forEach((channelData) => {
      for (let i = 0; i < channelData.length; i++) {
        globalPeak = Math.max(globalPeak, Math.abs(channelData[i]));
      }
    });

    if (globalPeak === 0) return audioData;

    const normalizationFactor = targetLevel / globalPeak;

    return audioData.map((channelData) => {
      const normalizedChannel = new Float32Array(channelData.length);

      for (let i = 0; i < channelData.length; i++) {
        normalizedChannel[i] = channelData[i] * normalizationFactor;
      }

      return normalizedChannel;
    });
  }

  applyFiltering(audioData, parameters) {
    // Simple high-pass and low-pass filtering
    const { highPass, lowPass, cutoffFrequency = 1000 } = parameters;

    if (!highPass && !lowPass) return audioData;

    return audioData.map((channelData) => {
      const filteredChannel = new Float32Array(channelData.length);
      let previousSample = 0;

      const rc = 1.0 / (cutoffFrequency * 2 * Math.PI);
      const dt = 1.0 / this.sampleRate;
      const alpha = dt / (rc + dt);

      for (let i = 0; i < channelData.length; i++) {
        const currentSample = channelData[i];

        if (lowPass) {
          // Low-pass filter
          filteredChannel[i] =
            previousSample + alpha * (currentSample - previousSample);
        } else if (highPass) {
          // High-pass filter
          filteredChannel[i] =
            alpha *
            (previousSample + currentSample - channelData[Math.max(0, i - 1)]);
        }

        previousSample = filteredChannel[i];
      }

      return filteredChannel;
    });
  }

  // Utility methods

  initializeProcessors() {
    // Initialize various audio processors
    this.processors.set('limiter', this.createLimiter());
    this.processors.set('compressor', this.createCompressor());
    this.processors.set('equalizer', this.createEqualizer());
  }

  createLimiter() {
    return {
      threshold: 0.95,
      process: (sample) => {
        return Math.max(-this.threshold, Math.min(this.threshold, sample));
      },
    };
  }

  createCompressor() {
    let envelope = 0;
    const attackTime = 0.003; // 3ms
    const releaseTime = 0.1; // 100ms

    return {
      threshold: 0.7,
      ratio: 4,
      process: (sample) => {
        const inputLevel = Math.abs(sample);
        const targetEnvelope = inputLevel > this.threshold ? inputLevel : 0;

        if (targetEnvelope > envelope) {
          envelope += (targetEnvelope - envelope) * attackTime;
        } else {
          envelope += (targetEnvelope - envelope) * releaseTime;
        }

        const reduction =
          envelope > this.threshold
            ? (envelope - this.threshold) * (1 - 1 / this.ratio)
            : 0;

        return sample * Math.pow(10, -reduction / 20);
      },
    };
  }

  createEqualizer() {
    // Simple 3-band EQ
    return {
      lowGain: 1.0,
      midGain: 1.0,
      highGain: 1.0,
      process: (sample, frequency) => {
        // Simplified EQ processing
        if (frequency < 200) {
          return sample * this.lowGain;
        } else if (frequency < 2000) {
          return sample * this.midGain;
        } else {
          return sample * this.highGain;
        }
      },
    };
  }

  sendAnalysisResult(analysisResult) {
    this.sendMessage('analysis_result', analysisResult);
  }

  updateMetrics(processingTime) {
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.processedBuffers++;

    // Update average processing time (exponential moving average)
    this.metrics.averageProcessingTime =
      this.metrics.averageProcessingTime * 0.9 + processingTime * 0.1;

    // Estimate CPU usage based on processing time vs buffer duration
    const bufferDuration = (this.bufferSize / this.sampleRate) * 1000; // ms
    this.metrics.cpuUsage = Math.min(
      100,
      (processingTime / bufferDuration) * 100,
    );

    // Send metrics update occasionally
    if (this.metrics.processedBuffers % 20 === 0) {
      this.sendMessage('metrics_update', this.metrics);
    }
  }

  getCapabilities() {
    return {
      supportedProcessingTypes: [
        'effects',
        'analysis',
        'normalization',
        'filtering',
      ],
      maxChannels: 8,
      maxBufferSize: 8192,
      supportedSampleRates: [44100, 48000, 96000],
      processorTypes: Array.from(this.processors.keys()),
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
    return `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy() {
    try {
      // Clean up processors
      this.processors.clear();
      this.analysisBuffer = [];

      this.sendMessage('destroy_complete', { status: 'destroyed' });
    } catch (error) {
      this.handleError('destruction', error);
    }
  }
}

// Initialize worker
const audioWorker = new AudioWorker();

// Message handler
onmessage = function (event) {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      audioWorker.initialize(payload);
      break;
    case 'process_audio':
      audioWorker.processAudio(payload);
      break;
    case 'configure':
      audioWorker.config = { ...audioWorker.config, ...payload };
      audioWorker.sendMessage('configure_complete', { status: 'configured' });
      break;
    case 'destroy':
      audioWorker.destroy();
      break;
    default:
      audioWorker.handleError(
        'unknown_message',
        new Error(`Unknown message type: ${type}`),
      );
  }
};

// Error handler
onerror = function (error) {
  audioWorker.handleError('worker_error', error);
};
