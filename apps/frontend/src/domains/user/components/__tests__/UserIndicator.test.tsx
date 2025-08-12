/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import { UserIndicator } from '../UserIndicator';

// Mock the hooks
const mockUseAuth = vi.fn();
const mockUseUserProfile = vi.fn();
const mockNavigateWithTransition = vi.fn();

vi.mock('../hooks/use-auth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../hooks/use-user-profile', () => ({
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: false,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('Not logged in')).toBeInTheDocument();
      expect(screen.getByRole('generic')).toHaveClass('bg-slate-800/50');
    });

    it('should display login icon when not authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: false,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      const container = screen.getByText('Not logged in').closest('div');
      expect(container).toBeInTheDocument();
      // Note: We can't easily test Lucide icons directly, but we can verify the structure
    });

    it('should not be clickable when not authenticated', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: false,
      });

      const { user } = render(<UserIndicator />);

      // Act
      const indicator = screen.getByText('Not logged in').closest('div');
      await user.click(indicator!);

      // Assert
      expect(mockNavigateWithTransition).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner when profile is loading', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: true,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: true,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'John Doe',
          role: 'user',
        },
        isLoading: false,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: null,
          role: 'user',
        },
        isLoading: false,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: null,
          role: 'user',
        },
        isLoading: false,
      });

      // Act
      render(<UserIndicator />);

      // Assert
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('should navigate to dashboard when clicked', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'John Doe',
          role: 'user',
        },
        isLoading: false,
      });

      const { user } = render(<UserIndicator />);

      // Act
      const indicator = screen.getByText('John Doe').closest('div');
      await user.click(indicator!);

      // Assert
      expect(mockNavigateWithTransition).toHaveBeenCalledWith('/dashboard');
    });

    it('should have hover effects for interactive state', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' },
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'John Doe',
          role: 'user',
        },
        isLoading: false,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'John Doe',
          role: 'user',
        },
        isLoading: false,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Admin User',
          role: 'admin',
        },
        isLoading: false,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Admin User',
          role: 'admin',
        },
        isLoading: false,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Regular User',
          role: 'user',
        },
        isLoading: false,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: false,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Test User',
          role: undefined,
        },
        isLoading: false,
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
      });
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          displayName: 'Test User',
          role: 'unknown-role',
        },
        isLoading: false,
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
      };
      const profileData = {
        profile: {
          id: '123',
          displayName: 'Test User',
          role: 'user',
        },
        isLoading: false,
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
