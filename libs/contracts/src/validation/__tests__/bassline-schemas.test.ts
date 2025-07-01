import { describe, it, expect } from 'vitest';
import {
  BasslineMetadataSchema,
  SavedBasslineSchema,
  AutoSaveConfigSchema,
  SaveBasslineRequestSchema,
  AutoSaveRequestSchema,
  RenameBasslineRequestSchema,
  DuplicateBasslineRequestSchema,
  BasslineListFiltersSchema,
  SavedBasslinesResponseSchema,
  SaveBasslineResponseSchema,
  AutoSaveResponseSchema,
  SharingOptionsSchema,
  SharedBasslineSchema,
} from '../exercise-schemas.js';

describe('Story 3.8 Bassline Persistence Schemas', () => {
  // Valid test data fixtures
  const validNote = {
    id: 'note-1',
    timestamp: 1000,
    string: 4,
    fret: 3,
    duration: 500,
    note: 'G',
    color: '#FF6B6B',
  };

  const validMetadata = {
    tempo: 120,
    timeSignature: '4/4',
    key: 'C',
    difficulty: 'beginner' as const,
    tags: ['practice', 'warm-up'],
  };

  const validBassline = {
    id: 'bassline-1',
    userId: 'user-1',
    name: 'Test Bassline',
    description: 'A test bassline for validation',
    notes: [validNote],
    metadata: validMetadata,
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  describe('BasslineMetadataSchema', () => {
    it('should accept valid metadata', () => {
      expect(() => BasslineMetadataSchema.parse(validMetadata)).not.toThrow();
    });

    it('should validate tempo range (40-300 BPM)', () => {
      expect(() =>
        BasslineMetadataSchema.parse({ ...validMetadata, tempo: 39 }),
      ).toThrow();
      expect(() =>
        BasslineMetadataSchema.parse({ ...validMetadata, tempo: 301 }),
      ).toThrow();
      expect(() =>
        BasslineMetadataSchema.parse({ ...validMetadata, tempo: 40 }),
      ).not.toThrow();
      expect(() =>
        BasslineMetadataSchema.parse({ ...validMetadata, tempo: 300 }),
      ).not.toThrow();
    });

    it('should require time signature', () => {
      expect(() =>
        BasslineMetadataSchema.parse({ ...validMetadata, timeSignature: '' }),
      ).toThrow();
      expect(() =>
        BasslineMetadataSchema.parse({
          ...validMetadata,
          timeSignature: '3/4',
        }),
      ).not.toThrow();
    });

    it('should require key', () => {
      expect(() =>
        BasslineMetadataSchema.parse({ ...validMetadata, key: '' }),
      ).toThrow();
      expect(() =>
        BasslineMetadataSchema.parse({ ...validMetadata, key: 'Am' }),
      ).not.toThrow();
    });

    it('should validate difficulty enum', () => {
      expect(() =>
        BasslineMetadataSchema.parse({
          ...validMetadata,
          difficulty: 'expert',
        }),
      ).toThrow();
      expect(() =>
        BasslineMetadataSchema.parse({
          ...validMetadata,
          difficulty: 'advanced',
        }),
      ).not.toThrow();
    });

    it('should handle tags array with default empty array', () => {
      const metadataWithoutTags = { ...validMetadata };
      delete (metadataWithoutTags as any).tags;

      const result = BasslineMetadataSchema.parse(metadataWithoutTags);
      expect(result.tags).toEqual([]);
    });

    it('should validate tags as string array', () => {
      expect(() =>
        BasslineMetadataSchema.parse({
          ...validMetadata,
          tags: [123, 'valid'],
        }),
      ).toThrow();
      expect(() =>
        BasslineMetadataSchema.parse({
          ...validMetadata,
          tags: ['tag1', 'tag2'],
        }),
      ).not.toThrow();
    });
  });

  describe('SavedBasslineSchema', () => {
    it('should accept valid bassline', () => {
      expect(() => SavedBasslineSchema.parse(validBassline)).not.toThrow();
    });

    it('should require all mandatory fields', () => {
      const requiredFields = [
        'id',
        'userId',
        'name',
        'notes',
        'metadata',
        'createdAt',
        'updatedAt',
      ];

      requiredFields.forEach((field) => {
        const invalidBassline = { ...validBassline };
        delete (invalidBassline as any)[field];
        expect(() => SavedBasslineSchema.parse(invalidBassline)).toThrow();
      });
    });

    it('should validate name length (1-255 chars)', () => {
      expect(() =>
        SavedBasslineSchema.parse({ ...validBassline, name: '' }),
      ).toThrow();
      expect(() =>
        SavedBasslineSchema.parse({ ...validBassline, name: 'a'.repeat(256) }),
      ).toThrow();
      expect(() =>
        SavedBasslineSchema.parse({ ...validBassline, name: 'Valid Name' }),
      ).not.toThrow();
      expect(() =>
        SavedBasslineSchema.parse({ ...validBassline, name: 'a'.repeat(255) }),
      ).not.toThrow();
    });

    it('should validate description length (max 1000 chars)', () => {
      expect(() =>
        SavedBasslineSchema.parse({
          ...validBassline,
          description: 'a'.repeat(1001),
        }),
      ).toThrow();
      expect(() =>
        SavedBasslineSchema.parse({
          ...validBassline,
          description: 'a'.repeat(1000),
        }),
      ).not.toThrow();
    });

    it('should allow optional description', () => {
      const basslineWithoutDesc = { ...validBassline };
      delete (basslineWithoutDesc as any).description;

      expect(() =>
        SavedBasslineSchema.parse(basslineWithoutDesc),
      ).not.toThrow();
    });

    it('should require at least one note', () => {
      expect(() =>
        SavedBasslineSchema.parse({ ...validBassline, notes: [] }),
      ).toThrow();
      expect(() =>
        SavedBasslineSchema.parse({ ...validBassline, notes: [validNote] }),
      ).not.toThrow();
    });

    it('should validate version number', () => {
      expect(() =>
        SavedBasslineSchema.parse({ ...validBassline, version: 0 }),
      ).toThrow();
      expect(() =>
        SavedBasslineSchema.parse({ ...validBassline, version: 1 }),
      ).not.toThrow();
    });

    it('should default version to 1', () => {
      const basslineWithoutVersion = { ...validBassline };
      delete (basslineWithoutVersion as any).version;

      const result = SavedBasslineSchema.parse(basslineWithoutVersion);
      expect(result.version).toBe(1);
    });

    it('should validate nested metadata', () => {
      expect(() =>
        SavedBasslineSchema.parse({
          ...validBassline,
          metadata: { ...validMetadata, tempo: 500 },
        }),
      ).toThrow();
    });

    it('should validate nested notes', () => {
      const invalidNote = { ...validNote, fret: 30 };
      expect(() =>
        SavedBasslineSchema.parse({ ...validBassline, notes: [invalidNote] }),
      ).toThrow();
    });
  });

  describe('AutoSaveConfigSchema', () => {
    const validConfig = {
      interval: 30000,
      changeThreshold: 5,
      idleTimeout: 10000,
      maxRetries: 3,
    };

    it('should accept valid config', () => {
      expect(() => AutoSaveConfigSchema.parse(validConfig)).not.toThrow();
    });

    it('should provide default values', () => {
      const result = AutoSaveConfigSchema.parse({});
      expect(result.interval).toBe(30000);
      expect(result.changeThreshold).toBe(5);
      expect(result.idleTimeout).toBe(10000);
      expect(result.maxRetries).toBe(3);
    });

    it('should validate minimum interval (1000ms)', () => {
      expect(() =>
        AutoSaveConfigSchema.parse({ ...validConfig, interval: 999 }),
      ).toThrow();
      expect(() =>
        AutoSaveConfigSchema.parse({ ...validConfig, interval: 1000 }),
      ).not.toThrow();
    });

    it('should validate minimum change threshold', () => {
      expect(() =>
        AutoSaveConfigSchema.parse({ ...validConfig, changeThreshold: 0 }),
      ).toThrow();
      expect(() =>
        AutoSaveConfigSchema.parse({ ...validConfig, changeThreshold: 1 }),
      ).not.toThrow();
    });

    it('should validate minimum idle timeout', () => {
      expect(() =>
        AutoSaveConfigSchema.parse({ ...validConfig, idleTimeout: 999 }),
      ).toThrow();
      expect(() =>
        AutoSaveConfigSchema.parse({ ...validConfig, idleTimeout: 1000 }),
      ).not.toThrow();
    });

    it('should validate minimum max retries', () => {
      expect(() =>
        AutoSaveConfigSchema.parse({ ...validConfig, maxRetries: 0 }),
      ).toThrow();
      expect(() =>
        AutoSaveConfigSchema.parse({ ...validConfig, maxRetries: 1 }),
      ).not.toThrow();
    });
  });

  describe('SaveBasslineRequestSchema', () => {
    const validRequest = {
      name: 'New Bassline',
      description: 'A new bassline',
      notes: [validNote],
      metadata: validMetadata,
      overwriteExisting: false,
    };

    it('should accept valid request', () => {
      expect(() => SaveBasslineRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should require name', () => {
      expect(() =>
        SaveBasslineRequestSchema.parse({ ...validRequest, name: '' }),
      ).toThrow();
    });

    it('should require notes array', () => {
      expect(() =>
        SaveBasslineRequestSchema.parse({ ...validRequest, notes: [] }),
      ).toThrow();
    });

    it('should require metadata', () => {
      const requestWithoutMetadata = { ...validRequest };
      delete (requestWithoutMetadata as any).metadata;
      expect(() =>
        SaveBasslineRequestSchema.parse(requestWithoutMetadata),
      ).toThrow();
    });

    it('should default overwriteExisting to false', () => {
      const requestWithoutOverwrite = { ...validRequest };
      delete (requestWithoutOverwrite as any).overwriteExisting;

      const result = SaveBasslineRequestSchema.parse(requestWithoutOverwrite);
      expect(result.overwriteExisting).toBe(false);
    });

    it('should allow optional description', () => {
      const requestWithoutDesc = { ...validRequest };
      delete (requestWithoutDesc as any).description;

      expect(() =>
        SaveBasslineRequestSchema.parse(requestWithoutDesc),
      ).not.toThrow();
    });
  });

  describe('AutoSaveRequestSchema', () => {
    const validAutoSaveRequest = {
      basslineId: 'bassline-1',
      name: 'Auto-saved Bassline',
      notes: [validNote],
      metadata: validMetadata,
      isAutoSave: true,
    };

    it('should accept valid auto-save request', () => {
      expect(() =>
        AutoSaveRequestSchema.parse(validAutoSaveRequest),
      ).not.toThrow();
    });

    it('should allow optional basslineId for new basslines', () => {
      const requestWithoutId = { ...validAutoSaveRequest };
      delete (requestWithoutId as any).basslineId;

      expect(() => AutoSaveRequestSchema.parse(requestWithoutId)).not.toThrow();
    });

    it('should default isAutoSave to true', () => {
      const requestWithoutAutoSave = { ...validAutoSaveRequest };
      delete (requestWithoutAutoSave as any).isAutoSave;

      const result = AutoSaveRequestSchema.parse(requestWithoutAutoSave);
      expect(result.isAutoSave).toBe(true);
    });

    it('should require name, notes, and metadata', () => {
      const requiredFields = ['name', 'notes', 'metadata'];

      requiredFields.forEach((field) => {
        const invalidRequest = { ...validAutoSaveRequest };
        delete (invalidRequest as any)[field];
        expect(() => AutoSaveRequestSchema.parse(invalidRequest)).toThrow();
      });
    });
  });

  describe('Management Request Schemas', () => {
    describe('RenameBasslineRequestSchema', () => {
      it('should accept valid rename request', () => {
        const validRename = { newName: 'Updated Bassline Name' };
        expect(() =>
          RenameBasslineRequestSchema.parse(validRename),
        ).not.toThrow();
      });

      it('should require newName', () => {
        expect(() =>
          RenameBasslineRequestSchema.parse({ newName: '' }),
        ).toThrow();
      });

      it('should validate name length', () => {
        expect(() =>
          RenameBasslineRequestSchema.parse({ newName: 'a'.repeat(256) }),
        ).toThrow();
      });
    });

    describe('DuplicateBasslineRequestSchema', () => {
      const validDuplicate = {
        newName: 'Duplicate Bassline',
        includeDescription: true,
      };

      it('should accept valid duplicate request', () => {
        expect(() =>
          DuplicateBasslineRequestSchema.parse(validDuplicate),
        ).not.toThrow();
      });

      it('should require newName', () => {
        expect(() =>
          DuplicateBasslineRequestSchema.parse({
            ...validDuplicate,
            newName: '',
          }),
        ).toThrow();
      });

      it('should default includeDescription to true', () => {
        const requestWithoutFlag = { newName: 'Duplicate' };
        const result = DuplicateBasslineRequestSchema.parse(requestWithoutFlag);
        expect(result.includeDescription).toBe(true);
      });
    });
  });

  describe('BasslineListFiltersSchema', () => {
    const validFilters = {
      search: 'warm-up',
      difficulty: 'beginner' as const,
      tags: ['practice', 'scales'],
      sortBy: 'updatedAt' as const,
      sortOrder: 'desc' as const,
      page: 2,
      limit: 10,
    };

    it('should accept valid filters', () => {
      expect(() => BasslineListFiltersSchema.parse(validFilters)).not.toThrow();
    });

    it('should provide default values', () => {
      const result = BasslineListFiltersSchema.parse({});
      expect(result.sortBy).toBe('updatedAt');
      expect(result.sortOrder).toBe('desc');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should validate sortBy enum', () => {
      expect(() =>
        BasslineListFiltersSchema.parse({ ...validFilters, sortBy: 'invalid' }),
      ).toThrow();

      const validSortBy = ['name', 'createdAt', 'updatedAt', 'difficulty'];
      validSortBy.forEach((sort) => {
        expect(() =>
          BasslineListFiltersSchema.parse({ ...validFilters, sortBy: sort }),
        ).not.toThrow();
      });
    });

    it('should validate sortOrder enum', () => {
      expect(() =>
        BasslineListFiltersSchema.parse({
          ...validFilters,
          sortOrder: 'invalid',
        }),
      ).toThrow();

      ['asc', 'desc'].forEach((order) => {
        expect(() =>
          BasslineListFiltersSchema.parse({
            ...validFilters,
            sortOrder: order,
          }),
        ).not.toThrow();
      });
    });

    it('should validate page minimum', () => {
      expect(() =>
        BasslineListFiltersSchema.parse({ ...validFilters, page: 0 }),
      ).toThrow();
      expect(() =>
        BasslineListFiltersSchema.parse({ ...validFilters, page: 1 }),
      ).not.toThrow();
    });

    it('should validate limit range', () => {
      expect(() =>
        BasslineListFiltersSchema.parse({ ...validFilters, limit: 0 }),
      ).toThrow();
      expect(() =>
        BasslineListFiltersSchema.parse({ ...validFilters, limit: 101 }),
      ).toThrow();
      expect(() =>
        BasslineListFiltersSchema.parse({ ...validFilters, limit: 50 }),
      ).not.toThrow();
    });

    it('should allow optional filters', () => {
      const minimalFilters = {};
      expect(() =>
        BasslineListFiltersSchema.parse(minimalFilters),
      ).not.toThrow();
    });
  });

  describe('Response Schemas', () => {
    describe('SavedBasslinesResponseSchema', () => {
      const validResponse = {
        basslines: [validBassline],
        total: 1,
        page: 1,
        limit: 20,
      };

      it('should accept valid response', () => {
        expect(() =>
          SavedBasslinesResponseSchema.parse(validResponse),
        ).not.toThrow();
      });

      it('should require all fields', () => {
        const requiredFields = ['basslines', 'total', 'page', 'limit'];

        requiredFields.forEach((field) => {
          const invalidResponse = { ...validResponse };
          delete (invalidResponse as any)[field];
          expect(() =>
            SavedBasslinesResponseSchema.parse(invalidResponse),
          ).toThrow();
        });
      });

      it('should validate basslines array', () => {
        expect(() =>
          SavedBasslinesResponseSchema.parse({
            ...validResponse,
            basslines: [{}],
          }),
        ).toThrow();
      });

      it('should validate positive numbers', () => {
        expect(() =>
          SavedBasslinesResponseSchema.parse({ ...validResponse, total: -1 }),
        ).toThrow();
        expect(() =>
          SavedBasslinesResponseSchema.parse({ ...validResponse, page: 0 }),
        ).toThrow();
        expect(() =>
          SavedBasslinesResponseSchema.parse({ ...validResponse, limit: 0 }),
        ).toThrow();
      });
    });

    describe('SaveBasslineResponseSchema', () => {
      const validSaveResponse = {
        bassline: validBassline,
        message: 'Bassline saved successfully',
      };

      it('should accept valid save response', () => {
        expect(() =>
          SaveBasslineResponseSchema.parse(validSaveResponse),
        ).not.toThrow();
      });

      it('should require bassline and message', () => {
        expect(() =>
          SaveBasslineResponseSchema.parse({ message: 'test' }),
        ).toThrow();
        expect(() =>
          SaveBasslineResponseSchema.parse({ bassline: validBassline }),
        ).toThrow();
      });
    });

    describe('AutoSaveResponseSchema', () => {
      const validAutoSaveResponse = {
        basslineId: 'bassline-1',
        lastSaved: '2024-01-01T00:00:00Z',
        message: 'Auto-saved successfully',
      };

      it('should accept valid auto-save response', () => {
        expect(() =>
          AutoSaveResponseSchema.parse(validAutoSaveResponse),
        ).not.toThrow();
      });

      it('should require all fields', () => {
        const requiredFields = ['basslineId', 'lastSaved', 'message'];

        requiredFields.forEach((field) => {
          const invalidResponse = { ...validAutoSaveResponse };
          delete (invalidResponse as any)[field];
          expect(() => AutoSaveResponseSchema.parse(invalidResponse)).toThrow();
        });
      });
    });
  });

  describe('Sharing Schemas (Epic 5 Preparation)', () => {
    describe('SharingOptionsSchema', () => {
      const validSharing = {
        isPublic: true,
        shareLink: 'https://bassnotion.com/shared/bassline-1',
        allowComments: true,
        allowRemixing: false,
        expiresAt: '2024-12-31T23:59:59Z',
      };

      it('should accept valid sharing options', () => {
        expect(() => SharingOptionsSchema.parse(validSharing)).not.toThrow();
      });

      it('should provide default values', () => {
        const result = SharingOptionsSchema.parse({});
        expect(result.isPublic).toBe(false);
        expect(result.allowComments).toBe(false);
        expect(result.allowRemixing).toBe(false);
      });

      it('should allow all optional fields', () => {
        const minimalSharing = { isPublic: true };
        expect(() => SharingOptionsSchema.parse(minimalSharing)).not.toThrow();
      });
    });

    describe('SharedBasslineSchema', () => {
      const validSharedBassline = {
        ...validBassline,
        sharingOptions: {
          isPublic: true,
          allowComments: true,
          allowRemixing: false,
        },
        shareCount: 5,
        remixCount: 2,
      };

      it('should accept valid shared bassline', () => {
        expect(() =>
          SharedBasslineSchema.parse(validSharedBassline),
        ).not.toThrow();
      });

      it('should extend SavedBasslineSchema', () => {
        // Should still validate base bassline requirements
        expect(() =>
          SharedBasslineSchema.parse({ ...validSharedBassline, name: '' }),
        ).toThrow();
      });

      it('should default share and remix counts', () => {
        const sharedWithoutCounts = { ...validBassline };
        const result = SharedBasslineSchema.parse(sharedWithoutCounts);
        expect(result.shareCount).toBe(0);
        expect(result.remixCount).toBe(0);
      });

      it('should validate non-negative counts', () => {
        expect(() =>
          SharedBasslineSchema.parse({
            ...validSharedBassline,
            shareCount: -1,
          }),
        ).toThrow();
        expect(() =>
          SharedBasslineSchema.parse({
            ...validSharedBassline,
            remixCount: -1,
          }),
        ).toThrow();
      });
    });
  });

  describe('Integration with Existing Schemas', () => {
    it('should work with ExerciseNoteSchema', () => {
      const noteWithTechniques = {
        ...validNote,
        techniques: ['hammer_on', 'vibrato'],
        target_note_id: 'note-2',
        vibrato_intensity: 'medium',
      };

      expect(() =>
        SavedBasslineSchema.parse({
          ...validBassline,
          notes: [noteWithTechniques],
        }),
      ).not.toThrow();
    });

    it('should work with ExerciseDifficultySchema', () => {
      const metadata = {
        ...validMetadata,
        difficulty: 'advanced' as const,
      };

      expect(() =>
        SavedBasslineSchema.parse({
          ...validBassline,
          metadata,
        }),
      ).not.toThrow();
    });

    it('should validate complex basslines with multiple notes', () => {
      const complexNotes = Array.from({ length: 100 }, (_, i) => ({
        ...validNote,
        id: `note-${i}`,
        timestamp: i * 500,
        fret: (i % 12) + 1,
        techniques: i % 2 === 0 ? ['slap'] : ['pop'],
      }));

      expect(() =>
        SavedBasslineSchema.parse({
          ...validBassline,
          notes: complexNotes,
        }),
      ).not.toThrow();
    });
  });
});
