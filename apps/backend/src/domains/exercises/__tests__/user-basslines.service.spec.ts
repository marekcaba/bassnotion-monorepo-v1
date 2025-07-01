/**
 * UserBasslinesService Unit Tests (Story 3.8)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { UserBasslinesService } from '../user-basslines.service.js';

describe('UserBasslinesService', () => {
  let userBasslinesService: UserBasslinesService;
  let mockSupabaseService: any;
  let mockSupabaseClient: any;

  const mockUser = { id: 'user-123' };

  // Database format (snake_case)
  const mockBasslineDB = {
    id: 'bassline-1',
    user_id: 'user-123',
    name: 'Test Bassline',
    description: 'A test bassline',
    notes: [
      {
        id: 'note-1',
        timestamp: 0,
        string: 4,
        fret: 3,
        duration: 500,
        note: 'G',
        color: '#FF6B6B',
      },
    ],
    metadata: {
      tempo: 120,
      timeSignature: '4/4',
      key: 'C',
      difficulty: 'beginner',
      tags: [],
    },
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
  };

  // Transformed format (camelCase) - what the service returns
  const mockBasslineTransformed = {
    id: 'bassline-1',
    userId: 'user-123',
    name: 'Test Bassline',
    description: 'A test bassline',
    notes: [
      {
        id: 'note-1',
        timestamp: 0,
        string: 4,
        fret: 3,
        duration: 500,
        note: 'G',
        color: '#FF6B6B',
      },
    ],
    metadata: {
      tempo: 120,
      timeSignature: '4/4',
      key: 'C',
      difficulty: 'beginner',
      tags: [],
    },
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseClient = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    mockSupabaseService = {
      getClient: vi.fn(() => mockSupabaseClient),
      isReady: vi.fn(() => true),
    };

    userBasslinesService = new UserBasslinesService(mockSupabaseService);
  });

  describe('saveBassline', () => {
    it('should save bassline when no conflict exists', async () => {
      const saveRequest = {
        name: 'Unique Bassline Name',
        notes: mockBasslineDB.notes,
        metadata: mockBasslineDB.metadata,
        overwriteExisting: false,
      };

      // Mock the existence check to return no conflict
      const mockExistenceQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // Mock the insert operation
      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockBasslineDB, error: null }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockExistenceQuery) // First call for existence check
        .mockReturnValueOnce(mockInsertQuery); // Second call for insert

      const startTime = performance.now();
      const result = await userBasslinesService.saveBassline(
        mockUser.id,
        saveRequest,
      );
      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(500);
      // Service returns { bassline: SavedBasslineInput, message: string }
      expect(result).toEqual({
        bassline: mockBasslineTransformed,
        message: 'Bassline saved successfully',
      });
    });

    it('should throw ConflictException when bassline name exists without overwrite', async () => {
      const saveRequest = {
        name: 'Existing Name',
        notes: mockBasslineDB.notes,
        metadata: mockBasslineDB.metadata,
        overwriteExisting: false,
      };

      // Mock existence check to return existing bassline
      const mockExistenceQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockBasslineDB, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockExistenceQuery);

      await expect(
        userBasslinesService.saveBassline(mockUser.id, saveRequest),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getUserBasslines', () => {
    it('should retrieve basslines with performance <300ms', async () => {
      const mockResponse = {
        data: [mockBasslineDB],
        error: null,
        count: 1,
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const startTime = performance.now();
      const result = await userBasslinesService.getUserBasslines(mockUser.id);
      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(300);
      expect(result.basslines).toEqual([mockBasslineTransformed]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply search filters correctly', async () => {
      const filters = {
        search: 'test',
        difficulty: 'beginner',
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10,
      };

      const mockResponse = {
        data: [],
        error: null,
        count: 0,
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(mockResponse),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await userBasslinesService.getUserBasslines(
        mockUser.id,
        filters,
      );

      expect(result.basslines).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);

      // Verify filter methods were called
      expect(mockQuery.ilike).toHaveBeenCalledWith('name', '%test%');
      expect(mockQuery.eq).toHaveBeenCalledWith(
        'metadata->>difficulty',
        'beginner',
      );
    });
  });

  describe('autoSave', () => {
    it('should auto-save with performance <200ms', async () => {
      const autoSaveRequest = {
        name: 'Auto-saved Bassline',
        notes: mockBasslineDB.notes,
        metadata: mockBasslineDB.metadata,
        basslineId: 'bassline-1',
        isAutoSave: true,
      };

      // Mock the RPC call to return bassline ID as string
      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'bassline-1',
        error: null,
      });

      const startTime = performance.now();
      const result = await userBasslinesService.autoSave(
        mockUser.id,
        autoSaveRequest,
      );
      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(200);
      expect(result).toEqual({
        basslineId: 'bassline-1',
        lastSaved: expect.any(String),
        message: 'Auto-save completed',
      });
      expect(new Date(result.lastSaved)).toBeInstanceOf(Date);
    });

    it('should handle new bassline auto-save', async () => {
      const autoSaveRequest = {
        name: 'New Auto-saved Bassline',
        notes: mockBasslineDB.notes,
        metadata: mockBasslineDB.metadata,
        isAutoSave: true,
      };

      // Mock RPC call for new bassline (no basslineId provided)
      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'bassline-1',
        error: null,
      });

      const result = await userBasslinesService.autoSave(
        mockUser.id,
        autoSaveRequest,
      );

      expect(result.basslineId).toBe('bassline-1');
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'auto_save_bassline',
        {
          p_user_id: mockUser.id,
          p_name: autoSaveRequest.name,
          p_notes: autoSaveRequest.notes,
          p_bassline_id: null, // Should be null for new basslines
          p_metadata: autoSaveRequest.metadata,
        },
      );
    });
  });

  describe('getBasslineById', () => {
    it('should retrieve specific bassline', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockBasslineDB, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const result = await userBasslinesService.getBasslineById(
        mockUser.id,
        'bassline-1',
      );

      expect(result).toEqual(mockBasslineTransformed);
    });

    it('should throw NotFoundException for non-existent bassline', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // Supabase not found error code
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await expect(
        userBasslinesService.getBasslineById(mockUser.id, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('renameBassline', () => {
    it('should rename bassline successfully', async () => {
      const renameRequest = { newName: 'Updated Name' };

      // Mock name conflict check (no conflict)
      const mockConflictQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // Mock update operation
      const mockUpdateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockBasslineDB, name: 'Updated Name' },
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockConflictQuery) // First call for conflict check
        .mockReturnValueOnce(mockUpdateQuery); // Second call for update

      const result = await userBasslinesService.renameBassline(
        mockUser.id,
        'bassline-1',
        renameRequest,
      );

      expect(result.name).toBe('Updated Name');
    });
  });

  describe('duplicateBassline', () => {
    it('should duplicate bassline successfully', async () => {
      const duplicateRequest = { newName: 'Copy', includeDescription: true };

      // Mock the RPC call to return new bassline ID
      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'bassline-2',
        error: null,
      });

      // Mock getBasslineById call for fetching the duplicated bassline
      const mockGetQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockBasslineDB, id: 'bassline-2', name: 'Copy' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockGetQuery);

      const result = await userBasslinesService.duplicateBassline(
        mockUser.id,
        'bassline-1',
        duplicateRequest,
      );

      expect(result.name).toBe('Copy');
      expect(result.id).toBe('bassline-2');
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'duplicate_bassline',
        {
          p_user_id: mockUser.id,
          p_bassline_id: 'bassline-1',
          p_new_name: 'Copy',
          p_include_description: true,
        },
      );
    });
  });

  describe('deleteBassline', () => {
    it('should soft delete bassline', async () => {
      // Mock the RPC call to return success
      mockSupabaseClient.rpc.mockResolvedValue({
        data: true, // Success indicator
        error: null,
      });

      await userBasslinesService.deleteBassline(mockUser.id, 'bassline-1');

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'soft_delete_bassline',
        {
          p_user_id: mockUser.id,
          p_bassline_id: 'bassline-1',
        },
      );
    });

    it('should handle non-existent bassline deletion', async () => {
      // Mock RPC call returning no data (bassline not found)
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { code: 'P0002', message: 'No data found' },
      });

      await expect(
        userBasslinesService.deleteBassline(mockUser.id, 'non-existent'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase service not ready', async () => {
      mockSupabaseService.isReady.mockReturnValue(false);

      await expect(
        userBasslinesService.saveBassline(mockUser.id, {
          name: 'Test',
          notes: [],
          metadata: {},
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await expect(
        userBasslinesService.getUserBasslines(mockUser.id),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('Security & User Isolation', () => {
    it('should enforce user ownership in all queries', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await userBasslinesService.getUserBasslines(mockUser.id);

      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('should include user_id in all data insertions', async () => {
      const saveRequest = {
        name: 'Test Bassline',
        notes: mockBasslineDB.notes,
        metadata: mockBasslineDB.metadata,
        overwriteExisting: false,
      };

      // Mock both existence check and insert
      const mockExistenceQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockBasslineDB, error: null }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(mockExistenceQuery)
        .mockReturnValueOnce(mockInsertQuery);

      await userBasslinesService.saveBassline(mockUser.id, saveRequest);

      expect(mockInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
        }),
      );
    });
  });
});
