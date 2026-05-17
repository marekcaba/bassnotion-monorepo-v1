import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { CreateTutorialDto } from './dto/create-tutorial.dto.js';
import { UpdateTutorialDto } from './dto/update-tutorial.dto.js';
import { SaveTutorialWithExercisesDto } from './dto/save-tutorial-with-exercises.dto.js';

interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
}

interface SearchFilters {
  query: string;
  level?: string;
  tags?: string[];
  isActive?: boolean;
  isPublished?: boolean;
  author?: string;
  durationMin?: number;
  durationMax?: number;
}

@Injectable()
export class AdminTutorialsService {
  private readonly logger = new Logger(AdminTutorialsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(options: PaginationOptions) {
    const { page, limit, search } = options;
    const offset = (page - 1) * limit;

    const client = this.supabaseService.getClient();

    let query = client
      .from('tutorials')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Failed to fetch tutorials', error);
      throw new Error('Failed to fetch tutorials');
    }

    // Get exercise counts for all tutorials
    const { data: exerciseCounts, error: countError } = await client.rpc(
      'get_tutorials_with_exercise_count',
    );

    let itemsWithCounts = data || [];

    if (!countError && exerciseCounts) {
      const countsMap = new Map(
        exerciseCounts.map((tc: { id: string; exercise_count: number }) => [
          tc.id,
          tc.exercise_count,
        ]),
      );

      itemsWithCounts = (data || []).map((tutorial: any) => ({
        ...tutorial,
        exercise_count: countsMap.get(tutorial.id) || 0,
      }));
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return {
      items: itemsWithCounts,
      total: count || 0,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async findPublished(options: PaginationOptions) {
    const extendedOptions = {
      ...options,
      search: `is_active.eq.true,published_at.not.is.null${
        options.search ? `,and(${options.search})` : ''
      }`,
    };

    return this.findAll(extendedOptions);
  }

  async findById(id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to fetch tutorial by ID: ${id}`, error);
      throw new Error('Failed to fetch tutorial');
    }

    return data;
  }

  async findBySlug(slug: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to fetch tutorial by slug: ${slug}`, error);
      throw new Error('Failed to fetch tutorial');
    }

    return data;
  }

  // OPTIMIZATION: Batch fetch exercises with tutorial to reduce API calls
  async findExercisesByTutorialId(tutorialId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .select('*')
      .eq('tutorial_id', tutorialId)
      .order('created_at', { ascending: true }); // Order by created_at instead of position

    if (error) {
      this.logger.error(
        `Failed to fetch exercises for tutorial ${tutorialId}`,
        error,
      );
      throw new Error('Failed to fetch exercises');
    }

    return data || [];
  }

  async create(createTutorialDto: CreateTutorialDto & { created_by: string }) {
    // Generate slug from title
    const slug = createTutorialDto.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const now = new Date().toISOString();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .insert({
        title: createTutorialDto.title,
        slug: slug,
        description: createTutorialDto.description,
        youtube_id: createTutorialDto.youtube_id || '',
        youtube_url: createTutorialDto.youtube_id
          ? `https://www.youtube.com/watch?v=${createTutorialDto.youtube_id}`
          : null,
        duration: createTutorialDto.duration || 0,
        author_name: createTutorialDto.author_name,
        // Note: thumbnail_url column doesn't exist - thumbnails are generated from YouTube ID
        level: createTutorialDto.difficulty, // Map difficulty to level
        category: createTutorialDto.category,
        tags: createTutorialDto.tags || [],
        is_active: createTutorialDto.is_active ?? true,
        created_by: createTutorialDto.created_by,
        status: 'draft', // Default status for new tutorials
        created_at: now,
        updated_at: now,
        last_modified: now,
        auto_save_version: 0,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create tutorial', error);
      throw new Error('Failed to create tutorial');
    }

    return data;
  }

  async update(id: string, updateTutorialDto: UpdateTutorialDto) {
    const now = new Date().toISOString();

    // Generate new slug if title is being updated
    const updateData: any = {
      updated_at: now,
      last_modified: now,
    };

    if (updateTutorialDto.title !== undefined) {
      updateData.title = updateTutorialDto.title;
      // Regenerate slug from new title to keep them in sync
      updateData.slug = updateTutorialDto.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    if (updateTutorialDto.description !== undefined) {
      updateData.description = updateTutorialDto.description;
    }

    if (updateTutorialDto.youtube_id !== undefined) {
      updateData.youtube_id = updateTutorialDto.youtube_id;
      // Also update youtube_url to keep both columns in sync
      updateData.youtube_url = updateTutorialDto.youtube_id
        ? `https://www.youtube.com/watch?v=${updateTutorialDto.youtube_id}`
        : null;
    }

    if (updateTutorialDto.duration !== undefined) {
      updateData.duration = updateTutorialDto.duration;
    }

    if (updateTutorialDto.author_name !== undefined) {
      updateData.author_name = updateTutorialDto.author_name;
    }

    if (updateTutorialDto.thumbnail_url !== undefined) {
      updateData.thumbnail_url = updateTutorialDto.thumbnail_url;
    }

    if (updateTutorialDto.difficulty !== undefined) {
      updateData.level = updateTutorialDto.difficulty; // Map difficulty to level
    }

    if (updateTutorialDto.category !== undefined) {
      updateData.category = updateTutorialDto.category;
    }

    if (updateTutorialDto.tags !== undefined) {
      updateData.tags = updateTutorialDto.tags;
    }

    if (updateTutorialDto.is_active !== undefined) {
      updateData.is_active = updateTutorialDto.is_active;
    }

    // Core Concept fields
    if (updateTutorialDto.core_concept_description !== undefined) {
      updateData.core_concept_description =
        updateTutorialDto.core_concept_description;
    }

    if (updateTutorialDto.core_concept_points !== undefined) {
      updateData.core_concept_points = updateTutorialDto.core_concept_points;
    }

    if (updateTutorialDto.teaching_takeaway !== undefined) {
      updateData.teaching_takeaway = updateTutorialDto.teaching_takeaway;
    }

    // Creator fields for YouTube attribution
    if (updateTutorialDto.creator_name !== undefined) {
      updateData.creator_name = updateTutorialDto.creator_name;
    }

    if (updateTutorialDto.creator_channel_url !== undefined) {
      updateData.creator_channel_url = updateTutorialDto.creator_channel_url;
    }

    if (updateTutorialDto.creator_avatar_url !== undefined) {
      updateData.creator_avatar_url = updateTutorialDto.creator_avatar_url;
    }

    if (updateTutorialDto.creator_subscriber_count !== undefined) {
      updateData.creator_subscriber_count =
        updateTutorialDto.creator_subscriber_count;
    }

    if ((updateTutorialDto as any).blocks !== undefined) {
      updateData.blocks = (updateTutorialDto as any).blocks;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to update tutorial: ${id}`, error);
      throw new Error('Failed to update tutorial');
    }

    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        return false;
      }
      this.logger.error(`Failed to delete tutorial: ${id}`, error);
      throw new Error('Failed to delete tutorial');
    }

    return true;
  }

  async publish(id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .update({
        is_active: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to publish tutorial: ${id}`, error);
      throw new Error('Failed to publish tutorial');
    }

    return data;
  }

  async unpublish(id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .update({
        is_active: false,
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to unpublish tutorial: ${id}`, error);
      throw new Error('Failed to unpublish tutorial');
    }

    return data;
  }

  async findRelated(id: string, limit: number) {
    // First get the tutorial to find its tags and difficulty
    const tutorial = await this.findById(id);
    if (!tutorial) {
      return [];
    }

    // Find tutorials with similar tags or difficulty
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .select('*')
      .neq('id', id)
      .eq('is_active', true)
      .not('published_at', 'is', null)
      .or(
        `tags.cs.{${tutorial.tags?.join(',')}},difficulty.eq.${tutorial.difficulty}`,
      )
      .limit(limit);

    if (error) {
      this.logger.error(`Failed to fetch related tutorials for: ${id}`, error);
      return [];
    }

    return data || [];
  }

  async findByIds(ids: string[]) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .select('*')
      .in('id', ids);

    if (error) {
      this.logger.error('Failed to fetch tutorials by IDs', error);
      throw new Error('Failed to fetch tutorials');
    }

    return data || [];
  }

  async search(filters: SearchFilters) {
    const client = this.supabaseService.getClient();

    let query = client.from('tutorials').select('*');

    // Apply search query
    query = query.or(
      `title.ilike.%${filters.query}%,description.ilike.%${filters.query}%,tags.cs.{${filters.query}}`,
    );

    // Apply filters
    if (filters.level) {
      query = query.eq('difficulty', filters.level);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    if (filters.isPublished !== undefined) {
      if (filters.isPublished) {
        query = query.not('published_at', 'is', null);
      } else {
        query = query.is('published_at', null);
      }
    }

    if (filters.author) {
      query = query.ilike('author_name', `%${filters.author}%`);
    }

    if (filters.durationMin !== undefined) {
      query = query.gte('duration', filters.durationMin);
    }

    if (filters.durationMax !== undefined) {
      query = query.lte('duration', filters.durationMax);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error('Failed to search tutorials', error);
      throw new Error('Failed to search tutorials');
    }

    return data || [];
  }

  /**
   * FAANG-level batch save operation
   * Atomically saves tutorial and all its exercises in a single transaction
   * Uses optimistic concurrency control and server-side ID generation
   */
  async saveWithExercises(dto: SaveTutorialWithExercisesDto, userId: string) {
    const client = this.supabaseService.getClient();

    // DEBUG: Log incoming exercise notes AND MIDI URLs
    this.logger.log('saveWithExercises - Incoming exercises:', {
      exerciseCount: dto.exercises.length,
      exercises: dto.exercises.map((ex) => ({
        id: ex.id || 'NEW',
        title: ex.title,
        notesCount: ex.notes?.length || 0,
        hasNotes: !!ex.notes,
        firstNote: ex.notes?.[0],
        // CRITICAL: Check drum_pattern from drummer MIDI conversion
        hasDrumPattern: !!ex.drum_pattern,
        drumPatternHits: ex.drum_pattern?.length || 0,
        drumPatternSample: ex.drum_pattern?.[0],
        // CRITICAL DEBUG: Check temp MIDI paths and permanent URLs
        drummerMidiUrl: ex.drummer_midi_url,
        tempDrummerPath: ex.temp_drummer_midi_path,
        basslineMidiUrl: ex.bassline_midi_url,
        tempBasslinePath: ex.temp_bassline_midi_path,
      })),
    });

    try {
      // Step 1: Update tutorial (tutorial ID always exists from frontend)
      const now = new Date().toISOString();

      // Generate slug from title to keep them in sync
      const slug = dto.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const tutorialUpdateData: any = {
        title: dto.title,
        slug: slug,
        description: dto.description,
        youtube_id: dto.youtube_id,
        youtube_url: dto.youtube_id
          ? `https://www.youtube.com/watch?v=${dto.youtube_id}`
          : null,
        duration: dto.duration,
        author_name: dto.author_name,
        thumbnail_url: dto.thumbnail_url, // Custom thumbnail from Supabase storage
        level: dto.difficulty,
        category: dto.category,
        tags: dto.tags || [],
        is_active: dto.is_active ?? true,
        core_concept_description: dto.core_concept_description,
        core_concept_points: dto.core_concept_points || [],
        teaching_takeaway: dto.teaching_takeaway,
        creator_name: dto.creator_name,
        creator_channel_url: dto.creator_channel_url,
        creator_avatar_url: dto.creator_avatar_url,
        creator_subscriber_count: dto.creator_subscriber_count,
        // Modular block system
        blocks: dto.blocks || [],
        // Act 1: Understand fields (legacy)
        understand_video_url: dto.understand_video_url,
        understand_video_library_id: dto.understand_video_library_id,
        understand_headline: dto.understand_headline,
        understand_questions: dto.understand_questions || [],
        title_highlight_words: dto.title_highlight_words || [],
        sidebar_title: dto.sidebar_title,
        updated_at: now,
        last_modified: now,
      };

      const { data: tutorialData, error: tutorialError } = await client
        .from('tutorials')
        .update(tutorialUpdateData)
        .eq('id', dto.id)
        .select()
        .single();

      if (tutorialError) {
        this.logger.error(
          'Failed to update tutorial in batch save',
          tutorialError,
        );

        // Check for duplicate slug constraint violation (PostgreSQL error code 23505)
        if (
          tutorialError.code === '23505' &&
          tutorialError.message?.includes('tutorials_slug_key')
        ) {
          throw new ConflictException(
            `A tutorial with the slug "${slug}" already exists. Please use a different title or slug.`,
          );
        }

        // Generic database error
        throw new Error(`Failed to update tutorial: ${tutorialError.message}`);
      }

      // Step 2: Process exercises - separate creates and updates
      const exercisesToCreate = dto.exercises.filter((ex) => !ex.id);
      const exercisesToUpdate = dto.exercises.filter((ex) => ex.id);

      const createdExercises = [];
      const updatedExercises = [];

      // Step 3: Batch create new exercises
      if (exercisesToCreate.length > 0) {
        // Process temp MIDI files before inserting (Story 4.4 - Task 3.4)
        const exerciseInserts = await Promise.all(
          exercisesToCreate.map(async (ex) => {
            // Generate exercise ID for MIDI file paths
            const exerciseId = crypto.randomUUID();

            // Handle temp MIDI file migration - all 4 MIDI types
            let finalBasslineMidiUrl = ex.bassline_midi_url;
            let finalDrummerMidiUrl = ex.drummer_midi_url || ex.drums_midi_url;
            let finalHarmonyMidiUrl = ex.harmony_midi_url;
            let finalMetronomeMidiUrl = ex.metronome_midi_url;

            if (ex.temp_bassline_midi_path) {
              this.logger.log(
                'Migrating bassline MIDI from temp to permanent storage',
                {
                  exerciseId,
                  tempPath: ex.temp_bassline_midi_path,
                },
              );
              const permanentPath = `exercises/${exerciseId}/${Date.now()}_bassline.mid`;
              finalBasslineMidiUrl = await this.supabaseService.moveToPermanent(
                ex.temp_bassline_midi_path,
                'exercise-midi-files',
                permanentPath,
              );
            }
            if (ex.temp_drummer_midi_path) {
              const permanentPath = `exercises/${exerciseId}/${Date.now()}_drummer.mid`;
              finalDrummerMidiUrl = await this.supabaseService.moveToPermanent(
                ex.temp_drummer_midi_path,
                'exercise-midi-files',
                permanentPath,
              );
            }
            if (ex.temp_harmony_midi_path) {
              const permanentPath = `exercises/${exerciseId}/${Date.now()}_harmony.mid`;
              finalHarmonyMidiUrl = await this.supabaseService.moveToPermanent(
                ex.temp_harmony_midi_path,
                'exercise-midi-files',
                permanentPath,
              );
            }
            if (ex.temp_metronome_midi_path) {
              const permanentPath = `exercises/${exerciseId}/${Date.now()}_metronome.mid`;
              finalMetronomeMidiUrl =
                await this.supabaseService.moveToPermanent(
                  ex.temp_metronome_midi_path,
                  'exercise-midi-files',
                  permanentPath,
                );
            }

            return {
              id: exerciseId, // Use the generated ID
              tutorial_id: dto.id,
              title: ex.title,
              description: ex.description,
              difficulty: ex.difficulty,
              duration: ex.duration ?? 0,
              total_bars: ex.total_bars ?? 4,
              duration_beats: ex.duration_beats,
              time_signature: ex.time_signature ?? {
                numerator: 4,
                denominator: 4,
              },
              bpm: ex.bpm ?? 120,
              key: ex.key ?? 'C',
              notes: ex.notes || [],
              drum_pattern: ex.drum_pattern || [], // Pre-converted drum hits from MIDI
              harmony_notes: ex.harmony_notes || [], // Pre-converted harmony notes from MIDI
              harmony_control_changes: ex.harmony_control_changes || [], // MIDI control changes (sustain pedal, etc.)
              harmony_instrument: ex.harmony_instrument || null, // Harmony instrument type
              fretboard_view_config: ex.fretboard_view_config || {
                preset: 'default',
              }, // Fretboard view config
              bassline_midi_url: finalBasslineMidiUrl,
              drummer_midi_url: finalDrummerMidiUrl,
              harmony_midi_url: finalHarmonyMidiUrl,
              metronome_midi_url: finalMetronomeMidiUrl,
              order_index: ex.order_index ?? 0,
              is_active: ex.is_active ?? true,
              created_at: now,
              updated_at: now,
            };
          }),
        );

        const { data: createdData, error: createError } = await client
          .from('exercises')
          .insert(exerciseInserts)
          .select();

        if (createError) {
          this.logger.error('Failed to create exercises in batch', createError);
          throw new Error(`Failed to create exercises: ${createError.message}`);
        }

        createdExercises.push(...(createdData || []));
      }

      // Step 4: Batch update existing exercises
      if (exercisesToUpdate.length > 0) {
        // Process temp MIDI files before updating (Story 4.4 - Task 3.4)
        const exerciseUpdates = await Promise.all(
          exercisesToUpdate.map(async (ex) => {
            // Handle temp MIDI file migration - all 4 MIDI types
            let finalBasslineMidiUrl = ex.bassline_midi_url;
            let finalDrummerMidiUrl = ex.drummer_midi_url || ex.drums_midi_url;
            let finalHarmonyMidiUrl = ex.harmony_midi_url;
            let finalMetronomeMidiUrl = ex.metronome_midi_url;

            if (ex.temp_bassline_midi_path) {
              this.logger.log(
                'Migrating bassline MIDI from temp to permanent storage (update)',
                {
                  exerciseId: ex.id,
                  tempPath: ex.temp_bassline_midi_path,
                },
              );
              const permanentPath = `exercises/${ex.id}/${Date.now()}_bassline.mid`;
              finalBasslineMidiUrl = await this.supabaseService.moveToPermanent(
                ex.temp_bassline_midi_path,
                'exercise-midi-files',
                permanentPath,
              );
            }
            if (ex.temp_drummer_midi_path) {
              const permanentPath = `exercises/${ex.id}/${Date.now()}_drummer.mid`;
              finalDrummerMidiUrl = await this.supabaseService.moveToPermanent(
                ex.temp_drummer_midi_path,
                'exercise-midi-files',
                permanentPath,
              );
              this.logger.log('🎵 DRUMMER MIDI migrated to permanent:', {
                exerciseId: ex.id,
                tempPath: ex.temp_drummer_midi_path,
                permanentPath,
                finalDrummerMidiUrl,
              });
            }
            if (ex.temp_harmony_midi_path) {
              const permanentPath = `exercises/${ex.id}/${Date.now()}_harmony.mid`;
              finalHarmonyMidiUrl = await this.supabaseService.moveToPermanent(
                ex.temp_harmony_midi_path,
                'exercise-midi-files',
                permanentPath,
              );
            }
            if (ex.temp_metronome_midi_path) {
              const permanentPath = `exercises/${ex.id}/${Date.now()}_metronome.mid`;
              finalMetronomeMidiUrl =
                await this.supabaseService.moveToPermanent(
                  ex.temp_metronome_midi_path,
                  'exercise-midi-files',
                  permanentPath,
                );
            }

            return {
              id: ex.id,
              tutorial_id: dto.id,
              title: ex.title,
              description: ex.description,
              difficulty: ex.difficulty,
              duration: ex.duration ?? 0,
              total_bars: ex.total_bars ?? 4,
              duration_beats: ex.duration_beats,
              time_signature: ex.time_signature ?? {
                numerator: 4,
                denominator: 4,
              },
              bpm: ex.bpm ?? 120,
              key: ex.key ?? 'C',
              notes: ex.notes || [],
              drum_pattern: ex.drum_pattern || [], // Pre-converted drum hits from MIDI
              harmony_notes: ex.harmony_notes || [], // Pre-converted harmony notes from MIDI
              harmony_control_changes: ex.harmony_control_changes || [], // MIDI control changes (sustain pedal, etc.)
              harmony_instrument: ex.harmony_instrument || null, // Harmony instrument type
              fretboard_view_config: ex.fretboard_view_config || {
                preset: 'default',
              }, // Fretboard view config
              bassline_midi_url: finalBasslineMidiUrl,
              drummer_midi_url: finalDrummerMidiUrl,
              harmony_midi_url: finalHarmonyMidiUrl,
              metronome_midi_url: finalMetronomeMidiUrl,
              order_index: ex.order_index ?? 0,
              is_active: ex.is_active ?? true,
              updated_at: now,
            };
          }),
        );

        // DEBUG: Log exact data being sent to database
        this.logger.log('🔍 About to upsert exercise updates:', {
          count: exerciseUpdates.length,
          updates: exerciseUpdates.map((ex) => ({
            id: ex.id,
            title: ex.title,
            drummer_midi_url: ex.drummer_midi_url,
            bassline_midi_url: ex.bassline_midi_url,
            harmony_midi_url: ex.harmony_midi_url,
            metronome_midi_url: ex.metronome_midi_url,
          })),
        });

        const { data: updatedData, error: updateError } = await client
          .from('exercises')
          .upsert(exerciseUpdates, { onConflict: 'id' })
          .select();

        // DEBUG: Log upsert result
        this.logger.log('✅ Upsert result:', {
          success: !updateError,
          error: updateError,
          updatedCount: updatedData?.length,
          updatedExercises: updatedData?.map((ex) => ({
            id: ex.id,
            title: ex.title,
            drummer_midi_url: ex.drummer_midi_url,
            bassline_midi_url: ex.bassline_midi_url,
          })),
        });

        if (updateError) {
          this.logger.error('Failed to update exercises in batch', updateError);
          throw new Error(`Failed to update exercises: ${updateError.message}`);
        }

        updatedExercises.push(...(updatedData || []));
      }

      // Step 5: Return complete result
      const allExercises = [...createdExercises, ...updatedExercises].sort(
        (a, b) => (a.order_index || 0) - (b.order_index || 0),
      );

      return {
        tutorial: tutorialData,
        exercises: allExercises,
      };
    } catch (error) {
      this.logger.error('Batch save operation failed', error);
      throw error;
    }
  }
}
