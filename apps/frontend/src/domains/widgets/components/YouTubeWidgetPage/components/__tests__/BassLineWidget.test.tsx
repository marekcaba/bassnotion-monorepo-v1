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

vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="play-icon">▶️</span>,
  Pause: () => <span data-testid="pause-icon">⏸️</span>,
  Volume2: () => <span data-testid="volume-icon">🔊</span>,
}));

vi.mock('@/shared/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

import { BassLineWidget } from '../BassLineWidget.js';

describe('BassLineWidget', () => {
  const defaultProps = {
    pattern: 'Modal Walking',
    isPlaying: false,
    isVisible: true,
    onTogglePlay: vi.fn(),
    onPatternChange: vi.fn(),
    onToggleVisibility: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when visible', () => {
    render(<BassLineWidget {...defaultProps} />);

    expect(screen.getByText('🎸 Bass Line')).toBeInTheDocument();
    expect(screen.getAllByText('Modal Walking')).toHaveLength(2);
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<BassLineWidget {...defaultProps} isVisible={false} />);

    expect(screen.queryByText('🎸 Bass Line')).not.toBeInTheDocument();
  });

  it('should display correct pattern', () => {
    render(<BassLineWidget {...defaultProps} pattern="Chromatic Walk" />);

    expect(screen.getAllByText('Chromatic Walk')).toHaveLength(2);
  });

  it('should show play icon when not playing', () => {
    render(<BassLineWidget {...defaultProps} isPlaying={false} />);

    expect(screen.getByTestId('play-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('pause-icon')).not.toBeInTheDocument();
  });

  it('should show pause icon when playing', () => {
    render(<BassLineWidget {...defaultProps} isPlaying={true} />);

    expect(screen.getByTestId('pause-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('play-icon')).not.toBeInTheDocument();
  });

  it('should call onTogglePlay when play/pause button is clicked', async () => {
    const { user } = render(<BassLineWidget {...defaultProps} />);

    const playButton = screen.getByTestId('play-icon').closest('button');
    expect(playButton).toBeInTheDocument();

    await user.click(playButton!);

    expect(defaultProps.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('should show fret position indicators', () => {
    render(<BassLineWidget {...defaultProps} isPlaying={true} />);

    // Look for fret position elements
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getAllByText('D')).toHaveLength(2);
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('should call onToggleVisibility when hide button is clicked', async () => {
    const { user } = render(<BassLineWidget {...defaultProps} />);

    const hideButton = screen.getByText('×');
    await user.click(hideButton);

    expect(defaultProps.onToggleVisibility).toHaveBeenCalledTimes(1);
  });
});
