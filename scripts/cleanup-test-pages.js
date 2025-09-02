#!/usr/bin/env node

/**
 * Script to analyze and clean up test page variations
 * Run with: node scripts/cleanup-test-pages.js
 */

const fs = require('fs').promises;
const path = require('path');

const LIBRARY_PATH = path.join(__dirname, '..', 'apps', 'frontend', 'src', 'app', 'library', '[tutorialId]');
const APP_PATH = path.join(__dirname, '..', 'apps', 'frontend', 'src', 'app');

// Directories to keep
const KEEP_DIRS = [
  'page.tsx',
  'metadata.ts',
  '__tests__',
  'layout.tsx'
];

// Test patterns to identify test directories
const TEST_PATTERNS = [
  /^v\d+$/,           // v1, v2, v123, etc.
  /^test-/,           // test-*
  /^step\d+$/,        // step1, step2, etc.
  /-test$/,           // *-test
  /^debug/,           // debug*
  /^diagnose/,        // diagnose*
  /^fix-/,            // fix-*
  /^minimal/,         // minimal*
  /^console-/,        // console-*
  /^extension-/,      // extension-*
  /^force-/,          // force-*
  /^progressive-/,    // progressive-*
  /^render-/,         // render-*
  /^singleton-/,      // singleton-*
  /^no-/,            // no-*
];

async function analyzeTestPages() {
  console.log('🔍 Analyzing test page variations...\n');
  
  try {
    // Analyze library/[tutorialId] directory
    const libraryItems = await fs.readdir(LIBRARY_PATH);
    const testDirs = [];
    const keepItems = [];
    
    for (const item of libraryItems) {
      const itemPath = path.join(LIBRARY_PATH, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory() || (stats.isFile() && !KEEP_DIRS.includes(item))) {
        // Check if it matches test patterns
        const isTest = TEST_PATTERNS.some(pattern => pattern.test(item));
        
        if (isTest || item.endsWith('.backup.tsx') || item.endsWith('.simple.tsx')) {
          testDirs.push(item);
        } else if (!KEEP_DIRS.includes(item)) {
          // Might be a test dir with unusual name
          console.log(`⚠️  Unclear item: ${item} (review manually)`);
        } else {
          keepItems.push(item);
        }
      }
    }
    
    console.log(`📊 Found ${testDirs.length} test variations in library/[tutorialId]:`);
    console.log('Test directories to remove:', testDirs.slice(0, 10).join(', '), 
                testDirs.length > 10 ? `... and ${testDirs.length - 10} more` : '');
    console.log('\n✅ Keeping:', keepItems.join(', '));
    
    // Analyze app directory for test routes
    const appItems = await fs.readdir(APP_PATH);
    const testRoutes = appItems.filter(item => item.startsWith('test-'));
    
    console.log(`\n📊 Found ${testRoutes.length} test routes in app directory:`);
    console.log('Test routes:', testRoutes.slice(0, 10).join(', '),
                testRoutes.length > 10 ? `... and ${testRoutes.length - 10} more` : '');
    
    return { libraryTestDirs: testDirs, appTestRoutes: testRoutes };
    
  } catch (error) {
    console.error('Error analyzing directories:', error);
    return { libraryTestDirs: [], appTestRoutes: [] };
  }
}

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, '..', `test-pages-backup-${timestamp}.json`);
  
  console.log('\n📦 Creating backup list...');
  
  const { libraryTestDirs, appTestRoutes } = await analyzeTestPages();
  
  const backup = {
    timestamp: new Date().toISOString(),
    libraryPath: LIBRARY_PATH,
    appPath: APP_PATH,
    libraryTestDirs,
    appTestRoutes,
    totalItems: libraryTestDirs.length + appTestRoutes.length
  };
  
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
  console.log(`✅ Backup created: ${backupPath}`);
  
  return backup;
}

async function cleanupTestPages(dryRun = true) {
  const backup = await createBackup();
  
  if (dryRun) {
    console.log('\n🔄 DRY RUN MODE - No files will be deleted');
    console.log('To actually delete files, run: node scripts/cleanup-test-pages.js --execute');
    return;
  }
  
  console.log('\n🗑️  Starting cleanup...');
  
  let deletedCount = 0;
  
  // Delete library test directories
  for (const dir of backup.libraryTestDirs) {
    const dirPath = path.join(LIBRARY_PATH, dir);
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      deletedCount++;
      if (deletedCount % 10 === 0) {
        console.log(`Deleted ${deletedCount} items...`);
      }
    } catch (error) {
      console.error(`Failed to delete ${dir}:`, error.message);
    }
  }
  
  // Delete app test routes
  for (const route of backup.appTestRoutes) {
    const routePath = path.join(APP_PATH, route);
    try {
      await fs.rm(routePath, { recursive: true, force: true });
      deletedCount++;
      if (deletedCount % 10 === 0) {
        console.log(`Deleted ${deletedCount} items...`);
      }
    } catch (error) {
      console.error(`Failed to delete ${route}:`, error.message);
    }
  }
  
  console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} test directories/files`);
  console.log(`💾 Backup saved for reference`);
}

// Main execution
const isDryRun = !process.argv.includes('--execute');
cleanupTestPages(isDryRun).catch(console.error);