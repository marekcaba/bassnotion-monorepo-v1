# Voice Sample Upload Guide

## 🎤 Voice Sample Requirements

You need to upload **4 voice sample files** to Supabase for the countdown system to work.

### Required Files

| Filename    | Content                     | Duration | Size  | Notes                            |
| ----------- | --------------------------- | -------- | ----- | -------------------------------- |
| `one.ogg`   | Female voice saying "One"   | ~0.67s   | 11KB  | Clear pronunciation, upbeat tone |
| `two.ogg`   | Female voice saying "Two"   | ~0.64s   | 11KB  | Match energy of "one"            |
| `three.ogg` | Female voice saying "Three" | ~0.64s   | 4.5KB | Match energy of "one"            |
| `four.ogg`  | Female voice saying "Four"  | ~0.76s   | 11KB  | Match energy of "one"            |

### Audio Specifications

- **Format:** OGG Vorbis (optimized for web audio)
- **Sample Rate:** 44.1kHz (standard)
- **Codec Quality:** Level 4 (good balance of quality and size)
- **Channels:** Stereo (converted from source)
- **Normalization:** Peak normalize to -3dB to prevent clipping
- **Attack Timing:** Sound should start within 50ms (tight onset for sync)
- **File Size:** ~5-11KB per file (68% smaller than MP3!)

### Voice Characteristics

- **Gender:** Female voice (warm, encouraging)
- **Tone:** Professional but friendly
- **Energy:** Moderate - not too excited, not monotone
- **Consistency:** All 4 samples should sound like the same person
- **Clarity:** Crystal clear pronunciation, no background noise
- **Accent:** Neutral (American or neutral English)

## 📤 Upload Instructions

### Step 1: Access Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click on the `audio-samples` bucket

### Step 2: Create Voice Cues Folder

1. In the `audio-samples` bucket, click **New Folder**
2. Name it: `voice-cues`
3. Click **Create**

### Step 3: Upload Voice Files

1. Navigate into the `voice-cues` folder
2. Click **Upload file**
3. Select and upload these files:
   - `one.ogg`
   - `two.ogg`
   - `three.ogg`
   - `four.ogg`

### Step 4: Verify Public Access

1. After upload, click on each file to view its details
2. Verify the **Public URL** is accessible (should be enabled if bucket is public)
3. Test one URL in your browser to ensure it downloads/plays

Expected URL format:

```
https://[your-project].supabase.co/storage/v1/object/public/audio-samples/voice-cues/one.ogg
```

## 🧪 Testing the Implementation

### Test 1: Check Sample Loading

After uploading, check the browser console for:

```
🗣️ Registering voice cue instrument configuration...
Voice cue URL: one -> https://...
Voice cue URL: two -> https://...
Voice cue URL: three -> https://...
Voice cue URL: four -> https://...
✅ Voice cue config registered
```

### Test 2: Play Countdown

1. Navigate to any exercise page (e.g., `/library/come-together/v100`)
2. Click the Play button
3. Listen for countdown: metronome clicks + voice cues ("one, two, three, four")
4. Check browser console for:
   ```
   🗣️ Voice cue countdown region added at beginning
   🎯 FAANG: Direct audio scheduled - voice cue "one"
   🎯 FAANG: Direct audio scheduled - voice cue "two"
   ```

### Test 3: Verify Synchronization

- Voice cues should be **perfectly synchronized** with metronome clicks
- Each voice sample should start **exactly** on the beat
- Volume should be balanced (voice clear but not overpowering metronome)

### Test 4: Different Time Signatures

Test with various time signatures:

- **4/4**: Should say "one, two, three, four" (4 beats)
- **3/4**: Should say "one, two, three" (3 beats)
- **5/4**: Should say "one, two, three, four, five" (5 beats - if you have "five.mp3")

## 🎨 Creating Voice Samples

### Option 1: Professional Voice Talent

- Hire voice actor from Fiverr, Voices.com, or Upwork
- Provide sample script: "Please say the numbers one through four clearly and evenly"
- Request separate files for each number
- Specify timing requirements (start speaking within 50ms)

### Option 2: Text-to-Speech (TTS)

Quick option for testing:

1. Use high-quality TTS service:
   - **ElevenLabs** (most natural, paid)
   - **Google Cloud Text-to-Speech** (good quality, affordable)
   - **Amazon Polly** (good quality, affordable)

2. Settings for natural sound:
   - Voice: Choose a female voice (e.g., "Joanna", "Nicole", "Emma")
   - Speed: Normal (1.0x)
   - Pitch: Normal
   - Emphasis: Neutral

3. Generate each number separately

4. Post-process:
   - Trim silence from beginning (< 50ms onset)
   - Normalize to -3dB
   - Export as OGG Vorbis (quality 4)

### Option 3: Record Yourself

If you have a good microphone:

1. Find a quiet room
2. Use recording software (Audacity, GarageBand, etc.)
3. Record each number separately with consistent tone
4. Edit to remove breath sounds, clicks
5. Normalize and export

## 🔧 Troubleshooting

### Problem: Voice cues not playing

**Check:**

1. Browser console for errors (F12 → Console)
2. Network tab - are OGG files loading? (F12 → Network → filter by "voice-cues")
3. Supabase bucket permissions - is `audio-samples` public?
4. File names - exact match required: `one.ogg`, `two.ogg`, `three.ogg`, `four.ogg`

**Solution:**

```typescript
// In console, check if buffers are loaded:
const coreServices = window.__globalCoreServices;
const regionProcessor = coreServices?.getRegionProcessor?.();
// Should see voiceCueBuffers Map with 4 entries
```

### Problem: Voice cues out of sync with metronome

**Likely cause:** Silent samples at start of audio file

**Solution:**

1. Open audio file in editor (Audacity)
2. Zoom in to the beginning
3. Trim any silence before the voice starts
4. Ensure voice starts within first 50ms
5. Re-export and re-upload

### Problem: Voice too quiet or too loud

**Adjust in code:**

In `RegionProcessor.ts`, line 1312:

```typescript
const baseVolume = 0.8; // Change this: 0.0-1.0
```

Or in `VoiceCueInstrument.ts`, line 78 (constructor):

```typescript
volume: config?.volume ?? 0.8, // Change default volume
```

### Problem: Voice cues load but don't trigger

**Check:**

1. Is countdown enabled? (Should be by default)
2. Are there errors in `AudioEventRouter`? Check console
3. Is voice-cue instrument registered? Check PreloadableInstrumentRegistry

**Debug:**

```typescript
// In console:
const registry = window.__preloadableRegistry;
registry.hasConfig('voice-cue'); // Should return true
```

## 📊 Expected File Sizes

Based on the sample manifest configuration:

| File        | Actual Size | Format Details                   |
| ----------- | ----------- | -------------------------------- |
| `one.ogg`   | 11KB        | Vorbis quality 4, 44.1kHz stereo |
| `two.ogg`   | 11KB        | Vorbis quality 4, 44.1kHz stereo |
| `three.ogg` | 4.5KB       | Vorbis quality 4, 44.1kHz stereo |
| `four.ogg`  | 11KB        | Vorbis quality 4, 44.1kHz stereo |
| **Total**   | **37.5KB**  | **68% smaller than MP3!**        |

Benefits of OGG Vorbis format:

- Superior compression (68% smaller than MP3)
- Better audio quality at lower bitrates
- Native browser support (all modern browsers)
- Faster download and parsing

## ✅ Success Checklist

Before considering the implementation complete:

- [ ] All 4 voice files uploaded to `audio-samples/voice-cues/`
- [ ] Files are accessible via public URL
- [ ] Console shows voice cue config registered
- [ ] Console shows "Voice cue buffers injected"
- [ ] Countdown plays with both clicks and voice
- [ ] Voice is synchronized with metronome
- [ ] Volume balance is appropriate
- [ ] No console errors related to voice cues
- [ ] Works in different time signatures (3/4, 4/4, 5/4)
- [ ] Tested in multiple browsers (Chrome, Safari, Firefox)

## 🎉 You're Done!

Once all files are uploaded and tests pass, your voice cue countdown system is fully operational!

The system will:

- ✅ Automatically load voice samples on page load (highest priority)
- ✅ Create voice cue track alongside metronome
- ✅ Schedule voice samples with sample-perfect timing
- ✅ Play "one, two, three, four" synchronized with clicks
- ✅ Adapt to different time signatures automatically
- ✅ Cache samples for fast subsequent loads

## 🔮 Future Enhancements

Once basic system is working, consider:

1. Multiple voice packs (different languages, voices)
2. User preference to enable/disable voice cues
3. Volume control slider for voice cues
4. Extended cues ("Ready, Go!" at measure start)
5. Practice-specific encouragement phrases

---

**Need help?** Check the implementation summary in `VOICE_CUE_IMPLEMENTATION_SUMMARY.md` for technical details.
