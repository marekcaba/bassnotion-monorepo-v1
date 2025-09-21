#!/bin/bash
# Script to clean up unused imports in the playback domain
# Phase 6.2.3: Clean up unused imports

echo "🧹 Cleaning up unused imports in playback domain..."
echo ""

# Run ESLint with autofix for unused variables
echo "Running ESLint autofix for unused variables..."
cd /Users/marekcaba/Documents/Projekty\ 2024/🟣\ BassNotion/4.\ Cursor\ Project\ Folder/bassnotion-monorepo-v1

# First, get a count of issues
BEFORE_COUNT=$(pnpm eslint apps/frontend/src/domains/playback --ext .ts,.tsx --rule 'no-unused-vars: error' 2>&1 | grep -c "is defined but never used" || true)
echo "Found $BEFORE_COUNT unused imports/variables"

# Run autofix
echo ""
echo "Attempting to auto-fix unused imports..."
pnpm eslint apps/frontend/src/domains/playback --ext .ts,.tsx --fix --rule '@typescript-eslint/no-unused-vars: error' --rule 'no-unused-vars: error' 2>&1 | grep -v "warning" | head -50

# Get count after fix
AFTER_COUNT=$(pnpm eslint apps/frontend/src/domains/playback --ext .ts,.tsx --rule 'no-unused-vars: error' 2>&1 | grep -c "is defined but never used" || true)

echo ""
echo "📊 Results:"
echo "- Before: $BEFORE_COUNT unused imports"
echo "- After: $AFTER_COUNT unused imports"
echo "- Fixed: $((BEFORE_COUNT - AFTER_COUNT)) imports"

# List remaining issues that need manual review
if [ $AFTER_COUNT -gt 0 ]; then
  echo ""
  echo "⚠️  Remaining issues that need manual review:"
  pnpm eslint apps/frontend/src/domains/playback --ext .ts,.tsx --rule 'no-unused-vars: error' 2>&1 | grep "is defined but never used" | head -20
fi

echo ""
echo "✅ Cleanup complete!"