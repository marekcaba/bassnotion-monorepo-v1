/**
 * InitializationLifecycleLogger
 *
 * Centralized diagnostic system to track all initialization points,
 * sample loading, buffer injection, and track registration timing.
 *
 * Usage (in code):
 *   import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger';
 *   lifecycle.checkpoint('CORESERVICES_CREATED');
 *   lifecycle.checkpoint('HARMONY_BUFFERS_INJECTED', { instrument: 'wurlitzer', count: 39 });
 *
 * Browser Console Commands (window.__lifecycle):
 *   window.__lifecycle.printTimeline()        // View full timeline with grouped phases
 *   window.__lifecycle.getTimeline()          // Get timeline as array for programmatic access
 *   window.__lifecycle.analyzeRaceConditions() // Check for potential race conditions
 *   window.__lifecycle.exportJSON()           // Export timeline as JSON string
 *   window.__lifecycle.reset()                // Reset logger (for new page load)
 *   window.__lifecycle.setEnabled(true/false) // Enable/disable logging
 */

export type LifecyclePhase =
  | 'PAGE_LOAD'
  | 'USER_INTERACTION'
  | 'CORESERVICES'
  | 'SAMPLE_LOADING'
  | 'WIDGET_INIT'
  | 'BUFFER_INJECTION'
  | 'TRACK_REGISTRATION'
  | 'PLAYBACK';

export type LifecycleCheckpoint =
  // Phase 1: Page Load
  | 'PAGE_MOUNTED'
  | 'TUTORIAL_DATA_FETCHED'
  | 'SCROLL_TRIGGER_MOUNTED'

  // Phase 2: User Interaction (ScrollTriggerLoader)
  | 'USER_INTERACTION_DETECTED'
  | 'CORESERVICES_CREATING'
  | 'CORESERVICES_CREATED'
  | 'CORESERVICES_PREINIT_START'
  | 'CORESERVICES_PREINIT_COMPLETE'

  // Phase 3: Sample Loading
  | 'ESSENTIAL_SAMPLES_START'
  | 'ESSENTIAL_SAMPLES_COMPLETE'
  | 'TUTORIAL_SAMPLES_START'
  | 'TUTORIAL_SAMPLES_COMPLETE'
  | 'EXERCISE_SAMPLES_START'
  | 'EXERCISE_SAMPLES_COMPLETE'
  | 'SAMPLES_READY_EVENT'
  // Granular sample loading
  | 'SAMPLE_TYPE_LOADING_START'
  | 'SAMPLE_TYPE_LOADING_COMPLETE'
  | 'SAMPLE_DOWNLOAD_START'
  | 'SAMPLE_DOWNLOAD_COMPLETE'
  | 'SAMPLE_CACHE_HIT'
  | 'SAMPLE_CACHE_MISS'

  // Phase 4: Widget Initialization
  | 'HARMONY_WIDGET_MOUNTED'
  | 'HARMONY_PLUGIN_LOADING'
  | 'HARMONY_PLUGIN_LOADED'
  | 'DRUMMER_WIDGET_MOUNTED'
  | 'DRUMMER_PLUGIN_LOADING'
  | 'DRUMMER_PLUGIN_LOADED'
  | 'METRONOME_WIDGET_MOUNTED'
  | 'METRONOME_PLUGIN_LOADING'
  | 'METRONOME_PLUGIN_LOADED'
  | 'GLOBALCONTROLS_MOUNTED'
  // Plugin creation blocked/retry
  | 'PLUGIN_AUDIOCONTEXT_CHECK'
  | 'PLUGIN_CREATION_BLOCKED'
  | 'PLUGIN_CREATION_RETRY'

  // Phase 5: Buffer Injection
  | 'BUFFER_INJECTION_START'
  | 'BUFFER_REINJECTION_START'
  | 'BUFFER_REINJECTION_COMPLETE'
  | 'METRONOME_BUFFER_SEARCH'
  | 'METRONOME_BUFFERS_INJECTED'
  | 'DRUM_BUFFER_SEARCH'
  | 'DRUM_BUFFERS_INJECTED'
  | 'VOICECUE_BUFFER_SEARCH'
  | 'VOICECUE_BUFFERS_INJECTED'
  | 'HARMONY_BUFFER_SEARCH'
  | 'HARMONY_BUFFERS_INJECTED'
  | 'BUFFER_INJECTION_FAILED'

  // Phase 6: Track Registration
  | 'TRACK_REGISTERED'
  | 'TRACK_UNREGISTERED'
  | 'TRACKS_BATCH_REGISTERED'
  | 'REGION_ADDED'
  | 'COUNTDOWN_REGION_ADDED'

  // Phase 7: Playback
  | 'AUDIOCONTEXT_CREATING'
  | 'AUDIOCONTEXT_RUNNING'
  | 'PLAYBACK_START_REQUESTED'
  | 'SCHEDULE_ALL_REGIONS_START'
  | 'SCHEDULE_ALL_REGIONS_COMPLETE'
  | 'TRANSPORT_STARTED'
  | 'PLAYBACK_STOPPED';

interface CheckpointEntry {
  checkpoint: LifecycleCheckpoint;
  phase: LifecyclePhase;
  timestamp: number;
  relativeTime: number; // ms since first checkpoint
  data?: Record<string, unknown>;
}

class InitializationLifecycleLogger {
  private entries: CheckpointEntry[] = [];
  private startTime: number | null = null;
  private enabled: boolean = true;

  /**
   * Enable/disable lifecycle logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get phase from checkpoint name
   */
  private getPhase(checkpoint: LifecycleCheckpoint): LifecyclePhase {
    if (checkpoint.startsWith('PAGE_') || checkpoint.startsWith('TUTORIAL_DATA') || checkpoint.startsWith('SCROLL_TRIGGER')) {
      return 'PAGE_LOAD';
    }
    if (checkpoint.startsWith('USER_INTERACTION')) {
      return 'USER_INTERACTION';
    }
    if (checkpoint.startsWith('CORESERVICES')) {
      return 'CORESERVICES';
    }
    if (checkpoint.includes('SAMPLES') || checkpoint === 'SAMPLES_READY_EVENT' ||
        checkpoint.startsWith('SAMPLE_') || checkpoint === 'SAMPLE_CACHE_HIT' || checkpoint === 'SAMPLE_CACHE_MISS') {
      return 'SAMPLE_LOADING';
    }
    if (checkpoint.includes('WIDGET') || checkpoint.includes('PLUGIN') || checkpoint === 'GLOBALCONTROLS_MOUNTED') {
      return 'WIDGET_INIT';
    }
    if (checkpoint.includes('BUFFER') || checkpoint === 'BUFFER_INJECTION_START' || checkpoint === 'BUFFER_INJECTION_FAILED') {
      return 'BUFFER_INJECTION';
    }
    if (checkpoint.includes('TRACK') || checkpoint.includes('REGION')) {
      return 'TRACK_REGISTRATION';
    }
    return 'PLAYBACK';
  }

  /**
   * Record a lifecycle checkpoint
   */
  checkpoint(checkpoint: LifecycleCheckpoint, data?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const now = performance.now();
    if (this.startTime === null) {
      this.startTime = now;
    }

    const entry: CheckpointEntry = {
      checkpoint,
      phase: this.getPhase(checkpoint),
      timestamp: now,
      relativeTime: now - this.startTime,
      data,
    };

    this.entries.push(entry);

    // Log to console with color-coded phase
    const phaseColors: Record<LifecyclePhase, string> = {
      PAGE_LOAD: '#888888',
      USER_INTERACTION: '#FF9800',
      CORESERVICES: '#2196F3',
      SAMPLE_LOADING: '#4CAF50',
      WIDGET_INIT: '#9C27B0',
      BUFFER_INJECTION: '#00BCD4',
      TRACK_REGISTRATION: '#E91E63',
      PLAYBACK: '#F44336',
    };

    const color = phaseColors[entry.phase];
    const timeStr = `+${entry.relativeTime.toFixed(1)}ms`;

    console.log(
      `%c[LIFECYCLE]%c [${entry.phase}] %c${checkpoint}%c ${timeStr}`,
      'background: #333; color: #fff; padding: 2px 4px; border-radius: 2px;',
      `color: ${color}; font-weight: bold;`,
      'color: inherit;',
      'color: #888;',
      data ? data : ''
    );
  }

  /**
   * Get the complete timeline
   */
  getTimeline(): CheckpointEntry[] {
    return [...this.entries];
  }

  /**
   * Print a formatted timeline to console
   */
  printTimeline(): void {
    console.group('📊 Initialization Lifecycle Timeline');

    let currentPhase: LifecyclePhase | null = null;

    this.entries.forEach((entry, index) => {
      if (entry.phase !== currentPhase) {
        if (currentPhase !== null) {
          console.groupEnd();
        }
        console.group(`Phase: ${entry.phase}`);
        currentPhase = entry.phase;
      }

      const timeStr = `+${entry.relativeTime.toFixed(1)}ms`;
      const prevEntry = index > 0 ? this.entries[index - 1] : null;
      const delta = prevEntry ? entry.relativeTime - prevEntry.relativeTime : 0;
      const deltaStr = delta > 0 ? ` (Δ${delta.toFixed(1)}ms)` : '';

      console.log(
        `${timeStr}${deltaStr}: ${entry.checkpoint}`,
        entry.data || ''
      );
    });

    if (currentPhase !== null) {
      console.groupEnd();
    }

    console.groupEnd();

    // Print summary
    this.printSummary();
  }

  /**
   * Print phase duration summary
   */
  printSummary(): void {
    console.group('📈 Phase Durations');

    const phases = new Map<LifecyclePhase, { start: number; end: number }>();

    this.entries.forEach((entry) => {
      const existing = phases.get(entry.phase);
      if (!existing) {
        phases.set(entry.phase, { start: entry.relativeTime, end: entry.relativeTime });
      } else {
        existing.end = entry.relativeTime;
      }
    });

    phases.forEach((timing, phase) => {
      const duration = timing.end - timing.start;
      console.log(`${phase}: ${timing.start.toFixed(0)}ms - ${timing.end.toFixed(0)}ms (${duration.toFixed(0)}ms)`);
    });

    const totalTime = this.entries.length > 0
      ? this.entries[this.entries.length - 1].relativeTime
      : 0;
    console.log(`Total initialization time: ${totalTime.toFixed(0)}ms`);

    console.groupEnd();
  }

  /**
   * Check for potential race conditions
   */
  analyzeRaceConditions(): string[] {
    const issues: string[] = [];

    const findCheckpoint = (name: LifecycleCheckpoint): CheckpointEntry | undefined =>
      this.entries.find((e) => e.checkpoint === name);

    // Check 1: Harmony buffers should be injected before playback starts
    const harmonyBuffers = findCheckpoint('HARMONY_BUFFERS_INJECTED');
    const playbackStart = findCheckpoint('PLAYBACK_START_REQUESTED');
    if (playbackStart && harmonyBuffers && harmonyBuffers.relativeTime > playbackStart.relativeTime) {
      issues.push(
        `⚠️ RACE: Harmony buffers injected ${(harmonyBuffers.relativeTime - playbackStart.relativeTime).toFixed(0)}ms AFTER playback started`
      );
    }

    // Check 2: All tracks should be registered before scheduling
    const scheduleStart = findCheckpoint('SCHEDULE_ALL_REGIONS_START');
    const lateRegistrations = this.entries.filter(
      (e) => e.checkpoint === 'TRACK_REGISTERED' && scheduleStart && e.relativeTime > scheduleStart.relativeTime
    );
    if (lateRegistrations.length > 0) {
      issues.push(
        `⚠️ RACE: ${lateRegistrations.length} track(s) registered AFTER scheduling started`
      );
    }

    // Check 3: Samples should be ready before widget initialization completes
    const samplesReady = findCheckpoint('SAMPLES_READY_EVENT');
    const pluginLoaded = this.entries.filter((e) => e.checkpoint.includes('PLUGIN_LOADED'));
    pluginLoaded.forEach((plugin) => {
      if (samplesReady && plugin.relativeTime < samplesReady.relativeTime) {
        // This is actually OK - plugins can load before samples
      }
    });

    // Check 4: AudioContext should be running before scheduling
    const audioContextRunning = findCheckpoint('AUDIOCONTEXT_RUNNING');
    if (scheduleStart && audioContextRunning && scheduleStart.relativeTime < audioContextRunning.relativeTime) {
      issues.push(
        `⚠️ RACE: Scheduling started ${(audioContextRunning.relativeTime - scheduleStart.relativeTime).toFixed(0)}ms BEFORE AudioContext running`
      );
    }

    if (issues.length === 0) {
      issues.push('✅ No race conditions detected');
    }

    console.group('🔍 Race Condition Analysis');
    issues.forEach((issue) => console.log(issue));
    console.groupEnd();

    return issues;
  }

  /**
   * Reset the logger (for new page load)
   */
  reset(): void {
    this.entries = [];
    this.startTime = null;
  }

  /**
   * Export timeline as JSON for debugging
   */
  exportJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}

// Singleton instance
export const lifecycle = new InitializationLifecycleLogger();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.__lifecycle = lifecycle;
}
