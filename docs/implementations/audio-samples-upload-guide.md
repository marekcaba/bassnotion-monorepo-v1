# Audio Samples Upload Guide

This guide explains how to upload professional audio samples to Supabase for use in the BassNotion platform.

## Architecture Overview

We use a secure backend API approach for uploading audio samples:

1. **Frontend**: Generates/downloads samples locally
2. **Backend API**: Authenticated endpoint with service role access
3. **Supabase Storage**: CDN-backed storage bucket for global distribution
4. **Client Loading**: Direct public URL access for fast playback

## Prerequisites

1. Backend server running with proper environment variables
2. Valid user account with authentication
3. Generated audio samples in `public/samples/` directory

## Step-by-Step Upload Process

### 1. Generate Professional Keyboard Samples

```bash
# Generate synthesized professional keyboard samples
node scripts/create-sample-soundfonts.js
```

This creates samples for:

- Salamander Grand Piano
- Nice Keys Rhodes Electric Piano
- Versilian Hammond Organ
- ZynAddSubFX Synthesizer

### 2. Start the Backend Server

```bash
# Ensure backend has SUPABASE_SERVICE_ROLE_KEY in .env.local
pnpm dev:backend
```

### 3. Get Authentication Token

```bash
# Login to get JWT token
node scripts/get-auth-token.js your-email@example.com your-password

# This will output:
# export BASSNOTION_ADMIN_TOKEN="eyJhbGc..."
```

### 4. Set the Token

```bash
# Copy and run the export command from step 3
export BASSNOTION_ADMIN_TOKEN="your-jwt-token-here"
```

### 5. Upload Samples

```bash
# Upload all keyboard samples to Supabase
node scripts/upload-keyboards-via-api.js
```

## API Endpoints

### Single Sample Upload

```
POST /api/v1/audio-samples/upload
Authorization: Bearer <token>
{
  "path": "keyboards/piano/C4.mp3",
  "buffer": "base64-encoded-file-content",
  "contentType": "audio/mpeg"
}
```

### Batch Upload

```
POST /api/v1/audio-samples/upload-batch
Authorization: Bearer <token>
{
  "samples": [
    {
      "path": "keyboards/piano/C4.mp3",
      "buffer": "base64-encoded-content",
      "contentType": "audio/mpeg"
    }
  ]
}
```

### Metadata Creation

```
POST /api/v1/audio-samples/metadata
Authorization: Bearer <token>
{
  "path": "metadata/keyboards/piano.json",
  "metadata": {
    "name": "Salamander Grand Piano",
    "samples": [...]
  }
}
```

## Security Considerations

1. **Service Role Key**: Never expose in client-side code
2. **Authentication**: All uploads require valid JWT token
3. **File Size Limits**: 10MB per file, 50MB per batch
4. **Bucket Permissions**: Public read, authenticated write

## CDN URLs

After upload, samples are available at:

```
https://[supabase-project-id].supabase.co/storage/v1/object/public/audio-samples/[path]
```

Example:

```
https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/keyboards/salamander-piano/C4.mp3
```

## Testing Uploaded Samples

1. Visit: http://localhost:3001/test-harmony
2. Click "Play" button
3. Console should show: "Loading professional samples from Supabase"
4. Audio should play with high-quality synthesized sounds

## Troubleshooting

### "Row-level security policy" Error

- Ensure you're using the backend API, not direct Supabase client
- Check that backend has SUPABASE_SERVICE_ROLE_KEY configured

### "No authentication token" Error

- Run get-auth-token.js to obtain a fresh token
- Ensure token is exported as BASSNOTION_ADMIN_TOKEN

### "Bucket not found" Error

- Verify audio-samples bucket exists in Supabase dashboard
- Check bucket has public read permissions

## Alternative: Direct Supabase Dashboard Upload

For quick testing, you can also upload directly via Supabase dashboard:

1. Go to Storage section
2. Navigate to audio-samples bucket
3. Create folders: keyboards/[instrument-name]/
4. Upload MP3 files
5. Update ChordInstrumentProcessor with correct URLs
