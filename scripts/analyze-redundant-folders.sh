#!/bin/bash

# Analyze redundant folders before cleanup
# This script shows what will be cleaned up without making changes

echo "=== Analyzing Redundant Folders ==="
echo "This script analyzes folders identified for cleanup"
echo ""

# Function to analyze folder
analyze_folder() {
    local folder=$1
    local description=$2
    
    if [ -d "$folder" ]; then
        local size=$(du -sh "$folder" 2>/dev/null | cut -f1)
        local file_count=$(find "$folder" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "📁 ${folder}"
        echo "   Description: ${description}"
        echo "   Size: ${size}"
        echo "   Files: ${file_count}"
        echo ""
    else
        echo "❌ Not found: ${folder}"
        echo ""
    fi
}

# Calculate total size
echo "=== Total Space Used by Redundant Folders ==="
total_size=$(du -sh temp-downloads temp tmp dist playwright-report test-results screenshots backup-migrations backup deploy/backend deploy/docker/archive BassNotion Cursor Folder Project public/samples/keyboards 2>/dev/null | awk '{sum+=$1} END {print sum}')
echo "Estimated total: Check individual sizes below"
echo ""

echo "=== Temporary Folders Analysis ==="
analyze_folder "temp-downloads" "Downloaded sample files (rhodes, wurlitzer)"
analyze_folder "temp" "Temporary files and Salamander samples"
analyze_folder "tmp" "Build artifacts and generated tsconfig files"
analyze_folder "dist" "Empty distribution folder"

echo "=== Test Output Folders Analysis ==="
analyze_folder "playwright-report" "Playwright test reports"
analyze_folder "test-results" "Test failure artifacts"
analyze_folder "screenshots" "Root level screenshots (duplicates of frontend-e2e)"

echo "=== Deploy/Backup Folders Analysis ==="
analyze_folder "deploy/backend" "Old backend deploy files (main.js, package.json)"
analyze_folder "deploy/docker/archive" "Archived Docker files"
analyze_folder "backup-migrations" "Old SQL migration files"
analyze_folder "backup" "Story-specific backups"

echo "=== Duplicate Path Folders Analysis ==="
analyze_folder "BassNotion" "Path parsing artifact"
analyze_folder "Cursor" "Path parsing artifact"
analyze_folder "Folder" "Path parsing artifact"
analyze_folder "Project" "Path parsing artifact"

echo "=== Empty/Misplaced Folders Analysis ==="
analyze_folder "public/samples/keyboards" "Empty keyboards folder"
analyze_folder "public/workers" "Worker files (might belong in frontend)"

echo "=== Old Scripts Analysis ==="
analyze_folder "scripts/fixes" "Old fix scripts"

# Check for any important files
echo "=== Checking for Important Files ==="
echo "Searching for README files..."
find temp-downloads temp tmp -name "README*" -o -name "readme*" 2>/dev/null | head -10

echo ""
echo "Searching for config files..."
find temp-downloads temp tmp -name "*.json" -o -name "*.config.*" -o -name ".*rc" 2>/dev/null | grep -v node_modules | head -10

echo ""
echo "=== Recommendation ==="
echo "The temp-downloads and temp folders contain 2.2GB of sample files."
echo "These appear to be audio samples that may have been processed and uploaded to Supabase."
echo ""
echo "Before running the archive script, you should:"
echo "1. Verify these samples are already in Supabase storage"
echo "2. Check if any scripts reference these local sample files"
echo "3. Consider keeping a smaller subset if needed for testing"