import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { UpdateMidiStatusDto } from './dto/update-midi-status.dto.js';

interface PaginationOptions {
  page: number;
  limit: number;
  tutorialId?: string;
}

interface SearchFilters {
  query: string;
  difficulty?: string;
  tags?: string[];
  isActive?: boolean;
  bpmMin?: number;
  bpmMax?: number;
}

@Injectable()
export class AdminExercisesService {
  private readonly logger = new Logger(AdminExercisesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(options: PaginationOptions) {
    const { page, limit, tutorialId } = options;
    const offset = (page - 1) * limit;

    const client = this.supabaseService.getClient();

    let query = client
      .from('exercises')
      .select('*', { count: 'exact' })
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tutorialId) {
      query = query.eq('tutorial_id', tutorialId);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Failed to fetch exercises', error);
      throw new Error('Failed to fetch exercises');
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return {
      items: data || [],
      total: count || 0,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to fetch exercise by ID: ${id}`, error);
      throw new Error('Failed to fetch exercise');
    }

    return data;
  }

  async findByTutorialId(tutorialId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .select('*')
      .eq('tutorial_id', tutorialId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to fetch exercises for tutorial: ${tutorialId}`,
        error,
      );
      throw new Error('Failed to fetch exercises');
    }

    return data || [];
  }

  async create(createExerciseDto: any) {
    // Get the next order index for the tutorial
    const { data: existingExercises } = await this.supabaseService
      .getClient()
      .from('exercises')
      .select('order_index')
      .eq('tutorial_id', createExerciseDto.tutorial_id)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrderIndex =
      existingExercises && existingExercises.length > 0
        ? (existingExercises[0].order_index || 0) + 1
        : 0;

    // Handle temp MIDI file migration (Story 4.4 Task 3.4) - all 4 MIDI types
    const exerciseId = createExerciseDto.id || crypto.randomUUID();
    let finalBasslineMidiUrl = createExerciseDto.bassline_midi_url;
    let finalDrummerMidiUrl = createExerciseDto.drummer_midi_url;
    let finalHarmonyMidiUrl = createExerciseDto.harmony_midi_url;
    let finalMetronomeMidiUrl = createExerciseDto.metronome_midi_url;

    this.logger.log('Checking for temp MIDI files to migrate', {
      temp_bassline_midi_path: createExerciseDto.temp_bassline_midi_path,
      temp_drummer_midi_path: createExerciseDto.temp_drummer_midi_path,
      temp_harmony_midi_path: createExerciseDto.temp_harmony_midi_path,
      temp_metronome_midi_path: createExerciseDto.temp_metronome_midi_path,
    });

    if (createExerciseDto.temp_bassline_midi_path) {
      this.logger.log(
        'Migrating bassline MIDI from temp to permanent storage',
        {
          tempPath: createExerciseDto.temp_bassline_midi_path,
        },
      );
      const permanentPath = `exercises/${exerciseId}/${Date.now()}_bassline.mid`;
      finalBasslineMidiUrl = await this.supabaseService.moveToPermanent(
        createExerciseDto.temp_bassline_midi_path,
        'exercise-midi-files',
        permanentPath,
      );
      this.logger.log('Bassline MIDI migrated successfully', {
        permanentUrl: finalBasslineMidiUrl,
      });
    }
    if (createExerciseDto.temp_drummer_midi_path) {
      const permanentPath = `exercises/${exerciseId}/${Date.now()}_drummer.mid`;
      finalDrummerMidiUrl = await this.supabaseService.moveToPermanent(
        createExerciseDto.temp_drummer_midi_path,
        'exercise-midi-files',
        permanentPath,
      );
    }
    if (createExerciseDto.temp_harmony_midi_path) {
      const permanentPath = `exercises/${exerciseId}/${Date.now()}_harmony.mid`;
      finalHarmonyMidiUrl = await this.supabaseService.moveToPermanent(
        createExerciseDto.temp_harmony_midi_path,
        'exercise-midi-files',
        permanentPath,
      );
    }
    if (createExerciseDto.temp_metronome_midi_path) {
      const permanentPath = `exercises/${exerciseId}/${Date.now()}_metronome.mid`;
      finalMetronomeMidiUrl = await this.supabaseService.moveToPermanent(
        createExerciseDto.temp_metronome_midi_path,
        'exercise-midi-files',
        permanentPath,
      );
    }

    // DIAGNOSTIC: Log harmony data being saved
    this.logger.log('🎛️ Creating exercise with harmony data', {
      exerciseId,
      title: createExerciseDto.title,
      hasHarmonyNotes: !!createExerciseDto.harmony_notes,
      harmonyNotesCount: createExerciseDto.harmony_notes?.length || 0,
      hasHarmonyControlChanges: !!createExerciseDto.harmony_control_changes,
      harmonyControlChangesCount:
        createExerciseDto.harmony_control_changes?.length || 0,
      harmonyInstrument: createExerciseDto.harmony_instrument,
    });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .insert({
        id: exerciseId, // Use the exerciseId we generated above
        tutorial_id: createExerciseDto.tutorial_id,
        title: createExerciseDto.title,
        description: createExerciseDto.description,
        bpm: createExerciseDto.bpm,
        duration: createExerciseDto.duration,
        total_bars: createExerciseDto.total_bars,
        duration_beats: createExerciseDto.duration_beats,
        time_signature: createExerciseDto.time_signature || {
          numerator: 4,
          denominator: 4,
        },
        difficulty: createExerciseDto.difficulty,
        key: createExerciseDto.key || 'C',
        tags: createExerciseDto.tags,
        notes: createExerciseDto.notes || [], // Story 4.4 Task 3.4: Support notes array
        order_index: createExerciseDto.order_index ?? nextOrderIndex,
        is_active: createExerciseDto.is_active ?? true,
        created_by: createExerciseDto.created_by,
        // MIDI URL fields - use migrated permanent URLs
        drummer_midi_url: finalDrummerMidiUrl,
        bassline_midi_url: finalBasslineMidiUrl,
        harmony_midi_url: finalHarmonyMidiUrl,
        metronome_midi_url: finalMetronomeMidiUrl,
        // Harmony instrument data (converted from MIDI)
        harmony_notes: createExerciseDto.harmony_notes || [],
        harmony_control_changes:
          createExerciseDto.harmony_control_changes || [],
        harmony_instrument: createExerciseDto.harmony_instrument || null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create exercise', error);
      throw new Error('Failed to create exercise');
    }

    // DIAGNOSTIC: Log what came back from database
    this.logger.log('🎛️ Exercise created, returned data', {
      exerciseId: data.id,
      title: data.title,
      hasHarmonyNotes: !!data.harmony_notes,
      harmonyNotesCount: data.harmony_notes?.length || 0,
      hasHarmonyControlChanges: !!data.harmony_control_changes,
      harmonyControlChangesCount: data.harmony_control_changes?.length || 0,
    });

    if (error) {
      this.logger.error('Failed to create exercise', error);
      throw new Error('Failed to create exercise');
    }

    return data;
  }

  async update(id: string, updateExerciseDto: any) {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Handle temp MIDI file migration (Story 4.4 Task 3.4) - all 4 MIDI types
    if (updateExerciseDto.temp_bassline_midi_path) {
      const permanentPath = `exercises/${id}/${Date.now()}_bassline.mid`;
      updateData.bassline_midi_url = await this.supabaseService.moveToPermanent(
        updateExerciseDto.temp_bassline_midi_path,
        'exercise-midi-files',
        permanentPath,
      );
    }
    if (updateExerciseDto.temp_drummer_midi_path) {
      const permanentPath = `exercises/${id}/${Date.now()}_drummer.mid`;
      updateData.drummer_midi_url = await this.supabaseService.moveToPermanent(
        updateExerciseDto.temp_drummer_midi_path,
        'exercise-midi-files',
        permanentPath,
      );
    }
    if (updateExerciseDto.temp_harmony_midi_path) {
      const permanentPath = `exercises/${id}/${Date.now()}_harmony.mid`;
      updateData.harmony_midi_url = await this.supabaseService.moveToPermanent(
        updateExerciseDto.temp_harmony_midi_path,
        'exercise-midi-files',
        permanentPath,
      );
    }
    if (updateExerciseDto.temp_metronome_midi_path) {
      const permanentPath = `exercises/${id}/${Date.now()}_metronome.mid`;
      updateData.metronome_midi_url =
        await this.supabaseService.moveToPermanent(
          updateExerciseDto.temp_metronome_midi_path,
          'exercise-midi-files',
          permanentPath,
        );
    }

    // Only include defined fields in the update
    if (updateExerciseDto.title !== undefined)
      updateData.title = updateExerciseDto.title;
    if (updateExerciseDto.description !== undefined)
      updateData.description = updateExerciseDto.description;
    // MIDI URL fields
    if (updateExerciseDto.drummer_midi_url !== undefined)
      updateData.drummer_midi_url = updateExerciseDto.drummer_midi_url;
    if (updateExerciseDto.bassline_midi_url !== undefined)
      updateData.bassline_midi_url = updateExerciseDto.bassline_midi_url;
    if (updateExerciseDto.harmony_midi_url !== undefined)
      updateData.harmony_midi_url = updateExerciseDto.harmony_midi_url;
    if (updateExerciseDto.metronome_midi_url !== undefined)
      updateData.metronome_midi_url = updateExerciseDto.metronome_midi_url;
    if (updateExerciseDto.bpm !== undefined)
      updateData.bpm = updateExerciseDto.bpm;
    if (updateExerciseDto.duration !== undefined)
      updateData.duration = updateExerciseDto.duration;
    if (updateExerciseDto.total_bars !== undefined)
      updateData.total_bars = updateExerciseDto.total_bars;
    if (updateExerciseDto.duration_beats !== undefined)
      updateData.duration_beats = updateExerciseDto.duration_beats;
    if (updateExerciseDto.time_signature !== undefined)
      updateData.time_signature = updateExerciseDto.time_signature;
    if (updateExerciseDto.difficulty !== undefined)
      updateData.difficulty = updateExerciseDto.difficulty;
    if (updateExerciseDto.key !== undefined)
      updateData.key = updateExerciseDto.key;
    if (updateExerciseDto.tags !== undefined)
      updateData.tags = updateExerciseDto.tags;
    if (updateExerciseDto.notes !== undefined)
      updateData.notes = updateExerciseDto.notes; // Story 4.4 Task 3.4: Support notes array
    if (updateExerciseDto.is_active !== undefined)
      updateData.is_active = updateExerciseDto.is_active;
    // Harmony instrument data
    if (updateExerciseDto.harmony_notes !== undefined)
      updateData.harmony_notes = updateExerciseDto.harmony_notes;
    if (updateExerciseDto.harmony_control_changes !== undefined)
      updateData.harmony_control_changes =
        updateExerciseDto.harmony_control_changes;
    if (updateExerciseDto.harmony_instrument !== undefined)
      updateData.harmony_instrument = updateExerciseDto.harmony_instrument;
    // Drum pattern data
    if (updateExerciseDto.drum_pattern !== undefined)
      updateData.drum_pattern = updateExerciseDto.drum_pattern;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to update exercise: ${id}`, error);
      throw new Error('Failed to update exercise');
    }

    return data;
  }

  async delete(id: string) {
    // First, fetch the exercise to get MIDI file URLs
    const exercise = await this.findById(id);
    if (!exercise) {
      return false;
    }

    // Delete the exercise from database
    const { error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        return false;
      }
      this.logger.error(`Failed to delete exercise: ${id}`, error);
      throw new Error('Failed to delete exercise');
    }

    // After successful database deletion, clean up MIDI files from storage
    const midiUrls = [
      exercise.bassline_midi_url,
      exercise.drummer_midi_url,
      exercise.harmony_midi_url,
      exercise.metronome_midi_url,
    ].filter(Boolean); // Remove null/undefined values

    if (midiUrls.length > 0) {
      this.logger.log(
        `Cleaning up ${midiUrls.length} MIDI file(s) for exercise ${id}`,
      );

      for (const url of midiUrls) {
        try {
          // Extract path from URL (format: ...storage/v1/object/public/exercise-midi-files/exercises/{id}/{filename})
          const pathMatch = url.match(/exercise-midi-files\/(.+)$/);
          if (pathMatch) {
            const filePath = pathMatch[1];
            await this.supabaseService.deleteFile(
              'exercise-midi-files',
              filePath,
            );
            this.logger.log(`Deleted MIDI file: ${filePath}`);
          }
        } catch (fileError) {
          // Log but don't fail the deletion if file cleanup fails
          this.logger.warn(`Failed to delete MIDI file ${url}:`, fileError);
        }
      }
    }

    return true;
  }

  async updateMidiStatus(id: string, updateMidiStatusDto: UpdateMidiStatusDto) {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updateMidiStatusDto.has_metronome_midi !== undefined) {
      updateData.has_metronome_midi = updateMidiStatusDto.has_metronome_midi;
    }
    if (updateMidiStatusDto.has_drums_midi !== undefined) {
      updateData.has_drums_midi = updateMidiStatusDto.has_drums_midi;
    }
    if (updateMidiStatusDto.has_bass_midi !== undefined) {
      updateData.has_bass_midi = updateMidiStatusDto.has_bass_midi;
    }
    if (updateMidiStatusDto.has_harmony_midi !== undefined) {
      updateData.has_harmony_midi = updateMidiStatusDto.has_harmony_midi;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(
        `Failed to update MIDI status for exercise: ${id}`,
        error,
      );
      throw new Error('Failed to update MIDI status');
    }

    return data;
  }

  async findByIds(ids: string[]) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .select('*')
      .in('id', ids)
      .order('order_index', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch exercises by IDs', error);
      throw new Error('Failed to fetch exercises');
    }

    return data || [];
  }

  async search(filters: SearchFilters) {
    const client = this.supabaseService.getClient();

    let query = client.from('exercises').select('*');

    // Apply search query
    query = query.or(
      `title.ilike.%${filters.query}%,description.ilike.%${filters.query}%,tags.cs.{${filters.query}}`,
    );

    // Apply filters
    if (filters.difficulty) {
      query = query.eq('difficulty', filters.difficulty);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    if (filters.bpmMin !== undefined) {
      query = query.gte('bpm', filters.bpmMin);
    }

    if (filters.bpmMax !== undefined) {
      query = query.lte('bpm', filters.bpmMax);
    }

    const { data, error } = await query.order('order_index', {
      ascending: true,
    });

    if (error) {
      this.logger.error('Failed to search exercises', error);
      throw new Error('Failed to search exercises');
    }

    return data || [];
  }

  async updateOrder(id: string, orderIndex: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .update({
        order_index: orderIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Failed to update exercise order: ${id}`, error);
      throw new Error('Failed to update exercise order');
    }

    return data;
  }

  async findByDifficulty(difficulty: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .select('*')
      .eq('difficulty', difficulty)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to fetch exercises by difficulty: ${difficulty}`,
        error,
      );
      throw new Error('Failed to fetch exercises');
    }

    return data || [];
  }

  /**
   * Upsert pattern: Create or update exercise based on presence of ID
   * Story 4.4 Task 3.7: Smart upsert logic
   *
   * @param exerciseDto - Exercise data with optional ID
   * @returns Created or updated exercise
   */
  async upsert(exerciseDto: any) {
    if (exerciseDto.id) {
      // Check if exercise exists
      const existing = await this.findById(exerciseDto.id);
      if (existing) {
        // Update existing exercise
        this.logger.log(`Upserting exercise (UPDATE): ${exerciseDto.id}`);
        return await this.update(exerciseDto.id, exerciseDto);
      }
    }

    // Create new exercise (either no ID provided or ID doesn't exist)
    this.logger.log(`Upserting exercise (CREATE): ${exerciseDto.id || 'new'}`);
    return await this.create(exerciseDto);
  }
}
