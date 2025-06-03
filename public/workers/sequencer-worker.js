/**
 * Sequencer Worker - Background MIDI Processing
 *
 * Handles MIDI sequencing, timing, and scheduling in a background thread
 * to prevent blocking the main UI thread.
 *
 * Part of Story 2.1: Subtask 3.5 - Tone.js worker threads for background audio processing
 */

/* global importScripts, Tone */

// Import Tone.js for worker context
importScripts('https://unpkg.com/tone@15.0.4/build/Tone.js');

class SequencerWorker {
  constructor() {
    this.isInitialized = false;
    this.config = null;
    this.audioContextState = null;
    this.transport = null;
    this.sequences = new Map();
    this.scheduledEvents = new Map();
    this.midiBuffer = [];
    this.processingTime = 0;

    // Performance monitoring
    this.metrics = {
      processedEvents: 0,
      averageLatency: 0,
      lastProcessingTime: 0,
      errorCount: 0,
    };
  }

  async initialize(payload) {
    try {
      this.config = payload.config;
      this.audioContextState = payload.audioContextState;

      // Initialize Tone.js in worker context
      if (typeof Tone !== 'undefined') {
        // Set up transport with worker-specific configuration
        this.transport = Tone.getTransport();
        this.transport.bpm.value = this.config.tempo;

        // Configure for low-latency processing
        Tone.getContext().lookAhead = 0.05; // 50ms lookahead
        Tone.getContext().updateInterval = 0.025; // 25ms update interval
      }

      this.isInitialized = true;
      this.sendMessage('init_complete', { status: 'initialized' });
    } catch (error) {
      this.handleError('initialization', error);
    }
  }

  processMidi(payload) {
    if (!this.isInitialized) {
      this.handleError('processing', new Error('Worker not initialized'));
      return;
    }

    const startTime = performance.now();
    let scheduledEvent = null;

    try {
      const { midiData, timestamp, scheduleTime, velocity, channel } = payload;

      // Parse MIDI data
      const midiEvent = this.parseMidiData(midiData);

      if (midiEvent) {
        // Schedule the MIDI event
        scheduledEvent = {
          id: this.generateEventId(),
          event: midiEvent,
          scheduleTime,
          velocity,
          channel,
          timestamp,
          status: 'pending',
        };

        this.scheduledEvents.set(scheduledEvent.id, scheduledEvent);

        // Use Tone.js Transport for precise timing
        if (this.transport) {
          this.transport.schedule((time) => {
            this.executeMidiEvent(scheduledEvent, time);
          }, scheduleTime);
        }

        this.metrics.processedEvents++;
      }

      const processingTime = performance.now() - startTime;
      this.updateMetrics(processingTime);

      this.sendMessage('processing_complete', {
        eventId: scheduledEvent?.id,
        processingTime,
        queueLength: this.scheduledEvents.size,
      });
    } catch (error) {
      this.handleError('processing', error);
    }
  }

  processAudio(payload) {
    if (!this.isInitialized) {
      this.handleError('processing', new Error('Worker not initialized'));
      return;
    }

    const startTime = performance.now();

    try {
      const { audioData, processingType, parameters } = payload;
      let processedData = audioData;

      switch (processingType) {
        case 'sequencer':
          processedData = this.processSequencerAudio(audioData, parameters);
          break;
        default:
          // Pass through for non-sequencer processing
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
        },
        transferables,
      );
    } catch (error) {
      this.handleError('processing', error);
    }
  }

  updateState(payload) {
    try {
      if (payload.tempo && this.transport) {
        this.transport.bpm.value = payload.tempo;
      }

      if (payload.config) {
        this.config = { ...this.config, ...payload.config };
      }

      this.sendMessage('state_update', { status: 'updated' });
    } catch (error) {
      this.handleError('state_update', error);
    }
  }

  // Private methods

  parseMidiData(midiData) {
    if (!midiData || midiData.length < 2) {
      return null;
    }

    const status = midiData[0];
    const noteOrCC = midiData[1];
    const velocity = midiData.length > 2 ? midiData[2] : 127;

    // Note on/off events
    if ((status & 0xf0) === 0x90) {
      // Note on
      return {
        type: 'noteOn',
        channel: status & 0x0f,
        note: noteOrCC,
        velocity: velocity,
      };
    } else if ((status & 0xf0) === 0x80) {
      // Note off
      return {
        type: 'noteOff',
        channel: status & 0x0f,
        note: noteOrCC,
        velocity: velocity,
      };
    }

    return null;
  }

  executeMidiEvent(scheduledEvent, time) {
    try {
      const { event } = scheduledEvent;

      // Execute the MIDI event using Tone.js
      if (event.type === 'noteOn') {
        // This would trigger instrument playback in the main thread
        // For now, we just mark it as executed
        scheduledEvent.status = 'executed';
        scheduledEvent.executionTime = time;
      } else if (event.type === 'noteOff') {
        scheduledEvent.status = 'executed';
        scheduledEvent.executionTime = time;
      }

      // Send event execution notification to main thread
      this.sendMessage('midi_event_executed', {
        eventId: scheduledEvent.id,
        event: event,
        executionTime: time,
        latency: time - scheduledEvent.timestamp,
      });
    } catch (error) {
      this.handleError('midi_execution', error);
    }
  }

  processSequencerAudio(audioData, parameters = {}) {
    // Apply sequencer-specific audio processing
    // This could include quantization, swing, timing adjustments

    const processedData = audioData.map((channelData) => {
      const processedChannel = new Float32Array(channelData.length);

      for (let i = 0; i < channelData.length; i++) {
        let sample = channelData[i];

        // Apply swing factor if configured
        if (this.config?.swingFactor > 0) {
          // Simple swing implementation
          const swingAmount = this.config.swingFactor;
          const swingOffset = Math.sin(i * 0.001) * swingAmount * 0.1;
          sample += swingOffset;
        }

        // Apply timing adjustments
        if (parameters.timingAdjustment) {
          sample *= parameters.timingAdjustment;
        }

        processedChannel[i] = Math.max(-1, Math.min(1, sample)); // Clamp
      }

      return processedChannel;
    });

    return processedData;
  }

  updateMetrics(processingTime) {
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.averageLatency =
      this.metrics.averageLatency * 0.9 + processingTime * 0.1;

    // Send metrics update occasionally
    if (this.metrics.processedEvents % 10 === 0) {
      this.sendMessage('metrics_update', this.metrics);
    }
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
      id: payload.eventId || this.generateEventId(),
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

  generateEventId() {
    return `seq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy() {
    try {
      // Clean up scheduled events
      if (this.transport) {
        this.transport.cancel();
      }

      this.scheduledEvents.clear();
      this.sequences.clear();
      this.midiBuffer = [];

      this.sendMessage('destroy_complete', { status: 'destroyed' });
    } catch (error) {
      this.handleError('destruction', error);
    }
  }
}

// Initialize worker
const sequencerWorker = new SequencerWorker();

// Message handler
self.onmessage = function (event) {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      sequencerWorker.initialize(payload);
      break;
    case 'process_midi':
      sequencerWorker.processMidi(payload);
      break;
    case 'process_audio':
      sequencerWorker.processAudio(payload);
      break;
    case 'state_update':
      sequencerWorker.updateState(payload);
      break;
    case 'destroy':
      sequencerWorker.destroy();
      break;
    default:
      sequencerWorker.handleError(
        'unknown_message',
        new Error(`Unknown message type: ${type}`),
      );
  }
};

// Error handler
self.onerror = function (error) {
  sequencerWorker.handleError('worker_error', error);
};
