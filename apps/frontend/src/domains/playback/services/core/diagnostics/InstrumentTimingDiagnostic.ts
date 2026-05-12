/**
 * InstrumentTimingDiagnostic - Cross-instrument timing measurement utility
 *
 * Measures and reports timing differences between different instruments
 * when they are scheduled on the same beat. Helps identify:
 * - Which instrument triggers first/last
 * - Execution time variations between instruments
 * - Any systematic timing offsets
 *
 * Usage:
 *   // In browser console:
 *   window.__timingDiagnostic.enable();
 *   // Play the exercise
 *   window.__timingDiagnostic.report();
 *   window.__timingDiagnostic.disable();
 */

export interface TimingEvent {
  instrument: 'drums' | 'metronome' | 'harmony' | 'bass' | 'voice-cue';
  eventType: string; // e.g., 'kick', 'accent', 'C4', etc.
  scheduledAudioTime: number; // When it SHOULD play (Web Audio time)
  jsExecutionTime: number; // When source.start() was called (performance.now())
  scheduleFrame: number; // Frame number at scheduling time
  targetFrame: number; // Frame number for target playback
  lookaheadMs: number; // How far ahead it was scheduled
  beat: number; // Beat number in the measure (1-4)
  measure: number; // Measure number
}

export interface BeatTimingComparison {
  beat: number;
  measure: number;
  scheduledAudioTime: number;
  instruments: {
    instrument: string;
    eventType: string;
    jsExecutionTime: number;
    deltaFromFirst: number; // ms difference from first instrument on this beat
  }[];
  maxDelta: number; // Maximum timing difference between instruments on this beat
}

class InstrumentTimingDiagnosticClass {
  private events: TimingEvent[] = [];
  private enabled = false;
  private startTime = 0;

  /**
   * Enable timing diagnostics
   */
  enable(): void {
    this.events = [];
    this.enabled = true;
    this.startTime = performance.now();
    console.log('🎯 [TIMING DIAGNOSTIC] Enabled - play the exercise to collect data');
  }

  /**
   * Disable timing diagnostics
   */
  disable(): void {
    this.enabled = false;
    console.log(`🎯 [TIMING DIAGNOSTIC] Disabled - collected ${this.events.length} events`);
  }

  /**
   * Check if diagnostics are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record a timing event
   */
  record(event: TimingEvent): void {
    if (!this.enabled) return;
    this.events.push(event);
  }

  /**
   * Get all recorded events
   */
  getEvents(): TimingEvent[] {
    return [...this.events];
  }

  /**
   * Analyze timing by beat - groups all instruments scheduled on the same beat
   */
  analyzeByBeat(): BeatTimingComparison[] {
    // Group events by their target audio time (rounded to ~1ms precision for grouping)
    const beatGroups = new Map<string, TimingEvent[]>();

    for (const event of this.events) {
      // Round to 10ms for grouping events on "same beat"
      const beatKey = `${event.measure}:${Math.round(event.scheduledAudioTime * 100)}`;

      if (!beatGroups.has(beatKey)) {
        beatGroups.set(beatKey, []);
      }
      beatGroups.get(beatKey)!.push(event);
    }

    // Convert to comparisons
    const comparisons: BeatTimingComparison[] = [];

    for (const [, events] of beatGroups) {
      if (events.length < 2) continue; // Only compare when multiple instruments

      // Sort by JS execution time (when source.start was called)
      const sorted = [...events].sort((a, b) => a.jsExecutionTime - b.jsExecutionTime);
      const firstTime = sorted[0].jsExecutionTime;

      comparisons.push({
        beat: sorted[0].beat,
        measure: sorted[0].measure,
        scheduledAudioTime: sorted[0].scheduledAudioTime,
        instruments: sorted.map(e => ({
          instrument: e.instrument,
          eventType: e.eventType,
          jsExecutionTime: e.jsExecutionTime,
          deltaFromFirst: e.jsExecutionTime - firstTime,
        })),
        maxDelta: sorted[sorted.length - 1].jsExecutionTime - firstTime,
      });
    }

    return comparisons.sort((a, b) => a.scheduledAudioTime - b.scheduledAudioTime);
  }

  /**
   * Generate a human-readable report
   */
  report(): void {
    console.log('\n🎯 ═══════════════════════════════════════════════════════════');
    console.log('🎯 CROSS-INSTRUMENT TIMING DIAGNOSTIC REPORT');
    console.log('🎯 ═══════════════════════════════════════════════════════════\n');

    if (this.events.length === 0) {
      console.log('❌ No events recorded. Make sure to enable() before playing.');
      return;
    }

    // Summary statistics
    const byInstrument = new Map<string, TimingEvent[]>();
    for (const event of this.events) {
      if (!byInstrument.has(event.instrument)) {
        byInstrument.set(event.instrument, []);
      }
      byInstrument.get(event.instrument)!.push(event);
    }

    console.log('📊 EVENTS BY INSTRUMENT:');
    console.log('────────────────────────');
    for (const [instrument, events] of byInstrument) {
      const avgLookahead = events.reduce((sum, e) => sum + e.lookaheadMs, 0) / events.length;
      console.log(`  ${instrument.padEnd(12)}: ${events.length} events, avg lookahead: ${avgLookahead.toFixed(1)}ms`);
    }

    // Beat-by-beat comparison
    const comparisons = this.analyzeByBeat();

    if (comparisons.length === 0) {
      console.log('\n⚠️ No beats found with multiple instruments playing simultaneously.');
      return;
    }

    console.log('\n📊 TIMING COMPARISON (same-beat events):');
    console.log('─────────────────────────────────────────');

    // Show first 10 comparisons
    const showCount = Math.min(10, comparisons.length);
    for (let i = 0; i < showCount; i++) {
      const comp = comparisons[i];
      console.log(`\n  Beat ${comp.measure}:${comp.beat} (audioTime: ${comp.scheduledAudioTime.toFixed(3)}s)`);

      for (const inst of comp.instruments) {
        const marker = inst.deltaFromFirst === 0 ? '🥇' :
                       inst.deltaFromFirst < 1 ? '✅' :
                       inst.deltaFromFirst < 5 ? '⚠️' : '❌';
        console.log(`    ${marker} ${inst.instrument.padEnd(12)} ${inst.eventType.padEnd(8)} +${inst.deltaFromFirst.toFixed(3)}ms`);
      }

      if (comp.maxDelta > 5) {
        console.log(`    ⚠️ MAX DELTA: ${comp.maxDelta.toFixed(3)}ms (may be audible)`);
      }
    }

    // Overall statistics
    const allDeltas = comparisons.flatMap(c => c.instruments.map(i => i.deltaFromFirst));
    const maxDeltaOverall = Math.max(...comparisons.map(c => c.maxDelta));
    const avgMaxDelta = comparisons.reduce((sum, c) => sum + c.maxDelta, 0) / comparisons.length;

    console.log('\n📊 OVERALL STATISTICS:');
    console.log('──────────────────────');
    console.log(`  Total beats compared:     ${comparisons.length}`);
    console.log(`  Max timing difference:    ${maxDeltaOverall.toFixed(3)}ms`);
    console.log(`  Avg timing difference:    ${avgMaxDelta.toFixed(3)}ms`);

    // Recommendations
    console.log('\n📋 INTERPRETATION:');
    console.log('──────────────────');
    if (maxDeltaOverall < 1) {
      console.log('  ✅ EXCELLENT: All instruments within 1ms - inaudible difference');
    } else if (maxDeltaOverall < 5) {
      console.log('  ✅ GOOD: All instruments within 5ms - barely perceptible');
    } else if (maxDeltaOverall < 20) {
      console.log('  ⚠️ ACCEPTABLE: Some instruments 5-20ms apart - may be noticeable');
    } else {
      console.log('  ❌ NEEDS ATTENTION: Instruments >20ms apart - likely audible');
    }

    // Which instrument is typically first/last
    const firstCounts = new Map<string, number>();
    const lastCounts = new Map<string, number>();

    for (const comp of comparisons) {
      const first = comp.instruments[0].instrument;
      const last = comp.instruments[comp.instruments.length - 1].instrument;
      firstCounts.set(first, (firstCounts.get(first) || 0) + 1);
      lastCounts.set(last, (lastCounts.get(last) || 0) + 1);
    }

    console.log('\n📋 INSTRUMENT ORDER ANALYSIS:');
    console.log('─────────────────────────────');
    console.log('  First to trigger:');
    for (const [instrument, count] of [...firstCounts.entries()].sort((a, b) => b[1] - a[1])) {
      const pct = ((count / comparisons.length) * 100).toFixed(0);
      console.log(`    ${instrument.padEnd(12)}: ${count} times (${pct}%)`);
    }
    console.log('  Last to trigger:');
    for (const [instrument, count] of [...lastCounts.entries()].sort((a, b) => b[1] - a[1])) {
      const pct = ((count / comparisons.length) * 100).toFixed(0);
      console.log(`    ${instrument.padEnd(12)}: ${count} times (${pct}%)`);
    }

    console.log('\n🎯 ═══════════════════════════════════════════════════════════\n');
  }

  /**
   * Export raw data as JSON
   */
  exportJSON(): string {
    return JSON.stringify({
      events: this.events,
      analysis: this.analyzeByBeat(),
      recorded: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Clear all recorded events
   */
  clear(): void {
    this.events = [];
    console.log('🎯 [TIMING DIAGNOSTIC] Cleared all events');
  }
}

// Singleton instance
export const InstrumentTimingDiagnostic = new InstrumentTimingDiagnosticClass();

// Expose on window for console access
if (typeof window !== 'undefined') {
  window.__timingDiagnostic = InstrumentTimingDiagnostic;
}
