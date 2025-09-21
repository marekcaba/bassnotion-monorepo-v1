#!/bin/bash

# Update GlobalSampleCache imports from services to modules
echo "Updating GlobalSampleCache imports..."

# Find and replace imports
find apps/frontend/src -type f -name "*.ts" -o -name "*.tsx" | while read file; do
  # Update GlobalSampleCache imports
  sed -i '' 's|@/domains/playback/services/storage/GlobalSampleCache|@/domains/playback/modules/storage/cache/GlobalSampleCache|g' "$file"
  
  # Update CachedToneBufferLoader imports (if any direct imports exist)
  sed -i '' 's|@/domains/playback/services/storage/CachedToneBufferLoader|@/domains/playback/modules/storage/loaders/SampleLoader|g' "$file"
done

echo "Import updates complete!"

# List files that still import from services/storage
echo -e "\nFiles still importing from services/storage:"
grep -r "from.*playback/services/storage" apps/frontend/src --include="*.ts" --include="*.tsx" | grep -v "node_modules" | sort | uniq

echo -e "\nDone!"