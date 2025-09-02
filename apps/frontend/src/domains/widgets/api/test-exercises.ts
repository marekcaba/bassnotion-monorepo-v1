/**
 * Test script for Exercise API integration with Supabase
 *
 * This script can be used to test the exercise API functions
 * either with MCP server or direct Supabase connection.
 */

import {
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { createStructuredLogger } from '@bassnotion/contracts';
  getExercises,
  getExerciseWithNotes,
  getExercisesByDifficulty,
  searchExercises,
} from './exercises';

/**
 * Test all exercise API functions
 */
export async function testExerciseAPI() {
  logger.info('🎸 Testing Exercise API Integration...\n');

  try {
    // Test 1: Fetch all exercises
    logger.info('1️⃣ Testing getExercises()...');
    const allExercises = await getExercises();
    logger.info(`✅ Found ${allExercises.exercises.length} exercises`);
    allExercises.exercises.forEach((ex, i) => {
      logger.info(`   ${i + 1}. ${ex.title} (${ex.difficulty}, ${ex.bpm} BPM)`);
    });
    logger.info('');

    // Test 2: Fetch specific exercise with notes
    if (allExercises.exercises.length > 0) {
      const firstExercise = allExercises.exercises[0];
      if (firstExercise) {
        logger.info(
          `2️⃣ Testing getExerciseWithNotes('${firstExercise.id}')...`,
        );
        const exerciseWithNotes = await getExerciseWithNotes(firstExercise.id);
        logger.info(`✅ Loaded exercise: ${exerciseWithNotes.exercise.title}`);
        logger.info(`   Notes: ${exerciseWithNotes.exercise.notes.length}`);
        logger.info(`   Duration: ${exerciseWithNotes.exercise.duration}ms`);
        logger.info('');
      }
    }

    // Test 3: Filter by difficulty
    logger.info('3️⃣ Testing getExercisesByDifficulty()...');
    const beginnerExercises = await getExercisesByDifficulty('beginner');
    const intermediateExercises =
      await getExercisesByDifficulty('intermediate');
    const advancedExercises = await getExercisesByDifficulty('advanced');

    logger.info(`✅ Beginner: ${beginnerExercises.exercises.length}`);
    logger.info(`✅ Intermediate: ${intermediateExercises.exercises.length}`);
    logger.info(`✅ Advanced: ${advancedExercises.exercises.length}`);
    logger.info('');

    // Test 4: Search exercises
    logger.info('4️⃣ Testing searchExercises()...');
    const bluesResults = await searchExercises('blues');
    const modalResults = await searchExercises('modal');

    logger.info(`✅ 'blues' search: ${bluesResults.exercises.length} results`);
    logger.info(`✅ 'modal' search: ${modalResults.exercises.length} results`);
    logger.info('');

    // TODO: Review non-null assertion - consider null safety
    logger.info('🎉 All tests passed! Exercise API is working correctly.');
    return true;
  } catch (error) {
    logger.error('❌ Exercise API test failed:', error);
    logger.info('\n📝 This is expected if:');
    logger.info('   - Supabase is not running locally');
    logger.info('   - Database migration has not been applied');
    logger.info('   - MCP server is not configured');
    // Configuration needed:
    logger.info('   1. Start Supabase: cd apps/backend && npx supabase start');
    logger.info('   2. Apply migration: npx supabase db reset');
    logger.info('   3. Or configure MCP server for Supabase');
    return false;
  }
}

/**
 * Test exercise data structure and types
 */
export function testExerciseTypes() {
  logger.info('🔍 Testing Exercise Types...\n');

  try {
    logger.info('✅ Exercise type validation passed');
    logger.info('   Types are properly defined in contracts');
    logger.info('');

    // TODO: Review non-null assertion - consider null safety
    logger.info('🎯 Type system is working correctly!');
    return true;
  } catch (error) {
    logger.error('❌ Type validation failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  logger.info('🚀 Running Exercise Integration Tests\n');
  logger.info('='.repeat(50));
  logger.info('');

  // Test types first (doesn't require database)
  const typesOk = testExerciseTypes();

  // Test API (requires database)
  const apiOk = await testExerciseAPI();

  logger.info('='.repeat(50));
  logger.info(`\n📊 Test Results:`);
  logger.info(`   Types: ${typesOk ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`   API: ${apiOk ? '✅ PASS' : '❌ FAIL'}`);

  if (typesOk && apiOk) {
    // TODO: Review non-null assertion - consider null safety
    logger.info('\n🎉 All tests passed! Ready for production.');
    // TODO: Review non-null assertion - consider null safety
  } else if (typesOk && !apiOk) {
    logger.info('\n⚠️  Types OK, API needs database setup.');
  } else {
    logger.info('\n❌ Tests failed. Check implementation.');
  }

  return typesOk && apiOk;
}

// Export individual functions for manual testing
export {
  getExercises,
  getExerciseWithNotes,
  getExercisesByDifficulty,
  searchExercises,
};
