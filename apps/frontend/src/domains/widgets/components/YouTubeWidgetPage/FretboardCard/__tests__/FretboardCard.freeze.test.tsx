import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FretboardCard } from '../FretboardCard';
import { SyncProvider } from '../../../base/SyncProvider';
import { AudioProvider } from '@/domains/playback/providers/AudioProvider';

// Mock the hooks that might cause issues
vi.mock('../../../hooks/useExerciseSelection', () => ({
  useExerciseSelection: () => ({
    exercises: [
      { id: '1', title: 'Exercise 1', bpm: 120 },
      { id: '2', title: 'Exercise 2', bpm: 140 },
    ],
    isLoading: false,
    error: null,
    selectExercise: vi.fn(),
  }),
}));

// Track render counts
let renderCount = 0;
let componentRenderCount = 0;

// Create a test wrapper that tracks renders
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  renderCount++;
  console.log(`TestWrapper rendered: ${renderCount} times`);

  return (
    <AudioProvider>
      <SyncProvider debugMode={false}>{children}</SyncProvider>
    </AudioProvider>
  );
};

// Create a component that tracks FretboardCard renders
const FretboardCardWithTracking = (props: any) => {
  componentRenderCount++;
  console.log(`FretboardCard rendered: ${componentRenderCount} times`);

  if (componentRenderCount > 50) {
    throw new Error(`Excessive renders detected: ${componentRenderCount}`);
  }

  return <FretboardCard {...props} />;
};

describe('FretboardCard Freeze Detection', () => {
  beforeEach(() => {
    renderCount = 0;
    componentRenderCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log(
      `Final render counts - Wrapper: ${renderCount}, Component: ${componentRenderCount}`,
    );
  });

  it('should not cause excessive re-renders on mount', async () => {
    const { container } = render(
      <TestWrapper>
        <FretboardCardWithTracking />
      </TestWrapper>,
    );

    // Wait a bit to see if renders stabilize
    await waitFor(
      () => {
        expect(componentRenderCount).toBeLessThan(10);
      },
      { timeout: 2000 },
    );

    console.log(
      `Mount test - Final component renders: ${componentRenderCount}`,
    );
  });

  it('should not cause infinite loops with exercises prop', async () => {
    const exercises = [
      { id: '1', title: 'Test Exercise 1', bpm: 120 },
      { id: '2', title: 'Test Exercise 2', bpm: 140 },
    ];

    const { rerender } = render(
      <TestWrapper>
        <FretboardCardWithTracking exercises={exercises} />
      </TestWrapper>,
    );

    const initialRenders = componentRenderCount;
    console.log(`After initial render: ${initialRenders}`);

    // Rerender with same props
    rerender(
      <TestWrapper>
        <FretboardCardWithTracking exercises={exercises} />
      </TestWrapper>,
    );

    await waitFor(
      () => {
        expect(componentRenderCount - initialRenders).toBeLessThan(5);
      },
      { timeout: 1000 },
    );

    console.log(`Exercise prop test - Total renders: ${componentRenderCount}`);
  });

  it('should handle onExerciseSelect without infinite loops', async () => {
    const onExerciseSelect = vi.fn();

    render(
      <TestWrapper>
        <FretboardCardWithTracking
          onExerciseSelect={onExerciseSelect}
          exercises={[{ id: '1', title: 'Test', bpm: 120 }]}
        />
      </TestWrapper>,
    );

    await waitFor(
      () => {
        expect(componentRenderCount).toBeLessThan(10);
      },
      { timeout: 1000 },
    );

    console.log(
      `onExerciseSelect test - Total renders: ${componentRenderCount}`,
    );
  });

  it('should isolate problematic hooks', async () => {
    // Test with minimal props to isolate issues
    const { container } = render(
      <TestWrapper>
        <FretboardCardWithTracking is3DMode={false} tiltAngle={35} />
      </TestWrapper>,
    );

    // Log any errors in the console
    const errorElements = container.querySelectorAll('.widget-error-boundary');
    if (errorElements.length > 0) {
      console.error('Error boundary triggered!', errorElements);
    }

    await waitFor(
      () => {
        expect(componentRenderCount).toBeLessThan(15);
      },
      { timeout: 2000 },
    );
  });
});
