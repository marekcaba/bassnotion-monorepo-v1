# Story 3.16: Professional Audio Sample Scripts

This directory contains scripts for downloading, processing, and uploading professional audio samples for the BassNotion platform.

## Scripts Overview

### 1. `download-hydrogen-kits.js`

Downloads and converts Hydrogen drum kits to web-compatible formats.

**Requirements:**

- Node.js
- FFmpeg (for audio conversion)

**Usage:**

```bash
node download-hydrogen-kits.js
```

**What it does:**

- Downloads popular Hydrogen drum kits
- Extracts and converts samples to 16-bit 44.1kHz WAV
- Organizes samples by drum type and velocity layers
- Generates metadata index

### 2. `download-keyboard-sounds.js`

Downloads professional keyboard soundfonts.

**Requirements:**

- Node.js
- Internet connection (files are large)

**Usage:**

```bash
node download-keyboard-sounds.js
```

**What it does:**

- Downloads professional soundfonts (Salamander Piano, etc.)
- Creates optimization instructions
- Generates metadata for integration

### 3. `upload-to-supabase.js`

Uploads processed samples to Supabase storage.

**Requirements:**

- Node.js
- Supabase credentials in backend/.env

**Usage:**

```bash
node upload-to-supabase.js
```

**What it does:**

- Uploads drum kits to audio-samples bucket
- Uploads metadata files
- Creates admin sample structure
- Handles large file warnings

## Installation Requirements

### Install FFmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/
```

### Install Dependencies

```bash
cd ../  # Go to project root
pnpm install  # Install all project dependencies
```

## Usage Flow

1. **Download drum kits:**

   ```bash
   node download-hydrogen-kits.js
   ```

2. **Download keyboard sounds:**

   ```bash
   node download-keyboard-sounds.js
   ```

3. **Upload to Supabase:**
   ```bash
   node upload-to-supabase.js
   ```

## File Structure Created

```
apps/frontend/public/
├── drum-kits/
│   └── hydrogen/
│       ├── rock-kit/
│       │   ├── kick-v1.wav
│       │   ├── snare-v1.wav
│       │   └── ...
│       └── index.json
├── soundfonts/
│   ├── salamander-piano/
│   │   └── salamander-piano.sf2
│   └── keyboard-instruments.json
└── sample-metadata/
    ├── metronome-samples.json
    └── admin-drum-kits.json
```

## Supabase Storage Structure

```
audio-samples/
├── metadata/
│   ├── metronome-samples.json
│   └── admin-drum-kits.json
├── metronome/
│   ├── index.json
│   └── *.wav
├── drums/
│   ├── hydrogen-kits/
│   │   ├── index.json
│   │   └── */
│   └── admin-samples/
│       ├── index.json
│       └── */
└── keyboards/
    └── */
```

## Notes

- **Large Files**: Soundfonts are large (100-200MB). Consider serving from CDN.
- **Licensing**: Ensure all samples have appropriate licenses for commercial use.
- **Quality**: All drum samples are converted to 44.1kHz/16-bit for web compatibility.
- **Velocity Layers**: Drum samples include multiple velocity layers (v1, v2, v3).

## Troubleshooting

### FFmpeg not found

Install FFmpeg using your system's package manager.

### Supabase upload fails

Check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.

### Download timeouts

Large files may timeout. Consider downloading manually and running the upload script separately.

### Disk space

Ensure you have at least 1GB free space for all samples.

## Next Steps

After running these scripts:

1. Test sample loading in the application
2. Configure CDN for large soundfont files
3. Add more drum kits and samples as needed
4. Set up admin upload interface
