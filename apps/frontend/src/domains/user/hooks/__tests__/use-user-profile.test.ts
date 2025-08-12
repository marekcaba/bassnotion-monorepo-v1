/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserProfile } from '../use-user-profile';

// Mock the auth hook
const mockUseAuth = vi.fn();
vi.mock('../use-auth', () => ({
  useAuth: mockUseAuth,
}));

// Mock the Supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
  },
};

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useUserProfile', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
  };

  const mockProfile = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    bio: 'Test bio',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    role: 'user',
    preferences: {
      bassConfiguration: {
        stringCount: 4,
        maxFrets: 24,
      },
      theme: 'light',
      emailNotifications: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set default environment variables
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';

    // Default successful session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
  });

  describe('Unauthenticated State', () => {
    it('should return null profile when not authenticated', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
      });

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      expect(result.current.profile).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should not make API calls when not authenticated', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
      });

      // Act
      renderHook(() => useUserProfile());

      // Assert
      expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should clear profile when user becomes unauthenticated', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockProfile,
          }),
      });

      // Act
      const { result, rerender } = renderHook(() => useUserProfile());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.profile).not.toBeNull();
      });

      // Change to unauthenticated
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
      });

      rerender();

      // Assert
      expect(result.current.profile).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Authenticated State - Successful Profile Fetch', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockProfile,
          }),
      });
    });

    it('should fetch profile successfully', async () => {
      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert initial state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBeNull();

      // Wait for profile to load
      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should make correct API call with authentication headers', async () => {
      // Act
      renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(mockSupabase.auth.getSession).toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/user/profile',
          {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer mock-access-token',
            },
          },
        );
      });
    });

    it('should use fallback backend URL when NEXT_PUBLIC_API_URL not set', async () => {
      // Arrange
      delete process.env.NEXT_PUBLIC_API_URL;
      process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.example.com';

      // Act
      renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://backend.example.com/api/user/profile',
          expect.any(Object),
        );
      });
    });

    it('should use default localhost when no environment variables set', async () => {
      // Arrange
      delete process.env.NEXT_PUBLIC_API_URL;
      delete process.env.NEXT_PUBLIC_BACKEND_URL;

      // Act
      renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/user/profile',
          expect.any(Object),
        );
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
      });
    });

    it('should handle session errors', async () => {
      // Arrange
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('User not authenticated');
        expect(result.current.profile).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle missing session', async () => {
      // Arrange
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('User not authenticated');
        expect(result.current.profile).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle HTTP error responses', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch profile: 404');
        expect(result.current.profile).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle API error responses', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: false,
            message: 'Profile not found',
          }),
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Profile not found');
        expect(result.current.profile).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
        expect(result.current.profile).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle unknown errors', async () => {
      // Arrange
      mockFetch.mockRejectedValue('String error');

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Unknown error');
        expect(result.current.profile).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Refetch Functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
      });
    });

    it('should provide refetch function', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockProfile,
          }),
      });

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should refetch profile when refetch is called', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockProfile,
          }),
      });

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.profile).not.toBeNull();
      });

      // Clear mocks and call refetch
      vi.clearAllMocks();
      await result.current.refetch();

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle refetch errors', async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockProfile,
            }),
        })
        .mockRejectedValueOnce(new Error('Refetch error'));

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.profile).not.toBeNull();
      });

      // Call refetch
      await result.current.refetch();

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Refetch error');
        expect(result.current.profile).toBeNull();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('User ID Changes', () => {
    it('should refetch profile when user ID changes', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockProfile,
          }),
      });

      // Act
      const { rerender } = renderHook(() => useUserProfile());

      // Wait for initial load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Change user ID
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { ...mockUser, id: 'user-456' },
      });

      rerender();

      // Assert
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Loading States', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
      });
    });

    it('should show loading state during fetch', () => {
      // Arrange
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      expect(result.current.isLoading).toBe(true);
      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should clear loading state after successful fetch', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockProfile,
          }),
      });

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should clear loading state after error', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Test error'));
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Type Safety', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
      });
    });

    it('should return properly typed profile with role', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockProfile,
          }),
      });

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        const profile = result.current.profile;
        expect(profile).toBeDefined();
        expect(profile?.role).toBe('user');
        expect(typeof profile?.role).toBe('string');
      });
    });

    it('should handle admin role correctly', async () => {
      // Arrange
      const adminProfile = { ...mockProfile, role: 'admin' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: adminProfile,
          }),
      });

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(result.current.profile?.role).toBe('admin');
      });
    });
  });
});
