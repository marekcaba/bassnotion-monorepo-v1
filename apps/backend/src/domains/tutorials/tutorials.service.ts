import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import type { Tutorial, TutorialSummary } from '@bassnotion/contracts';

@Injectable()
export class TutorialsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(): Promise<{ tutorials: TutorialSummary[]; total: number }> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_tutorials_with_exercise_count');

    if (error) {
      throw new Error(`Failed to fetch tutorials: ${error.message}`);
    }

    return {
      tutorials: data || [],
      total: data?.length || 0,
    };
  }

  async findBySlug(slug: string): Promise<Tutorial> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Tutorial with slug "${slug}" not found`);
    }

    return data;
  }

  async findExercisesByTutorialSlug(slug: string): Promise<{
    tutorial: Tutorial;
    exercises: any[]; // Using any[] to avoid type conflicts for now
  }> {
    // First get the tutorial
    const tutorial = await this.findBySlug(slug);

    // Then get the exercises for this tutorial
    const { data: exercises, error: exercisesError } =
      await this.supabaseService
        .getClient()
        .from('exercises')
        .select(
          `
        id,
        title,
        description,
        difficulty,
        duration,
        bpm,
        key,
        tutorial_id,
        created_at,
        updated_at,
        is_active,
        chord_progression
      `,
        )
        .eq('tutorial_id', tutorial.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

    if (exercisesError) {
      throw new Error(`Failed to fetch exercises: ${exercisesError.message}`);
    }

    return {
      tutorial,
      exercises: exercises || [],
    };
  }

  async findById(id: string): Promise<Tutorial> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Tutorial with id "${id}" not found`);
    }

    return data;
  }

  // Temporary method to fix exercise-tutorial relationships
  async fixExerciseLinks(): Promise<{ message: string; results: any[] }> {
    const results = [];

    // Blues Scale Mastery -> Billie Jean
    const billieJeanTutorial = await this.findBySlug('billie-jean');
    const { data: bluesExercise, error: bluesError } =
      await this.supabaseService
        .getClient()
        .from('exercises')
        .update({ tutorial_id: billieJeanTutorial.id })
        .eq('title', 'Blues Scale Mastery')
        .select();

    if (bluesError) {
      results.push({
        exercise: 'Blues Scale Mastery',
        error: bluesError.message,
      });
    } else {
      results.push({
        exercise: 'Blues Scale Mastery',
        success: true,
        updated: bluesExercise,
      });
    }

    return {
      message: 'Exercise-tutorial relationships updated',
      results,
    };
  }
}
