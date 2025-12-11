#!/usr/bin/env node

/**
 * CC64 SUSTAIN PEDAL DIAGNOSTIC SCRIPT
 *
 * This script shows EXACT calculations for how CC64 sustain pedal data
 * extends harmony notes from their MIDI duration to pedal-up time.
 *
 * It uses REAL data from the database to demonstrate the logic.
 */

import pg from 'pg';
const { Client } = pg;

// Database connection - using pooler for better compatibility
const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres.iuuplfrktnzsbzibpfjm:MN8whatistrueloveWN@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
});

/**
 * CRITICAL CC64 LOGIC FUNCTIONS (copied from RegionProcessor.ts)
 */

/**
 * Find if CC64 pedal is DOWN when note starts OR goes DOWN during note
 * Returns the time when pedal is/goes DOWN, or null
 */
function findCC64DownDuringNote(noteStartTime, midiNoteEndTime, cc64Timeline) {
  // Check if pedal is already DOWN when note starts
  const pedalStateAtStart = getPedalStateAtTime(noteStartTime, cc64Timeline);
  if (pedalStateAtStart) {
    console.log(
      `  → Pedal already DOWN at note start (${noteStartTime.toFixed(3)}s)`,
    );
    return noteStartTime;
  }

  // Find if pedal goes DOWN during note (syncopated pedaling)
  for (const [time, isDown] of cc64Timeline) {
    if (isDown && time > noteStartTime && time < midiNoteEndTime) {
      console.log(`  → Pedal goes DOWN during note at ${time.toFixed(3)}s`);
      return time;
    }
  }

  console.log(`  → Pedal NOT down during note`);
  return null;
}

/**
 * Get pedal state at specific time (walk timeline backwards)
 */
function getPedalStateAtTime(time, cc64Timeline) {
  let currentState = false; // Pedal starts UP

  for (const [eventTime, isDown] of cc64Timeline) {
    if (eventTime > time) break;
    currentState = isDown;
  }

  return currentState;
}

/**
 * Find next CC64 UP event after given time
 */
function findNextCC64Up(fromTime, cc64Timeline) {
  for (const [time, isDown] of cc64Timeline) {
    if (time > fromTime && !isDown) {
      console.log(`  → Next pedal UP at ${time.toFixed(3)}s`);
      return time;
    }
  }
  console.log(`  → No pedal UP found after ${fromTime.toFixed(3)}s`);
  return null;
}

/**
 * MAIN CC64 EXTENSION LOGIC (from RegionProcessor line 2222-2279)
 */
function calculateNoteDuration(
  noteName,
  audioTime,
  midiDuration,
  cc64Timeline,
) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`NOTE: ${noteName} @ ${audioTime.toFixed(3)}s`);
  console.log(`MIDI duration: ${midiDuration.toFixed(3)}s`);
  console.log(`MIDI would end at: ${(audioTime + midiDuration).toFixed(3)}s`);
  console.log(`${'='.repeat(80)}`);

  let actualDuration = midiDuration; // Start with MIDI duration

  if (cc64Timeline.size === 0) {
    console.log('⚠️  No CC64 timeline - using MIDI duration');
    return { actualDuration, extended: false, reason: 'No CC64 data' };
  }

  console.log(`\n📊 CC64 Timeline (${cc64Timeline.size} events):`);
  for (const [time, isDown] of cc64Timeline) {
    console.log(
      `  ${time.toFixed(3)}s: ${isDown ? '🔽 PEDAL DOWN' : '🔼 PEDAL UP'}`,
    );
  }

  console.log(`\n🔍 Checking pedal state during note...`);

  const midiNoteEndTime = audioTime + midiDuration;
  const pedalDownTime = findCC64DownDuringNote(
    audioTime,
    midiNoteEndTime,
    cc64Timeline,
  );

  if (pedalDownTime === null) {
    console.log(`\n❌ Pedal NOT down during note - using MIDI duration`);
    return { actualDuration, extended: false, reason: 'Pedal not active' };
  }

  console.log(
    `\n✅ Pedal IS down during note (at ${pedalDownTime.toFixed(3)}s)`,
  );
  console.log(`🔍 Finding when pedal goes UP...`);

  const pedalUpTime = findNextCC64Up(pedalDownTime, cc64Timeline);

  if (pedalUpTime === null) {
    console.log(`\n⚠️  No pedal UP found - note sustains indefinitely`);
    return {
      actualDuration: 10.0,
      extended: true,
      reason: 'No pedal UP (sustain forever)',
    };
  }

  const sustainDuration = pedalUpTime - audioTime;

  console.log(`\n📐 Calculating duration:`);
  console.log(`  Pedal UP time: ${pedalUpTime.toFixed(3)}s`);
  console.log(
    `  Sustain duration: ${pedalUpTime.toFixed(3)}s - ${audioTime.toFixed(3)}s = ${sustainDuration.toFixed(3)}s`,
  );

  if (sustainDuration <= 0) {
    console.log(
      `\n❌ Edge case: Note starts after pedal UP - using MIDI duration`,
    );
    return { actualDuration, extended: false, reason: 'Note after pedal UP' };
  }

  console.log(`\n🎯 Applying sustain pedal rule:`);
  console.log(`  MIDI note ends at: ${midiNoteEndTime.toFixed(3)}s`);
  console.log(`  Pedal UP at:       ${pedalUpTime.toFixed(3)}s`);

  if (pedalUpTime > midiNoteEndTime) {
    // EXTEND NOTE - pedal UP after MIDI note-off
    actualDuration = sustainDuration;
    const extension = actualDuration - midiDuration;

    console.log(`\n✅ PEDAL EXTENDS NOTE!`);
    console.log(`  Original duration: ${midiDuration.toFixed(3)}s`);
    console.log(`  Extended duration: ${actualDuration.toFixed(3)}s`);
    console.log(`  Extension:         +${extension.toFixed(3)}s`);

    if (pedalDownTime > audioTime) {
      console.log(`  Type: MID-SUSTAIN (pedal went down during note)`);
    } else {
      console.log(`  Type: FULL-SUSTAIN (pedal already down at start)`);
    }

    return {
      actualDuration,
      extended: true,
      reason: 'Pedal extends note',
      extension,
    };
  } else {
    // IGNORE PEDAL - pedal UP before MIDI note-off (legato pedaling)
    console.log(`\n❌ PEDAL UP WHILE NOTE HELD (legato pedaling)`);
    console.log(`  Pedal UP before note ends - using MIDI duration`);
    console.log(`  This is typical for overlapping chords`);

    return {
      actualDuration,
      extended: false,
      reason: 'Legato pedaling (pedal UP before note-off)',
    };
  }
}

/**
 * Parse CC64 control changes from harmony_data JSON
 */
function parseCC64Timeline(harmonyData) {
  if (!harmonyData?.controlChanges?.CC64) {
    return new Map();
  }

  const timeline = new Map();

  // CC64 values: 0-63 = UP, 64-127 = DOWN
  harmonyData.controlChanges.CC64.forEach((event) => {
    const isDown = event.value >= 64;
    timeline.set(event.time, isDown);
  });

  // Sort by time
  return new Map([...timeline.entries()].sort((a, b) => a[0] - b[0]));
}

/**
 * Main diagnostic function
 */
async function runDiagnostic() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get exercise with harmony_data containing CC64
    const result = await client.query(`
      SELECT
        id,
        title,
        harmony_notes,
        harmony_data
      FROM exercises
      WHERE harmony_data IS NOT NULL
        AND harmony_data::text LIKE '%CC64%'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No exercises found with CC64 data');
      return;
    }

    const exercise = result.rows[0];
    console.log('🎵 EXERCISE:', exercise.title);
    console.log('🆔 ID:', exercise.id);
    console.log('\n' + '='.repeat(80));

    // Parse CC64 timeline
    const cc64Timeline = parseCC64Timeline(exercise.harmony_data);

    if (cc64Timeline.size === 0) {
      console.log('❌ No CC64 events found in harmony_data');
      return;
    }

    console.log(`\n📊 FULL CC64 TIMELINE (${cc64Timeline.size} events):`);
    console.log('='.repeat(80));
    for (const [time, isDown] of cc64Timeline) {
      console.log(
        `${time.toFixed(3)}s: ${isDown ? '🔽 PEDAL DOWN (value ≥64)' : '🔼 PEDAL UP (value <64)'}`,
      );
    }

    // Get some example notes from harmony_notes
    const harmonyNotes = exercise.harmony_notes || [];

    if (harmonyNotes.length === 0) {
      console.log('\n❌ No harmony notes found');
      return;
    }

    console.log(
      `\n🎹 HARMONY NOTES (showing first 10 of ${harmonyNotes.length}):`,
    );
    console.log('='.repeat(80));

    // Show first 10 notes with their calculations
    const notesToShow = harmonyNotes.slice(0, 10);

    for (const note of notesToShow) {
      const result = calculateNoteDuration(
        note.name,
        note.time,
        note.duration,
        cc64Timeline,
      );

      console.log(`\n📝 RESULT:`);
      console.log(`  Final duration: ${result.actualDuration.toFixed(3)}s`);
      console.log(`  Extended: ${result.extended ? '✅ YES' : '❌ NO'}`);
      console.log(`  Reason: ${result.reason}`);
      if (result.extension) {
        console.log(`  Extension: +${result.extension.toFixed(3)}s`);
      }
    }

    // Summary statistics
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY STATISTICS');
    console.log('='.repeat(80));

    let extendedCount = 0;
    let totalExtension = 0;
    let maxExtension = 0;

    for (const note of harmonyNotes) {
      const result = calculateNoteDuration(
        note.name,
        note.time,
        note.duration,
        cc64Timeline,
      );

      if (result.extended && result.extension) {
        extendedCount++;
        totalExtension += result.extension;
        maxExtension = Math.max(maxExtension, result.extension);
      }
    }

    console.log(`Total notes:          ${harmonyNotes.length}`);
    console.log(
      `Extended by CC64:     ${extendedCount} (${((extendedCount / harmonyNotes.length) * 100).toFixed(1)}%)`,
    );
    console.log(`Not extended:         ${harmonyNotes.length - extendedCount}`);
    if (extendedCount > 0) {
      console.log(
        `Average extension:    ${(totalExtension / extendedCount).toFixed(3)}s`,
      );
      console.log(`Maximum extension:    ${maxExtension.toFixed(3)}s`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Diagnostic complete!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

// Run diagnostic
runDiagnostic();
