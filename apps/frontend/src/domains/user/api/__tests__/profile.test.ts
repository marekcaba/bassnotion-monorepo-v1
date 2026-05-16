/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProfileService, profileService } from '../profile';

// Mock Supabase client. vi.hoisted() so mockSupabase is available inside
// the vi.mock factory, which Vitest hoists above the rest of the module.
const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    })),
  },
}));

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ProfileService', () => {
  const mockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: {
      display_name: 'Test User',
      full_name: 'Test User Full',
      name: 'Test User Name',
    },
  };

  const mockProfile = {
    id: 'user-123',
    email: 'test@example.com',
    display_name: 'Test User',
    bio: 'Test bio',
    avatar_url: 'https://example.com/avatar.jpg',
    bass_string_count: 4,
    bass_max_frets: 24,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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

    // Default successful user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
  });

  describe('Authentication', () => {
    it('should get auth headers successfully', async () => {
      // Arrange
      const service = new ProfileService();

      // Act
      const headers = await (service as any).getAuthHeaders();

      // Assert
      expect(headers).toEqual({
        Authorization: 'Bearer mock-access-token',
        'Content-Type': 'application/json',
      });
    });

    it('should throw error when session is missing', async () => {
      // Arrange
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const service = new ProfileService();

      // Act & Assert
      await expect((service as any).getAuthHeaders()).rejects.toThrow(
        'User not authenticated',
      );
    });

    it('should throw error when session has error', async () => {
      // Arrange
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const service = new ProfileService();

      // Act & Assert
      await expect((service as any).getAuthHeaders()).rejects.toThrow(
        'User not authenticated',
      );
    });

    it('should throw error when access token is missing', async () => {
      // Arrange
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: null } },
        error: null,
      });

      const service = new ProfileService();

      // Act & Assert
      await expect((service as any).getAuthHeaders()).rejects.toThrow(
        'User not authenticated',
      );
    });
  });

  describe('Backend URL Configuration', () => {
    it('should use NEXT_PUBLIC_API_URL when available', () => {
      // Arrange
      process.env.NEXT_PUBLIC_API_URL = 'http://api.example.com';
      const service = new ProfileService();

      // Act
      const url = (service as any).backendUrl;

      // Assert
      expect(url).toBe('http://api.example.com');
    });

    it('should fallback to NEXT_PUBLIC_BACKEND_URL when API_URL not available', () => {
      // Arrange
      delete process.env.NEXT_PUBLIC_API_URL;
      process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend.example.com';
      const service = new ProfileService();

      // Act
      const url = (service as any).backendUrl;

      // Assert
      expect(url).toBe('http://backend.example.com');
    });

    it('should use localhost as default when no environment variables', () => {
      // Arrange
      delete process.env.NEXT_PUBLIC_API_URL;
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      const service = new ProfileService();

      // Act
      const url = (service as any).backendUrl;

      // Assert
      expect(url).toBe('http://localhost:3000');
    });
  });

  describe('updateProfile', () => {
    const mockProfileData = {
      displayName: 'Updated User',
      bio: 'Updated bio',
      avatarUrl: 'https://example.com/new-avatar.jpg',
    };

    const mockResponseData = {
      id: 'user-123',
      displayName: 'Updated User',
      bio: 'Updated bio',
      avatarUrl: 'https://example.com/new-avatar.jpg',
    };

    it('should update profile successfully', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            success: true,
            data: mockResponseData,
          }),
      });

      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Act
      const result = await profileService.updateProfile(mockProfileData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/user/profile',
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockProfileData),
        },
      );

      expect(result).toEqual(mockResponseData);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Profile] Calling backend URL:',
        'http://localhost:3000/user/profile',
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle HTTP error responses', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            success: false,
            message: 'Invalid profile data',
          }),
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(
        profileService.updateProfile(mockProfileData),
      ).rejects.toThrow('Invalid profile data');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle API error responses', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: false,
            message: 'Profile validation failed',
          }),
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(
        profileService.updateProfile(mockProfileData),
      ).rejects.toThrow('Profile validation failed');

      consoleErrorSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Network error'));
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(
        profileService.updateProfile(mockProfileData),
      ).rejects.toThrow('Network error');

      consoleErrorSpy.mockRestore();
    });

    it('should handle authentication errors', async () => {
      // Arrange
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(
        profileService.updateProfile(mockProfileData),
      ).rejects.toThrow('User not authenticated');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('deleteAccount', () => {
    const mockPassword = 'test-password';

    it('should delete account successfully', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {},
          }),
      });

      // Act
      const result = await profileService.deleteAccount(mockPassword);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/user/account',
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password: mockPassword }),
        },
      );

      expect(result).toEqual({});
    });

    it('should handle delete account errors', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            success: false,
            message: 'Invalid password',
          }),
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(profileService.deleteAccount(mockPassword)).rejects.toThrow(
        'Invalid password',
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('updateBassConfiguration', () => {
    const mockBassConfig = {
      stringCount: 5,
      maxFrets: 22,
    };

    it('should update bass configuration successfully', async () => {
      // Arrange
      const mockUpdatedProfile = {
        ...mockProfile,
        bass_string_count: 5,
        bass_max_frets: 22,
        updated_at: '2024-01-02T00:00:00Z',
      };

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUpdatedProfile,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockSupabaseChain);

      // Act
      const result =
        await profileService.updateBassConfiguration(mockBassConfig);

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabaseChain.update).toHaveBeenCalledWith({
        bass_string_count: 5,
        bass_max_frets: 22,
        updated_at: expect.any(String),
      });
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'user-123');

      expect(result).toEqual({
        stringCount: 5,
        maxFrets: 22,
      });
    });

    it('should handle bass configuration update errors', async () => {
      // Arrange
      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Profile not found' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockSupabaseChain);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(
        profileService.updateBassConfiguration(mockBassConfig),
      ).rejects.toThrow(
        'Failed to update bass configuration: Profile not found',
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle user authentication errors', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' },
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(
        profileService.updateBassConfiguration(mockBassConfig),
      ).rejects.toThrow('User not authenticated');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCurrentProfile', () => {
    it('should get existing profile successfully', async () => {
      // Arrange
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockSupabaseChain);

      // Act
      const result = await profileService.getCurrentProfile();

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabaseChain.select).toHaveBeenCalledWith('*');
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('id', 'user-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        bio: 'Test bio',
        avatarUrl: 'https://example.com/avatar.jpg',
        bassConfiguration: {
          stringCount: 4,
          maxFrets: 24,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should create profile when none exists', async () => {
      // Arrange
      const mockNewProfile = {
        ...mockProfile,
        display_name: 'Test User',
        bio: null,
        avatar_url: null,
      };

      const mockMaybeSingleChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockNewProfile,
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockMaybeSingleChain)
        .mockReturnValueOnce(mockInsertChain);

      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Act
      const result = await profileService.getCurrentProfile();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'No profile found, creating one...',
      );
      expect(mockInsertChain.insert).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: null,
        avatar_url: null,
        bass_string_count: 4,
        bass_max_frets: 24,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        bio: null,
        avatarUrl: null,
        bassConfiguration: {
          stringCount: 4,
          maxFrets: 24,
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      consoleLogSpy.mockRestore();
    });

    it('should use fallback display name when user metadata missing', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            ...mockUser,
            user_metadata: {},
            email: 'fallback@example.com',
          },
        },
        error: null,
      });

      const mockMaybeSingleChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockProfile, display_name: 'fallback' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockMaybeSingleChain)
        .mockReturnValueOnce(mockInsertChain);

      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Act
      await profileService.getCurrentProfile();

      // Assert
      expect(mockInsertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'fallback',
        }),
      );

      consoleLogSpy.mockRestore();
    });

    it('should use "User" as ultimate fallback for display name', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            ...mockUser,
            user_metadata: {},
            email: null,
          },
        },
        error: null,
      });

      const mockMaybeSingleChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockProfile, display_name: 'User' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockMaybeSingleChain)
        .mockReturnValueOnce(mockInsertChain);

      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Act
      await profileService.getCurrentProfile();

      // Assert
      expect(mockInsertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'User',
        }),
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle profile fetch errors', async () => {
      // Arrange
      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockSupabase.from.mockReturnValue(mockSupabaseChain);
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(profileService.getCurrentProfile()).rejects.toThrow(
        'Failed to fetch profile: Database error',
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle profile creation errors', async () => {
      // Arrange
      const mockMaybeSingleChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Insert failed' },
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockMaybeSingleChain)
        .mockReturnValueOnce(mockInsertChain);

      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(profileService.getCurrentProfile()).rejects.toThrow(
        'Failed to create profile: Insert failed',
      );

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle null data after profile creation', async () => {
      // Arrange
      const mockMaybeSingleChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockMaybeSingleChain)
        .mockReturnValueOnce(mockInsertChain);

      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(profileService.getCurrentProfile()).rejects.toThrow(
        'Failed to create profile: No data returned',
      );

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle user authentication errors', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' },
      });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act & Assert
      await expect(profileService.getCurrentProfile()).rejects.toThrow(
        'User not authenticated',
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle null bass configuration gracefully', async () => {
      // Arrange
      const profileWithNullBass = {
        ...mockProfile,
        bass_string_count: null,
        bass_max_frets: null,
      };

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: profileWithNullBass,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockSupabaseChain);

      // Act
      const result = await profileService.getCurrentProfile();

      // Assert
      expect(result.bassConfiguration).toEqual({
        stringCount: 4,
        maxFrets: 24,
      });
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      // Assert
      expect(profileService).toBeInstanceOf(ProfileService);
    });

    it('should use the same instance across imports', () => {
      // Arrange
      const { profileService: importedService } = require('../profile');

      // Assert
      expect(importedService).toBe(profileService);
    });
  });
});
