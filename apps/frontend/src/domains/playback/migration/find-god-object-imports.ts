#!/usr/bin/env node
/**
 * Script to find all imports of god objects in the codebase
 * Phase 6.1.1: Find all imports of god objects
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface GodObjectInfo {
  name: string;
  originalPath: string;
  newPath: string;
  imports: Array<{
    file: string;
    line: number;
    content: string;
  }>;
}

const godObjects: GodObjectInfo[] = [
  {
    name: 'SupabaseAssetClient',
    originalPath: 'services/storage/SupabaseAssetClient',
    newPath: 'services/storage/SupabaseAssetClientFacade',
    imports: [],
  },
  {
    name: 'MidiParserProcessor',
    originalPath: 'services/plugins/MidiParserProcessor',
    newPath: 'modules/midi/MidiParserProcessor',
    imports: [],
  },
  {
    name: 'MetronomeInstrumentProcessor',
    originalPath: 'services/plugins/MetronomeInstrumentProcessor',
    newPath:
      'modules/instruments/implementations/metronome/MetronomeInstrumentProcessor',
    imports: [],
  },
  {
    name: 'SalamanderVelocitySampler',
    originalPath: 'services/plugins/SalamanderVelocitySampler',
    newPath:
      'modules/instruments/implementations/harmony/SalamanderVelocitySampler',
    imports: [],
  },
  {
    name: 'RhodesVelocitySampler',
    originalPath: 'services/plugins/RhodesVelocitySampler',
    newPath:
      'modules/instruments/implementations/harmony/RhodesVelocitySampler',
    imports: [],
  },
  {
    name: 'WurlitzerVelocitySampler',
    originalPath: 'services/plugins/WurlitzerVelocitySampler',
    newPath:
      'modules/instruments/implementations/harmony/WurlitzerVelocitySampler',
    imports: [],
  },
];

function findImports(godObject: GodObjectInfo): void {
  console.log(`\n🔍 Searching for imports of ${godObject.name}...`);

  try {
    // Search for various import patterns
    const patterns = [
      `import.*${godObject.name}`,
      `from.*${godObject.name}`,
      `require.*${godObject.name}`,
    ];

    patterns.forEach((pattern) => {
      const command = `grep -rn "${pattern}" apps/frontend/src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" || true`;
      const result = execSync(command, { encoding: 'utf-8' });

      if (result) {
        const lines = result.split('\n').filter((line) => line.trim());
        lines.forEach((line) => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            const [, file, lineNum, content] = match;

            // Skip migration files and documentation
            if (
              file.includes('migration/') ||
              file.includes('.md') ||
              file.includes('GOD_OBJECTS_REFACTORING_PLAN')
            ) {
              return;
            }

            godObject.imports.push({
              file,
              line: parseInt(lineNum),
              content: content.trim(),
            });
          }
        });
      }
    });

    // Remove duplicates
    godObject.imports = Array.from(
      new Map(
        godObject.imports.map((imp) => [`${imp.file}:${imp.line}`, imp]),
      ).values(),
    );
  } catch (error) {
    console.error(`Error searching for ${godObject.name}:`, error);
  }
}

function generateReport(): string {
  let report = '# God Object Import Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  let totalImports = 0;
  const criticalFiles = new Set<string>();

  godObjects.forEach((obj) => {
    if (obj.imports.length > 0) {
      report += `## ${obj.name}\n\n`;
      report += `- **Original Path**: ${obj.originalPath}\n`;
      report += `- **New Path**: ${obj.newPath}\n`;
      report += `- **Import Count**: ${obj.imports.length}\n\n`;

      report += '### Files using this import:\n\n';

      // Group by file
      const fileGroups = new Map<string, typeof obj.imports>();
      obj.imports.forEach((imp) => {
        if (!fileGroups.has(imp.file)) {
          fileGroups.set(imp.file, []);
        }
        fileGroups.get(imp.file)!.push(imp);
      });

      fileGroups.forEach((imports, file) => {
        report += `#### ${file}\n\n`;
        imports.forEach((imp) => {
          report += `- Line ${imp.line}: \`${imp.content}\`\n`;
        });
        report += '\n';

        // Mark files that need immediate attention
        if (!file.includes('__tests__') && !file.includes('.test.')) {
          criticalFiles.add(file);
        }
      });

      totalImports += obj.imports.length;
    }
  });

  // Summary
  report += '\n## Summary\n\n';
  report += `- **Total God Object Imports**: ${totalImports}\n`;
  report += `- **Critical Files to Update**: ${criticalFiles.size}\n`;
  report += `- **Test Files**: ${totalImports - criticalFiles.size}\n\n`;

  if (criticalFiles.size > 0) {
    report += '### Critical Files (Non-Test):\n\n';
    Array.from(criticalFiles)
      .sort()
      .forEach((file) => {
        report += `- ${file}\n`;
      });
  }

  return report;
}

function generateMigrationScript(): string {
  let script = `#!/bin/bash
# Auto-generated migration script
# Phase 6.1.2: Update to use new modular imports

set -e

echo "🔄 Starting god object import migration..."

`;

  godObjects.forEach((obj) => {
    if (obj.imports.length === 0) return;

    script += `\n# Migrate ${obj.name} imports\n`;
    script += `echo "Migrating ${obj.name} imports..."\n\n`;

    // Group by file to avoid multiple sed operations on same file
    const fileGroups = new Map<string, typeof obj.imports>();
    obj.imports.forEach((imp) => {
      if (!fileGroups.has(imp.file)) {
        fileGroups.set(imp.file, []);
      }
      fileGroups.get(imp.file)!.push(imp);
    });

    fileGroups.forEach((imports, file) => {
      // Skip test files for now
      if (file.includes('__tests__') || file.includes('.test.')) {
        script += `# TODO: Update test file manually: ${file}\n`;
        return;
      }

      // Create sed commands for this file
      imports.forEach((imp) => {
        const oldPath = obj.originalPath;
        const newPath = obj.newPath;

        // Handle different import patterns
        if (imp.content.includes(`from '`) || imp.content.includes(`from "`)) {
          script += `sed -i.bak 's|${oldPath}|${newPath}|g' "${file}"\n`;
        }
      });
    });
  });

  script += `\necho "✅ Migration complete!"
echo "⚠️  Please review the changes and run tests before committing"
`;

  return script;
}

// Main execution
console.log('🚀 God Object Import Finder\n');

// Find all imports
godObjects.forEach(findImports);

// Generate report
const report = generateReport();
const reportPath = resolve(
  'apps/frontend/src/domains/playback/migration/god-object-imports.md',
);
writeFileSync(reportPath, report);
console.log(`\n✅ Report generated: ${reportPath}`);

// Generate migration script
const script = generateMigrationScript();
const scriptPath = resolve(
  'apps/frontend/src/domains/playback/migration/migrate-imports.sh',
);
writeFileSync(scriptPath, script);
execSync(`chmod +x "${scriptPath}"`);
console.log(`✅ Migration script generated: ${scriptPath}`);

// Show summary
const totalImports = godObjects.reduce(
  (sum, obj) => sum + obj.imports.length,
  0,
);
console.log(`\n📊 Summary:`);
console.log(`- Total god object imports found: ${totalImports}`);
console.log(
  `- God objects with imports: ${godObjects.filter((obj) => obj.imports.length > 0).length}`,
);
console.log('\nNext steps:');
console.log('1. Review the report: migration/god-object-imports.md');
console.log('2. Run the migration script: ./migration/migrate-imports.sh');
console.log('3. Manually update test files as needed');
console.log('4. Run tests to ensure nothing broke');
