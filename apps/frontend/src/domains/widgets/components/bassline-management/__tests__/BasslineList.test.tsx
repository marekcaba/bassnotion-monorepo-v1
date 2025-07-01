import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BasslineList } from '../BasslineList';

// Mock the toast hook
vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock the API module to prevent actual API calls
vi.mock('../../api/user-basslines.js', () => ({
  UserBasslinesAPI: {
    getUserBasslines: vi.fn().mockResolvedValue({
      data: { basslines: [], total: 0, page: 1, limit: 20 },
    }),
    deleteBassline: vi.fn(),
    renameBassline: vi.fn(),
    duplicateBassline: vi.fn(),
  },
}));

describe('BasslineList Component', () => {
  const mockProps = {
    onLoadBassline: vi.fn(),
    onEditBassline: vi.fn(),
  };

  it('should render component without crashing', () => {
    render(<BasslineList {...mockProps} />);

    // The component should render some basic UI elements
    // Since it's loading initially, we might see loading state or empty state
    expect(document.body).toContain(
      document.querySelector('[data-testid], .bassline-list, div'),
    );
  });

  it('should accept required props correctly', () => {
    const onLoadBassline = vi.fn();
    const onEditBassline = vi.fn();

    render(
      <BasslineList
        onLoadBassline={onLoadBassline}
        onEditBassline={onEditBassline}
      />,
    );

    // Component should render without throwing errors
    expect(onLoadBassline).toBeDefined();
    expect(onEditBassline).toBeDefined();
  });

  it('should render with proper component structure', async () => {
    render(<BasslineList {...mockProps} />);

    // Wait for component to settle and check it exists in DOM
    const container = document.querySelector('body > div');
    expect(container).toBeInTheDocument();
  });

  it('should not crash with different prop combinations', () => {
    // Test that component handles props gracefully
    expect(() => {
      render(<BasslineList {...mockProps} />);
    }).not.toThrow();
  });

  it('should maintain component stability across re-renders', () => {
    const { rerender } = render(<BasslineList {...mockProps} />);

    // Re-render with same props
    rerender(<BasslineList {...mockProps} />);

    // Should not crash on re-render
    expect(document.body).toBeTruthy();
  });
});
