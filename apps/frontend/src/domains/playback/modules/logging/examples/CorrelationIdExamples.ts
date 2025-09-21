/**
 * Examples of using enhanced correlation ID support
 * Phase 5.1.4: Demonstrating correlation ID propagation and async tracking
 */

import {
  usePlaybackCorrelation,
  Correlated,
  PlaybackCorrelationManager,
  createCorrelatedEventEmitter,
} from '../CorrelationIdSupport.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { createPlaybackLogger } from '../PlaybackLoggerIntegration.js';

/**
 * Example 1: Component with correlation tracking
 */
export function AudioPlayerComponent() {
  const { correlationId, propagator, wrapAsync } =
    usePlaybackCorrelation('AudioPlayer');
  const logger = createPlaybackLogger('AudioPlayer', { correlationId });

  const loadTrack = async (trackId: string) => {
    // Wrap async operation with correlation tracking
    return wrapAsync(
      async () => {
        logger.info('Loading track', { trackId });

        // Fetch with correlation headers automatically added
        const fetch = propagator.createFetch();
        const response = await fetch(`/api/tracks/${trackId}`);
        const track = await response.json();

        logger.info('Track loaded', { trackId, duration: track.duration });
        return track;
      },
      'loadTrack',
      { trackId }, // Metadata for the operation
    );
  };

  const play = async () => {
    return wrapAsync(async () => {
      logger.info('Starting playback');

      // Create child operations
      await propagator.wrapAsync(
        () => initializeAudioContext(),
        'initializeAudioContext',
      );

      await propagator.wrapAsync(() => startTransport(), 'startTransport');

      logger.info('Playback started');
    }, 'play');
  };

  return { loadTrack, play, correlationId };
}

/**
 * Example 2: Service class with correlation decorators
 */
export class AudioService {
  private logger = createPlaybackLogger('AudioService');
  private correlationId?: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId;
  }

  @Correlated('loadSamples')
  async loadSamples(instrumentId: string): Promise<void> {
    this.logger.info('Loading samples', { instrumentId });

    // Simulate loading multiple samples with child operations
    const manager = PlaybackCorrelationManager.getInstance(
      EventBus.getInstance(),
    );
    const propagator = manager.createPropagator(this.correlationId!);

    const sampleUrls = await this.getSampleUrls(instrumentId);

    // Load samples in parallel with correlation tracking
    const loadPromises = sampleUrls.map((url, index) =>
      propagator.wrapAsync(
        () => this.loadSingleSample(url),
        `loadSample[${index}]`,
        { url },
      ),
    );

    await Promise.all(loadPromises);
    this.logger.info('All samples loaded', {
      instrumentId,
      count: sampleUrls.length,
    });
  }

  @Correlated('processAudio')
  async processAudio(buffer: AudioBuffer): Promise<AudioBuffer> {
    this.logger.info('Processing audio', {
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
    });

    // Processing logic here
    await new Promise((resolve) => setTimeout(resolve, 100));

    return buffer;
  }

  private async getSampleUrls(instrumentId: string): Promise<string[]> {
    // Mock implementation
    return [`/samples/${instrumentId}/1.mp3`, `/samples/${instrumentId}/2.mp3`];
  }

  private async loadSingleSample(url: string): Promise<AudioBuffer> {
    // Mock implementation
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {} as AudioBuffer;
  }
}

/**
 * Example 3: Cross-component correlation
 */
export class TransportOrchestrator {
  private eventBus = EventBus.getInstance();
  private manager = PlaybackCorrelationManager.getInstance(this.eventBus);
  private logger = createPlaybackLogger('TransportOrchestrator');

  async orchestratePlayback(trackId: string): Promise<void> {
    // Create root correlation context
    const context = this.manager.createContext(
      'orchestratePlayback',
      undefined,
      { trackId },
    );
    const propagator = this.manager.createPropagator(context.correlationId);

    try {
      // Create correlated services
      const audioService = new AudioService(context.correlationId);
      const transportService = new TransportService(context.correlationId);

      // Execute operations in sequence with correlation
      await propagator.wrapAsync(
        () => audioService.loadSamples('drums'),
        'loadDrumSamples',
      );

      await propagator.wrapAsync(
        () => audioService.loadSamples('bass'),
        'loadBassSamples',
      );

      await propagator.wrapAsync(
        () => transportService.initialize(),
        'initializeTransport',
      );

      await propagator.wrapAsync(
        () => transportService.start(),
        'startTransport',
      );

      this.logger.info('Playback orchestration complete', {
        correlationId: context.correlationId,
        trackId,
      });
    } catch (error) {
      // Cancel all related operations
      this.manager.cancelCorrelation(context.correlationId);
      throw error;
    }
  }

  async getPlaybackTrace(correlationId: string): Promise<any[]> {
    // Get full trace of all operations
    const trace = this.manager.getTrace(correlationId);

    return trace.map((context) => ({
      spanId: context.spanId,
      operation: context.operationName,
      startTime: context.startTime,
      metadata: context.metadata,
      childCount: context.children.length,
    }));
  }
}

/**
 * Example 4: Worker with correlation
 */
export class CorrelatedAudioWorker {
  private worker: Worker;
  private correlationId: string;

  constructor(correlationId: string) {
    this.correlationId = correlationId;

    const manager = PlaybackCorrelationManager.getInstance(
      EventBus.getInstance(),
    );
    const propagator = manager.createPropagator(correlationId);

    // Create worker with correlation
    this.worker = propagator.createWorker('/workers/audio-processor.js');

    // Handle messages with correlation context
    this.worker.onmessage = (event) => {
      if (event.data.correlationId === this.correlationId) {
        this.handleWorkerMessage(event.data);
      }
    };
  }

  async processInWorker(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = crypto.randomUUID();

      // Send message with correlation
      this.worker.postMessage({
        id: messageId,
        correlationId: this.correlationId,
        type: 'process',
        data,
      });

      // Set up one-time response handler
      const handler = (event: MessageEvent) => {
        if (event.data.id === messageId) {
          this.worker.removeEventListener('message', handler);

          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };

      this.worker.addEventListener('message', handler);
    });
  }

  private handleWorkerMessage(data: any): void {
    // Handle worker messages
  }
}

/**
 * Example 5: Event-driven correlation
 */
export class CorrelatedEventSystem {
  private eventBus = EventBus.getInstance();
  private correlationId: string;
  private logger = createPlaybackLogger('EventSystem');

  constructor(correlationId: string) {
    this.correlationId = correlationId;
  }

  setupCorrelatedEvents(): void {
    // Create correlated event emitter
    const { emit, on } = createCorrelatedEventEmitter(
      this.correlationId,
      this.eventBus,
    );

    // Emit events with automatic correlation
    emit('audio:initialized', { timestamp: Date.now() });

    // Listen only to events with matching correlation ID
    on('audio:play', (data) => {
      this.logger.info('Received correlated play event', {
        correlationId: this.correlationId,
        data,
      });
    });

    on('audio:error', (data) => {
      this.logger.error('Received correlated error event', {
        correlationId: this.correlationId,
        error: data.error,
      });
    });
  }
}

/**
 * Example 6: Distributed tracing across services
 */
export class DistributedAudioSystem {
  private correlationId: string;
  private manager = PlaybackCorrelationManager.getInstance(
    EventBus.getInstance(),
  );

  constructor() {
    this.correlationId = crypto.randomUUID();
  }

  async performDistributedOperation(): Promise<void> {
    const propagator = this.manager.createPropagator(this.correlationId);

    // Call multiple services with correlation
    const [audioResult, videoResult, metadataResult] = await Promise.all([
      this.callAudioService(propagator),
      this.callVideoService(propagator),
      this.callMetadataService(propagator),
    ]);

    // Get complete trace
    const trace = this.manager.getTrace(this.correlationId);
    console.log('Distributed operation trace:', trace);
  }

  private async callAudioService(propagator: any): Promise<any> {
    return propagator.wrapAsync(async () => {
      const headers = propagator.addHeaders();
      const response = await fetch('/api/audio/process', { headers });
      return response.json();
    }, 'audioService.process');
  }

  private async callVideoService(propagator: any): Promise<any> {
    return propagator.wrapAsync(async () => {
      const headers = propagator.addHeaders();
      const response = await fetch('/api/video/process', { headers });
      return response.json();
    }, 'videoService.process');
  }

  private async callMetadataService(propagator: any): Promise<any> {
    return propagator.wrapAsync(async () => {
      const headers = propagator.addHeaders();
      const response = await fetch('/api/metadata/fetch', { headers });
      return response.json();
    }, 'metadataService.fetch');
  }
}

/**
 * Example 7: Correlation with WebSocket
 */
export class CorrelatedWebSocketClient {
  private ws: WebSocket;
  private correlationId: string;
  private logger = createPlaybackLogger('WebSocketClient');

  constructor(url: string, correlationId: string) {
    this.correlationId = correlationId;

    const manager = PlaybackCorrelationManager.getInstance(
      EventBus.getInstance(),
    );
    const propagator = manager.createPropagator(correlationId);

    // Create WebSocket with correlation ID in URL
    this.ws = propagator.createWebSocket(url);

    this.ws.onopen = () => {
      this.logger.info('WebSocket connected', { correlationId });
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Log with correlation context
      this.logger.info('Received WebSocket message', {
        correlationId: this.correlationId,
        messageType: data.type,
      });
    };
  }

  send(type: string, payload: any): void {
    // Include correlation ID in all messages
    this.ws.send(
      JSON.stringify({
        correlationId: this.correlationId,
        type,
        payload,
        timestamp: Date.now(),
      }),
    );
  }
}

// Mock helper classes
class TransportService {
  constructor(private correlationId?: string) {}

  async initialize(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async start(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function initializeAudioContext(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

async function startTransport(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}
