#!/bin/bash

# Script to fix Harmony5 exercise by converting its MIDI file and updating harmony_notes
# Usage: ./fix-harmony5-exercise.sh

set -e

EXERCISE_ID="5b20d609-9521-410c-a3c6-25b6fdb1831e"
HARMONY_MIDI_URL="https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/exercise-midi-files/exercises/5b20d609-9521-410c-a3c6-25b6fdb1831e/1762612419067_harmony.mid"
BPM=102
TIME_SIG_NUM=4
TIME_SIG_DEN=4
TOTAL_BARS=8
INSTRUMENT="wurlitzer"
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000}"

echo "=== Fixing Harmony5 Exercise ==="
echo "Exercise ID: $EXERCISE_ID"
echo "MIDI URL: $HARMONY_MIDI_URL"
echo "Instrument: $INSTRUMENT"
echo ""

# Get auth token from Supabase
echo "Step 1: Getting auth token..."
# For now, we'll use service role key via backend API which bypasses auth

# Step 2: Parse MIDI file
echo "Step 2: Parsing harmony MIDI..."
PARSE_RESULT=$(curl -s -X POST "$API_URL/api/v1/midi/parse" \
  -H "Content-Type: application/json" \
  -d "{
    \"midiUrl\": \"$HARMONY_MIDI_URL\",
    \"bpm\": $BPM,
    \"timeSignature\": {
      \"numerator\": $TIME_SIG_NUM,
      \"denominator\": $TIME_SIG_DEN
    },
    \"totalBars\": $TOTAL_BARS
  }")

echo "Parse result: $PARSE_RESULT"
MEASURES=$(echo "$PARSE_RESULT" | jq -c '.measures')
echo "Extracted measures: $MEASURES"
echo ""

# Step 3: Convert to harmony notes
echo "Step 3: Converting to harmony notes..."
CONVERT_RESULT=$(curl -s -X POST "$API_URL/api/v1/midi/convert-harmony" \
  -H "Content-Type: application/json" \
  -d "{
    \"measures\": $MEASURES,
    \"instrumentType\": \"$INSTRUMENT\"
  }")

echo "Convert result:"
echo "$CONVERT_RESULT" | jq .
HARMONY_NOTES=$(echo "$CONVERT_RESULT" | jq -c '.notes')
NOTES_COUNT=$(echo "$CONVERT_RESULT" | jq '.notes | length')
echo ""
echo "Extracted $NOTES_COUNT harmony notes"
echo ""

# Step 4: Update exercise with harmony notes
echo "Step 4: Updating exercise with harmony notes..."
UPDATE_RESULT=$(curl -s -X PUT "$API_URL/api/v1/exercises/$EXERCISE_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"harmony_notes\": $HARMONY_NOTES,
    \"harmony_instrument\": \"$INSTRUMENT\"
  }")

echo "Update result:"
echo "$UPDATE_RESULT" | jq .
echo ""
echo "=== Exercise fixed successfully! ==="
echo "Harmony notes count: $NOTES_COUNT"
