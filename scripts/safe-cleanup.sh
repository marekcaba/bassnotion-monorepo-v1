#!/bin/bash

# Safe cleanup script - removes only safe-to-delete folders
# Large audio sample folders are handled separately

echo "=== Safe Cleanup Script ==="
echo "This script removes only build artifacts and empty folders"
echo "Large audio sample folders require separate confirmation"
echo ""

# Function to safely remove folder
remove_folder() {
    local folder=$1
    local description=$2
    
    if [ -d "$folder" ]; then
        echo "Removing ${folder} - ${description}"
        rm -rf "$folder"
        echo "✓ Removed ${folder}"
    else
        echo "⚠️  Folder not found: ${folder}"
    fi
}

# Step 1: Remove empty path artifact folders
echo "=== Step 1: Removing Empty Path Artifacts ==="
remove_folder "BassNotion" "Empty path parsing artifact"
remove_folder "Cursor" "Empty path parsing artifact"
remove_folder "Folder" "Empty path parsing artifact"
remove_folder "Project" "Empty path parsing artifact"

# Step 2: Remove build artifacts
echo -e "\n=== Step 2: Removing Build Artifacts ==="
remove_folder "tmp" "Temporary build artifacts (76KB)"
remove_folder "dist" "Distribution folder (20MB - mostly node_modules)"

# Step 3: Remove test output folders
echo -e "\n=== Step 3: Removing Test Output ==="
remove_folder "playwright-report" "Test reports (772KB)"
remove_folder "test-results" "Test artifacts (8KB)"
remove_folder "screenshots" "Duplicate screenshots (160KB)"

# Step 4: Clean up old deploy artifacts
echo -e "\n=== Step 4: Removing Old Deploy Files ==="
remove_folder "deploy/backend" "Old deploy files (24KB)"
remove_folder "deploy/docker/archive" "Archived Docker files (24KB)"

# Step 5: Archive backup folders (safer than removing)
echo -e "\n=== Step 5: Archiving Backup Folders ==="
if [ -d "backup-migrations" ] || [ -d "backup" ]; then
    mkdir -p "archived-backups"
    [ -d "backup-migrations" ] && mv "backup-migrations" "archived-backups/"
    [ -d "backup" ] && mv "backup" "archived-backups/"
    echo "✓ Moved backup folders to archived-backups/"
fi

# Summary of what's left
echo -e "\n=== Cleanup Complete ==="
echo "✓ Removed empty folders and build artifacts"
echo "✓ Archived backup folders to archived-backups/"
echo ""
echo "=== Large Folders Requiring Manual Review ==="
echo "The following folders contain significant data and were NOT removed:"
echo ""
echo "1. temp-downloads/ (816MB) - Downloaded audio samples"
echo "2. temp/ (1.4GB) - Salamander piano samples"
echo "3. public/samples/keyboards/ (3.2MB) - Keyboard samples"
echo "4. public/workers/ (52KB) - Worker scripts"
echo "5. scripts/fixes/ (52KB) - Old fix scripts"
echo ""
echo "To remove these large audio folders after confirming they're in Supabase:"
echo "  rm -rf temp-downloads"
echo "  rm -rf temp"
echo ""
echo "To clean up other folders:"
echo "  rm -rf public/samples/keyboards  # If samples are in Supabase"
echo "  rm -rf scripts/fixes            # If no longer needed"