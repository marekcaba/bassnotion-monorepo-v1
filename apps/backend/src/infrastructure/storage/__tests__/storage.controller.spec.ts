import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { StorageController } from '../storage.controller.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { CleanupService } from '../cleanup.service.js';
import { Readable } from 'stream';

describe('StorageController - Temp MIDI Storage (Story 4.4 - Task 2)', () => {
  let controller: StorageController;
  let supabaseService: SupabaseService;
  let cleanupService: CleanupService;

  // Helper to create a mock Fastify request with multipart file
  const createMockFastifyRequest = (fileData: {
    filename: string;
    mimetype: string;
    buffer: Buffer;
  }) => {
    const stream = Readable.from([fileData.buffer]);
    return {
      file: vi.fn().mockResolvedValue({
        file: stream,
        filename: fileData.filename,
        mimetype: fileData.mimetype,
      }),
    } as any;
  };

  beforeEach(() => {
    // Create mock services
    supabaseService = {
      uploadToTemp: vi.fn(),
      moveToPermanent: vi.fn(),
      deleteTempFile: vi.fn(),
      listTempFiles: vi.fn(),
    } as any;

    cleanupService = {
      cleanupExpiredFiles: vi.fn(),
      getTempStorageStats: vi.fn(),
    } as any;

    controller = new StorageController(supabaseService, cleanupService);
    vi.clearAllMocks();
  });

  describe('POST /api/v1/storage/upload-temp (Task 2.1)', () => {
    const validFileData = {
      buffer: Buffer.from('mock midi file content'),
      filename: 'test-song.mid',
      mimetype: 'audio/midi',
    };

    const mockUploadResult = {
      temporaryUrl:
        'https://xyz.supabase.co/storage/v1/object/sign/exercise-midi-temp/uuid_test-song.mid?token=xyz',
      tempPath: 'uuid_test-song.mid',
    };

    it('should upload valid MIDI file to temp bucket', async () => {
      (supabaseService.uploadToTemp as any).mockResolvedValue(mockUploadResult);

      const mockReq = createMockFastifyRequest(validFileData);
      const result = await controller.uploadTemp(
        mockReq,
        'test-correlation-id',
      );

      expect(result).toEqual({
        temporaryUrl: mockUploadResult.temporaryUrl,
        tempPath: mockUploadResult.tempPath,
        filename: validFileData.filename,
        fileSize: validFileData.buffer.length,
        expiresIn: '1 hour',
      });

      expect(supabaseService.uploadToTemp).toHaveBeenCalledWith(
        validFileData.buffer,
        expect.stringContaining('test-song.mid'),
        validFileData.mimetype,
      );
    });

    it('should reject file exceeding 10MB size limit', async () => {
      const oversizedFileData = {
        ...validFileData,
        buffer: Buffer.alloc(11 * 1024 * 1024), // 11MB (exceeds 10MB limit)
      };

      const mockReq = createMockFastifyRequest(oversizedFileData);
      await expect(
        controller.uploadTemp(mockReq, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(supabaseService.uploadToTemp).not.toHaveBeenCalled();
    });

    it('should reject file with invalid extension', async () => {
      const invalidFileData = {
        ...validFileData,
        filename: 'test-song.mp3', // Not a MIDI file
      };

      const mockReq = createMockFastifyRequest(invalidFileData);
      await expect(
        controller.uploadTemp(mockReq, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(supabaseService.uploadToTemp).not.toHaveBeenCalled();
    });

    it('should handle network failure during upload', async () => {
      const networkError = new Error('Network timeout');
      (supabaseService.uploadToTemp as any).mockRejectedValue(networkError);

      const mockReq = createMockFastifyRequest(validFileData);
      await expect(
        controller.uploadTemp(mockReq, 'test-correlation-id'),
      ).rejects.toThrow(networkError);
    });

    it('should handle Supabase quota exceeded error', async () => {
      const quotaError = new Error('Storage quota exceeded');
      (supabaseService.uploadToTemp as any).mockRejectedValue(quotaError);

      const mockReq = createMockFastifyRequest(validFileData);
      await expect(
        controller.uploadTemp(mockReq, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /api/v1/storage/move-to-permanent (Task 2.2)', () => {
    const validRequest = {
      tempPath: 'uuid_test-song.mid',
      exerciseId: 'exercise-123',
    };

    it('should move file from temp to permanent bucket', async () => {
      const permanentUrl =
        'https://xyz.supabase.co/storage/v1/object/public/exercise-midi-files/exercises/exercise-123/1234_bassline.mid';
      (supabaseService.moveToPermanent as any).mockResolvedValue(permanentUrl);

      const result = await controller.moveToPermanent(
        validRequest,
        'test-correlation-id',
      );

      expect(result.permanentUrl).toBe(permanentUrl);
      expect(result.permanentPath).toContain('exercises/exercise-123');

      expect(supabaseService.moveToPermanent).toHaveBeenCalledWith(
        validRequest.tempPath,
        'exercise-midi-files',
        expect.stringContaining('exercises/exercise-123'),
      );
    });

    it('should reject request without tempPath', async () => {
      const invalidRequest = {
        tempPath: '',
        exerciseId: 'exercise-123',
      };

      await expect(
        controller.moveToPermanent(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(supabaseService.moveToPermanent).not.toHaveBeenCalled();
    });

    it('should reject request without exerciseId', async () => {
      const invalidRequest = {
        tempPath: 'uuid_test.mid',
        exerciseId: '',
      };

      await expect(
        controller.moveToPermanent(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(supabaseService.moveToPermanent).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/storage/cleanup (Task 2.3)', () => {
    const mockCleanupResult = {
      deletedCount: 15,
      failedCount: 2,
      totalScanned: 50,
      durationMs: 1234,
    };

    it('should cleanup expired temp files and return statistics', async () => {
      (cleanupService.cleanupExpiredFiles as any).mockResolvedValue(
        mockCleanupResult,
      );

      const result = await controller.cleanup('test-correlation-id');

      expect(result).toEqual(mockCleanupResult);
      expect(cleanupService.cleanupExpiredFiles).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const cleanupError = new Error('Cleanup service unavailable');
      (cleanupService.cleanupExpiredFiles as any).mockRejectedValue(
        cleanupError,
      );

      await expect(controller.cleanup('test-correlation-id')).rejects.toThrow(
        cleanupError,
      );
    });
  });

  describe('POST /api/v1/storage/stats (Task 2.4)', () => {
    const mockStats = {
      totalFiles: 42,
      expiredFiles: 15,
      activeFiles: 27,
      oldestFileAge: '3h 24m',
      newestFileAge: '5m 12s',
    };

    it('should return temp bucket statistics', async () => {
      (cleanupService.getTempStorageStats as any).mockResolvedValue(mockStats);

      const result = await controller.getStats('test-correlation-id');

      expect(result).toEqual(mockStats);
      expect(cleanupService.getTempStorageStats).toHaveBeenCalled();
    });

    it('should handle errors when fetching stats', async () => {
      const statsError = new Error('Failed to get stats');
      (cleanupService.getTempStorageStats as any).mockRejectedValue(statsError);

      await expect(controller.getStats('test-correlation-id')).rejects.toThrow(
        statsError,
      );
    });
  });
});
