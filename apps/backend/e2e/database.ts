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
  private client: SupabaseClient;
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

    this.verifyConnection().catch((error: Error) => {
      logger.error('Failed to verify Supabase connection:', error);
      throw error;
    });
  }

  private async verifyConnection(): Promise<void> {
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

  private async createGetTablesFunction() {
    const sql = `
      CREATE OR REPLACE FUNCTION get_all_tables(schema_name text)
      RETURNS TABLE (table_name text)
      LANGUAGE plpgsql
      AS $$
      BEGIN
          RETURN QUERY
          SELECT c.relname::text
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = schema_name
          AND c.relkind = 'r';  -- 'r' means regular table
      END;
      $$;
    `;

    const { error } = await this.client.rpc('create_get_tables_function', {
      sql_command: sql,
    });

    if (error) {
      logger.error('Error creating get_all_tables function:', error);
      return false;
    }

    return true;
  }

  async cleanDatabase() {
    logger.debug('Cleaning test database...');
    try {
      // Get list of existing tables using a raw query
      let existingTables = null;
      const { data: initialTables, error: tablesError } = await this.client.rpc(
        'get_all_tables',
        { schema_name: 'public' },
      );

      if (tablesError) {
        // If the function doesn't exist, create it
        const created = await this.createGetTablesFunction();
        if (!created) {
          logger.warn(
            'Could not create get_all_tables function, assuming no tables exist',
          );
          return;
        }

        const { data: retryTables, error: retryError } = await this.client.rpc(
          'get_all_tables',
          { schema_name: 'public' },
        );

        if (retryError) {
          logger.warn('Could not fetch table list, assuming no tables exist');
          return;
        }

        existingTables = retryTables;
      } else {
        existingTables = initialTables;
      }

      const existingTableNames =
        existingTables?.map((t: any) => t.table_name) || [];
      logger.debug(`Found existing tables: ${existingTableNames.join(', ')}`);

      // Clean each table in reverse order to handle foreign key constraints
      for (const table of [...this.tables].reverse()) {
        const tableName = table.includes('.') ? table.split('.')[1] : table;

        if (existingTableNames.includes(tableName)) {
          logger.debug(`Cleaning table: ${table}`);
          const { error } = await this.client.from(table).delete();
          if (error && error.code !== '42P01') {
            // Ignore table not found errors
            logger.error(`Error cleaning table ${table}:`, error);
          }
        } else {
          logger.debug(`Skipping non-existent table: ${table}`);
        }
      }

      logger.debug('Database cleaned successfully');
    } catch (error) {
      logger.error('Failed to clean database:', error);
      // Don't throw the error, just log it and continue
      // This allows tests to proceed even if cleanup fails
      logger.warn('Continuing with tests despite cleanup failure');
    }
  }

  async seedDatabase() {
    logger.debug('Seeding test database...');
    try {
      // Create test users
      const userFactory = new UserFactory(this.client);
      await userFactory.createMany(3); // Create 3 test users

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
    return this.client;
  }
}

export const testDb = new TestDatabase();
