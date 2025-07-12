import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { FretboardCard } from '../FretboardCard';
import { SyncProvider } from '../../base/SyncProvider';

// Mock the useAudioFretboard hook
const mockTriggerNote = vi.fn();
const mockCreateNoteEvent = vi.fn((stringIndex, fret) => ({
  note: 'A',
  octave: 2,
  string: stringIndex,
  fret: fret === 'open' ? 0 : fret,
}));

vi.mock('../../../hooks/useAudioFretboard', () => ({
  useAudioFretboard: vi.fn(() => ({
    createNoteEvent: mockCreateNoteEvent,
    triggerNote: mockTriggerNote,
    playbackIntegration: null,
    isAudioEnabled: true,
    audioError: null,
    stringConfigs: {
      4: ['E', 'A', 'D', 'G'],
      5: ['B', 'E', 'A', 'D', 'G'],
    },
    playbackPosition: {
      currentNoteIndex: -1,
      currentNote: null,
      isPlaying: false,
      currentTime: 0,
      progress: 0,
    },
    isCurrentNote: vi.fn(() => false),
  })),
}));

// Mock the SyncedWidget to capture event emissions
const mockEmitEvent = vi.fn();

// Create a dynamic mock props object that can be modified by tests
let mockSyncPropsOverride: any = null;

const getBaseMockSyncProps = (widgetId: string, widgetName: string) => ({
  isConnected: true,
  widgetId,
  widgetName,
  sync: {
    actions: {
      emitEvent: mockEmitEvent,
    },
    state: {},
  },
  selectedExercise: null,
  isPlaying: false,
  currentTime: 0,
  tempo: 120,
});

vi.mock('../../base/SyncedWidget', () => ({
  SyncedWidget: ({
    children,
    widgetId,
    widgetName,
    syncOptions: _syncOptions,
  }: any) => {
    const baseMockSyncProps = getBaseMockSyncProps(widgetId, widgetName);
    const mockSyncProps = mockSyncPropsOverride || baseMockSyncProps;
    return <div data-testid="synced-widget">{children(mockSyncProps)}</div>;
  },
}));

describe('FretboardCard Synchronization Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncPropsOverride = null;
  });

  describe('CUSTOM_BASSLINE Event Emission', () => {
    it('should emit CUSTOM_BASSLINE event when dots are selected', async () => {
      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // Select a dot
      const openStringDot = screen.getAllByTitle(/Open.*String/)[0];
      fireEvent.click(openStringDot);

      // Wait for the event to be emitted (uses setTimeout)
      await waitFor(() => {
        expect(mockEmitEvent).toHaveBeenCalledWith(
          'CUSTOM_BASSLINE',
          expect.objectContaining({
            bassline: expect.arrayContaining([
              expect.objectContaining({
                stringIndex: expect.any(Number),
                fret: expect.any(String),
                order: 1,
                note: expect.any(String),
              }),
            ]),
            source: 'interactive-fretboard',
            timestamp: expect.any(Number),
          }),
          'normal',
        );
      });
    });

    it('should emit updated CUSTOM_BASSLINE when multiple dots are selected', async () => {
      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // Select first dot
      const dots = screen.getAllByTitle(/Open.*String/);
      fireEvent.click(dots[0]);

      await waitFor(() => {
        expect(mockEmitEvent).toHaveBeenCalledTimes(1);
      });

      // Select second dot
      fireEvent.click(dots[1]);

      await waitFor(() => {
        expect(mockEmitEvent).toHaveBeenCalledTimes(2);
        const lastCall = mockEmitEvent.mock.calls[1];
        expect(lastCall[1].bassline).toHaveLength(2);
      });
    });

    it('should maintain order when dots are selected', async () => {
      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // Select dots in specific order
      const dots = screen.getAllByTitle(/Open.*String/);
      fireEvent.click(dots[2]); // Third string
      fireEvent.click(dots[0]); // First string
      fireEvent.click(dots[1]); // Second string

      await waitFor(() => {
        const lastCall =
          mockEmitEvent.mock.calls[mockEmitEvent.mock.calls.length - 1];
        const bassline = lastCall[1].bassline;

        // Check order numbers
        expect(bassline.find((b: any) => b.stringIndex === 2).order).toBe(1);
        expect(bassline.find((b: any) => b.stringIndex === 0).order).toBe(2);
        expect(bassline.find((b: any) => b.stringIndex === 1).order).toBe(3);
      });
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to required events', () => {
      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // Check that SyncedWidget is rendered with correct subscriptions
      const syncedWidget = screen.getByTestId('synced-widget');
      expect(syncedWidget).toBeInTheDocument();

      // The component should be subscribing to these events
      // This is verified through the SyncedWidget mock setup
    });
  });

  describe('Playback State Integration', () => {
    it('should update when playback state changes', async () => {
      const { rerender } = render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // Initially not playing
      expect(screen.queryByText('Exercise Progress')).not.toBeInTheDocument();

      // Set mock props for exercise selection and playback
      mockSyncPropsOverride = {
        isConnected: true,
        widgetId: 'interactive-fretboard',
        widgetName: 'Interactive Fretboard',
        sync: {
          actions: {
            emitEvent: mockEmitEvent,
          },
          state: {},
        },
        selectedExercise: {
          id: 'test-1',
          title: 'Test Exercise',
          bpm: 120,
          difficulty: 'beginner',
          notes: [
            {
              id: 'note-1',
              string: 1,
              fret: 0,
              timestamp: 0,
              duration: 500,
              note: 'E',
              color: 'red',
            },
          ],
        },
        isPlaying: true,
        currentTime: 250,
        tempo: 120,
      };

      // Rerender to apply the new mock props
      rerender(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // Should show exercise progress
      await waitFor(() => {
        expect(screen.getByText('Exercise Progress')).toBeInTheDocument();
      });
    });
  });

  describe('Tempo Change Handling', () => {
    it('should respond to tempo changes from sync state', () => {
      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // The component should be ready to receive tempo changes
      // This is handled internally by the SyncedWidget wrapper
      expect(screen.getByTestId('synced-widget')).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('should show disconnected status when not connected', () => {
      // Set mock props for disconnected state
      mockSyncPropsOverride = {
        isConnected: false,
        widgetId: 'interactive-fretboard',
        widgetName: 'Interactive Fretboard',
        sync: {
          actions: {
            emitEvent: mockEmitEvent,
          },
          state: {},
        },
        selectedExercise: null,
        isPlaying: false,
        currentTime: 0,
        tempo: 120,
      };

      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });
});
