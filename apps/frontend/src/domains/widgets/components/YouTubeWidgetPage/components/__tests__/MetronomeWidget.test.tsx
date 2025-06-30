/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../../../test/test-utils.js';

// Mock all @/ imports before importing the component
vi.mock('@/shared/components/ui/card', () => ({
  Card: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
      <div ref={ref} className={className} data-testid="card" {...props}>
        {children}
      </div>
    ),
  ),
  CardContent: React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, children, ...props }, ref) => (
    <div ref={ref} className={className} data-testid="card-content" {...props}>
      {children}
    </div>
  )),
}));

vi.mock('@/shared/components/ui/button', () => ({
  Button: React.forwardRef<HTMLButtonElement, any>(
    ({ className, variant, size, children, onClick, ...props }, ref) => (
      <button
        ref={ref}
        className={className}
        data-variant={variant}
        data-size={size}
        data-testid="button"
        onClick={onClick}
        {...props}
      >
        {children}
      </button>
    ),
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="play-icon">▶️</span>,
  Pause: () => <span data-testid="pause-icon">⏸️</span>,
  Volume2: () => <span data-testid="volume-icon">🔊</span>,
}));

// Mock shared utilities
vi.mock('@/shared/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Now import the component after mocking dependencies
import { MetronomeWidget } from '../MetronomeWidget.js';

describe('MetronomeWidget', () => {
  const defaultProps = {
    bpm: 100,
    isPlaying: false,
    isVisible: true,
    onTogglePlay: vi.fn(),
    onBpmChange: vi.fn(),
    onToggleVisibility: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when visible', () => {
    render(<MetronomeWidget {...defaultProps} />);

    expect(screen.getByText('🎵 Metronome')).toBeInTheDocument();
    expect(screen.getByText('100 BPM')).toBeInTheDocument();
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<MetronomeWidget {...defaultProps} isVisible={false} />);

    expect(screen.queryByText('🎵 Metronome')).not.toBeInTheDocument();
  });

  it('should display correct BPM value', () => {
    render(<MetronomeWidget {...defaultProps} bpm={120} />);

    expect(screen.getByText('120 BPM')).toBeInTheDocument();
  });

  it('should show play icon when not playing', () => {
    render(<MetronomeWidget {...defaultProps} isPlaying={false} />);

    expect(screen.getByTestId('play-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('pause-icon')).not.toBeInTheDocument();
  });

  it('should show pause icon when playing', () => {
    render(<MetronomeWidget {...defaultProps} isPlaying={true} />);

    expect(screen.getByTestId('pause-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('play-icon')).not.toBeInTheDocument();
  });

  it('should call onTogglePlay when play/pause button is clicked', async () => {
    const { user } = render(<MetronomeWidget {...defaultProps} />);

    const playButton = screen.getByTestId('play-icon').closest('button');
    expect(playButton).toBeInTheDocument();

    await user.click(playButton!);

    expect(defaultProps.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('should call onBpmChange when tempo is increased', async () => {
    const { user } = render(<MetronomeWidget {...defaultProps} />);

    const increaseButton = screen.getByText('+5');
    await user.click(increaseButton);

    expect(defaultProps.onBpmChange).toHaveBeenCalledWith(105);
  });

  it('should call onBpmChange when tempo is decreased', async () => {
    const { user } = render(<MetronomeWidget {...defaultProps} />);

    const decreaseButton = screen.getByText('-5');
    await user.click(decreaseButton);

    expect(defaultProps.onBpmChange).toHaveBeenCalledWith(95);
  });

  it('should respect minimum BPM of 60', async () => {
    const { user } = render(<MetronomeWidget {...defaultProps} bpm={60} />);

    const decreaseButton = screen.getByText('-5');
    await user.click(decreaseButton);

    expect(defaultProps.onBpmChange).toHaveBeenCalledWith(60);
  });

  it('should respect maximum BPM of 200', async () => {
    const { user } = render(<MetronomeWidget {...defaultProps} bpm={200} />);

    const increaseButton = screen.getByText('+5');
    await user.click(increaseButton);

    expect(defaultProps.onBpmChange).toHaveBeenCalledWith(200);
  });

  it('should show visual beat indicators', () => {
    render(<MetronomeWidget {...defaultProps} isPlaying={true} />);

    // Look for the beat indicator divs instead of text
    const beatIndicators = document.querySelectorAll('.w-4.h-4.rounded-full');
    expect(beatIndicators.length).toBeGreaterThan(0);
  });

  it('should call onToggleVisibility when hide button is clicked', async () => {
    const { user } = render(<MetronomeWidget {...defaultProps} />);

    const hideButton = screen.getByText('×');
    await user.click(hideButton);

    expect(defaultProps.onToggleVisibility).toHaveBeenCalledTimes(1);
  });
});
