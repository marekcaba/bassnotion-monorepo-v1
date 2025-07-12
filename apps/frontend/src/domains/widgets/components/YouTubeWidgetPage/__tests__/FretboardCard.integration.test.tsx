import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { FretboardCard } from '../FretboardCard';
import { SyncProvider } from '../../base/SyncProvider';
import type { Exercise } from '@bassnotion/contracts';

// Mock the useAudioFretboard hook
vi.mock('../../../hooks/useAudioFretboard', () => ({
  useAudioFretboard: vi.fn(() => ({
    createNoteEvent: vi.fn((stringIndex, fret) => ({
      note: 'A',
      octave: 2,
      string: stringIndex,
      fret: fret === 'open' ? 0 : fret,
    })),
    triggerNote: vi.fn(),
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

const _mockExercise = {
  id: 'test-exercise-1',
  title: 'Basic Scale Exercise',
  description: 'A simple scale exercise',
  difficulty: 'beginner' as const,
  duration: 10000,
  bpm: 120,
  key: 'C',
  notes: [
    {
      id: 'note-1',
      timestamp: 0,
      string: 1,
      fret: 0,
      duration: 500,
      note: 'E',
      color: 'red',
    },
    {
      id: 'note-2',
      timestamp: 500,
      string: 1,
      fret: 2,
      duration: 500,
      note: 'F#',
      color: 'green',
    },
    {
      id: 'note-3',
      timestamp: 1000,
      string: 2,
      fret: 0,
      duration: 500,
      note: 'A',
      color: 'blue',
    },
  ],
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('FretboardCard Integration Tests', () => {
  const renderWithProvider = (_selectedExercise?: Exercise) => {
    return render(
      <SyncProvider>
        <FretboardCard />
      </SyncProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Widget Synchronization', () => {
    it('should render with sync status indicator', () => {
      renderWithProvider();

      // Check for sync status indicator
      expect(screen.getByText(/Synced|Disconnected/)).toBeInTheDocument();
    });

    it('should show connected status when synced', async () => {
      renderWithProvider();

      // Should show as synced by default with SyncProvider
      await waitFor(() => {
        expect(screen.getByText('Synced')).toBeInTheDocument();
      });
    });

    it('should display audio status in header', () => {
      renderWithProvider();

      // Check for audio status icon
      const header = screen.getByText(/Interactive Fretboard/);
      expect(header.textContent).toContain('🔊'); // Audio enabled
    });
  });

  describe('String Configuration', () => {
    it('should render 4-string configuration by default', () => {
      renderWithProvider();

      // Check for 4 String button being active
      const fourStringBtn = screen.getByRole('button', {
        name: 'Select 4 string bass guitar',
      });
      expect(fourStringBtn).toHaveClass('bg-blue-500');
    });

    it('should switch to 5-string configuration when clicked', () => {
      renderWithProvider();

      const fiveStringBtn = screen.getByRole('button', {
        name: 'Select 5 string bass guitar',
      });
      fireEvent.click(fiveStringBtn);

      expect(fiveStringBtn).toHaveClass('bg-blue-500');
    });
  });

  describe('Tilt Controls', () => {
    it('should have tilt control buttons', () => {
      renderWithProvider();

      // Check for tilt buttons
      expect(screen.getByTitle(/Increase tilt/)).toBeInTheDocument();
      expect(screen.getByTitle(/Decrease tilt/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Reset fretboard tilt to default 35 degrees',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Set fretboard tilt to flat view, 0 degrees',
        }),
      ).toBeInTheDocument();
    });

    it('should change tilt angle when buttons are clicked', () => {
      renderWithProvider();

      const increaseTiltBtn = screen.getByTitle(/Increase tilt/);
      const defaultAngle = increaseTiltBtn.title.match(/\d+/)?.[0];

      fireEvent.click(increaseTiltBtn);

      // Check if title updated with new angle
      const newAngle = increaseTiltBtn.title.match(/\d+/)?.[0];
      expect(Number(newAngle)).toBeGreaterThan(Number(defaultAngle));
    });
  });

  describe('Dot Selection', () => {
    it('should allow selecting dots by clicking', () => {
      renderWithProvider();

      // Find an open string dot
      const openStringDot = screen.getAllByTitle(/Open.*String/)[0];

      // Initial state - not selected
      expect(openStringDot).toHaveClass('bg-slate-600');

      // Click to select
      fireEvent.click(openStringDot);

      // Should now be selected (green)
      expect(openStringDot).toHaveClass('bg-green-500');
    });

    it('should reset all selections when Reset button is clicked', () => {
      renderWithProvider();

      // Select a dot
      const openStringDot = screen.getAllByTitle(/Open.*String/)[0];
      fireEvent.click(openStringDot);
      expect(openStringDot).toHaveClass('bg-green-500');

      // Click reset
      const resetBtn = screen.getByRole('button', {
        name: 'Reset all selected fretboard dots',
      });
      fireEvent.click(resetBtn);

      // Should no longer be selected
      expect(openStringDot).not.toHaveClass('bg-green-500');
      expect(openStringDot).toHaveClass('bg-slate-600');
    });
  });

  describe('Responsive Design', () => {
    it('should render all controls in mobile view', () => {
      renderWithProvider();

      // Check all essential controls are present
      expect(screen.getByText(/Interactive Fretboard/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Select 4 string bass guitar' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Select 5 string bass guitar' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Reset all selected fretboard dots',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Reset fretboard tilt to default 35 degrees',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Set fretboard tilt to flat view, 0 degrees',
        }),
      ).toBeInTheDocument();
    });
  });
});
