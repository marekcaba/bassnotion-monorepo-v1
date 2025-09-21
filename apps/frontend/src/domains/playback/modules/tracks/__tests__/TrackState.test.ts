import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrackState } from '../state/TrackState.js';
import type { TrackState as ITrackState } from '../../../types/track.js';
import { EventBus } from '../../shared/index.js';

describe('TrackState', () => {
  let trackState: TrackState;
  let initialState: ITrackState;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();

    initialState = {
      id: 'track-1',
      name: 'Test Track',
      color: '#3B82F6',
      index: 0,
      lifecycle: 'stopped',
      musical: {
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        key: 'C',
        scale: 'major',
        velocityRange: { min: 0, max: 127 },
      },
      mixing: {
        volume: 0.75,
        pan: 0,
        mute: false,
        solo: false,
        recordArm: false,
        phaseInvert: false,
        delayCompensation: 0,
      },
      routing: {
        inputBus: 'none',
        outputBus: 'master',
        sends: [],
      },
      sync: {
        followTransport: true,
        startOffset: 0,
        quantization: { enabled: false, value: '1/16', strength: 1 },
        swing: 0,
        dependencies: [],
      },
      automation: [],
    };

    trackState = new TrackState(
      initialState,
      { trackId: 'track-1', maxHistorySize: 10 },
      eventBus,
    );
  });

  describe('state management', () => {
    it('should return immutable state', () => {
      const state = trackState.getState();

      // Try to modify returned state
      expect(() => {
        (state as any).name = 'Modified';
      }).toThrow();

      // Original state should be unchanged
      expect(trackState.getState().name).toBe('Test Track');
    });

    it('should update state with partial changes', () => {
      trackState.updateState({
        name: 'Updated Track',
        color: '#EF4444',
      });

      const state = trackState.getState();
      expect(state.name).toBe('Updated Track');
      expect(state.color).toBe('#EF4444');
      // Other properties should remain unchanged
      expect(state.index).toBe(0);
    });

    it('should detect changed properties', () => {
      const onUpdate = vi.fn();
      eventBus.on('trackState:updated', onUpdate);

      trackState.updateState({
        mixing: { ...initialState.mixing, volume: 0.9, pan: -0.5 },
      });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          changedProperties: ['mixing'],
        }),
        expect.any(Object),
      );
    });

    it('should ignore no-op updates', () => {
      const onUpdate = vi.fn();
      eventBus.on('trackState:updated', onUpdate);

      trackState.updateState({
        name: 'Test Track', // Same as current
      });

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('specialized updates', () => {
    it('should update mixing state', () => {
      trackState.updateMixing({ volume: 0.5, mute: true });

      const state = trackState.getState();
      expect(state.mixing.volume).toBe(0.5);
      expect(state.mixing.mute).toBe(true);
      expect(state.mixing.pan).toBe(0); // Unchanged
    });

    it('should update routing state', () => {
      trackState.updateRouting({
        outputBus: 'drums-bus',
        sends: [{ busId: 'reverb', level: 0.3, enabled: true }],
      });

      const state = trackState.getState();
      expect(state.routing.outputBus).toBe('drums-bus');
      expect(state.routing.sends).toHaveLength(1);
    });

    it('should update sync state', () => {
      trackState.updateSync({
        followTransport: false,
        swing: 0.1,
      });

      const state = trackState.getState();
      expect(state.sync.followTransport).toBe(false);
      expect(state.sync.swing).toBe(0.1);
    });
  });

  describe('batch updates', () => {
    it('should apply multiple updates atomically', () => {
      trackState.batchUpdate((draft) => {
        draft.name = 'Batch Updated';
        draft.color = '#10B981';
        draft.mixing.volume = 0.8;
        draft.mixing.pan = 0.25;
      });

      const state = trackState.getState();
      expect(state.name).toBe('Batch Updated');
      expect(state.color).toBe('#10B981');
      expect(state.mixing.volume).toBe(0.8);
      expect(state.mixing.pan).toBe(0.25);
    });

    it('should emit single event for batch update', () => {
      const onUpdate = vi.fn();
      eventBus.on('trackState:updated', onUpdate);

      trackState.batchUpdate((draft) => {
        draft.name = 'Multiple';
        draft.index = 5;
        draft.mixing.solo = true;
      });

      expect(onUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('history and undo/redo', () => {
    it('should track history', () => {
      trackState.updateState({ name: 'Version 1' });
      trackState.updateState({ name: 'Version 2' });
      trackState.updateState({ name: 'Version 3' });

      const history = trackState.getHistoryInfo();
      expect(history.total).toBe(4); // Initial + 3 updates
      expect(history.current).toBe(3);
    });

    it('should undo changes', () => {
      trackState.updateState({ name: 'Version 1' });
      trackState.updateState({ name: 'Version 2' });

      expect(trackState.getState().name).toBe('Version 2');

      trackState.undo();
      expect(trackState.getState().name).toBe('Version 1');

      trackState.undo();
      expect(trackState.getState().name).toBe('Test Track');
    });

    it('should redo changes', () => {
      trackState.updateState({ name: 'Version 1' });
      trackState.updateState({ name: 'Version 2' });

      trackState.undo();
      trackState.undo();

      expect(trackState.getState().name).toBe('Test Track');

      trackState.redo();
      expect(trackState.getState().name).toBe('Version 1');

      trackState.redo();
      expect(trackState.getState().name).toBe('Version 2');
    });

    it('should clear redo history on new change', () => {
      trackState.updateState({ name: 'Version 1' });
      trackState.updateState({ name: 'Version 2' });
      trackState.undo();

      expect(trackState.canRedo()).toBe(true);

      trackState.updateState({ name: 'Version 3' });

      expect(trackState.canRedo()).toBe(false);
    });

    it('should respect max history size', () => {
      // Max history is 10
      for (let i = 0; i < 15; i++) {
        trackState.updateState({ name: `Version ${i}` });
      }

      const history = trackState.getHistoryInfo();
      expect(history.total).toBe(10);
    });
  });

  describe('snapshots', () => {
    it('should take manual snapshot', () => {
      trackState.takeSnapshot('Manual snapshot', ['name']);

      const history = trackState.getHistoryInfo();
      const lastSnapshot = history.snapshots[history.snapshots.length - 1];

      expect(lastSnapshot.description).toBe('Manual snapshot');
    });

    it('should jump to specific snapshot', () => {
      trackState.updateState({ name: 'Version 1' });
      trackState.updateState({ name: 'Version 2' });
      trackState.updateState({ name: 'Version 3' });

      const history = trackState.getHistoryInfo();
      const firstSnapshot = history.snapshots[0];

      trackState.jumpToSnapshot(firstSnapshot.id);
      expect(trackState.getState().name).toBe('Test Track');
    });

    it('should clear history', () => {
      trackState.updateState({ name: 'Version 1' });
      trackState.updateState({ name: 'Version 2' });

      trackState.clearHistory();

      const history = trackState.getHistoryInfo();
      expect(history.total).toBe(1); // Only "History cleared" snapshot
      expect(history.canUndo).toBe(false);
    });
  });

  describe('subscriptions', () => {
    it('should notify subscribers on state change', () => {
      const listener = vi.fn();
      const unsubscribe = trackState.subscribe(listener);

      trackState.updateState({ name: 'Updated' });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated' }),
      );

      unsubscribe();
      trackState.updateState({ name: 'Updated Again' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in listeners', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      trackState.subscribe(errorListener);
      trackState.subscribe(goodListener);

      // Should not throw
      trackState.updateState({ name: 'Updated' });

      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('auto-snapshot', () => {
    it('should batch updates within snapshot interval', () => {
      const state = new TrackState(
        initialState,
        {
          trackId: 'track-1',
          enableAutoSnapshot: true,
          snapshotInterval: 100, // 100ms
        },
        eventBus,
      );

      // Multiple updates within interval
      state.updateState({ name: 'Update 1' });
      state.updateState({ name: 'Update 2' });
      state.updateState({ name: 'Update 3' });

      const history = state.getHistoryInfo();
      // Should only have initial snapshot
      expect(history.total).toBe(1);
    });
  });
});
