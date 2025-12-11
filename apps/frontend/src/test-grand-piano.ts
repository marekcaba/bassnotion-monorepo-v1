/**
 * Test Grand Piano Velocity Distribution
 *
 * This script tests that:
 * 1. Grand Piano configuration loads correctly
 * 2. Velocity layers are equally distributed across 0-127
 * 3. All 7 layers are properly configured
 */

import grandPianoConfig from './domains/playback/data/instruments/piano/grand-piano.json';

console.log('🎹 Grand Piano Configuration Test\n');
console.log('='.repeat(50));
console.log(`Name: ${grandPianoConfig.name}`);
console.log(`Version: ${grandPianoConfig.version}`);
console.log(
  `Total Keys: ${Object.keys(grandPianoConfig.sampleMapping).length}`,
);
console.log('='.repeat(50));

// Test velocity layer distribution
console.log('\n📊 Velocity Layer Distribution (0-127):\n');

const velocityRanges = grandPianoConfig.globalVelocityRanges;
let totalCoverage = 0;

velocityRanges.forEach((range, index) => {
  const count = range.max - range.min + 1;
  totalCoverage += count;
  console.log(
    `${range.layer}: ${String(range.min).padStart(3)} - ${String(range.max).padStart(3)} (${count} values)`,
  );
});

console.log('='.repeat(50));
console.log(`Total Coverage: ${totalCoverage} values (should be 128)`);

// Test validation
console.log('\n✅ Validation:\n');

const tests = [
  {
    name: '7 velocity layers configured',
    result: velocityRanges.length === 7,
    expected: '7 layers',
    actual: `${velocityRanges.length} layers`,
  },
  {
    name: 'Coverage is complete (0-127)',
    result: totalCoverage === 128,
    expected: '128 values',
    actual: `${totalCoverage} values`,
  },
  {
    name: 'No gaps in velocity ranges',
    result: velocityRanges.every((range, i) => {
      if (i === 0) return range.min === 0;
      return range.min === velocityRanges[i - 1].max + 1;
    }),
    expected: 'No gaps',
    actual: 'Checking...',
  },
  {
    name: 'Last layer ends at 127',
    result: velocityRanges[velocityRanges.length - 1].max === 127,
    expected: '127',
    actual: `${velocityRanges[velocityRanges.length - 1].max}`,
  },
  {
    name: '88 keys configured (A0-C8)',
    result: Object.keys(grandPianoConfig.sampleMapping).length === 88,
    expected: '88 keys',
    actual: `${Object.keys(grandPianoConfig.sampleMapping).length} keys`,
  },
  {
    name: 'EQ is configured',
    result: !!grandPianoConfig.effects?.eq,
    expected: 'EQ present',
    actual: grandPianoConfig.effects?.eq ? 'EQ present' : 'No EQ',
  },
  {
    name: 'EQ is flat (all values = 0)',
    result:
      grandPianoConfig.effects?.eq?.low === 0 &&
      grandPianoConfig.effects?.eq?.mid === 0 &&
      grandPianoConfig.effects?.eq?.high === 0,
    expected: 'All 0',
    actual: `low:${grandPianoConfig.effects?.eq?.low}, mid:${grandPianoConfig.effects?.eq?.mid}, high:${grandPianoConfig.effects?.eq?.high}`,
  },
];

tests.forEach((test) => {
  const status = test.result ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${test.name}`);
  if (!test.result) {
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Actual: ${test.actual}`);
  }
});

// Test velocity layer selection logic
console.log('\n🎯 Velocity Layer Selection Test:\n');

function getLayerForVelocity(velocity: number): string {
  const v = Math.max(0, Math.min(127, velocity));
  const range = velocityRanges.find((r) => v >= r.min && v <= r.max);
  return range ? range.layer : 'v4';
}

const testVelocities = [
  0, 1, 18, 19, 36, 37, 54, 55, 72, 73, 90, 91, 108, 109, 126, 127,
];

testVelocities.forEach((vel) => {
  const layer = getLayerForVelocity(vel);
  console.log(`Velocity ${String(vel).padStart(3)} → ${layer}`);
});

console.log('\n' + '='.repeat(50));
console.log('🎉 Grand Piano Configuration Test Complete!');
console.log('='.repeat(50));
