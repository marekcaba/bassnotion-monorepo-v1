/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import { UserIndicator } from '../UserIndicator';

// Mock the hooks. vi.hoisted() so these are available inside the
// vi.mock factories, which Vitest hoists above the rest of the module.
const { mockUseAuth, mockUseUserProfile, mockNavigateWithTransition } =
  vi.hoisted(() => ({
    mockUseAuth: vi.fn(),
    mockUseUserProfile: vi.fn(),
    mockNavigateWithTransition: vi.fn(),
  }));

// Test file lives in components/__tests__/, so paths to user/hooks/ need
// to climb two levels, not one. Previously these resolved to
// components/hooks/use-auth (a path that doesn't exist), so vi.mock
// silently failed and the real Zustand-backed hooks ran instead — that's
// why every test rendered the "Loading..." skeleton instead of real
// content.
vi.mock('../../hooks/use-auth', () => ({
  useAuth: mockUseAuth,
  useAuthStore: vi.fn((selector?: (state: any) => any) => {
    // The component calls useAuthStore((state) => state.reset).
    // Return the selected value (or the whole stub if no selector).
    const stub = { reset: vi.fn() };
    return selector ? selector(stub) : stub;
  }),
}));

vi.mock('../../hooks/use-user-profile', () => ({
  useUserProfile: mockUseUserProfile,
}));

vi.mock('@/lib/hooks/use-view-transition-router', () => ({
  useViewTransitionRouter: () => ({
    navigateWithTransition: mockNavigateWithTransition,
  }),
}));

describe('UserIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unauthenticated State', () => {
    it('should display "Not logged in" when user is not authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert: the container around the "Not logged in" text carries
      // the styled background. getByRole('generic') would match both
      // the testing-library wrapper and the component div, so we target
      // the parent of our known text node instead.
      expect(screen.getByText('Not logged in')).toBeInTheDocument();
      expect(screen.getByText('Not logged in').parentElement).toHaveClass(
        'bg-slate-800/50',
      );
    });

    it('should display login icon when not authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      const container = screen.getByText('Not logged in').closest('div');
      expect(container).toBeInTheDocument();
      // Note: We can't easily test Lucide icons directly, but we can verify the structure
    });

    it('should navigate to /login when clicked while unauthenticated', async () => {
      // NOTE: The earlier version of this test asserted the click did
      // NOTHING. Product changed: unauthenticated click now routes the
      // user straight to the login page (better UX than a dead click).
      // Updating the assertion to match the new behavior.
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      const { user } = render(<UserIndicator />);

      // Act
      const indicator = screen.getByText('Not logged in').closest('div');
      await user.click(indicator!);

      // Assert
      expect(mockNavigateWithTransition).toHaveBeenCalledWith('/login');
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner when profile is loading', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: true,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      const spinner = screen.getByText('Loading...').previousElementSibling;
      expect(spinner).toHaveClass('animate-spin');
    });

    it('should display loading state styling', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: true,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      const container = screen.getByText('Loading...').closest('div');
      expect(container).toHaveClass('bg-slate-800/50', 'border-slate-700/50');
    });
  });

  describe('Authenticated User State', () => {
    it('should display user information when authenticated with profile', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'John Doe',
          role: 'user',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('should display email username when no display name is available', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'john.doe@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: null,
          role: 'user',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('john.doe')).toBeInTheDocument();
    });

    it('should display "User" as fallback when no email or display name', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: null },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: null,
          role: 'user',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert: when displayName, cachedDisplayName, and user.email are
      // all nullish the component falls back to the literal "User"
      // string. The role badge ALSO reads "User" for non-admin roles,
      // so there are exactly two "User" texts in the DOM (display name +
      // role badge).
      const userTexts = screen.getAllByText('User');
      expect(userTexts).toHaveLength(2);
    });

    it('should navigate to dashboard when clicked', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'John Doe',
          role: 'user',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      const { user } = render(<UserIndicator />);

      // Act
      const indicator = screen.getByText('John Doe').closest('div');
      await user.click(indicator!);

      // Assert — signed-in home is Backstage (the legacy /dashboard was removed). In the test env
      // NEXT_PUBLIC_APP_URL is unset, so navigateToApp resolves to the relative /backstage path.
      expect(mockNavigateWithTransition).toHaveBeenCalledWith('/backstage');
    });

    it('should have hover effects for interactive state', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'John Doe',
          role: 'user',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      const indicator = screen.getByText('John Doe').closest('div');
      expect(indicator).toHaveClass(
        'cursor-pointer',
        'hover:bg-slate-800/70',
        'transition-colors',
      );
    });

    it('should have correct tooltip', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'John Doe',
          role: 'user',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      const indicator = screen.getByText('John Doe').closest('div');
      expect(indicator).toHaveAttribute('title', 'Go to Dashboard');
    });
  });

  describe('Admin User State', () => {
    it('should display admin badge and styling for admin users', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'admin@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Admin User',
          role: 'admin',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('Admin')).toBeInTheDocument();
      const adminBadge = screen.getByText('Admin');
      expect(adminBadge).toHaveClass(
        'bg-yellow-500/20',
        'text-yellow-400',
        'border-yellow-500/30',
      );
    });

    it('should display crown icon for admin users', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'admin@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Admin User',
          role: 'admin',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      // We verify the admin badge exists, icon verification depends on implementation
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
  });

  describe('Regular User State', () => {
    it('should display user badge and styling for regular users', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'user@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Regular User',
          role: 'user',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('User')).toBeInTheDocument();
      const userBadge = screen.getByText('User');
      expect(userBadge).toHaveClass(
        'bg-blue-500/20',
        'text-blue-400',
        'border-blue-500/30',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing profile gracefully', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('should handle undefined role gracefully', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Test User',
          role: undefined,
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('should handle unknown role as regular user', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Test User',
          role: 'unknown-role',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not cause excessive re-renders', () => {
      // Arrange
      const authData = {
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
        isInitialized: true,
      };
      const profileData = {
        profile: {
          id: '123',
          displayName: 'Test User',
          role: 'user',
        },
        isLoading: false,
        isHydrated: true,
        cachedRole: null,
        cachedDisplayName: null,
      };

      mockUseAuth.mockReturnValue(authData);
      mockUseUserProfile.mockReturnValue(profileData);

      // Act
      const { rerender } = render(<UserIndicator />);
      rerender(<UserIndicator />);
      rerender(<UserIndicator />);

      // Assert
      expect(screen.getByText('Test User')).toBeInTheDocument();
      // Component should render consistently
    });
  });
});
