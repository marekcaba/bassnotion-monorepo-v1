/**
 * Analysis Worker - Background Audio Analysis
 *
 * Handles real-time audio analysis including frequency analysis,
 * beat detection, and audio feature extraction in a background thread.
 *
 * Part of Story 2.1: Subtask 3.5 - Tone.js worker threads for background audio processing
 */

class AnalysisWorker {
  constructor() {
    this.isInitialized = false;
    this.config = null;
    this.audioContextState = null;
    this.sampleRate = 48000;
    this.bufferSize = 1024;

    // Analysis processing
    this.fftSize = 2048;
    this.hopSize = 512;
    this.analysisBuffer = [];
    this.frequencyHistory = [];
    this.beatDetection = {
      energyHistory: [],
      lastBeatTime: 0,
      threshold: 1.3,
    };

    // Feature extraction
    this.features = {
      spectralCentroid: [],
      spectralRolloff: [],
      zeroCrossingRate: [],
      rms: [],
      mfcc: [],
    };

    // Performance monitoring
    this.metrics = {
      processedBuffers: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0,
      errorCount: 0,
      analysisResults: 0,
    };
  }

  async initialize(payload) {
    try {
      this.config = payload.config;
      this.audioContextState = payload.audioContextState;
      this.sampleRate = payload.audioContextState.sampleRate;
      this.bufferSize = payload.audioContextState.bufferSize;

      // Initialize analysis parameters
      this.initializeAnalysis();

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
      let analysisResult = null;

      switch (processingType) {
        case 'analysis':
          analysisResult = this.performFullAnalysis(audioData, parameters);
          break;
        case 'frequency':
          analysisResult = this.performFrequencyAnalysis(audioData, parameters);
          break;
        case 'beat':
          analysisResult = this.performBeatDetection(audioData, parameters);
          break;
        case 'features':
          analysisResult = this.extractAudioFeatures(audioData, parameters);
          break;
        default:
          analysisResult = this.performFullAnalysis(audioData, parameters);
          break;
      }

      const processingTime = performance.now() - startTime;
      this.updateMetrics(processingTime);

      // Send analysis result
      this.sendMessage('analysis_result', {
        ...analysisResult,
        processingTime,
        bufferSize: audioData[0]?.length || 0,
        processingType,
      });

      // Also send processing complete for compatibility
      this.sendMessage('processing_complete', {
        analysisResult,
        processingTime,
        bufferSize: audioData[0]?.length || 0,
        processingType,
      });
    } catch (error) {
      this.handleError('processing', error);
    }
  }

  // Analysis methods

  performFullAnalysis(audioData, parameters) {
    const result = {
      timestamp: performance.now(),
      frequency: this.performFrequencyAnalysis(audioData, parameters),
      beat: this.performBeatDetection(audioData, parameters),
      features: this.extractAudioFeatures(audioData, parameters),
      volume: this.calculateVolumeMetrics(audioData),
    };

    return result;
  }

  performFrequencyAnalysis(audioData, parameters) {
    const { includePhase = false, windowType = 'hann' } = parameters;
    const channelResults = [];

    audioData.forEach((channelData) => {
      // Apply windowing
      const windowedData = this.applyWindow(channelData, windowType);

      // Perform FFT
      const fftResult = this.performFFT(windowedData, this.fftSize);

      // Calculate magnitude spectrum
      const magnitudes = new Array(this.fftSize / 2);
      const phases = includePhase ? new Array(this.fftSize / 2) : null;

      for (let i = 0; i < this.fftSize / 2; i++) {
        const real = fftResult.real[i];
        const imag = fftResult.imag[i];
        magnitudes[i] = Math.sqrt(real * real + imag * imag);

        if (includePhase) {
          phases[i] = Math.atan2(imag, real);
        }
      }

      // Calculate frequency bins
      const frequencyBins = new Array(this.fftSize / 2);
      for (let i = 0; i < this.fftSize / 2; i++) {
        frequencyBins[i] = (i * this.sampleRate) / this.fftSize;
      }

      channelResults.push({
        magnitudes,
        phases,
        frequencyBins,
        fundamentalFreq: this.findFundamentalFrequency(
          magnitudes,
          frequencyBins,
        ),
        spectralPeaks: this.findSpectralPeaks(magnitudes, frequencyBins, 5),
      });
    });

    // Store frequency history for beat detection
    this.updateFrequencyHistory(channelResults);

    return {
      channels: channelResults,
      dominantFreq: this.findDominantFrequency(channelResults),
      spectralCentroid: this.calculateSpectralCentroid(channelResults[0]),
      spectralRolloff: this.calculateSpectralRolloff(channelResults[0]),
    };
  }

  performBeatDetection(audioData, parameters) {
    const { sensitivityThreshold = 1.3 } = parameters;
    this.beatDetection.threshold = sensitivityThreshold;

    // Calculate energy for each channel
    const channelEnergies = audioData.map((channelData) => {
      let energy = 0;
      for (let i = 0; i < channelData.length; i++) {
        energy += channelData[i] * channelData[i];
      }
      return energy / channelData.length;
    });

    const totalEnergy = channelEnergies.reduce(
      (sum, energy) => sum + energy,
      0,
    );

    // Add to energy history
    this.beatDetection.energyHistory.push(totalEnergy);
    if (this.beatDetection.energyHistory.length > 50) {
      this.beatDetection.energyHistory.shift();
    }

    // Calculate average energy
    const avgEnergy =
      this.beatDetection.energyHistory.reduce((sum, e) => sum + e, 0) /
      this.beatDetection.energyHistory.length;

    // Detect beat
    const currentTime = performance.now();
    const timeSinceLastBeat = currentTime - this.beatDetection.lastBeatTime;
    const isBeat =
      totalEnergy > avgEnergy * this.beatDetection.threshold &&
      timeSinceLastBeat > 200; // Minimum 200ms between beats

    if (isBeat) {
      this.beatDetection.lastBeatTime = currentTime;
    }

    return {
      isBeat,
      energy: totalEnergy,
      averageEnergy: avgEnergy,
      energyRatio: totalEnergy / avgEnergy,
      timeSinceLastBeat,
      estimatedTempo: this.estimateTempo(),
      confidence: Math.min(
        1,
        totalEnergy / avgEnergy / this.beatDetection.threshold,
      ),
    };
  }

  extractAudioFeatures(audioData, parameters) {
    const features = {};

    // Zero Crossing Rate
    features.zeroCrossingRate = audioData.map((channelData) => {
      let crossings = 0;
      for (let i = 1; i < channelData.length; i++) {
        if (channelData[i] >= 0 !== channelData[i - 1] >= 0) {
          crossings++;
        }
      }
      return crossings / channelData.length;
    });

    // RMS Energy
    features.rms = audioData.map((channelData) => {
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      return Math.sqrt(sum / channelData.length);
    });

    // Spectral features from frequency analysis
    const freqAnalysis = this.performFrequencyAnalysis(audioData, parameters);
    features.spectralCentroid = freqAnalysis.spectralCentroid;
    features.spectralRolloff = freqAnalysis.spectralRolloff;

    // Update feature history
    this.updateFeatureHistory(features);

    return features;
  }

  calculateVolumeMetrics(audioData) {
    const channelMetrics = audioData.map((channelData) => {
      let peak = 0;
      let rms = 0;

      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.abs(channelData[i]);
        peak = Math.max(peak, sample);
        rms += channelData[i] * channelData[i];
      }

      rms = Math.sqrt(rms / channelData.length);

      return { peak, rms };
    });

    return {
      channels: channelMetrics,
      overallPeak: Math.max(...channelMetrics.map((m) => m.peak)),
      overallRMS: Math.sqrt(
        channelMetrics.reduce((sum, m) => sum + m.rms * m.rms, 0) /
          channelMetrics.length,
      ),
      dynamicRange:
        Math.max(...channelMetrics.map((m) => m.peak)) /
        Math.max(0.001, Math.min(...channelMetrics.map((m) => m.rms))),
    };
  }

  // Utility methods

  initializeAnalysis() {
    // Initialize analysis buffers and parameters
    this.analysisBuffer = new Array(this.fftSize).fill(0);
    this.frequencyHistory = [];

    // Reset feature history
    Object.keys(this.features).forEach((key) => {
      this.features[key] = [];
    });
  }

  applyWindow(data, windowType) {
    const windowed = new Float32Array(data.length);

    for (let i = 0; i < data.length; i++) {
      let window = 1;

      switch (windowType) {
        case 'hann':
          window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (data.length - 1)));
          break;
        case 'hamming':
          window =
            0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (data.length - 1));
          break;
        case 'blackman':
          window =
            0.42 -
            0.5 * Math.cos((2 * Math.PI * i) / (data.length - 1)) +
            0.08 * Math.cos((4 * Math.PI * i) / (data.length - 1));
          break;
        default: // rectangular
          window = 1;
      }

      windowed[i] = data[i] * window;
    }

    return windowed;
  }

  performFFT(data, fftSize) {
    // Simple DFT implementation (would use FFT library in production)
    const real = new Array(fftSize).fill(0);
    const imag = new Array(fftSize).fill(0);

    for (let k = 0; k < fftSize; k++) {
      for (let n = 0; n < Math.min(data.length, fftSize); n++) {
        const angle = (-2 * Math.PI * k * n) / fftSize;
        real[k] += data[n] * Math.cos(angle);
        imag[k] += data[n] * Math.sin(angle);
      }
    }

    return { real, imag };
  }

  findFundamentalFrequency(magnitudes, frequencyBins) {
    let maxMagnitude = 0;
    let fundamentalIndex = 0;

    // Look for fundamental in reasonable range (80Hz - 2kHz)
    const minIndex = Math.floor(
      (80 * magnitudes.length) / (this.sampleRate / 2),
    );
    const maxIndex = Math.floor(
      (2000 * magnitudes.length) / (this.sampleRate / 2),
    );

    for (let i = minIndex; i < Math.min(maxIndex, magnitudes.length); i++) {
      if (magnitudes[i] > maxMagnitude) {
        maxMagnitude = magnitudes[i];
        fundamentalIndex = i;
      }
    }

    return frequencyBins[fundamentalIndex];
  }

  findSpectralPeaks(magnitudes, frequencyBins, numPeaks) {
    const peaks = [];

    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (
        magnitudes[i] > magnitudes[i - 1] &&
        magnitudes[i] > magnitudes[i + 1]
      ) {
        peaks.push({
          frequency: frequencyBins[i],
          magnitude: magnitudes[i],
          index: i,
        });
      }
    }

    // Sort by magnitude and return top peaks
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    return peaks.slice(0, numPeaks);
  }

  calculateSpectralCentroid(channelResult) {
    const { magnitudes, frequencyBins } = channelResult;
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < magnitudes.length; i++) {
      numerator += frequencyBins[i] * magnitudes[i];
      denominator += magnitudes[i];
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  calculateSpectralRolloff(channelResult, threshold = 0.85) {
    const { magnitudes, frequencyBins } = channelResult;
    const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    const thresholdEnergy = totalEnergy * threshold;

    let cumulativeEnergy = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      cumulativeEnergy += magnitudes[i] * magnitudes[i];
      if (cumulativeEnergy >= thresholdEnergy) {
        return frequencyBins[i];
      }
    }

    return frequencyBins[frequencyBins.length - 1];
  }

  findDominantFrequency(channelResults) {
    if (channelResults.length === 0) return 0;

    // Average dominant frequencies across channels
    const dominantFreqs = channelResults.map(
      (result) => result.fundamentalFreq,
    );
    return (
      dominantFreqs.reduce((sum, freq) => sum + freq, 0) / dominantFreqs.length
    );
  }

  estimateTempo() {
    if (this.beatDetection.energyHistory.length < 10) return 0;

    // Simple tempo estimation based on energy peaks
    // TODO: implement proper beat tracking with recent beats analysis
    const avgInterval = 200; // Placeholder - would implement proper beat tracking

    return 60000 / avgInterval; // Convert to BPM
  }

  updateFrequencyHistory(channelResults) {
    this.frequencyHistory.push(channelResults);
    if (this.frequencyHistory.length > 100) {
      this.frequencyHistory.shift();
    }
  }

  updateFeatureHistory(features) {
    Object.keys(features).forEach((key) => {
      if (!this.features[key]) this.features[key] = [];
      this.features[key].push(features[key]);
      if (this.features[key].length > 50) {
        this.features[key].shift();
      }
    });
  }

  updateMetrics(processingTime) {
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.processedBuffers++;
    this.metrics.analysisResults++;
    this.metrics.averageProcessingTime =
      this.metrics.averageProcessingTime * 0.9 + processingTime * 0.1;

    // Send metrics update occasionally
    if (this.metrics.processedBuffers % 20 === 0) {
      this.sendMessage('metrics_update', this.metrics);
    }
  }

  getCapabilities() {
    return {
      supportedAnalysisTypes: ['frequency', 'beat', 'features', 'volume'],
      fftSizes: [512, 1024, 2048, 4096],
      windowTypes: ['hann', 'hamming', 'blackman', 'rectangular'],
      maxChannels: 8,
      realTimeAnalysis: true,
      beatDetection: true,
      featureExtraction: true,
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
    return `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy() {
    try {
      // Clean up analysis buffers
      this.analysisBuffer = [];
      this.frequencyHistory = [];

      Object.keys(this.features).forEach((key) => {
        this.features[key] = [];
      });

      this.sendMessage('destroy_complete', { status: 'destroyed' });
    } catch (error) {
      this.handleError('destruction', error);
    }
  }
}

// Initialize worker
const analysisWorker = new AnalysisWorker();

// Message handler
onmessage = function (event) {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      analysisWorker.initialize(payload);
      break;
    case 'process_audio':
      analysisWorker.processAudio(payload);
      break;
    case 'configure':
      analysisWorker.config = { ...analysisWorker.config, ...payload };
      analysisWorker.sendMessage('configure_complete', {
        status: 'configured',
      });
      break;
    case 'destroy':
      analysisWorker.destroy();
      break;
    default:
      analysisWorker.handleError(
        'unknown_message',
        new Error(`Unknown message type: ${type}`),
      );
  }
};

// Error handler
onerror = function (error) {
  analysisWorker.handleError('worker_error', error);
};
