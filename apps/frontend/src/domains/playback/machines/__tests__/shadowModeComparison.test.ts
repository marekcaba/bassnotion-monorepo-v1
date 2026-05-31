/**
 * Shadow Mode Comparison Tests
 *
 * Phase 4: Test Infrastructure
 *
 * These tests verify that the XState machines correctly track state
 * transitions that would occur in the real implementation. They test
 * the shadow mode comparison logic that runs in TransportContext.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { playbackMachine } from '../playbackMachine.js';
import {
  createMockAudioContext,
  createMockAudioDestination,
} from './testUtils.js';

// ============================================================================
// Types for Shadow Mode Testing
// ============================================================================

interface SimulatedTransportEvent {
  type: 'start' | 'stop' | 'pause' | 'resume' | 'tempo-change';
  data?: unknown;
}

interface StateComparisonResult {
  action: string;
  realState: string;
  xstateState: string;
  match: boolean;
  timestamp: number;
}

// ============================================================================
// Shadow Mode State Mapping (mirrors TransportContext logic)
// ============================================================================

/**
 * Maps XState states to equivalent real transport states
 * This matches the logic in TransportContext.tsx
 */
function mapXStateToTransportState(xstateState: string): string {
  const mapping: Record<string, string> = {
    idle: 'idle',
    loading: 'loading',
    ready: 'ready',
    starting: 'ready', // Intermediate async state
    playing: 'playing',
    paused: 'paused',
    stopping: 'stopped', // Intermediate async state
    stopped: 'stopped',
    error: 'error',
    disposing: 'idle', // Intermediate cleanup state
  };

  return mapping[xstateState] ?? xstateState;
}

/**
 * Checks if states match, accounting for XState's intermediate async states
 * This mirrors the logic in useShadowComparison hook
 */
function statesMatch(realState: string, xstateState: string): boolean {
  // XState 'idle' (uninitialized) is equivalent to real engine 'stopped' (initial state)
  // This occurs at startup before the machine has been initialized with an AudioContext
  if (xstateState === 'idle' && realState === 'stopped') {
    return true;
  }

  // XState 'loading' can occur while real engine is in any initializing state
  if (xstateState === 'loading') {
    return true;
  }

  // XState 'starting' is an async transition state
  // Real engine might be 'ready' (just started) or 'playing' (already transitioned)
  if (
    xstateState === 'starting' &&
    (realState === 'ready' || realState === 'playing')
  ) {
    return true;
  }

  // XState 'stopping' is an async transition state
  // Real engine might be 'playing' (just stopped) or 'stopped' (already transitioned)
  if (
    xstateState === 'stopping' &&
    (realState === 'playing' || realState === 'stopped')
  ) {
    return true;
  }

  // XState 'ready' can briefly occur when real engine is 'stopped'
  // This happens after initialization but before first play, or after stop
  if (xstateState === 'ready' && realState === 'stopped') {
    return true;
  }

  // XState 'stopped'/'stopping' while the real engine is already 'playing' is
  // the START-side race on a rapid stop→play: the shadow snapshot lags the
  // prior stop. Mirror of the 'stopping' + 'playing' tolerance above.
  if (
    (xstateState === 'stopped' || xstateState === 'stopping') &&
    realState === 'playing'
  ) {
    return true;
  }

  // XState 'disposing' is an async cleanup state transitioning to idle
  if (xstateState === 'disposing') {
    return true;
  }

  // Direct state matches
  const directMatches: Record<string, string[]> = {
    idle: ['idle'],
    ready: ['ready'],
    playing: ['playing'],
    paused: ['paused'],
    stopped: ['stopped'],
    error: ['error'],
  };

  const validMatches = directMatches[xstateState];
  if (validMatches && validMatches.includes(realState)) {
    return true;
  }

  return false;
}

// ============================================================================
// Shadow Mode Simulator
// ============================================================================

class ShadowModeSimulator {
  private actor: ReturnType<typeof createActor<typeof playbackMachine>>;
  private realState: string = 'stopped';
  private comparisons: StateComparisonResult[] = [];

  constructor() {
    this.actor = createActor(playbackMachine);
  }

  async initialize(): Promise<void> {
    this.actor.start();

    const mockAudioContext = createMockAudioContext();
    const mockDestination = createMockAudioDestination();

    this.actor.send({
      type: 'INITIALIZE',
      audioContext: mockAudioContext,
      audioDestination: mockDestination,
    });

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  /**
   * Simulates a transport event happening in the real implementation
   * and sends the corresponding event to the XState machine
   */
  async simulateTransportEvent(
    event: SimulatedTransportEvent,
  ): Promise<StateComparisonResult> {
    // First, update real state (simulating what the real transport would do)
    switch (event.type) {
      case 'start':
        this.realState = 'playing';
        this.actor.send({ type: 'START' });
        break;
      case 'stop':
        this.realState = 'stopped';
        this.actor.send({ type: 'STOP' });
        break;
      case 'pause':
        this.realState = 'paused';
        this.actor.send({ type: 'PAUSE' });
        break;
      case 'resume':
        this.realState = 'playing';
        this.actor.send({ type: 'RESUME' });
        break;
      case 'tempo-change':
        // Tempo change doesn't affect playback state
        if (typeof event.data === 'number') {
          this.actor.send({ type: 'SET_TEMPO', bpm: event.data });
        }
        break;
    }

    // Wait for async transitions
    await new Promise((resolve) => setTimeout(resolve, 100));

    const xstateState = this.actor.getSnapshot().value as string;
    const match = statesMatch(this.realState, xstateState);

    const result: StateComparisonResult = {
      action: event.type,
      realState: this.realState,
      xstateState,
      match,
      timestamp: Date.now(),
    };

    this.comparisons.push(result);
    return result;
  }

  getComparisons(): StateComparisonResult[] {
    return [...this.comparisons];
  }

  getXStateContext() {
    return this.actor.getSnapshot().context;
  }

  stop(): void {
    this.actor.stop();
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Shadow Mode State Comparison', () => {
  let simulator: ShadowModeSimulator;

  beforeEach(async () => {
    simulator = new ShadowModeSimulator();
    await simulator.initialize();
  });

  afterEach(() => {
    simulator.stop();
  });

  describe('Basic Playback Operations', () => {
    it('should match states on START', async () => {
      const result = await simulator.simulateTransportEvent({ type: 'start' });

      expect(result.match).toBe(true);
      console.log('[Shadow Test] START:', {
        real: result.realState,
        xstate: result.xstateState,
        match: result.match,
      });
    });

    it('should match states on STOP', async () => {
      // Start first
      await simulator.simulateTransportEvent({ type: 'start' });

      // Then stop
      const result = await simulator.simulateTransportEvent({ type: 'stop' });

      expect(result.match).toBe(true);
      console.log('[Shadow Test] STOP:', {
        real: result.realState,
        xstate: result.xstateState,
        match: result.match,
      });
    });

    it('should match states on PAUSE', async () => {
      // Start first
      await simulator.simulateTransportEvent({ type: 'start' });

      // Then pause
      const result = await simulator.simulateTransportEvent({ type: 'pause' });

      expect(result.match).toBe(true);
      console.log('[Shadow Test] PAUSE:', {
        real: result.realState,
        xstate: result.xstateState,
        match: result.match,
      });
    });

    it('should match states on RESUME', async () => {
      // Start, pause, then resume
      await simulator.simulateTransportEvent({ type: 'start' });
      await simulator.simulateTransportEvent({ type: 'pause' });
      const result = await simulator.simulateTransportEvent({ type: 'resume' });

      expect(result.match).toBe(true);
      console.log('[Shadow Test] RESUME:', {
        real: result.realState,
        xstate: result.xstateState,
        match: result.match,
      });
    });
  });

  describe('Complex Sequences', () => {
    it('should match states through play -> stop -> play cycle', async () => {
      const results = [];

      results.push(await simulator.simulateTransportEvent({ type: 'start' }));
      results.push(await simulator.simulateTransportEvent({ type: 'stop' }));
      results.push(await simulator.simulateTransportEvent({ type: 'start' }));

      // All should match
      results.forEach((result, i) => {
        expect(result.match).toBe(true);
        console.log(`[Shadow Test] Step ${i + 1}:`, {
          action: result.action,
          match: result.match,
        });
      });
    });

    it('should match states through play -> pause -> resume -> stop cycle', async () => {
      const results = [];

      results.push(await simulator.simulateTransportEvent({ type: 'start' }));
      results.push(await simulator.simulateTransportEvent({ type: 'pause' }));
      results.push(await simulator.simulateTransportEvent({ type: 'resume' }));
      results.push(await simulator.simulateTransportEvent({ type: 'stop' }));

      // All should match
      const allMatch = results.every((r) => r.match);
      expect(allMatch).toBe(true);

      console.log('[Shadow Test] Full cycle:', {
        steps: results.length,
        allMatch,
        sequence: results
          .map((r) => `${r.action}(${r.match ? 'OK' : 'MISMATCH'})`)
          .join(' -> '),
      });
    });

    it('should track tempo changes during playback', async () => {
      await simulator.simulateTransportEvent({ type: 'start' });
      await simulator.simulateTransportEvent({
        type: 'tempo-change',
        data: 140,
      });

      const context = simulator.getXStateContext();
      expect(context.currentTempo).toBe(140);

      console.log('[Shadow Test] Tempo change tracked:', {
        tempo: context.currentTempo,
      });
    });
  });

  describe('State Mapping Logic', () => {
    it('should correctly map XState states to transport states', () => {
      const mappings = [
        { xstate: 'idle', expected: 'idle' },
        { xstate: 'loading', expected: 'loading' },
        { xstate: 'ready', expected: 'ready' },
        { xstate: 'starting', expected: 'ready' },
        { xstate: 'playing', expected: 'playing' },
        { xstate: 'paused', expected: 'paused' },
        { xstate: 'stopping', expected: 'stopped' },
        { xstate: 'stopped', expected: 'stopped' },
        { xstate: 'error', expected: 'error' },
      ];

      mappings.forEach(({ xstate, expected }) => {
        expect(mapXStateToTransportState(xstate)).toBe(expected);
      });
    });

    it('should handle intermediate states gracefully', () => {
      // IDLE -> STOPPED: XState starts in 'idle', real engine starts in 'stopped'
      // This is the initial state equivalence that prevents false mismatch warnings
      expect(statesMatch('stopped', 'idle')).toBe(true);

      // READY -> STOPPED: XState 'ready' occurs after initialization, real engine may show 'stopped'
      expect(statesMatch('stopped', 'ready')).toBe(true);

      // START: real is immediately 'playing', but XState may still be 'starting'
      expect(statesMatch('playing', 'starting')).toBe(true);
      expect(statesMatch('ready', 'starting')).toBe(true);

      // STOP: real is immediately 'stopped', but XState may still be 'stopping'
      expect(statesMatch('stopped', 'stopping')).toBe(true);
      expect(statesMatch('playing', 'stopping')).toBe(true);

      // RAPID STOP→PLAY: real is already 'playing' but the shadow snapshot
      // still lags at the prior 'stopped'/'stopping' (stale React render).
      expect(statesMatch('playing', 'stopped')).toBe(true);
      expect(statesMatch('playing', 'stopping')).toBe(true);

      // Direct matches should work
      expect(statesMatch('playing', 'playing')).toBe(true);
      expect(statesMatch('stopped', 'stopped')).toBe(true);
      expect(statesMatch('paused', 'paused')).toBe(true);
    });

    it('should handle the idle -> stopped initial state case', () => {
      // This is the critical case that was causing console warnings:
      // XState machine starts in 'idle' (not yet initialized)
      // Real transport/engine starts in 'stopped' (ready to play)
      // These should be considered equivalent states
      expect(statesMatch('stopped', 'idle')).toBe(true);

      // But idle -> idle should also work for edge cases
      expect(statesMatch('idle', 'idle')).toBe(true);
    });
  });
});

describe('Shadow Mode Comparison History', () => {
  it('should record comparison history for debugging', async () => {
    const simulator = new ShadowModeSimulator();
    await simulator.initialize();

    // Run through a series of operations
    await simulator.simulateTransportEvent({ type: 'start' });
    await simulator.simulateTransportEvent({ type: 'pause' });
    await simulator.simulateTransportEvent({ type: 'resume' });
    await simulator.simulateTransportEvent({ type: 'stop' });

    const history = simulator.getComparisons();

    expect(history.length).toBe(4);
    expect(history.map((h) => h.action)).toEqual([
      'start',
      'pause',
      'resume',
      'stop',
    ]);

    // Print history for debugging
    console.log('[Shadow Test] Comparison History:');
    console.table(
      history.map((h) => ({
        action: h.action,
        real: h.realState,
        xstate: h.xstateState,
        match: h.match ? 'YES' : 'NO',
      })),
    );

    simulator.stop();
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Shadow Mode Edge Cases', () => {
  it('should handle rapid state changes', async () => {
    const simulator = new ShadowModeSimulator();
    await simulator.initialize();

    // Rapid fire events
    const promises = [
      simulator.simulateTransportEvent({ type: 'start' }),
      simulator.simulateTransportEvent({ type: 'stop' }),
      simulator.simulateTransportEvent({ type: 'start' }),
      simulator.simulateTransportEvent({ type: 'stop' }),
    ];

    const results = await Promise.all(promises);

    // Check final state is consistent
    const finalResult = results[results.length - 1];
    expect(finalResult.realState).toBe('stopped');

    simulator.stop();
  });

  it('should handle uninitialized machine gracefully', () => {
    const actor = createActor(playbackMachine);
    actor.start();

    // Send START without initializing - should stay in idle
    actor.send({ type: 'START' });

    expect(actor.getSnapshot().value).toBe('idle');

    actor.stop();
  });
});
