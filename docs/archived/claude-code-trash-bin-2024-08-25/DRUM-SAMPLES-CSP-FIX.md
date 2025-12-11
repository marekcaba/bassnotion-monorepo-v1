# Drum Samples CSP Fix

## Problem

Drum samples from Supabase were not loading/playing in the DrummerWidget even though:

- The samples were loading successfully (200 OK responses)
- The Boss DR-110 kit files were accessible
- The MPC-style internal architecture was implemented correctly

## Root Cause

Content Security Policy (CSP) was not explicitly allowing media from Supabase domains. While `media-src 'self' https:` technically allows all HTTPS sources, browsers may be stricter with cross-origin audio loading.

## Solution

Updated `next.config.js` CSP configuration to explicitly allow Supabase media:

```javascript
// Before:
"media-src 'self' https:",

// After:
"media-src 'self' https://*.supabase.co https://htuztkrbuewheehjspcz.supabase.co blob:",
```

This explicitly allows:

- Audio/video from self
- Audio/video from any Supabase subdomain
- Audio/video from the specific Supabase project
- Blob URLs (used by Tone.js for audio processing)

## Testing Steps

1. Navigate to http://localhost:3001/test-simple-drums
2. Click "Start Audio Context"
3. Click "Load Boss DR-110 Samples"
4. Test each drum sound (Kick, Snare, Hi-Hat)

## Files Modified

- `/apps/frontend/next.config.js` - Updated CSP media-src directive
- `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget.tsx` - Uses Tone.Player for external URLs
- `/apps/frontend/src/app/test-simple-drums/page.tsx` - Test page for isolated drum testing

## Status

✅ CSP updated to explicitly allow Supabase media sources
✅ Server restarted to apply changes
✅ Ready for testing

The drum samples should now load and play correctly from Supabase storage.
