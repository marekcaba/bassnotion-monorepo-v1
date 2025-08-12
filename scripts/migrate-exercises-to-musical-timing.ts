#!/usr/bin/env ts-node

/**
 * Migration Script: Millisecond Timing → Musical Timing System
 *
 * Converts existing exercises from millisecond-based duration/timestamp
 * to musical note durations and positional timing.
 *
 * USAGE:
 *   pnpm ts-node scripts/migrate-exercises-to-musical-timing.ts
 *
 * SAFETY:
 *   - Creates backup before migration
 *   - Validates all exercises before applying changes
 *   - Provides rollback capability
 *   - Logs all changes for audit trail
 */

import { createClient } from '@supabase/supabase-js';
import {
  ExerciseMigration,
  MusicalTimeConverter,
  type DatabaseExercise,
  type ExerciseNote,
  type NoteDuration,
  type MusicalPosition,
  type TimeSignature,
} from '../libs/contracts/src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKUP_DIR = path.join(__dirname, '../backups');
const LOG_FILE = path.join(__dirname, '../logs/migration.log');

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Logging utility
function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  console.log(logMessage);

  // Ensure logs directory exists
  const logsDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Append to log file
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Create backup of current exercises
async function createBackup(): Promise<string> {
  log('Creating backup of current exercises...');

  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch exercises for backup: ${error.message}`);
  }

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(
    BACKUP_DIR,
    `exercises-backup-${timestamp}.json`,
  );

  fs.writeFileSync(backupFile, JSON.stringify(exercises, null, 2));
  log(`✅ Backup created: ${backupFile} (${exercises?.length || 0} exercises)`);

  return backupFile;
}

// Analyze exercise data to determine migration strategy
async function analyzeExercises() {
  log('Analyzing existing exercises...');

  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch exercises: ${error.message}`);
  }

  if (!exercises || exercises.length === 0) {
    log('No exercises found in database');
    return { total: 0, needsMigration: 0, alreadyMigrated: 0 };
  }

  let needsMigration = 0;
  let alreadyMigrated = 0;
  let hasInvalidData = 0;

  for (const exercise of exercises) {
    try {
      const isAlreadyMusical =
        ExerciseMigration.isMusicalTimingExercise(exercise);
      if (isAlreadyMusical) {
        alreadyMigrated++;
      } else {
        // Check if it has valid legacy timing data
        if (
          exercise.notes &&
          Array.isArray(exercise.notes) &&
          exercise.notes.length > 0
        ) {
          const hasValidTiming = exercise.notes.every(
            (note: any) =>
              typeof note.timestamp === 'number' &&
              typeof note.duration === 'number',
          );
          if (hasValidTiming) {
            needsMigration++;
          } else {
            hasInvalidData++;
            log(`⚠️ Exercise ${exercise.id} has invalid timing data`, 'warn');
          }
        } else {
          hasInvalidData++;
          log(
            `⚠️ Exercise ${exercise.id} has no notes or invalid notes array`,
            'warn',
          );
        }
      }
    } catch (error) {
      hasInvalidData++;
      log(`⚠️ Error analyzing exercise ${exercise.id}: ${error}`, 'warn');
    }
  }

  log(`📊 Analysis complete:`);
  log(`   Total exercises: ${exercises.length}`);
  log(`   Already migrated: ${alreadyMigrated}`);
  log(`   Need migration: ${needsMigration}`);
  log(`   Invalid data: ${hasInvalidData}`);

  return {
    total: exercises.length,
    needsMigration,
    alreadyMigrated,
    hasInvalidData,
  };
}

// Migrate a single exercise
function migrateExercise(exercise: any): DatabaseExercise | null {
  try {
    // Skip if already migrated
    if (ExerciseMigration.isMusicalTimingExercise(exercise)) {
      return null;
    }

    // Validate legacy data
    if (
      !exercise.notes ||
      !Array.isArray(exercise.notes) ||
      exercise.notes.length === 0
    ) {
      throw new Error('No valid notes found');
    }

    const hasValidTiming = exercise.notes.every(
      (note: any) =>
        typeof note.timestamp === 'number' && typeof note.duration === 'number',
    );

    if (!hasValidTiming) {
      throw new Error('Invalid legacy timing data');
    }

    // Use migration utility
    const migrated = ExerciseMigration.migrateExercise(exercise);

    // Validate migrated exercise
    ExerciseMigration.validateMusicalExercise(migrated);

    return migrated;
  } catch (error) {
    log(`❌ Failed to migrate exercise ${exercise.id}: ${error}`, 'error');
    return null;
  }
}

// Perform the migration
async function performMigration(dryRun: boolean = false): Promise<void> {
  log(`${dryRun ? '🔍 DRY RUN:' : '🚀'} Starting exercise migration...`);

  // Create backup first
  if (!dryRun) {
    await createBackup();
  }

  // Fetch all exercises
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch exercises: ${error.message}`);
  }

  if (!exercises || exercises.length === 0) {
    log('No exercises to migrate');
    return;
  }

  const results = {
    processed: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const exercise of exercises) {
    results.processed++;
    log(
      `Processing exercise ${results.processed}/${exercises.length}: ${exercise.id}`,
    );

    // Attempt migration
    const migrated = migrateExercise(exercise);

    if (!migrated) {
      results.skipped++;
      continue;
    }

    // Apply migration to database
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('exercises')
        .update({
          bpm: migrated.bpm,
          timeSignature: migrated.timeSignature,
          notes: migrated.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exercise.id);

      if (updateError) {
        log(
          `❌ Failed to update exercise ${exercise.id}: ${updateError.message}`,
          'error',
        );
        results.failed++;
        continue;
      }
    }

    results.migrated++;
    log(`✅ ${dryRun ? 'Would migrate' : 'Migrated'} exercise ${exercise.id}`);
  }

  log(`🎉 Migration ${dryRun ? 'analysis' : 'completed'}:`);
  log(`   Processed: ${results.processed}`);
  log(`   Migrated: ${results.migrated}`);
  log(`   Skipped: ${results.skipped}`);
  log(`   Failed: ${results.failed}`);
}

// Validate migrated data
async function validateMigration(): Promise<boolean> {
  log('🔍 Validating migrated data...');

  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('*');

  if (error) {
    throw new Error(
      `Failed to fetch exercises for validation: ${error.message}`,
    );
  }

  if (!exercises) {
    log('No exercises found for validation');
    return true;
  }

  let validCount = 0;
  let invalidCount = 0;

  for (const exercise of exercises) {
    try {
      if (ExerciseMigration.isMusicalTimingExercise(exercise)) {
        ExerciseMigration.validateMusicalExercise(exercise);
        validCount++;
      } else {
        // Check if it still has valid legacy format
        if (
          exercise.notes &&
          exercise.notes.every(
            (note: any) =>
              typeof note.timestamp === 'number' &&
              typeof note.duration === 'number',
          )
        ) {
          validCount++;
        } else {
          invalidCount++;
          log(
            `❌ Exercise ${exercise.id} has invalid format after migration`,
            'error',
          );
        }
      }
    } catch (error) {
      invalidCount++;
      log(`❌ Exercise ${exercise.id} validation failed: ${error}`, 'error');
    }
  }

  log(`📊 Validation results:`);
  log(`   Valid: ${validCount}`);
  log(`   Invalid: ${invalidCount}`);

  return invalidCount === 0;
}

// Rollback migration
async function rollbackMigration(backupFile: string): Promise<void> {
  log(`🔄 Rolling back migration from backup: ${backupFile}`);

  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

  let restored = 0;
  let failed = 0;

  for (const exercise of backupData) {
    const { error } = await supabase
      .from('exercises')
      .update(exercise)
      .eq('id', exercise.id);

    if (error) {
      log(
        `❌ Failed to restore exercise ${exercise.id}: ${error.message}`,
        'error',
      );
      failed++;
    } else {
      restored++;
    }
  }

  log(`🔄 Rollback completed: ${restored} restored, ${failed} failed`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';

  try {
    switch (command) {
      case 'analyze':
        await analyzeExercises();
        break;

      case 'dry-run':
        await performMigration(true);
        break;

      case 'migrate':
        await analyzeExercises();
        await performMigration(false);
        await validateMigration();
        break;

      case 'validate':
        await validateMigration();
        break;

      case 'rollback':
        const backupFile = args[1];
        if (!backupFile) {
          console.error('Usage: npm run migrate rollback <backup-file>');
          process.exit(1);
        }
        await rollbackMigration(backupFile);
        break;

      default:
        console.log(
          'Usage: npm run migrate [analyze|dry-run|migrate|validate|rollback <backup-file>]',
        );
        console.log('');
        console.log('Commands:');
        console.log('  analyze   - Analyze current exercise data');
        console.log('  dry-run   - Simulate migration without changes');
        console.log('  migrate   - Perform full migration with backup');
        console.log('  validate  - Validate migrated data');
        console.log('  rollback  - Restore from backup file');
        break;
    }
  } catch (error) {
    log(`💥 Migration failed: ${error}`, 'error');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
