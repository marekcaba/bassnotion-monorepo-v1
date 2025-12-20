/**
 * Drum Editor Store - Unit Tests
 *
 * Tests Zustand state management for drum pattern editing,
 * including hit management, selection, clipboard, and history.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDrumEditorStore } from '../useDrumEditorStore.js';
import type { MusicalPosition, MidiDrumType, DrumHit } from '../../types.js';
import { DEFAULT_VELOCITY, DEFAULT_EDITOR_SETTINGS } from '../../constants.js';

// Test helper to reset store between tests
const resetStore = () => {
  useDrumEditorStore.getState().resetToInitial();
};

// Common test positions
const position0: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 0 };
const position1: MusicalPosition = { measure: 0, beat: 1, subdivision: 0, tick: 0 };
const position2: MusicalPosition = { measure: 0, beat: 2, subdivision: 0, tick: 0 };

describe('useDrumEditorStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Initial State', () => {
    it('should have empty pattern initially', () => {
      const state = useDrumEditorStore.getState();
      expect(state.pattern).toEqual([]);
    });

    it('should have default settings', () => {
      const state = useDrumEditorStore.getState();
      expect(state.bars).toBe(DEFAULT_EDITOR_SETTINGS.bars);
      expect(state.gridResolution).toBe(DEFAULT_EDITOR_SETTINGS.gridResolution);
      expect(state.previewTempo).toBe(DEFAULT_EDITOR_SETTINGS.tempo);
    });

    it('should have default lanes configured', () => {
      const state = useDrumEditorStore.getState();
      expect(state.lanes.length).toBeGreaterThan(0);
      expect(state.visibleLanes.length).toBeGreaterThan(0);
    });

    it('should not be dirty initially', () => {
      const state = useDrumEditorStore.getState();
      expect(state.isDirty).toBe(false);
    });
  });

  describe('Hit Management', () => {
    describe('addHit', () => {
      it('should add a hit to the pattern', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);

        const state = useDrumEditorStore.getState();
        expect(state.pattern.length).toBe(1);
        expect(state.pattern[0].drum).toBe('kick');
        expect(state.pattern[0].velocity).toBe(DEFAULT_VELOCITY);
      });

      it('should add hit with custom velocity', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('snare', position1, 80);

        const state = useDrumEditorStore.getState();
        expect(state.pattern[0].velocity).toBe(80);
      });

      it('should not add duplicate hit at same position', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);
        store.addHit('kick', position0); // Duplicate

        const state = useDrumEditorStore.getState();
        expect(state.pattern.length).toBe(1);
      });

      it('should allow different drums at same position', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);
        store.addHit('snare', position0);

        const state = useDrumEditorStore.getState();
        expect(state.pattern.length).toBe(2);
      });

      it('should mark pattern as dirty', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);

        const state = useDrumEditorStore.getState();
        expect(state.isDirty).toBe(true);
      });
    });

    describe('removeHit', () => {
      it('should remove a hit by ID', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);
        const hitId = useDrumEditorStore.getState().pattern[0].id;

        store.removeHit(hitId);

        const state = useDrumEditorStore.getState();
        expect(state.pattern.length).toBe(0);
      });

      it('should remove hit from selection when removed', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);
        const hitId = useDrumEditorStore.getState().pattern[0].id;
        store.selectHit(hitId);

        expect(useDrumEditorStore.getState().selectedHitIds).toContain(hitId);

        store.removeHit(hitId);

        const state = useDrumEditorStore.getState();
        expect(state.selectedHitIds).not.toContain(hitId);
      });

      it('should not fail when removing non-existent hit', () => {
        const store = useDrumEditorStore.getState();
        expect(() => store.removeHit('non-existent')).not.toThrow();
      });
    });

    describe('toggleHit', () => {
      it('should add hit when position is empty', () => {
        const store = useDrumEditorStore.getState();
        store.toggleHit('kick', position0);

        const state = useDrumEditorStore.getState();
        expect(state.pattern.length).toBe(1);
      });

      it('should remove hit when position has hit', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);
        store.toggleHit('kick', position0);

        const state = useDrumEditorStore.getState();
        expect(state.pattern.length).toBe(0);
      });
    });

    describe('updateHitVelocity', () => {
      it('should update hit velocity', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);
        const hitId = useDrumEditorStore.getState().pattern[0].id;

        store.updateHitVelocity(hitId, 64);

        const state = useDrumEditorStore.getState();
        expect(state.pattern[0].velocity).toBe(64);
      });

      it('should clamp velocity to valid range', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);
        const hitId = useDrumEditorStore.getState().pattern[0].id;

        store.updateHitVelocity(hitId, 200);
        expect(useDrumEditorStore.getState().pattern[0].velocity).toBe(127);

        store.updateHitVelocity(hitId, -10);
        expect(useDrumEditorStore.getState().pattern[0].velocity).toBe(1);
      });
    });

    describe('moveHit', () => {
      it('should move hit to new position', () => {
        const store = useDrumEditorStore.getState();
        store.addHit('kick', position0);
        const hitId = useDrumEditorStore.getState().pattern[0].id;

        store.moveHit(hitId, position1);

        const state = useDrumEditorStore.getState();
        expect(state.pattern[0].position.beat).toBe(1);
      });
    });
  });

  describe('Settings', () => {
    it('should set swing amount', () => {
      const store = useDrumEditorStore.getState();
      store.setSwing(50);

      const state = useDrumEditorStore.getState();
      expect(state.swingAmount).toBe(50);
    });

    it('should clamp swing to valid range', () => {
      const store = useDrumEditorStore.getState();
      store.setSwing(150);
      expect(useDrumEditorStore.getState().swingAmount).toBe(100);

      store.setSwing(-10);
      expect(useDrumEditorStore.getState().swingAmount).toBe(0);
    });

    it('should set grid resolution', () => {
      const store = useDrumEditorStore.getState();
      store.setGridResolution('1/8');

      const state = useDrumEditorStore.getState();
      expect(state.gridResolution).toBe('1/8');
    });

    it('should set bars', () => {
      const store = useDrumEditorStore.getState();
      store.setBars(4);

      const state = useDrumEditorStore.getState();
      expect(state.bars).toBe(4);
    });

    it('should set tempo with clamping', () => {
      const store = useDrumEditorStore.getState();
      store.setTempo(180);
      expect(useDrumEditorStore.getState().previewTempo).toBe(180);

      store.setTempo(500);
      expect(useDrumEditorStore.getState().previewTempo).toBe(300);

      store.setTempo(10);
      expect(useDrumEditorStore.getState().previewTempo).toBe(40);
    });

    it('should set edit mode', () => {
      const store = useDrumEditorStore.getState();
      store.setEditMode('select');

      const state = useDrumEditorStore.getState();
      expect(state.editMode).toBe('select');
    });

    it('should set zoom level with clamping', () => {
      const store = useDrumEditorStore.getState();
      store.setZoomLevel(1.5);
      expect(useDrumEditorStore.getState().zoomLevel).toBe(1.5);

      store.setZoomLevel(3);
      expect(useDrumEditorStore.getState().zoomLevel).toBe(2.0);

      store.setZoomLevel(0.1);
      expect(useDrumEditorStore.getState().zoomLevel).toBe(0.5);
    });
  });

  describe('Selection', () => {
    beforeEach(() => {
      resetStore();
      const store = useDrumEditorStore.getState();
      store.addHit('kick', position0);
      store.addHit('snare', position1);
      store.addHit('hihat_closed', position2);
    });

    it('should select a single hit', () => {
      const hitId = useDrumEditorStore.getState().pattern[0].id;
      useDrumEditorStore.getState().selectHit(hitId);

      const state = useDrumEditorStore.getState();
      expect(state.selectedHitIds).toEqual([hitId]);
    });

    it('should replace selection by default', () => {
      const store = useDrumEditorStore.getState();
      const hit1Id = store.pattern[0].id;
      const hit2Id = store.pattern[1].id;

      store.selectHit(hit1Id);
      store.selectHit(hit2Id);

      const state = useDrumEditorStore.getState();
      expect(state.selectedHitIds).toEqual([hit2Id]);
    });

    it('should add to selection when addToSelection is true', () => {
      const store = useDrumEditorStore.getState();
      const hit1Id = store.pattern[0].id;
      const hit2Id = store.pattern[1].id;

      store.selectHit(hit1Id);
      store.selectHit(hit2Id, true);

      const state = useDrumEditorStore.getState();
      expect(state.selectedHitIds).toContain(hit1Id);
      expect(state.selectedHitIds).toContain(hit2Id);
    });

    it('should toggle selection when already selected with addToSelection', () => {
      const store = useDrumEditorStore.getState();
      const hitId = store.pattern[0].id;

      store.selectHit(hitId);
      store.selectHit(hitId, true);

      const state = useDrumEditorStore.getState();
      expect(state.selectedHitIds).not.toContain(hitId);
    });

    it('should select all hits', () => {
      useDrumEditorStore.getState().selectAll();

      const state = useDrumEditorStore.getState();
      expect(state.selectedHitIds.length).toBe(3);
    });

    it('should clear selection', () => {
      const store = useDrumEditorStore.getState();
      store.selectAll();
      store.clearSelection();

      const state = useDrumEditorStore.getState();
      expect(state.selectedHitIds.length).toBe(0);
    });

    it('should delete selected hits', () => {
      const store = useDrumEditorStore.getState();
      const hitId = store.pattern[0].id;

      store.selectHit(hitId);
      store.deleteSelected();

      const state = useDrumEditorStore.getState();
      expect(state.pattern.length).toBe(2);
      expect(state.selectedHitIds.length).toBe(0);
    });
  });

  describe('Clipboard', () => {
    beforeEach(() => {
      resetStore();
      const store = useDrumEditorStore.getState();
      store.addHit('kick', position0);
      store.addHit('snare', position1);
    });

    it('should copy selected hits to clipboard', () => {
      const store = useDrumEditorStore.getState();
      const hitId = store.pattern[0].id;

      store.selectHit(hitId);
      store.copySelection();

      const state = useDrumEditorStore.getState();
      expect(state.clipboard.length).toBe(1);
      expect(state.clipboard[0].drum).toBe('kick');
    });

    it('should paste clipboard at new position', () => {
      const store = useDrumEditorStore.getState();
      store.selectAll();
      store.copySelection();

      // Paste at beat 2
      store.pasteClipboard(position2);

      const state = useDrumEditorStore.getState();
      // Original 2 + pasted 2 = 4 hits
      expect(state.pattern.length).toBe(4);
    });

    it('should select pasted hits', () => {
      const store = useDrumEditorStore.getState();
      store.selectAll();
      store.copySelection();
      store.clearSelection();

      store.pasteClipboard(position2);

      const state = useDrumEditorStore.getState();
      // Pasted hits should be selected
      expect(state.selectedHitIds.length).toBe(2);
    });

    it('should create new IDs for pasted hits', () => {
      const store = useDrumEditorStore.getState();
      const originalId = store.pattern[0].id;
      store.selectHit(originalId);
      store.copySelection();

      store.pasteClipboard(position2);

      const state = useDrumEditorStore.getState();
      const pastedHit = state.pattern.find(h => h.id !== originalId && h.drum === 'kick');
      expect(pastedHit).toBeDefined();
      expect(pastedHit!.id).not.toBe(originalId);
    });
  });

  describe('Playback', () => {
    it('should toggle play state', () => {
      const store = useDrumEditorStore.getState();
      store.play();
      expect(useDrumEditorStore.getState().isPlaying).toBe(true);

      store.stop();
      expect(useDrumEditorStore.getState().isPlaying).toBe(false);
    });

    it('should toggle loop state', () => {
      const store = useDrumEditorStore.getState();
      const initialLooping = store.isLooping;

      store.toggleLoop();
      expect(useDrumEditorStore.getState().isLooping).toBe(!initialLooping);
    });

    it('should set playhead tick', () => {
      const store = useDrumEditorStore.getState();
      store.setPlayheadTick(480);

      const state = useDrumEditorStore.getState();
      expect(state.currentPlayheadTick).toBe(480);
    });
  });

  describe('Lane Management', () => {
    it('should toggle lane mute', () => {
      const store = useDrumEditorStore.getState();
      const initialMuted = store.lanes[0].muted;

      store.toggleLaneMute('kick');

      const state = useDrumEditorStore.getState();
      const kickLane = state.lanes.find(l => l.drum === 'kick');
      expect(kickLane?.muted).toBe(!initialMuted);
    });

    it('should toggle lane collapse', () => {
      const store = useDrumEditorStore.getState();
      const initialCollapsed = store.lanes[0].collapsed;

      store.toggleLaneCollapse('kick');

      const state = useDrumEditorStore.getState();
      const kickLane = state.lanes.find(l => l.drum === 'kick');
      expect(kickLane?.collapsed).toBe(!initialCollapsed);
    });

    it('should set lane volume', () => {
      const store = useDrumEditorStore.getState();
      store.setLaneVolume('kick', 0.5);

      const state = useDrumEditorStore.getState();
      const kickLane = state.lanes.find(l => l.drum === 'kick');
      expect(kickLane?.volume).toBe(0.5);
    });

    it('should set visible lanes', () => {
      const store = useDrumEditorStore.getState();
      const newVisibleLanes: MidiDrumType[] = ['kick', 'snare', 'hihat_closed'];

      store.setVisibleLanes(newVisibleLanes);

      const state = useDrumEditorStore.getState();
      expect(state.visibleLanes).toEqual(newVisibleLanes);
    });
  });

  describe('Pattern Operations', () => {
    it('should clear pattern', () => {
      const store = useDrumEditorStore.getState();
      store.addHit('kick', position0);
      store.addHit('snare', position1);

      store.clearPattern();

      const state = useDrumEditorStore.getState();
      expect(state.pattern.length).toBe(0);
      expect(state.isDirty).toBe(true);
    });

    it('should load pattern', () => {
      const store = useDrumEditorStore.getState();
      const testPattern: DrumHit[] = [
        {
          id: 'test-1',
          drum: 'kick',
          velocity: 100,
          position: position0,
          durationTicks: 120,
          midiNote: 36,
        },
      ];

      store.loadPattern(testPattern, { name: 'Test Pattern' });

      const state = useDrumEditorStore.getState();
      expect(state.pattern.length).toBe(1);
      expect(state.patternName).toBe('Test Pattern');
    });

    it('should reset to initial state', () => {
      const store = useDrumEditorStore.getState();
      store.addHit('kick', position0);
      store.setBars(8);
      store.setTempo(180);

      store.resetToInitial();

      const state = useDrumEditorStore.getState();
      expect(state.pattern.length).toBe(0);
      expect(state.bars).toBe(DEFAULT_EDITOR_SETTINGS.bars);
      expect(state.previewTempo).toBe(DEFAULT_EDITOR_SETTINGS.tempo);
    });
  });

  describe('History (Undo/Redo)', () => {
    it('should undo last action', () => {
      const store = useDrumEditorStore.getState();
      store.addHit('kick', position0);
      store.addHit('snare', position1);

      expect(useDrumEditorStore.getState().pattern.length).toBe(2);

      store.undo();

      const state = useDrumEditorStore.getState();
      expect(state.pattern.length).toBe(1);
    });

    it('should redo undone action', () => {
      const store = useDrumEditorStore.getState();
      store.addHit('kick', position0);
      store.addHit('snare', position1);
      store.undo();

      expect(useDrumEditorStore.getState().pattern.length).toBe(1);

      store.redo();

      const state = useDrumEditorStore.getState();
      expect(state.pattern.length).toBe(2);
    });

    it('should not undo past initial state', () => {
      const store = useDrumEditorStore.getState();
      store.addHit('kick', position0);
      store.undo();
      store.undo(); // Try to undo again

      const state = useDrumEditorStore.getState();
      // Should be empty (first state in history)
      expect(state.pattern.length).toBeLessThanOrEqual(1);
    });
  });
});
