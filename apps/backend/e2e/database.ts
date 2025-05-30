import { Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { UserFactory } from './factories/user.factory.js';

const logger = new Logger('E2EDatabase');

const validateEnvVars = () => {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
  ] as const;
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const jwtSecret = process.env['JWT_SECRET'];

  if (!supabaseUrl || !supabaseServiceRoleKey || !jwtSecret) {
    throw new Error('Required environment variables are undefined');
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    jwtSecret,
  } as const;
};

export class TestDatabase {
  private client: SupabaseClient | null = null;
  private initialized = false;
  private tables: string[] = [
    // User domain tables
    'users',
    'auth.users',
    'profiles',
    'tokens',
    'user_preferences',

    // Content domain tables
    'exercises',
    'exercise_metadata',
    'exercise_tags',
    'exercise_categories',

    // Learning domain tables
    'learning_paths',
    'user_progress',
    'achievements',

    // Analysis domain tables
    'youtube_analyses',
    'audio_analyses',

    // Widget domain tables
    'widget_configurations',
    'widget_user_data',

    // Playback domain tables
    'playback_settings',
    'audio_bookmarks',
  ];

  constructor() {
    // Don't validate environment variables during construction
    // This allows the module to be imported before environment variables are loaded
  }

  private async ensureInitialized() {
    if (this.initialized) {
      return;
    }

    const env = validateEnvVars();
    this.client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          apikey: env.supabaseServiceRoleKey,
        },
      },
      db: {
        schema: 'public',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    await this.verifyConnection();
    this.initialized = true;
  }

  private async verifyConnection(): Promise<void> {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    try {
      const { error } = await this.client
        .from('profiles')
        .select('count')
        .limit(1);
      if (error) {
        throw error;
      }
      logger.debug('Supabase connection verified successfully');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to verify Supabase connection:', error);
      throw new Error(
        `Supabase connection verification failed: ${errorMessage}`,
      );
    }
  }

  private async cleanDatabase() {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    logger.debug('Cleaning test database...');
    try {
      // First, clean public schema tables in reverse order to handle foreign key constraints
      for (const table of [...this.tables].reverse()) {
        if (!table.includes('auth.')) {
          logger.debug(`Cleaning table: ${table}`);
          const { error } = await this.client
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows except system rows

          if (error && error.code !== '42P01') {
            // Ignore table not found errors
            logger.error(`Error cleaning table ${table}:`, error);
          }
        }
      }

      // Then, delete all auth.users which will cascade delete profiles
      const { data: users, error: listError } =
        await this.client.auth.admin.listUsers();

      if (listError) {
        logger.error('Error listing auth users:', listError);
      } else if (users) {
        // Delete users one by one and wait for each deletion to complete
        for (const user of users.users) {
          logger.debug(`Deleting auth user: ${user.id}`);
          const { error: deleteError } =
            await this.client.auth.admin.deleteUser(user.id);

          if (deleteError) {
            logger.error(`Error deleting user ${user.id}:`, deleteError);
          }
        }

        // Wait for cascade deletion to complete
        let retries = 5;
        while (retries > 0) {
          const { data: remainingProfiles, error: profileError } =
            await this.client.from('profiles').select('id');

          if (profileError) {
            logger.error('Error checking remaining profiles:', profileError);
            break;
          }

          if (!remainingProfiles || remainingProfiles.length === 0) {
            logger.debug('All profiles deleted successfully');
            break;
          }

          logger.debug(
            `Waiting for ${remainingProfiles.length} profiles to be deleted...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          retries--;
        }

        // Force delete any remaining profiles
        if (retries === 0) {
          logger.warn('Force deleting remaining profiles...');
          const { error: forceError } = await this.client
            .from('profiles')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

          if (forceError) {
            logger.error('Error force deleting profiles:', forceError);
          }
        }
      }
    } catch (error) {
      logger.error('Error cleaning database:', error);
      throw error;
    }
  }

  async seedDatabase() {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    logger.debug('Seeding test database...');
    try {
      // Create test users sequentially
      const userFactory = new UserFactory(this.client);
      for (let i = 0; i < 3; i++) {
        await userFactory.create(); // Create users one by one
      }

      // Seed other necessary test data
      await this.seedExerciseData();
      await this.seedLearningData();
      await this.seedWidgetData();

      logger.debug('Database seeded successfully');
    } catch (error) {
      logger.error('Failed to seed database:', error);
      throw error;
    }
  }

  private async seedExerciseData() {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    try {
      // Seed exercise categories
      const { error: catError } = await this.client
        .from('exercise_categories')
        .insert([
          { name: 'Technique', description: 'Technical exercises' },
          { name: 'Theory', description: 'Music theory exercises' },
          { name: 'Rhythm', description: 'Rhythm exercises' },
        ]);
      if (catError && catError.code !== '42P01') throw catError;

      // Seed exercise tags
      const { error: tagError } = await this.client
        .from('exercise_tags')
        .insert([
          { name: 'beginner' },
          { name: 'intermediate' },
          { name: 'advanced' },
        ]);
      if (tagError && tagError.code !== '42P01') throw tagError;
    } catch (error) {
      logger.warn('Error seeding exercise data:', error);
      // Continue despite errors
    }
  }

  private async seedLearningData() {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    try {
      // Seed learning paths
      const { error: pathError } = await this.client
        .from('learning_paths')
        .insert([
          { name: 'Bass Basics', description: 'Fundamental bass techniques' },
          {
            name: 'Music Theory',
            description: 'Essential music theory for bassists',
          },
        ]);
      if (pathError && pathError.code !== '42P01') throw pathError;
    } catch (error) {
      logger.warn('Error seeding learning data:', error);
      // Continue despite errors
    }
  }

  private async seedWidgetData() {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    try {
      // Seed widget configurations
      const { error: widgetError } = await this.client
        .from('widget_configurations')
        .insert([
          {
            widget_type: 'youtube_exerciser',
            default_config: {
              autoplay: false,
              loop_enabled: true,
              metronome_enabled: false,
            },
          },
        ]);
      if (widgetError && widgetError.code !== '42P01') throw widgetError;
    } catch (error) {
      logger.warn('Error seeding widget data:', error);
      // Continue despite errors
    }
  }

  async resetDatabase() {
    await this.cleanDatabase();
    await this.seedDatabase();
  }

  getClient() {
    if (!this.client) {
      throw new Error(
        'Database client not initialized. Call ensureInitialized() first.',
      );
    }
    return this.client;
  }
}

export const testDb = new TestDatabase();
