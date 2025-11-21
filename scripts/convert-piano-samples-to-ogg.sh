#!/bin/bash

###############################################################################
# Grand Piano MP3 to OGG Conversion Script
#
# Converts all Grand Piano MP3 samples to OGG Vorbis format
# - Sample rate: 32kHz
# - Quality: 3 (VBR ~96-112 kbps, good balance of quality/size)
# - Preserves directory structure (v1, v2, v3, v4, v5, v6, v7)
#
# Usage:
#   ./scripts/convert-piano-samples-to-ogg.sh [input_directory] [output_directory]
#
# If no arguments provided, uses default:
#   Input:  public/samples/salamander-edit
#   Output: public/samples/salamander-edit/ogg
#
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SAMPLE_RATE=32000
QUALITY=3

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}❌ Error: ffmpeg is not installed${NC}"
    echo -e "${YELLOW}Install it with: brew install ffmpeg${NC}"
    exit 1
fi

# Set default directories or use provided arguments
if [ $# -eq 0 ]; then
    INPUT_DIR="$PROJECT_ROOT/public/samples/salamander-edit"
    OUTPUT_DIR="$PROJECT_ROOT/public/samples/salamander-edit/ogg"
    echo -e "${BLUE}ℹ️  Using default directories${NC}"
elif [ $# -eq 2 ]; then
    INPUT_DIR="$1"
    OUTPUT_DIR="$2"
else
    echo -e "${RED}❌ Error: Invalid number of arguments${NC}"
    echo -e "${YELLOW}Usage: $0 [input_directory] [output_directory]${NC}"
    echo -e "${YELLOW}No args: Uses salamander-edit → salamander-edit/ogg${NC}"
    exit 1
fi

# Check if input directory exists
if [ ! -d "$INPUT_DIR" ]; then
    echo -e "${RED}❌ Error: Input directory does not exist: $INPUT_DIR${NC}"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Grand Piano Sample Conversion: MP3 → OGG Vorbis${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Input:${NC}        $INPUT_DIR"
echo -e "${GREEN}Output:${NC}       $OUTPUT_DIR"
echo -e "${GREEN}Sample Rate:${NC}  ${SAMPLE_RATE}Hz (32kHz)"
echo -e "${GREEN}Quality:${NC}      $QUALITY (VBR ~96-112 kbps)"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Count total files
TOTAL_FILES=$(find "$INPUT_DIR" -name "*.mp3" | wc -l | tr -d ' ')
echo -e "${YELLOW}📊 Found $TOTAL_FILES MP3 files to convert${NC}"
echo ""

# Expected layers
LAYERS=("v1" "v2" "v3" "v4" "v5" "v6" "v7")

# Counter
CONVERTED=0
FAILED=0

# Function to convert a single file
convert_file() {
    local input_file="$1"
    local relative_path="${input_file#$INPUT_DIR/}"
    local output_file="$OUTPUT_DIR/${relative_path%.mp3}.ogg"
    local output_dir=$(dirname "$output_file")

    # Create output directory if needed
    mkdir -p "$output_dir"

    # Convert using ffmpeg
    if ffmpeg -i "$input_file" \
        -ar $SAMPLE_RATE \
        -ac 1 \
        -acodec libvorbis \
        -q:a $QUALITY \
        -loglevel error \
        -y \
        "$output_file" 2>/dev/null; then

        echo -e "${GREEN}✓${NC} $relative_path"
        return 0
    else
        echo -e "${RED}✗${NC} $relative_path ${RED}(conversion failed)${NC}"
        return 1
    fi
}

# Process each layer
for layer in "${LAYERS[@]}"; do
    echo -e "${BLUE}─────────────────────────────────────────────────────────${NC}"
    echo -e "${BLUE}Processing Layer: $layer${NC}"
    echo -e "${BLUE}─────────────────────────────────────────────────────────${NC}"

    layer_dir="$INPUT_DIR/$layer"

    if [ ! -d "$layer_dir" ]; then
        echo -e "${YELLOW}⚠️  Warning: Layer directory not found: $layer${NC}"
        continue
    fi

    layer_count=0
    layer_failed=0

    # Convert all MP3 files in this layer
    while IFS= read -r -d '' mp3_file; do
        if convert_file "$mp3_file"; then
            ((layer_count++))
            ((CONVERTED++))
        else
            ((layer_failed++))
            ((FAILED++))
        fi
    done < <(find "$layer_dir" -name "*.mp3" -print0 | sort -z)

    echo -e "${GREEN}Layer $layer: $layer_count converted${NC}"
    if [ $layer_failed -gt 0 ]; then
        echo -e "${RED}Layer $layer: $layer_failed failed${NC}"
    fi
    echo ""
done

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Conversion Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Successfully converted: $CONVERTED files${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Failed: $FAILED files${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Calculate sizes
INPUT_SIZE=$(du -sh "$INPUT_DIR" | cut -f1)
OUTPUT_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
echo -e "${YELLOW}📦 Input size:  $INPUT_SIZE${NC}"
echo -e "${YELLOW}📦 Output size: $OUTPUT_SIZE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Expected file count (88 keys × 7 layers = 616)
EXPECTED_FILES=616
if [ $CONVERTED -eq $EXPECTED_FILES ]; then
    echo -e "${GREEN}🎉 Perfect! All $EXPECTED_FILES files converted successfully!${NC}"
elif [ $CONVERTED -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: Expected $EXPECTED_FILES files, but converted $CONVERTED${NC}"
else
    echo -e "${RED}❌ Error: No files were converted${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Conversion complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Upload the OGG files to Supabase storage"
echo -e "  2. Bucket path: ${BLUE}Keyboards/grand-piano/${NC}"
echo -e "  3. Ensure the bucket is public or CORS is configured"
echo ""
