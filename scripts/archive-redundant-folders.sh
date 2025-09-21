#!/bin/bash

# Archive redundant folders before deletion
# This script creates a backup of folders identified as redundant
# Run with: ./scripts/archive-redundant-folders.sh

# Get the current date for archive naming
DATE=$(date +%Y%m%d_%H%M%S)
ARCHIVE_DIR="archive_cleanup_${DATE}"

# Create archive directory
echo "Creating archive directory: ${ARCHIVE_DIR}"
mkdir -p "${ARCHIVE_DIR}"

# Function to safely move folder to archive
archive_folder() {
    local folder=$1
    local description=$2
    
    if [ -d "$folder" ]; then
        echo "Archiving ${folder} - ${description}"
        # Create subdirectory in archive to preserve structure
        local archive_subdir="${ARCHIVE_DIR}/$(dirname "$folder")"
        mkdir -p "$archive_subdir"
        mv "$folder" "$archive_subdir/"
        echo "✓ Archived ${folder}"
    else
        echo "⚠️  Folder not found: ${folder}"
    fi
}

# Archive temporary folders
echo "=== Archiving Temporary Folders ==="
archive_folder "temp-downloads" "Downloaded sample files"
archive_folder "temp" "Temporary files and samples"
archive_folder "tmp" "Build artifacts"
archive_folder "dist" "Empty distribution folder"

# Archive test output folders
echo -e "\n=== Archiving Test Output Folders ==="
archive_folder "playwright-report" "Playwright test reports"
archive_folder "test-results" "Test failure artifacts"
archive_folder "screenshots" "Root level screenshots (duplicates)"

# Archive old deploy artifacts
echo -e "\n=== Archiving Deploy Artifacts ==="
archive_folder "deploy/backend" "Old backend deploy files"
archive_folder "deploy/docker/archive" "Archived Docker files"

# Archive backup folders
echo -e "\n=== Archiving Backup Folders ==="
archive_folder "backup-migrations" "Old SQL migration files"
archive_folder "backup" "Story-specific backups"

# Archive duplicate path folders (likely created by error)
echo -e "\n=== Archiving Duplicate Path Folders ==="
archive_folder "BassNotion" "Duplicate path artifact"
archive_folder "Cursor" "Duplicate path artifact"
archive_folder "Folder" "Duplicate path artifact"
archive_folder "Project" "Duplicate path artifact"

# Archive empty or misplaced folders
echo -e "\n=== Archiving Empty/Misplaced Folders ==="
archive_folder "public/samples/keyboards" "Empty keyboards folder"

# Create a cleanup log
LOG_FILE="${ARCHIVE_DIR}/cleanup_log.txt"
echo "=== Cleanup Archive Log ===" > "$LOG_FILE"
echo "Date: $(date)" >> "$LOG_FILE"
echo "Archive Directory: ${ARCHIVE_DIR}" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "Folders Archived:" >> "$LOG_FILE"
ls -la "${ARCHIVE_DIR}" >> "$LOG_FILE"

# Create tarball of archive for easy storage
echo -e "\n=== Creating Archive Tarball ==="
tar -czf "${ARCHIVE_DIR}.tar.gz" "${ARCHIVE_DIR}"
echo "✓ Created archive: ${ARCHIVE_DIR}.tar.gz"

# Summary
echo -e "\n=== Cleanup Summary ==="
echo "Archive created at: ${ARCHIVE_DIR}"
echo "Tarball created at: ${ARCHIVE_DIR}.tar.gz"
echo ""
echo "You can now:"
echo "1. Review the archived folders in ${ARCHIVE_DIR}"
echo "2. Delete the archive directory after confirming: rm -rf ${ARCHIVE_DIR}"
echo "3. Keep the tarball for future reference: ${ARCHIVE_DIR}.tar.gz"
echo ""
echo "To restore any folder from the archive:"
echo "tar -xzf ${ARCHIVE_DIR}.tar.gz"
echo "mv ${ARCHIVE_DIR}/path/to/folder ./path/to/"