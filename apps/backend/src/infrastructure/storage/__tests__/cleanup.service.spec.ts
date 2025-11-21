import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CleanupService } from '../cleanup.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';

describe('CleanupService - Expired File Cleanup (Story 4.4 - Task 2)', () => {
  let cleanupService: CleanupService;
  let supabaseService: SupabaseService;

  beforeEach(() => {
    // Create mock Supabase service
    supabaseService = {
      listTempFiles: vi.fn(),
      deleteTempFile: vi.fn(),
    } as any;

    cleanupService = new CleanupService(supabaseService);
    vi.clearAllMocks();
  });

  describe('cleanupExpiredFiles()', () => {
    it('should delete files older than 2 hours', async () => {
      const now = Date.now();
      const mockFiles = [
        {
          name: 'uuid1_song1.mid',
          created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago (expired)
        },
        {
          name: 'uuid2_song2.mid',
          created_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago (active)
        },
        {
          name: 'uuid3_song3.mid',
          created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago (expired)
        },
      ];

      (supabaseService.listTempFiles as any).mockResolvedValue(mockFiles);
      (supabaseService.deleteTempFile as any).mockResolvedValue(true); // Return true for success

      const result = await cleanupService.cleanupExpiredFiles();

      expect(result.totalScanned).toBe(3);
      expect(result.deletedCount).toBe(2); // 2 expired files
      expect(result.failedCount).toBe(0);

      // Should delete expired files
      expect(supabaseService.deleteTempFile).toHaveBeenCalledWith('uuid1_song1.mid');
      expect(supabaseService.deleteTempFile).toHaveBeenCalledWith('uuid3_song3.mid');
      expect(supabaseService.deleteTempFile).toHaveBeenCalledTimes(2);
    });

    it('should handle empty bucket gracefully', async () => {
      (supabaseService.listTempFiles as any).mockResolvedValue([]);

      const result = await cleanupService.cleanupExpiredFiles();

      expect(result).toEqual({
        deletedCount: 0,
        failedCount: 0,
        totalScanned: 0,
        durationMs: expect.any(Number),
      });

      expect(supabaseService.deleteTempFile).not.toHaveBeenCalled();
    });

    it('should handle deletion failures and track failed count', async () => {
      const now = Date.now();
      const mockFiles = [
        {
          name: 'uuid1_song1.mid',
          created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago (expired)
        },
        {
          name: 'uuid2_song2.mid',
          created_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago (expired)
        },
        {
          name: 'uuid3_song3.mid',
          created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago (expired)
        },
      ];

      (supabaseService.listTempFiles as any).mockResolvedValue(mockFiles);

      // First deletion succeeds (true), second fails (false), third throws error
      (supabaseService.deleteTempFile as any)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false) // Deletion failed but no exception
        .mockRejectedValueOnce(new Error('Permission denied')); // Deletion threw exception

      const result = await cleanupService.cleanupExpiredFiles();

      expect(result.totalScanned).toBe(3);
      expect(result.deletedCount).toBe(1); // 1 successful deletion
      expect(result.failedCount).toBe(2); // 2 failed deletions (1 returned false, 1 threw error)

      expect(supabaseService.deleteTempFile).toHaveBeenCalledTimes(3);
    });

    it('should process files in batches of 50', async () => {
      const now = Date.now();
      const mockFiles = Array.from({ length: 75 }, (_, i) => ({
        name: `uuid${i}_song${i}.mid`,
        created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // All expired
      }));

      (supabaseService.listTempFiles as any).mockResolvedValue(mockFiles);
      (supabaseService.deleteTempFile as any).mockResolvedValue(true); // Return true for success

      const result = await cleanupService.cleanupExpiredFiles();

      expect(result.totalScanned).toBe(75);
      expect(result.deletedCount).toBe(75);
      expect(result.failedCount).toBe(0);

      // Should delete all 75 files
      expect(supabaseService.deleteTempFile).toHaveBeenCalledTimes(75);
    });

    it('should not delete files younger than 2 hours', async () => {
      const now = Date.now();
      const mockFiles = [
        {
          name: 'uuid1_recent.mid',
          created_at: new Date(now - 30 * 60 * 1000).toISOString(), // 30 min ago
        },
        {
          name: 'uuid2_recent.mid',
          created_at: new Date(now - 90 * 60 * 1000).toISOString(), // 90 min ago
        },
        {
          name: 'uuid3_recent.mid',
          created_at: new Date(now - 119 * 60 * 1000).toISOString(), // 119 min ago (just under 2 hours)
        },
      ];

      (supabaseService.listTempFiles as any).mockResolvedValue(mockFiles);

      const result = await cleanupService.cleanupExpiredFiles();

      expect(result.totalScanned).toBe(3);
      expect(result.deletedCount).toBe(0); // None expired
      expect(result.failedCount).toBe(0);

      expect(supabaseService.deleteTempFile).not.toHaveBeenCalled();
    });

    it('should track execution duration', async () => {
      (supabaseService.listTempFiles as any).mockResolvedValue([]);

      const result = await cleanupService.cleanupExpiredFiles();

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeLessThan(1000); // Should be very fast for empty bucket
    });

    it('should handle listTempFiles errors gracefully', async () => {
      const listError = new Error('Supabase API unavailable');
      (supabaseService.listTempFiles as any).mockRejectedValue(listError);

      await expect(cleanupService.cleanupExpiredFiles()).rejects.toThrow(listError);
    });

    it('should continue cleanup even if some deletions fail', async () => {
      const now = Date.now();
      const mockFiles = [
        {
          name: 'uuid1_song1.mid',
          created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        },
        {
          name: 'uuid2_song2.mid',
          created_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
        },
        {
          name: 'uuid3_song3.mid',
          created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
        },
      ];

      (supabaseService.listTempFiles as any).mockResolvedValue(mockFiles);

      // All deletions return false (failed but no exception)
      (supabaseService.deleteTempFile as any).mockResolvedValue(false);

      const result = await cleanupService.cleanupExpiredFiles();

      expect(result.totalScanned).toBe(3);
      expect(result.deletedCount).toBe(0);
      expect(result.failedCount).toBe(3); // All failed

      // Should attempt to delete all 3
      expect(supabaseService.deleteTempFile).toHaveBeenCalledTimes(3);
    });

    it('should handle edge case: file created exactly 2 hours ago', async () => {
      const now = Date.now();
      const mockFiles = [
        {
          name: 'uuid1_edge.mid',
          created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // Exactly 2 hours ago
        },
      ];

      (supabaseService.listTempFiles as any).mockResolvedValue(mockFiles);
      (supabaseService.deleteTempFile as any).mockResolvedValue(true);

      const result = await cleanupService.cleanupExpiredFiles();

      // File at exactly 2 hours should NOT be expired (strictly greater than)
      expect(result.deletedCount).toBe(0);
      expect(supabaseService.deleteTempFile).not.toHaveBeenCalled();
    });

    it('should process large batches efficiently without memory issues', async () => {
      const now = Date.now();
      const mockFiles = Array.from({ length: 500 }, (_, i) => ({
        name: `uuid${i}_song${i}.mid`,
        created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      }));

      (supabaseService.listTempFiles as any).mockResolvedValue(mockFiles);
      (supabaseService.deleteTempFile as any).mockResolvedValue(true); // Return true for success

      const result = await cleanupService.cleanupExpiredFiles();

      expect(result.totalScanned).toBe(500);
      expect(result.deletedCount).toBe(500);
      expect(result.durationMs).toBeGreaterThan(0);
    });
  });
});
