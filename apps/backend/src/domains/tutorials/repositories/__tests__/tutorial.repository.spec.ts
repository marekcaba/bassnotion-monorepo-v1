import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialRepository } from '../tutorial.repository.js';
import { Tutorial } from '../../entities/tutorial.entity.js';
import { TutorialId } from '../../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../../value-objects/tutorial-slug.vo.js';

// NOTE: We can't use `mockReturnThis()` here because the repository
// caches the client via `getClient()` and dereferences it, breaking
// the `this` binding the chain methods rely on. Returning `mockSupabase`
// explicitly keeps the fluent-builder chain working.
const mockSupabase: any = {};
Object.assign(mockSupabase, {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
  or: vi.fn(() => mockSupabase),
  not: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  range: vi.fn(() => mockSupabase),
});

describe('TutorialRepository', () => {
  let repository: TutorialRepository;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockRequestContextService = {
      getLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      }),
      getCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
    };

    // Production TutorialRepository takes a SupabaseService and calls
    // .getClient() internally to get the actual Supabase client.
    // Wrap our mock client so the service-shape matches.
    const mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabase),
    };

    repository = new TutorialRepository(
      mockSupabaseService as any,
      mockRequestContextService as any,
    );
  });

  describe('findById', () => {
    it('should find a tutorial by id', async () => {
      const tutorialData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Tutorial',
        slug: 'test-tutorial',
        description: 'Test description',
        youtube_id: 'abc123',
        duration: 300,
        author_name: 'John Doe',
        thumbnail_url: 'https://example.com/thumb.jpg',
        level: 'beginner',
        tags: ['bass', 'beginner'],
        is_active: true,
        published_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: tutorialData,
        error: null,
      });

      const id = TutorialId.create('123e4567-e89b-12d3-a456-426614174000');
      const result = await repository.findById(id);

      expect(mockSupabase.from).toHaveBeenCalledWith('tutorials');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith(
        'id',
        '123e4567-e89b-12d3-a456-426614174000',
      );
      expect(result).toBeInstanceOf(Tutorial);
      expect(result?.title).toBe('Test Tutorial');
    });

    it('should return null when tutorial not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const id = TutorialId.create('999e4567-e89b-12d3-a456-426614174999');
      const result = await repository.findById(id);

      expect(result).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('should find a tutorial by slug', async () => {
      const tutorialData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Tutorial',
        slug: 'test-tutorial',
        description: 'Test description',
        youtube_id: 'abc123',
        duration: 300,
        author_name: 'John Doe',
        level: 'beginner',
        tags: [],
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: tutorialData,
        error: null,
      });

      const slug = TutorialSlug.create('test-tutorial');
      const result = await repository.findBySlug(slug);

      expect(mockSupabase.eq).toHaveBeenCalledWith('slug', 'test-tutorial');
      expect(result).toBeInstanceOf(Tutorial);
      expect(result?.slug.value).toBe('test-tutorial');
    });
  });

  describe('findAll', () => {
    it('should return paginated tutorials', async () => {
      const tutorialsData = [
        {
          id: '111e4567-e89b-12d3-a456-426614174111',
          title: 'Tutorial 1',
          slug: 'tutorial-1',
          description: 'Description 1',
          youtube_id: 'vid1',
          duration: 300,
          author_name: 'Author 1',
          level: 'beginner',
          tags: [],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '222e4567-e89b-12d3-a456-426614174222',
          title: 'Tutorial 2',
          slug: 'tutorial-2',
          description: 'Description 2',
          youtube_id: 'vid2',
          duration: 400,
          author_name: 'Author 2',
          level: 'intermediate',
          tags: [],
          is_active: true,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockSupabase.range.mockResolvedValueOnce({
        data: tutorialsData,
        error: null,
        count: 2,
      });

      const result = await repository.findAll({ page: 1, limit: 10 });

      expect(mockSupabase.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockSupabase.range).toHaveBeenCalledWith(0, 9);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('save', () => {
    it('should save a new tutorial', async () => {
      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      const tutorial = Tutorial.create({
        title: 'New Tutorial',
        slug: TutorialSlug.create('new-tutorial'),
        description: 'New description',
        youtubeId: 'new123',
        duration: 500,
        authorName: 'New Author',
        level: 'intermediate',
      });

      await repository.save(tutorial);

      expect(mockSupabase.from).toHaveBeenCalledWith('tutorials');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Tutorial',
          slug: 'new-tutorial',
          description: 'New description',
          youtube_id: 'new123',
          duration: 500,
          author_name: 'New Author',
          level: 'intermediate',
        }),
      );
    });
  });

  describe('update', () => {
    it('should update an existing tutorial', async () => {
      mockSupabase.eq.mockResolvedValueOnce({ error: null });

      const tutorial = Tutorial.reconstitute({
        id: TutorialId.create('123e4567-e89b-12d3-a456-426614174000'),
        title: 'Updated Tutorial',
        slug: TutorialSlug.create('updated-tutorial'),
        description: 'Updated description',
        youtubeId: 'updated123',
        duration: 600,
        authorName: 'Updated Author',
        level: 'advanced',
        tags: [],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });

      await repository.update(tutorial);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Tutorial',
          slug: 'updated-tutorial',
        }),
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith(
        'id',
        '123e4567-e89b-12d3-a456-426614174000',
      );
    });
  });

  describe('delete', () => {
    it('should soft delete a tutorial', async () => {
      mockSupabase.eq.mockResolvedValueOnce({ error: null });

      const id = TutorialId.create('123e4567-e89b-12d3-a456-426614174000');
      await repository.delete(id);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          updated_at: expect.any(String),
        }),
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith(
        'id',
        '123e4567-e89b-12d3-a456-426614174000',
      );
    });
  });

  describe('search', () => {
    it('should search tutorials by query', async () => {
      const searchResults = [
        {
          id: '111e4567-e89b-12d3-a456-426614174111',
          title: 'Bass Tutorial',
          slug: 'bass-tutorial',
          description: 'Learn bass',
          youtube_id: 'bass123',
          duration: 300,
          author_name: 'Bass Teacher',
          level: 'beginner',
          tags: [],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockSupabase.order.mockResolvedValueOnce({
        data: searchResults,
        error: null,
      });

      const results = await repository.search('bass');

      expect(mockSupabase.or).toHaveBeenCalledWith(
        'title.ilike.%bass%,description.ilike.%bass%,author_name.ilike.%bass%',
      );
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Bass Tutorial');
    });
  });
});
