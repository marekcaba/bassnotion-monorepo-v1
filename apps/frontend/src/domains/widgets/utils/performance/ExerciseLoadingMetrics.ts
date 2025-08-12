/**
 * Exercise Loading Performance Metrics
 * Measures and tracks loading times for exercise metadata and audio assets
 */

export interface LoadingMetrics {
  exerciseMetadata: {
    startTime: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    error?: string;
  };
  audioEngine: {
    startTime: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    error?: string;
  };
  audioAssets: {
    startTime?: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    samplesLoaded: number;
    error?: string;
  };
  totalLoadTime?: number;
  userInteractionReady?: number; // Time when UI is ready for user interaction
}

export class ExerciseLoadingMetrics {
  private metrics: LoadingMetrics = {
    exerciseMetadata: {
      startTime: 0,
      success: false,
    },
    audioEngine: {
      startTime: 0,
      success: false,
    },
    audioAssets: {
      success: false,
      samplesLoaded: 0,
    },
  };
  
  private pageLoadTime: number;
  
  constructor() {
    // Record page load time
    this.pageLoadTime = performance.now();
  }
  
  // Start exercise metadata loading
  startExerciseMetadataLoad() {
    this.metrics.exerciseMetadata.startTime = performance.now();
    console.log('📊 [METRICS] Starting exercise metadata load');
  }
  
  // Complete exercise metadata loading
  completeExerciseMetadataLoad(success: boolean, error?: string) {
    const endTime = performance.now();
    this.metrics.exerciseMetadata.endTime = endTime;
    this.metrics.exerciseMetadata.duration = endTime - this.metrics.exerciseMetadata.startTime;
    this.metrics.exerciseMetadata.success = success;
    this.metrics.exerciseMetadata.error = error;
    
    console.log(`📊 [METRICS] Exercise metadata load ${success ? 'completed' : 'failed'} in ${this.metrics.exerciseMetadata.duration.toFixed(2)}ms`);
    
    // Check if UI is ready for interaction (metadata loaded)
    if (success && !this.metrics.userInteractionReady) {
      this.metrics.userInteractionReady = endTime - this.pageLoadTime;
      console.log(`📊 [METRICS] UI ready for user interaction after ${this.metrics.userInteractionReady.toFixed(2)}ms from page load`);
    }
  }
  
  // Start audio engine initialization
  startAudioEngineInit() {
    this.metrics.audioEngine.startTime = performance.now();
    console.log('📊 [METRICS] Starting audio engine initialization');
  }
  
  // Complete audio engine initialization
  completeAudioEngineInit(success: boolean, error?: string) {
    const endTime = performance.now();
    this.metrics.audioEngine.endTime = endTime;
    this.metrics.audioEngine.duration = endTime - this.metrics.audioEngine.startTime;
    this.metrics.audioEngine.success = success;
    this.metrics.audioEngine.error = error;
    
    console.log(`📊 [METRICS] Audio engine init ${success ? 'completed' : 'failed'} in ${this.metrics.audioEngine.duration.toFixed(2)}ms`);
  }
  
  // Start audio assets loading
  startAudioAssetsLoad() {
    this.metrics.audioAssets.startTime = performance.now();
    console.log('📊 [METRICS] Starting audio assets load');
  }
  
  // Complete audio assets loading
  completeAudioAssetsLoad(success: boolean, samplesLoaded: number, error?: string) {
    const endTime = performance.now();
    this.metrics.audioAssets.endTime = endTime;
    if (this.metrics.audioAssets.startTime) {
      this.metrics.audioAssets.duration = endTime - this.metrics.audioAssets.startTime;
    }
    this.metrics.audioAssets.success = success;
    this.metrics.audioAssets.samplesLoaded = samplesLoaded;
    this.metrics.audioAssets.error = error;
    
    console.log(`📊 [METRICS] Audio assets load ${success ? 'completed' : 'failed'} in ${this.metrics.audioAssets.duration?.toFixed(2)}ms (${samplesLoaded} samples)`);
    
    // Calculate total load time if everything is done
    if (this.metrics.exerciseMetadata.endTime && this.metrics.audioEngine.endTime && this.metrics.audioAssets.endTime) {
      const allEndTimes = [
        this.metrics.exerciseMetadata.endTime,
        this.metrics.audioEngine.endTime,
        this.metrics.audioAssets.endTime
      ];
      const lastEndTime = Math.max(...allEndTimes);
      this.metrics.totalLoadTime = lastEndTime - this.pageLoadTime;
      
      console.log(`📊 [METRICS] Total load time: ${this.metrics.totalLoadTime.toFixed(2)}ms`);
      this.printSummary();
    }
  }
  
  // Get current metrics
  getMetrics(): LoadingMetrics {
    return { ...this.metrics };
  }
  
  // Print summary report
  printSummary() {
    console.log('📊 [METRICS] === LOADING PERFORMANCE SUMMARY ===');
    console.log(`📊 User interaction ready: ${this.metrics.userInteractionReady?.toFixed(2)}ms`);
    console.log(`📊 Exercise metadata: ${this.metrics.exerciseMetadata.duration?.toFixed(2)}ms`);
    console.log(`📊 Audio engine init: ${this.metrics.audioEngine.duration?.toFixed(2)}ms`);
    console.log(`📊 Audio assets load: ${this.metrics.audioAssets.duration?.toFixed(2)}ms`);
    console.log(`📊 Total load time: ${this.metrics.totalLoadTime?.toFixed(2)}ms`);
    
    // Calculate parallel savings
    if (this.metrics.exerciseMetadata.duration && this.metrics.audioEngine.duration) {
      const sequentialTime = this.metrics.exerciseMetadata.duration + this.metrics.audioEngine.duration;
      const parallelTime = Math.max(this.metrics.exerciseMetadata.duration, this.metrics.audioEngine.duration);
      const savings = sequentialTime - parallelTime;
      console.log(`📊 Parallel loading saved: ${savings.toFixed(2)}ms`);
    }
    
    console.log('📊 ================================');
  }
}

// Global instance for easy access
export const loadingMetrics = new ExerciseLoadingMetrics();