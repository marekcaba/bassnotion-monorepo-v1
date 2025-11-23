/**
 * CoreServicesGate Tests
 *
 * Tests the CoreServices initialization gate that prevents race conditions
 * (BUG #1 fix)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CoreServicesGate, useCoreServicesReady } from '../CoreServicesGate.js';
import * as AudioProviderModule from '../../providers/AudioProvider.js';

// Mock AudioProvider
vi.mock('../../providers/AudioProvider.js', () => ({
  useAudioServices: vi.fn(),
}));

describe('CoreServicesGate - BUG #1: Race Condition Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // LOADING STATE TESTS
  // ============================================================================

  describe('Loading State', () => {
    it('should show loading state when coreServicesReady is false', () => {
      vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
        coreServicesReady: false,
        error: null,
        coreServices: null,
        audioEngine: null,
        transportController: null,
        eventBus: null,
        pluginManager: null,
        serviceRegistry: null,
        isInitialized: false,
        getTone: () => null,
      });

      render(
        <CoreServicesGate>
          <div>Should not render</div>
        </CoreServicesGate>
      );

      expect(screen.getByText(/Initializing audio system/i)).toBeInTheDocument();
      expect(screen.queryByText('Should not render')).not.toBeInTheDocument();
    });

    it('should show custom fallback when provided', () => {
      vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
        coreServicesReady: false,
        error: null,
        coreServices: null,
        audioEngine: null,
        transportController: null,
        eventBus: null,
        pluginManager: null,
        serviceRegistry: null,
        isInitialized: false,
        getTone: () => null,
      });

      render(
        <CoreServicesGate fallback={<div>Custom Loading...</div>}>
          <div>Should not render</div>
        </CoreServicesGate>
      );

      expect(screen.getByText('Custom Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Should not render')).not.toBeInTheDocument();
    });

    it('should not render children when CoreServices is null', () => {
      vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
        coreServicesReady: true, // Ready flag is true
        error: null,
        coreServices: null, // But CoreServices is null
        audioEngine: null,
        transportController: null,
        eventBus: null,
        pluginManager: null,
        serviceRegistry: null,
        isInitialized: false,
        getTone: () => null,
      });

      render(
        <CoreServicesGate>
          <div>Should not render</div>
        </CoreServicesGate>
      );

      expect(screen.getByText(/Initializing audio system/i)).toBeInTheDocument();
      expect(screen.queryByText('Should not render')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // READY STATE TESTS
  // ============================================================================

  describe('Ready State', () => {
    it('should render children when CoreServices is ready', () => {
      const mockCoreServices = { isReady: () => true };

      vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
        coreServicesReady: true,
        error: null,
        coreServices: mockCoreServices as any,
        audioEngine: null,
        transportController: null,
        eventBus: null,
        pluginManager: null,
        serviceRegistry: null,
        isInitialized: true,
        getTone: () => null,
      });

      render(
        <CoreServicesGate>
          <div>Audio Component</div>
        </CoreServicesGate>
      );

      expect(screen.getByText('Audio Component')).toBeInTheDocument();
      expect(screen.queryByText(/Initializing/i)).not.toBeInTheDocument();
    });

    it('should render children immediately if already initialized', () => {
      const mockCoreServices = { isReady: () => true };

      vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
        coreServicesReady: true,
        error: null,
        coreServices: mockCoreServices as any,
        audioEngine: null,
        transportController: null,
        eventBus: null,
        pluginManager: null,
        serviceRegistry: null,
        isInitialized: true,
        getTone: () => null,
      });

      const { container } = render(
        <CoreServicesGate>
          <div data-testid="child">Rendered</div>
        </CoreServicesGate>
      );

      // Should render immediately, no delay
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ERROR STATE TESTS
  // ============================================================================

  describe('Error State', () => {
    it('should show error message when initialization fails', () => {
      const testError = new Error('Failed to initialize audio');

      vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
        coreServicesReady: false,
        error: testError,
        coreServices: null,
        audioEngine: null,
        transportController: null,
        eventBus: null,
        pluginManager: null,
        serviceRegistry: null,
        isInitialized: false,
        getTone: () => null,
      });

      render(
        <CoreServicesGate>
          <div>Should not render</div>
        </CoreServicesGate>
      );

      expect(screen.getByText(/Failed to initialize audio system/i)).toBeInTheDocument();
      expect(screen.queryByText('Should not render')).not.toBeInTheDocument();
    });

    it('should show custom error fallback when provided', () => {
      const testError = new Error('Custom error');

      vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
        coreServicesReady: false,
        error: testError,
        coreServices: null,
        audioEngine: null,
        transportController: null,
        eventBus: null,
        pluginManager: null,
        serviceRegistry: null,
        isInitialized: false,
        getTone: () => null,
      });

      render(
        <CoreServicesGate
          errorFallback={(error) => <div>Error: {error.message}</div>}
        >
          <div>Should not render</div>
        </CoreServicesGate>
      );

      expect(screen.getByText('Error: Custom error')).toBeInTheDocument();
      expect(screen.queryByText('Should not render')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // RACE CONDITION PREVENTION TESTS
  // ============================================================================

  describe('Race Condition Prevention', () => {
    it('should not render children during initialization gap', () => {
      // Simulate the race condition scenario:
      // Component renders before CoreServices finishes initialization

      let mockReturn = {
        coreServicesReady: false,
        error: null,
        coreServices: null,
        audioEngine: null,
        transportController: null,
        eventBus: null,
        pluginManager: null,
        serviceRegistry: null,
        isInitialized: false,
        getTone: () => null,
      };

      vi.mocked(AudioProviderModule.useAudioServices).mockImplementation(() => mockReturn);

      const { rerender } = render(
        <CoreServicesGate>
          <div data-testid="child">Audio Component</div>
        </CoreServicesGate>
      );

      // Initially should show loading
      expect(screen.getByText(/Initializing/i)).toBeInTheDocument();
      expect(screen.queryByTestId('child')).not.toBeInTheDocument();

      // Simulate CoreServices becoming ready
      mockReturn = {
        ...mockReturn,
        coreServicesReady: true,
        coreServices: { isReady: () => true } as any,
        isInitialized: true,
      };

      rerender(
        <CoreServicesGate>
          <div data-testid="child">Audio Component</div>
        </CoreServicesGate>
      );

      // Now should render children
      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.queryByText(/Initializing/i)).not.toBeInTheDocument();
    });

    it('should handle multiple rapid re-renders gracefully', () => {
      const mockCoreServices = { isReady: () => true };

      vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
        coreServicesReady: true,
        error: null,
        coreServices: mockCoreServices as any,
        audioEngine: null,
        transportController: null,
        eventBus: null,
        pluginManager: null,
        serviceRegistry: null,
        isInitialized: true,
        getTone: () => null,
      });

      const { rerender } = render(
        <CoreServicesGate>
          <div data-testid="child">Child 1</div>
        </CoreServicesGate>
      );

      expect(screen.getByTestId('child')).toHaveTextContent('Child 1');

      // Rapid re-renders
      rerender(
        <CoreServicesGate>
          <div data-testid="child">Child 2</div>
        </CoreServicesGate>
      );

      expect(screen.getByTestId('child')).toHaveTextContent('Child 2');

      rerender(
        <CoreServicesGate>
          <div data-testid="child">Child 3</div>
        </CoreServicesGate>
      );

      expect(screen.getByTestId('child')).toHaveTextContent('Child 3');
    });
  });
});

describe('useCoreServicesReady Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return isReady: false when CoreServices not ready', () => {
    vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
      coreServicesReady: false,
      error: null,
      coreServices: null,
      audioEngine: null,
      transportController: null,
      eventBus: null,
      pluginManager: null,
      serviceRegistry: null,
      isInitialized: false,
      getTone: () => null,
    });

    let hookResult: any;

    function TestComponent() {
      hookResult = useCoreServicesReady();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult.isReady).toBe(false);
    expect(hookResult.error).toBeNull();
    expect(hookResult.coreServices).toBeNull();
  });

  it('should return isReady: true when CoreServices is ready', () => {
    const mockCoreServices = { isReady: () => true };

    vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
      coreServicesReady: true,
      error: null,
      coreServices: mockCoreServices as any,
      audioEngine: null,
      transportController: null,
      eventBus: null,
      pluginManager: null,
      serviceRegistry: null,
      isInitialized: true,
      getTone: () => null,
    });

    let hookResult: any;

    function TestComponent() {
      hookResult = useCoreServicesReady();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult.isReady).toBe(true);
    expect(hookResult.error).toBeNull();
    expect(hookResult.coreServices).toBe(mockCoreServices);
  });

  it('should return error when initialization fails', () => {
    const testError = new Error('Init failed');

    vi.mocked(AudioProviderModule.useAudioServices).mockReturnValue({
      coreServicesReady: false,
      error: testError,
      coreServices: null,
      audioEngine: null,
      transportController: null,
      eventBus: null,
      pluginManager: null,
      serviceRegistry: null,
      isInitialized: false,
      getTone: () => null,
    });

    let hookResult: any;

    function TestComponent() {
      hookResult = useCoreServicesReady();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult.isReady).toBe(false);
    expect(hookResult.error).toBe(testError);
    expect(hookResult.coreServices).toBeNull();
  });
});
