/**
 * AutoSave Service Tests (Story 3.8)
 *
 * Testing auto-save functionality including triggers, conflict resolution,
 * error recovery, and state management for bassline persistence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutoSaveService } from '../AutoSave.js';
import type {
  AutoSaveConfig,
  BasslineMetadata,
  ExerciseNote,
} from '@bassnotion/contracts';

// Mock the UserBasslinesAPI
vi.mock('../../api/user-basslines.js', () => ({
  UserBasslinesAPI: {
    autoSave: vi.fn(),
  },
}));

import { UserBasslinesAPI } from '../../api/user-basslines.js';

describe('AutoSaveService', () => {
  let autoSaveService: AutoSaveService;
  let mockMetadata: BasslineMetadata;
  let mockNotes: ExerciseNote[];
  let mockOnAutoSave: any;
  let mockOnError: any;
  let mockOnStateChange: any;

  const defaultConfig: AutoSaveConfig = {
    interval: 1000, // 1 second for testing
    changeThreshold: 3,
    idleTimeout: 500,
    maxRetries: 2,
  };

  const mockNote: ExerciseNote = {
    id: 'note-1',
    timestamp: 0,
    string: 4, // Fix: should be number (1-6)
    fret: 3,
    duration: 500,
    note: 'G',
    color: '#FF6B6B',
    velocity: 80,
  };

  const mockBasslineMetadata: BasslineMetadata = {
    tempo: 120,
    timeSignature: '4/4',
    key: 'C',
    difficulty: 'beginner',
    tags: ['practice'],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockNotes = [mockNote];
    mockMetadata = mockBasslineMetadata;
    mockOnAutoSave = vi.fn();
    mockOnError = vi.fn();
    mockOnStateChange = vi.fn();

    // Mock successful API response
    (UserBasslinesAPI.autoSave as any).mockResolvedValue({
      basslineId: 'auto-save-1',
      lastSaved: '2024-01-01T00:00:00Z',
      message: 'Auto-saved successfully',
    });

    autoSaveService = new AutoSaveService(defaultConfig, {
      onAutoSave: mockOnAutoSave,
      onError: mockOnError,
      onStateChange: mockOnStateChange,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    autoSaveService.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with custom configuration', () => {
      const customConfig = {
        interval: 30000,
        changeThreshold: 5,
        idleTimeout: 10000,
        maxRetries: 3,
      };

      const service = new AutoSaveService(customConfig);

      // Verify initialization via state
      const state = service.getState();
      expect(state.isDirty).toBe(false);
      expect(state.changeCount).toBe(0);

      service.destroy();
    });

    it('should use default configuration when none provided', () => {
      const service = new AutoSaveService();
      const state = service.getState();

      // Default state should be clean
      expect(state.isDirty).toBe(false);
      expect(state.changeCount).toBe(0);
      expect(state.isAutoSaving).toBe(false);

      service.destroy();
    });

    it('should initialize state correctly', () => {
      autoSaveService.initialize('bassline-1', mockMetadata);

      const state = autoSaveService.getState();
      expect(state.isDirty).toBe(false);
      expect(state.changeCount).toBe(0);
      expect(state.currentBasslineId).toBe('bassline-1');
    });
  });

  describe('Change Detection', () => {
    it('should mark state as dirty on note change', () => {
      autoSaveService.onNoteChange();
      expect(autoSaveService.getState().isDirty).toBe(true);
    });

    it('should increment change count', () => {
      autoSaveService.onNoteChange();
      autoSaveService.onNoteChange();
      expect(autoSaveService.getState().changeCount).toBe(2);
    });

    it('should notify state change callback', () => {
      const onStateChange = vi.fn();
      const service = new AutoSaveService({}, { onStateChange });

      service.onNoteChange();
      expect(onStateChange).toHaveBeenCalled();
    });

    it('should trigger auto-save when change threshold reached', async () => {
      const onAutoSave = vi.fn();
      const service = new AutoSaveService(
        { changeThreshold: 2 },
        { onAutoSave },
      );

      // Initialize with fake timers for testing
      vi.useFakeTimers();

      // Trigger changes to reach threshold
      service.onNoteChange();
      service.onNoteChange(); // Should trigger auto-save callback

      // Verify auto-save callback was triggered (not API call)
      expect(onAutoSave).toHaveBeenCalledWith('', false);

      vi.useRealTimers();
    });
  });

  describe('Auto-save Triggers', () => {
    it('should detect when auto-save is needed', () => {
      autoSaveService.initialize('bassline-1');
      autoSaveService.onNoteChange();

      expect(autoSaveService.isAutoSaveNeeded()).toBe(false); // Below threshold

      // Add more changes to reach threshold
      for (let i = 0; i < 4; i++) {
        autoSaveService.onNoteChange();
      }

      expect(autoSaveService.isAutoSaveNeeded()).toBe(true); // At threshold (5)
    });

    it('should trigger interval-based auto-save when dirty', async () => {
      vi.useFakeTimers();

      const onAutoSave = vi.fn();
      const service = new AutoSaveService({ interval: 1000 }, { onAutoSave });

      // Initialize and start timer manually for testing
      service.initialize('bassline-1');
      service.startTimer();

      // Make it dirty
      service.onNoteChange();

      // Advance time to trigger interval-based auto-save
      vi.advanceTimersByTime(35000); // Past interval + check time

      // Verify auto-save callback was triggered
      expect(onAutoSave).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not auto-save when clean', async () => {
      vi.useFakeTimers();

      const onAutoSave = vi.fn();
      const service = new AutoSaveService({ interval: 1000 }, { onAutoSave });

      service.initialize('bassline-1');
      service.startTimer();

      // Don't make it dirty - leave clean
      vi.advanceTimersByTime(35000);

      // Should not trigger auto-save when clean
      expect(onAutoSave).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should reset change count after manual force save', async () => {
      autoSaveService.initialize('bassline-1');
      autoSaveService.onNoteChange();
      autoSaveService.onNoteChange();

      expect(autoSaveService.getState().changeCount).toBe(2);

      await autoSaveService.forceSave('Test Bassline', mockNotes, mockMetadata);

      expect(autoSaveService.getState().changeCount).toBe(0);
    });
  });

  describe('Manual Force Save', () => {
    it('should perform force save', async () => {
      autoSaveService.initialize('bassline-1');

      const result = await autoSaveService.forceSave(
        'Test Bassline',
        mockNotes,
        mockMetadata,
      );

      // Updated expectation: force save DOES include isAutoSave: false
      expect(UserBasslinesAPI.autoSave).toHaveBeenCalledWith({
        basslineId: 'bassline-1',
        name: 'Test Bassline',
        notes: mockNotes,
        metadata: mockMetadata,
        isAutoSave: false, // Force save sets isAutoSave: false
      });

      expect(result).toBe('auto-save-1'); // Use actual mock return value
    });

    it('should return null when service is destroyed', async () => {
      autoSaveService.destroy();
      const result = await autoSaveService.forceSave(
        'Test',
        mockNotes,
        mockMetadata,
      );
      expect(result).toBeNull();
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      autoSaveService.initialize('bassline-1');
      autoSaveService.onNoteChange();
      autoSaveService.onNoteChange(); // 2 changes

      expect(autoSaveService.isAutoSaveNeeded()).toBe(false); // Below default threshold (5)

      // Update threshold to 10
      autoSaveService.updateConfig({ changeThreshold: 10 });

      // Add more changes but still below new threshold
      autoSaveService.onNoteChange(); // 3 changes total, still below 10

      expect(autoSaveService.isAutoSaveNeeded()).toBe(false); // Below new threshold (10)
    });
  });

  describe('Error Recovery', () => {
    it('should attempt recovery from failed auto-save', async () => {
      // Mock timers for controlled testing
      vi.useFakeTimers();

      // Clear any previous mocks
      vi.clearAllMocks();

      // Mock API failure for first call, success for second call
      (UserBasslinesAPI.autoSave as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          basslineId: 'recovered-id',
          lastSaved: new Date().toISOString(),
          message: 'Auto-save successful',
        });

      const recoveryPromise = autoSaveService.recoverFromFailure(
        'Test Recovery',
        mockNotes,
        mockMetadata,
      );

      // Fast-forward through the exponential backoff delay
      await vi.advanceTimersByTimeAsync(300); // Give enough time for retry

      const result = await recoveryPromise;

      expect(result).toBe(true);
      expect(UserBasslinesAPI.autoSave).toHaveBeenCalledTimes(2); // Original failure + retry

      vi.useRealTimers();
    }, 15000); // Increase timeout for this test

    it('should give up after max retries', async () => {
      vi.useFakeTimers();

      // Clear any previous mocks
      vi.clearAllMocks();

      // Mock all calls to fail
      (UserBasslinesAPI.autoSave as any).mockRejectedValue(
        new Error('Persistent failure'),
      );

      const onError = vi.fn();
      const service = new AutoSaveService({ maxRetries: 1 }, { onError }); // Reduce retries for faster test

      const recoveryPromise = service.recoverFromFailure(
        'Test Failure',
        mockNotes,
        mockMetadata,
      );

      // Fast-forward through retry attempt and timeout
      await vi.advanceTimersByTimeAsync(500); // Give enough time for retry and timeout

      const result = await recoveryPromise;

      expect(result).toBe(false);
      expect(onError).toHaveBeenCalledWith('Maximum retry attempts reached');

      vi.useRealTimers();
    }, 15000); // Increase timeout for this test
  });

  describe('Conflict Resolution', () => {
    it('should handle local precedence strategy', async () => {
      // Mock successful auto-save response
      (UserBasslinesAPI.autoSave as any).mockResolvedValueOnce({
        basslineId: 'auto-save-1',
        lastSaved: new Date().toISOString(),
        message: 'Auto-save successful',
      });

      const result = await autoSaveService.handleConflict(
        'Conflict Test',
        mockNotes,
        mockMetadata,
        'local',
      );

      expect(UserBasslinesAPI.autoSave).toHaveBeenCalled();
      expect(result).toBe('auto-save-1');
    });

    it('should handle server precedence strategy', async () => {
      autoSaveService.onNoteChange(); // Make it dirty

      const result = await autoSaveService.handleConflict(
        'Test',
        mockNotes,
        mockMetadata,
        'server',
      );

      expect(UserBasslinesAPI.autoSave).not.toHaveBeenCalled();
      expect(result).toBeNull();

      // Should reset local state
      const state = autoSaveService.getState();
      expect(state.isDirty).toBe(false);
      expect(state.changeCount).toBe(0);
    });

    it('should handle merge strategy (currently as local)', async () => {
      const result = await autoSaveService.handleConflict(
        'Test',
        mockNotes,
        mockMetadata,
        'merge',
      );

      expect(UserBasslinesAPI.autoSave).toHaveBeenCalled();
      expect(result).toBe('auto-save-1');
    });
  });

  describe('State Management', () => {
    it('should provide accurate state information', () => {
      autoSaveService.initialize('bassline-1', mockMetadata);

      let state = autoSaveService.getState();
      expect(state.isDirty).toBe(false);
      expect(state.changeCount).toBe(0);
      expect(state.currentBasslineId).toBe('bassline-1');
      expect(state.isAutoSaving).toBe(false);

      autoSaveService.onNoteChange();

      state = autoSaveService.getState();
      expect(state.isDirty).toBe(true);
      expect(state.changeCount).toBe(1);
    });

    it('should track last save time', () => {
      const beforeInit = Date.now();
      autoSaveService.initialize('bassline-1', mockMetadata);
      const afterInit = Date.now();

      const state = autoSaveService.getState();
      expect(state.lastSaveTime).toBeGreaterThanOrEqual(beforeInit);
      expect(state.lastSaveTime).toBeLessThanOrEqual(afterInit);
    });
  });

  describe('Cleanup & Destruction', () => {
    it('should prevent operations after destroy', async () => {
      autoSaveService.destroy();

      autoSaveService.onNoteChange();
      expect(autoSaveService.getState().isDirty).toBe(false);

      const result = await autoSaveService.forceSave(
        'Test',
        mockNotes,
        mockMetadata,
      );
      expect(result).toBeNull();
    });

    it('should clean up timers on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      // Start timer to create timers to clean up
      autoSaveService.initialize('bassline-1');
      autoSaveService.startTimer();
      autoSaveService.onNoteChange(); // This should create idle timer

      autoSaveService.destroy();

      // Verify timers are cleaned up (should be called when timers exist)
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Requirements', () => {
    it('should perform auto-save operations quickly (<200ms)', async () => {
      autoSaveService.initialize('bassline-1', mockMetadata);

      const startTime = Date.now();
      await autoSaveService.forceSave('Test', mockNotes, mockMetadata);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should handle rapid note changes efficiently', () => {
      autoSaveService.initialize('bassline-1', mockMetadata);

      const startTime = Date.now();

      // Simulate rapid changes
      for (let i = 0; i < 100; i++) {
        autoSaveService.onNoteChange();
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast

      const state = autoSaveService.getState();
      expect(state.changeCount).toBe(100);
    });
  });
});
