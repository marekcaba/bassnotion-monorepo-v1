import { describe, it, expect } from 'vitest';
import { Tutorial } from '../tutorial.entity.js';
import { TutorialId } from '../../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../../value-objects/tutorial-slug.vo.js';

describe('Tutorial Entity', () => {
  describe('create', () => {
    it('should create a new tutorial with default values', () => {
      const tutorial = Tutorial.create({
        title: 'Learn Bass Basics',
        slug: TutorialSlug.create('learn-bass-basics'),
        description: 'A comprehensive guide to bass fundamentals',
        youtubeId: 'abc123xyz',
        duration: 600,
        authorName: 'John Doe',
        level: 'beginner',
      });

      expect(tutorial.id).toBeDefined();
      expect(tutorial.title).toBe('Learn Bass Basics');
      expect(tutorial.slug.value).toBe('learn-bass-basics');
      expect(tutorial.description).toBe(
        'A comprehensive guide to bass fundamentals',
      );
      expect(tutorial.youtubeId).toBe('abc123xyz');
      expect(tutorial.duration).toBe(600);
      expect(tutorial.authorName).toBe('John Doe');
      expect(tutorial.level).toBe('beginner');
      expect(tutorial.tags).toEqual([]);
      expect(tutorial.isActive).toBe(true);
      expect(tutorial.publishedAt).toBeUndefined();
      expect(tutorial.createdAt).toBeInstanceOf(Date);
      expect(tutorial.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a tutorial with custom values', () => {
      const publishedAt = new Date('2024-01-01');
      const tutorial = Tutorial.create({
        title: 'Advanced Jazz Bass',
        slug: TutorialSlug.create('advanced-jazz-bass'),
        description: 'Master jazz bass techniques',
        youtubeId: 'jazz123',
        duration: 1800,
        authorName: 'Jane Smith',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        level: 'advanced',
        tags: ['jazz', 'advanced', 'improvisation'],
        isActive: false,
        publishedAt,
      });

      expect(tutorial.thumbnailUrl).toBe('https://example.com/thumb.jpg');
      expect(tutorial.tags).toEqual(['jazz', 'advanced', 'improvisation']);
      expect(tutorial.isActive).toBe(false);
      expect(tutorial.publishedAt).toBe(publishedAt);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a tutorial from persistence', () => {
      const id = TutorialId.create('123e4567-e89b-12d3-a456-426614174000');
      const slug = TutorialSlug.create('test-tutorial');
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-01-02');
      const publishedAt = new Date('2024-01-01T12:00:00Z');

      const tutorial = Tutorial.reconstitute({
        id,
        title: 'Test Tutorial',
        slug,
        description: 'Test description',
        youtubeId: 'test123',
        duration: 300,
        authorName: 'Test Author',
        thumbnailUrl: 'https://example.com/test.jpg',
        level: 'intermediate',
        tags: ['test', 'tutorial'],
        isActive: true,
        publishedAt,
        createdAt,
        updatedAt,
      });

      expect(tutorial.id).toBe(id);
      expect(tutorial.title).toBe('Test Tutorial');
      expect(tutorial.slug).toBe(slug);
      expect(tutorial.createdAt).toBe(createdAt);
      expect(tutorial.updatedAt).toBe(updatedAt);
      expect(tutorial.publishedAt).toBe(publishedAt);
    });
  });

  describe('business logic methods', () => {
    describe('isBeginnerFriendly', () => {
      it('should return true for beginner level', () => {
        const tutorial = Tutorial.create({
          title: 'Bass Basics',
          slug: TutorialSlug.create('bass-basics'),
          description: 'Learn the basics',
          youtubeId: 'basic123',
          duration: 300,
          authorName: 'Teacher',
          level: 'beginner',
        });

        expect(tutorial.isBeginnerFriendly()).toBe(true);
      });

      it('should return false for advanced level', () => {
        const tutorial = Tutorial.create({
          title: 'Advanced Techniques',
          slug: TutorialSlug.create('advanced-techniques'),
          description: 'Advanced bass techniques',
          youtubeId: 'adv123',
          duration: 1200,
          authorName: 'Expert',
          level: 'advanced',
        });

        expect(tutorial.isBeginnerFriendly()).toBe(false);
      });
    });

    describe('canBeAccessedByUser', () => {
      it('should allow access to users with same or higher level', () => {
        const tutorial = Tutorial.create({
          title: 'Intermediate Tutorial',
          slug: TutorialSlug.create('intermediate-tutorial'),
          description: 'An intermediate tutorial',
          youtubeId: 'inter123',
          duration: 400,
          authorName: 'Author',
          level: 'intermediate',
          publishedAt: new Date('2024-01-01'),
        });

        expect(tutorial.canBeAccessedByUser('beginner')).toBe(false);
        expect(tutorial.canBeAccessedByUser('intermediate')).toBe(true);
        expect(tutorial.canBeAccessedByUser('advanced')).toBe(true);
      });

      it('should handle beginner tutorials correctly', () => {
        const tutorial = Tutorial.create({
          title: 'Beginner Tutorial',
          slug: TutorialSlug.create('beginner-tutorial'),
          description: 'A beginner tutorial',
          youtubeId: 'begin123',
          duration: 400,
          authorName: 'Author',
          level: 'beginner',
        });

        expect(tutorial.canBeAccessedByUser('beginner')).toBe(true);
        expect(tutorial.canBeAccessedByUser('intermediate')).toBe(true);
        expect(tutorial.canBeAccessedByUser('advanced')).toBe(true);
      });

      it('should handle advanced tutorials correctly', () => {
        const tutorial = Tutorial.create({
          title: 'Advanced Tutorial',
          slug: TutorialSlug.create('advanced-tutorial'),
          description: 'An advanced tutorial',
          youtubeId: 'adv123',
          duration: 400,
          authorName: 'Author',
          level: 'advanced',
        });

        expect(tutorial.canBeAccessedByUser('beginner')).toBe(false);
        expect(tutorial.canBeAccessedByUser('intermediate')).toBe(false);
        expect(tutorial.canBeAccessedByUser('advanced')).toBe(true);
      });
    });

    describe('getDurationInMinutes', () => {
      it('should return duration in minutes', () => {
        const tutorial = Tutorial.create({
          title: 'Tutorial',
          slug: TutorialSlug.create('tutorial'),
          description: 'A tutorial',
          youtubeId: 'tut123',
          duration: 1830, // 30.5 minutes
          authorName: 'Author',
          level: 'intermediate',
        });

        expect(tutorial.getDurationInMinutes()).toBe(31);
      });
    });

    describe('hasTag', () => {
      it('should check if tutorial has a specific tag', () => {
        const tutorial = Tutorial.create({
          title: 'Tagged Tutorial',
          slug: TutorialSlug.create('tagged-tutorial'),
          description: 'A tagged tutorial',
          youtubeId: 'tag123',
          duration: 300,
          authorName: 'Author',
          level: 'beginner',
          tags: ['jazz', 'blues', 'rock'],
        });

        expect(tutorial.hasTag('jazz')).toBe(true);
        expect(tutorial.hasTag('JAZZ')).toBe(true); // case insensitive
        expect(tutorial.hasTag('funk')).toBe(false);
      });
    });

    describe('isPublished', () => {
      // NOTE: The Tutorial entity migrated from "publishedAt alone
      // means published" to an explicit status enum ('draft' |
      // 'published' | 'archived'). isPublished() now checks the
      // status field, not the presence of publishedAt. Tutorials
      // created via .create() default to status='draft', so a test
      // that wants a published tutorial must say so explicitly.
      it('should return true for tutorials with published status', () => {
        const tutorial = Tutorial.create({
          title: 'Published Tutorial',
          slug: TutorialSlug.create('published-tutorial'),
          description: 'A published tutorial',
          youtubeId: 'pub123',
          duration: 300,
          authorName: 'Author',
          level: 'intermediate',
          status: 'published',
          publishedAt: new Date('2024-01-01'),
        });

        expect(tutorial.isPublished()).toBe(true);
      });

      it('should return false for tutorials without an explicit status (default: draft)', () => {
        const tutorial = Tutorial.create({
          title: 'Unpublished Tutorial',
          slug: TutorialSlug.create('unpublished-tutorial'),
          description: 'An unpublished tutorial',
          youtubeId: 'unpub123',
          duration: 300,
          authorName: 'Author',
          level: 'intermediate',
        });

        expect(tutorial.isPublished()).toBe(false);
      });

      it('should return false when status is draft even if publishedAt is set', () => {
        const tutorial = Tutorial.create({
          title: 'Inactive Tutorial',
          slug: TutorialSlug.create('inactive-tutorial'),
          description: 'An inactive tutorial',
          youtubeId: 'inactive123',
          duration: 300,
          authorName: 'Author',
          level: 'intermediate',
          isActive: false,
          status: 'draft',
          publishedAt: new Date('2024-01-01'),
        });

        expect(tutorial.isPublished()).toBe(false);
      });
    });
  });

  describe('mutation methods', () => {
    describe('updateTitle', () => {
      it('should update tutorial title', () => {
        const tutorial = Tutorial.create({
          title: 'Original Title',
          slug: TutorialSlug.create('original-slug'),
          description: 'Original description',
          youtubeId: 'orig123',
          duration: 300,
          authorName: 'Original Author',
          level: 'beginner',
        });

        tutorial.updateTitle('Updated Title');
        expect(tutorial.title).toBe('Updated Title');
      });

      it('should throw error for empty title', () => {
        const tutorial = Tutorial.create({
          title: 'Title',
          slug: TutorialSlug.create('slug'),
          description: 'Description',
          youtubeId: 'id123',
          duration: 300,
          authorName: 'Author',
          level: 'beginner',
        });

        expect(() => tutorial.updateTitle('')).toThrow('Title cannot be empty');
        expect(() => tutorial.updateTitle('   ')).toThrow(
          'Title cannot be empty',
        );
      });
    });

    describe('updateDescription', () => {
      it('should update tutorial description', () => {
        const tutorial = Tutorial.create({
          title: 'Title',
          slug: TutorialSlug.create('slug'),
          description: 'Original description',
          youtubeId: 'id123',
          duration: 300,
          authorName: 'Author',
          level: 'beginner',
        });

        tutorial.updateDescription('Updated description');
        expect(tutorial.description).toBe('Updated description');
      });
    });

    describe('updateLevel', () => {
      it('should update tutorial level', () => {
        const tutorial = Tutorial.create({
          title: 'Title',
          slug: TutorialSlug.create('slug'),
          description: 'Description',
          youtubeId: 'id123',
          duration: 300,
          authorName: 'Author',
          level: 'beginner',
        });

        tutorial.updateLevel('advanced');
        expect(tutorial.level).toBe('advanced');
      });
    });

    describe('publish', () => {
      it('should publish an unpublished tutorial', () => {
        const tutorial = Tutorial.create({
          title: 'To Publish',
          slug: TutorialSlug.create('to-publish'),
          description: 'Tutorial to be published',
          youtubeId: 'pub123',
          duration: 500,
          authorName: 'Author',
          level: 'intermediate',
        });

        expect(tutorial.publishedAt).toBeUndefined();

        tutorial.publish();

        expect(tutorial.publishedAt).toBeInstanceOf(Date);
        expect(tutorial.isActive).toBe(true);
      });

      it('should not change already published tutorial', () => {
        const publishDate = new Date('2024-01-01');
        const tutorial = Tutorial.create({
          title: 'Already Published',
          slug: TutorialSlug.create('already-published'),
          description: 'Already published tutorial',
          youtubeId: 'already123',
          duration: 500,
          authorName: 'Author',
          level: 'intermediate',
          publishedAt: publishDate,
        });

        tutorial.publish();

        expect(tutorial.publishedAt).toBe(publishDate);
      });
    });

    describe('unpublish', () => {
      it('should unpublish a published tutorial', () => {
        const tutorial = Tutorial.create({
          title: 'To Unpublish',
          slug: TutorialSlug.create('to-unpublish'),
          description: 'Tutorial to be unpublished',
          youtubeId: 'unpub123',
          duration: 500,
          authorName: 'Author',
          level: 'intermediate',
          publishedAt: new Date('2024-01-01'),
        });

        tutorial.unpublish();

        // unpublish() only sets isActive to false, doesn't remove publishedAt
        expect(tutorial.publishedAt).toBeDefined();
        expect(tutorial.isActive).toBe(false);
      });
    });

    describe('addTag/removeTag', () => {
      it('should add tag to tutorial', () => {
        const tutorial = Tutorial.create({
          title: 'Tutorial',
          slug: TutorialSlug.create('tutorial'),
          description: 'Tutorial',
          youtubeId: 'tut123',
          duration: 300,
          authorName: 'Author',
          level: 'beginner',
        });

        tutorial.addTag('jazz');
        expect(tutorial.tags).toEqual(['jazz']);

        tutorial.addTag('blues');
        expect(tutorial.tags).toEqual(['jazz', 'blues']);
      });

      it('should not add duplicate tags', () => {
        const tutorial = Tutorial.create({
          title: 'Tutorial',
          slug: TutorialSlug.create('tutorial'),
          description: 'Tutorial',
          youtubeId: 'tut123',
          duration: 300,
          authorName: 'Author',
          level: 'beginner',
          tags: ['jazz'],
        });

        tutorial.addTag('jazz');
        expect(tutorial.tags).toEqual(['jazz']);

        tutorial.addTag('JAZZ'); // case insensitive
        expect(tutorial.tags).toEqual(['jazz']);
      });

      it('should remove tag from tutorial', () => {
        const tutorial = Tutorial.create({
          title: 'Tutorial',
          slug: TutorialSlug.create('tutorial'),
          description: 'Tutorial',
          youtubeId: 'tut123',
          duration: 300,
          authorName: 'Author',
          level: 'beginner',
          tags: ['jazz', 'blues', 'rock'],
        });

        tutorial.removeTag('blues');
        expect(tutorial.tags).toEqual(['jazz', 'rock']);

        tutorial.removeTag('JAZZ'); // case insensitive
        expect(tutorial.tags).toEqual(['rock']);
      });
    });
  });

  describe('toPersistence', () => {
    it('should convert core entity fields to persistence format', () => {
      // NOTE: toPersistence() also emits ~19 additional fields for
      // draft/MIDI/creator/blocks/understand subsystems added after
      // this test was first written. We assert on the core
      // mapping here (with objectContaining) so the test stays
      // resilient to future additive fields. A separate test below
      // covers the defaults that get emitted for those subsystems.
      const tutorial = Tutorial.create({
        title: 'Test Tutorial',
        slug: TutorialSlug.create('test-tutorial'),
        description: 'Test description',
        youtubeId: 'test123',
        duration: 300,
        authorName: 'Test Author',
        thumbnailUrl: 'https://example.com/test.jpg',
        level: 'intermediate',
        tags: ['test'],
        publishedAt: new Date('2024-01-01T12:00:00Z'),
      });

      const persistence = tutorial.toPersistence();

      expect(persistence).toMatchObject({
        id: tutorial.id.value,
        title: 'Test Tutorial',
        slug: 'test-tutorial',
        description: 'Test description',
        youtube_id: 'test123',
        duration: 300,
        author_name: 'Test Author',
        thumbnail_url: 'https://example.com/test.jpg',
        level: 'intermediate',
        tags: ['test'],
        is_active: true,
        published_at: '2024-01-01T12:00:00.000Z',
        created_at: tutorial.createdAt.toISOString(),
        updated_at: tutorial.updatedAt.toISOString(),
      });
    });

    it('should emit sensible defaults for draft / MIDI / blocks subsystems', () => {
      // Tutorials default to draft status with no MIDI assets, no
      // creator metadata, and an empty blocks array.
      const tutorial = Tutorial.create({
        title: 'Defaults Tutorial',
        slug: TutorialSlug.create('defaults-tutorial'),
        description: 'A tutorial with no subsystem fields set',
        youtubeId: 'defaults123',
        duration: 60,
        authorName: 'Author',
        level: 'beginner',
      });

      const persistence = tutorial.toPersistence();

      expect(persistence.status).toBe('draft');
      expect(persistence.auto_save_version).toBe(0);
      expect(persistence.blocks).toEqual([]);
      expect(persistence.drummer_midi_url).toBeUndefined();
      expect(persistence.bassline_midi_url).toBeUndefined();
      expect(persistence.harmony_midi_url).toBeUndefined();
    });
  });
});
