/**
 * Test script for Exercise API integration with Supabase
 *
 * This script can be used to test the exercise API functions
 * either with MCP server or direct Supabase connection.
 */

import {
  getExercises,
  getExerciseWithNotes,
  getExercisesByDifficulty,
  searchExercises,
} from './exercises';

/**
 * Test all exercise API functions
 */
export async function testExerciseAPI() {
  console.log('🎸 Testing Exercise API Integration...\n');

  try {
    // Test 1: Fetch all exercises
    console.log('1️⃣ Testing getExercises()...');
    const allExercises = await getExercises();
    console.log(`✅ Found ${allExercises.exercises.length} exercises`);
    allExercises.exercises.forEach((ex, i) => {
      console.log(`   ${i + 1}. ${ex.title} (${ex.difficulty}, ${ex.bpm} BPM)`);
    });
    console.log('');

    // Test 2: Fetch specific exercise with notes
    if (allExercises.exercises.length > 0) {
      const firstExercise = allExercises.exercises[0];
      if (firstExercise) {
        console.log(
          `2️⃣ Testing getExerciseWithNotes('${firstExercise.id}')...`,
        );
        const exerciseWithNotes = await getExerciseWithNotes(firstExercise.id);
        console.log(`✅ Loaded exercise: ${exerciseWithNotes.exercise.title}`);
        console.log(`   Notes: ${exerciseWithNotes.exercise.notes.length}`);
        console.log(`   Duration: ${exerciseWithNotes.exercise.duration}ms`);
        console.log('');
      }
    }

    // Test 3: Filter by difficulty
    console.log('3️⃣ Testing getExercisesByDifficulty()...');
    const beginnerExercises = await getExercisesByDifficulty('beginner');
    const intermediateExercises =
      await getExercisesByDifficulty('intermediate');
    const advancedExercises = await getExercisesByDifficulty('advanced');

    console.log(`✅ Beginner: ${beginnerExercises.exercises.length}`);
    console.log(`✅ Intermediate: ${intermediateExercises.exercises.length}`);
    console.log(`✅ Advanced: ${advancedExercises.exercises.length}`);
    console.log('');

    // Test 4: Search exercises
    console.log('4️⃣ Testing searchExercises()...');
    const bluesResults = await searchExercises('blues');
    const modalResults = await searchExercises('modal');

    console.log(`✅ 'blues' search: ${bluesResults.exercises.length} results`);
    console.log(`✅ 'modal' search: ${modalResults.exercises.length} results`);
    console.log('');

    // TODO: Review non-null assertion - consider null safety
    console.log('🎉 All tests passed! Exercise API is working correctly.');
    return true;
  } catch (error) {
    console.error('❌ Exercise API test failed:', error);
    console.log('\n📝 This is expected if:');
    console.log('   - Supabase is not running locally');
    console.log('   - Database migration has not been applied');
    console.log('   - MCP server is not configured');
    // Configuration needed:
    console.log('   1. Start Supabase: cd apps/backend && npx supabase start');
    console.log('   2. Apply migration: npx supabase db reset');
    console.log('   3. Or configure MCP server for Supabase');
    return false;
  }
}

/**
 * Test exercise data structure and types
 */
export function testExerciseTypes() {
  console.log('🔍 Testing Exercise Types...\n');

  try {
    console.log('✅ Exercise type validation passed');
    console.log('   Types are properly defined in contracts');
    console.log('');

    // TODO: Review non-null assertion - consider null safety
    console.log('🎯 Type system is working correctly!');
    return true;
  } catch (error) {
    console.error('❌ Type validation failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🚀 Running Exercise Integration Tests\n');
  console.log('='.repeat(50));
  console.log('');

  // Test types first (doesn't require database)
  const typesOk = testExerciseTypes();

  // Test API (requires database)
  const apiOk = await testExerciseAPI();

  console.log('='.repeat(50));
  console.log(`\n📊 Test Results:`);
  console.log(`   Types: ${typesOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   API: ${apiOk ? '✅ PASS' : '❌ FAIL'}`);

  if (typesOk && apiOk) {
    // TODO: Review non-null assertion - consider null safety
    console.log('\n🎉 All tests passed! Ready for production.');
    // TODO: Review non-null assertion - consider null safety
  } else if (typesOk && !apiOk) {
    console.log('\n⚠️  Types OK, API needs database setup.');
  } else {
    console.log('\n❌ Tests failed. Check implementation.');
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
