/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderHook as renderHookRTL,
  waitFor,
  type RenderHookOptions,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserProfile } from '../use-user-profile';

// Wrap renderHook so every call gets a fresh QueryClient + provider.
// Disable retries so query errors surface immediately instead of waiting
// out the default 3-retry backoff during tests.
function renderHook<TProps, TResult>(
  callback: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'>,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // The hook overrides `retry` with its own function (see
      // use-user-profile.ts), so setting retry: false here doesn't
      // disable retries. retryDelay: 0 fires the retries immediately
      // so error states surface before waitFor times out.
      queries: { retry: false, retryDelay: 0, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHookRTL(callback, { ...options, wrapper });
}

// Mock the auth hook, Supabase client, and apiClient. vi.hoisted() so these
// are available inside the vi.mock factories, which Vitest hoists above the
// rest of the module.
const { mockUseAuth, mockSupabase, mockApiGet, mockSetAuthToken } = vi.hoisted(
  () => ({
    mockUseAuth: vi.fn(),
    mockSupabase: {
      auth: {
        getSession: vi.fn(),
      },
    },
    mockApiGet: vi.fn(),
    mockSetAuthToken: vi.fn(),
  }),
);

vi.mock('../use-auth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: mockSupabase,
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: mockApiGet,
    setAuthToken: mockSetAuthToken,
  },
}));

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

    // Default successful session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
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
      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it('should clear profile when user becomes unauthenticated', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
      });

      mockApiGet.mockResolvedValue({
        success: true,
        data: mockProfile,
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

      mockApiGet.mockResolvedValue({
        success: true,
        data: mockProfile,
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

    it('should call apiClient.get with profile endpoint after setting auth token', async () => {
      // Act
      renderHook(() => useUserProfile());

      // Assert: the hook reads the supabase session, passes the access
      // token to apiClient, then requests the profile endpoint. URL
      // resolution and HTTP headers are apiClient's concern (covered by
      // api-client tests), not this hook's.
      await waitFor(() => {
        expect(mockSupabase.auth.getSession).toHaveBeenCalled();
        expect(mockSetAuthToken).toHaveBeenCalledWith('mock-access-token');
        expect(mockApiGet).toHaveBeenCalledWith('/api/user/profile');
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

    it('should surface HTTP errors thrown by apiClient', async () => {
      // Arrange: apiClient.get() throws an ApiError-shaped Error when the
      // backend returns a non-2xx response. We don't reach for the real
      // ApiError class here; the hook only cares about `error.message`.
      mockApiGet.mockRejectedValue(new Error('HTTP 404: Not Found'));

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('HTTP 404: Not Found');
        expect(result.current.profile).toBeNull();
        expect(result.current.isLoading).toBe(false);
      });

      consoleErrorSpy.mockRestore();
    });

    it('should surface API-level errors (success=false in response body)', async () => {
      // Arrange: the backend returned 200 OK but with success=false; the
      // hook itself throws a plain Error using the response's message.
      mockApiGet.mockResolvedValue({
        success: false,
        message: 'Profile not found',
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

    it('should surface network errors', async () => {
      // Arrange
      mockApiGet.mockRejectedValue(new Error('Network error'));

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

    it('should surface non-Error rejections as a generic message', async () => {
      // Arrange: apiClient rejects with a non-Error value (string, etc).
      // The user still deserves to see SOMETHING in the error state rather
      // than the hook silently swallowing the failure.
      mockApiGet.mockRejectedValue('String error');

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
      mockApiGet.mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should refetch profile when refetch is called', async () => {
      // Arrange
      mockApiGet.mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.profile).not.toBeNull();
      });

      // Clear the call count and call refetch (we want to verify only the
      // refetch call, not the initial fetch).
      mockApiGet.mockClear();
      await result.current.refetch();

      // Assert
      expect(mockApiGet).toHaveBeenCalledTimes(1);
    });

    it('should handle refetch errors', async () => {
      // Arrange: first call succeeds (initial mount), then every
      // subsequent call rejects. We use mockRejectedValue (not Once)
      // because the hook retries up to 2 more times on failure.
      mockApiGet.mockResolvedValueOnce({
        success: true,
        data: mockProfile,
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.profile).not.toBeNull();
      });

      // Switch the mock to reject for all subsequent calls (refetch +
      // hook-internal retries).
      mockApiGet.mockReset();
      mockApiGet.mockRejectedValue(new Error('Refetch error'));

      // Call refetch
      await result.current.refetch();

      // Assert: react-query keeps previously-cached data available on
      // refetch failure and surfaces the new error alongside it.
      await waitFor(() => {
        expect(result.current.error).toBe('Refetch error');
      });
      expect(result.current.profile).toEqual(mockProfile);

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

      mockApiGet.mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      // Act
      const { rerender } = renderHook(() => useUserProfile());

      // Wait for initial load
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledTimes(1);
      });

      // Change user ID
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { ...mockUser, id: 'user-456' },
      });

      rerender();

      // Assert
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledTimes(2);
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
      mockApiGet.mockImplementation(() => new Promise(() => {})); // Never resolves

      // Act
      const { result } = renderHook(() => useUserProfile());

      // Assert
      expect(result.current.isLoading).toBe(true);
      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should clear loading state after successful fetch', async () => {
      // Arrange
      mockApiGet.mockResolvedValue({
        success: true,
        data: mockProfile,
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
      mockApiGet.mockRejectedValue(new Error('Test error'));
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
      mockApiGet.mockResolvedValue({
        success: true,
        data: mockProfile,
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
      mockApiGet.mockResolvedValue({
        success: true,
        data: adminProfile,
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
