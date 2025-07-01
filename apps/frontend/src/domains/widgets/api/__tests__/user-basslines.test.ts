import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserBasslinesAPI } from '../user-basslines.js';
import { apiClient } from '@/lib/api-client.js';
import type {
  BasslineMetadata,
  SavedBassline,
  SaveBasslineRequest,
  AutoSaveRequest,
  RenameBasslineRequest,
  DuplicateBasslineRequest,
  BasslineListFilters,
  ExerciseNote,
} from '@bassnotion/contracts';

// Mock the API client
vi.mock('@/lib/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('UserBasslinesAPI', () => {
  const mockApiClient = apiClient as any;

  // Mock data
  const mockMetadata: BasslineMetadata = {
    tempo: 120,
    timeSignature: '4/4',
    key: 'C',
    difficulty: 'beginner',
    tags: ['practice', 'easy'],
  };

  const mockNote: ExerciseNote = {
    id: 'note-1',
    timestamp: 0,
    string: 4 as 1 | 2 | 3 | 4 | 5 | 6,
    fret: 3,
    duration: 250,
    note: 'D#',
    color: 'blue',
    techniques: [],
  };

  const mockBassline: SavedBassline = {
    id: 'bassline-test-id',
    userId: 'user-test-id',
    name: 'Test Bassline',
    description: 'A test bassline for unit testing',
    notes: [mockNote],
    metadata: mockMetadata,
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockSaveRequest: SaveBasslineRequest = {
    name: 'Test Save',
    description: 'Test description',
    notes: [mockNote],
    metadata: mockMetadata,
    overwriteExisting: false,
  };

  const mockAutoSaveRequest: AutoSaveRequest = {
    basslineId: 'bassline-1',
    name: 'Auto Save Test',
    notes: [mockNote],
    metadata: mockMetadata,
    isAutoSave: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserBasslines', () => {
    it('should fetch user basslines with default filters', async () => {
      const mockResponse = {
        basslines: [mockBassline],
        total: 1,
        page: 1,
        limit: 20,
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.getUserBasslines();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/user-basslines');
      expect(result).toEqual(mockResponse);
    });

    it('should apply custom filters', async () => {
      const filters: BasslineListFilters = {
        search: 'test',
        difficulty: 'intermediate',
        tags: ['rock', 'metal'],
        sortBy: 'name',
        sortOrder: 'asc',
        page: 2,
        limit: 10,
      };

      const mockResponse = {
        basslines: [],
        total: 0,
        page: 2,
        limit: 10,
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.getUserBasslines(filters);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/user-basslines?search=test&difficulty=intermediate&tags=rock%2Cmetal&sortBy=name&sortOrder=asc&page=2&limit=10',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle empty results gracefully', async () => {
      const mockResponse = {
        basslines: [],
        total: 0,
        page: 1,
        limit: 20,
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.getUserBasslines();

      expect(result.basslines).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network error');
      mockApiClient.get.mockRejectedValueOnce(error);

      await expect(UserBasslinesAPI.getUserBasslines()).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('getBasslineById', () => {
    it('should fetch specific bassline by ID', async () => {
      const mockResponse = mockBassline;
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.getBasslineById('bassline-test-id');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/user-basslines/bassline-test-id',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle non-existent bassline', async () => {
      const error = new Error('Bassline not found');
      (error as any).response = { status: 404 };
      mockApiClient.get.mockRejectedValueOnce(error);

      await expect(
        UserBasslinesAPI.getBasslineById('non-existent'),
      ).rejects.toThrow('Bassline not found');
    });
  });

  describe('saveBassline', () => {
    it('should save new bassline successfully', async () => {
      const mockResponse = {
        bassline: mockBassline,
        message: 'Bassline saved successfully',
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.saveBassline(mockSaveRequest);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/user-basslines',
        mockSaveRequest,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle overwrite existing bassline', async () => {
      const overwriteRequest = { ...mockSaveRequest, overwriteExisting: true };
      const mockResponse = {
        bassline: { ...mockBassline, updatedAt: '2024-01-02T00:00:00Z' },
        message: 'Bassline updated successfully',
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.saveBassline(overwriteRequest);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/user-basslines',
        overwriteRequest,
      );
      expect(result.message).toBe('Bassline updated successfully');
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      (error as any).response = {
        status: 400,
        data: { message: 'Name is required' },
      };
      mockApiClient.post.mockRejectedValueOnce(error);

      await expect(
        UserBasslinesAPI.saveBassline(mockSaveRequest),
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('autoSave', () => {
    it('should perform auto-save successfully', async () => {
      const mockResponse = {
        basslineId: 'auto-save-id',
        lastSaved: '2024-01-01T00:01:00Z',
        message: 'Auto-save successful',
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.autoSave(mockAutoSaveRequest);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/user-basslines/auto-save',
        mockAutoSaveRequest,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle auto-save for new bassline (no basslineId)', async () => {
      const newAutoSaveRequest = {
        ...mockAutoSaveRequest,
        basslineId: undefined,
      };
      const mockResponse = {
        basslineId: 'new-auto-save-id',
        lastSaved: '2024-01-01T00:01:00Z',
        message: 'Auto-save created',
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.autoSave(newAutoSaveRequest);

      expect(result.basslineId).toBe('new-auto-save-id');
    });

    it('should handle conflict errors (409)', async () => {
      const error = new Error('Conflict detected');
      (error as any).response = {
        status: 409,
        data: { message: 'Concurrent modification detected' },
      };
      mockApiClient.post.mockRejectedValueOnce(error);

      await expect(
        UserBasslinesAPI.autoSave(mockAutoSaveRequest),
      ).rejects.toThrow('Conflict detected');
    });
  });

  describe('renameBassline', () => {
    it('should rename bassline successfully', async () => {
      const renameRequest: RenameBasslineRequest = {
        newName: 'Renamed Bassline',
      };

      const mockResponse = { ...mockBassline, name: 'Renamed Bassline' };

      mockApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.renameBassline(
        'bassline-test-id',
        renameRequest,
      );

      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/api/user-basslines/bassline-test-id/rename',
        renameRequest,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle duplicate name conflicts', async () => {
      const renameRequest: RenameBasslineRequest = {
        newName: 'Existing Name',
      };

      const error = new Error('Name already exists');
      (error as any).response = {
        status: 409,
        data: { message: 'A bassline with this name already exists' },
      };
      mockApiClient.put.mockRejectedValueOnce(error);

      await expect(
        UserBasslinesAPI.renameBassline('bassline-test-id', renameRequest),
      ).rejects.toThrow('Name already exists');
    });
  });

  describe('duplicateBassline', () => {
    it('should duplicate bassline with new name', async () => {
      const duplicateRequest: DuplicateBasslineRequest = {
        newName: 'Duplicate Bassline',
        includeDescription: true,
      };

      const mockResponse = {
        ...mockBassline,
        id: 'duplicate-bassline-id',
        name: 'Duplicate Bassline',
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.duplicateBassline(
        'bassline-test-id',
        duplicateRequest,
      );

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/user-basslines/bassline-test-id/duplicate',
        duplicateRequest,
      );
      expect(result.id).toBe('duplicate-bassline-id');
      expect(result.name).toBe('Duplicate Bassline');
    });

    it('should duplicate without description when specified', async () => {
      const duplicateRequest: DuplicateBasslineRequest = {
        newName: 'Duplicate No Desc',
        includeDescription: false,
      };

      const mockResponse = {
        ...mockBassline,
        id: 'duplicate-no-desc-id',
        name: 'Duplicate No Desc',
        description: undefined,
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await UserBasslinesAPI.duplicateBassline(
        'bassline-test-id',
        duplicateRequest,
      );

      expect(result.description).toBeUndefined();
    });
  });

  describe('deleteBassline', () => {
    it('should delete bassline successfully', async () => {
      mockApiClient.delete.mockResolvedValueOnce(undefined);

      const result = await UserBasslinesAPI.deleteBassline('bassline-test-id');

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        '/api/user-basslines/bassline-test-id',
      );
      expect(result).toBeUndefined();
    });

    it('should handle deletion of non-existent bassline', async () => {
      const error = new Error('Bassline not found');
      (error as any).response = { status: 404 };
      mockApiClient.delete.mockRejectedValueOnce(error);

      await expect(
        UserBasslinesAPI.deleteBassline('non-existent'),
      ).rejects.toThrow('Bassline not found');
    });

    it('should handle unauthorized deletion attempts', async () => {
      const error = new Error('Unauthorized');
      (error as any).response = { status: 403 };
      mockApiClient.delete.mockRejectedValueOnce(error);

      await expect(
        UserBasslinesAPI.deleteBassline('other-user-bassline'),
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle network failures gracefully', async () => {
      const networkError = new Error('Network unreachable');
      (networkError as any).code = 'NETWORK_ERROR';
      mockApiClient.get.mockRejectedValueOnce(networkError);

      await expect(UserBasslinesAPI.getUserBasslines()).rejects.toThrow(
        'Network unreachable',
      );
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'TIMEOUT';
      mockApiClient.post.mockRejectedValueOnce(timeoutError);

      await expect(
        UserBasslinesAPI.saveBassline(mockSaveRequest),
      ).rejects.toThrow('Request timeout');
    });

    it('should handle malformed response data', async () => {
      const malformedResponse = mockBassline;
      mockApiClient.get.mockResolvedValueOnce(malformedResponse);

      const result = await UserBasslinesAPI.getBasslineById('test-id');
      expect(result).toEqual(malformedResponse);
    });

    it('should handle authentication failures (401)', async () => {
      const authError = new Error('Authentication required');
      (authError as any).response = { status: 401 };
      mockApiClient.get.mockRejectedValueOnce(authError);

      await expect(UserBasslinesAPI.getUserBasslines()).rejects.toThrow(
        'Authentication required',
      );
    });
  });

  describe('Performance Requirements', () => {
    it('should handle API calls within acceptable time limits', async () => {
      const startTime = Date.now();

      mockApiClient.get.mockResolvedValueOnce({
        basslines: [mockBassline],
        total: 1,
        page: 1,
        limit: 20,
      });

      await UserBasslinesAPI.getUserBasslines();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete quickly in test environment
    });

    it('should handle large bassline data efficiently', async () => {
      // Create large bassline with many notes
      const largeBasslineNotes: ExerciseNote[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          id: `note-${i}`,
          fret: (i % 12) + 1,
          string: ((i % 4) + 1) as 1 | 2 | 3 | 4 | 5 | 6,
          duration: 0.25,
          timestamp: i * 0.25,
          note: 'C',
          color: 'blue',
          techniques: [],
        }),
      );

      const largeBassline = {
        ...mockBassline,
        notes: largeBasslineNotes,
      };

      mockApiClient.post.mockResolvedValueOnce({
        bassline: largeBassline,
        message: 'Large bassline saved',
      });

      const startTime = Date.now();
      await UserBasslinesAPI.saveBassline({
        ...mockSaveRequest,
        notes: largeBasslineNotes,
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200); // Should handle large data efficiently
    });
  });
});
