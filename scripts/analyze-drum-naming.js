#!/usr/bin/env node

/**
 * Analyze drum sample naming patterns across all kits
 * FAANG-style approach to understanding the chaos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KITS_DIR = path.join(__dirname, '../temp/hydrogen-ready');

// Drum type patterns (order matters - most specific first)
const DRUM_PATTERNS = {
  'hihat-closed': [
    /closed[\s-_]*h(i)?[\s-_]*hat/i,
    /h(i)?[\s-_]*hat[\s-_]*closed/i,
    /hhc/i,
    /chh/i,
    /c[\s-_]*hh/i,
    /hat[\s-_]*cl/i,
    /closed/i, // if in context of other hihat files
  ],
  'hihat-open': [
    /open[\s-_]*h(i)?[\s-_]*hat/i,
    /h(i)?[\s-_]*hat[\s-_]*open/i,
    /hho/i,
    /ohh/i,
    /o[\s-_]*hh/i,
    /hat[\s-_]*op/i,
    /open/i, // if in context of other hihat files
  ],
  'hihat-pedal': [
    /pedal[\s-_]*h(i)?[\s-_]*hat/i,
    /h(i)?[\s-_]*hat[\s-_]*pedal/i,
    /foot[\s-_]*h(i)?[\s-_]*hat/i,
    /hhp/i,
    /phh/i,
  ],
  kick: [
    /kick/i,
    /bass[\s-_]*drum/i,
    /bassdrum/i,
    /b[\s-_]*d/i,
    /bd/i,
    /kik/i,
    /kk/i,
  ],
  snare: [
    /snare/i,
    /snr/i,
    /sn(?!ap)/i, // sn but not snap
    /s[\s-_]*d/i,
    /sd/i,
  ],
  rimshot: [/rim[\s-_]*shot/i, /rimshot/i, /rim/i, /rs/i],
  sidestick: [/side[\s-_]*stick/i, /sidestick/i, /stick/i, /ss/i],
  'tom-high': [
    /high[\s-_]*tom/i,
    /tom[\s-_]*high/i,
    /tom[\s-_]*1/i,
    /ht/i,
    /t1/i,
  ],
  'tom-mid': [/mid[\s-_]*tom/i, /tom[\s-_]*mid/i, /tom[\s-_]*2/i, /mt/i, /t2/i],
  'tom-low': [/low[\s-_]*tom/i, /tom[\s-_]*low/i, /tom[\s-_]*3/i, /lt/i, /t3/i],
  'tom-floor': [/floor[\s-_]*tom/i, /tom[\s-_]*floor/i, /ft/i, /floortom/i],
  crash: [
    /crash[\s-_]*2/i, // crash 2 before crash
    /crash/i,
    /crsh/i,
    /cr(?!\w)/i, // cr but not crow, cry, etc
  ],
  ride: [
    /ride[\s-_]*bell/i, // ride bell before ride
    /bell/i,
    /ride/i,
    /rd/i,
  ],
  splash: [/splash/i, /splsh/i, /spl/i],
  china: [/china/i, /chn/i],
  cowbell: [/cow[\s-_]*bell/i, /cowbell/i, /cb/i],
  clap: [/clap/i, /clp/i, /cp/i, /hand[\s-_]*clap/i],
  tambourine: [/tamb/i, /tmb/i],
  shaker: [/shaker/i, /shk/i, /shake/i],
};

// Analyze a single kit
function analyzeKit(kitPath) {
  const kitName = path.basename(kitPath);
  const analysis = {
    kit: kitName,
    totalSamples: 0,
    mapped: {},
    unmapped: [],
    patterns: {},
  };

  // Get all audio files
  const files = [];

  function scanDir(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        scanDir(path.join(dir, item.name));
      } else if (item.name.match(/\.(wav|mp3|flac|ogg)$/i)) {
        files.push({
          name: item.name,
          path: path.join(dir, item.name).replace(kitPath + '/', ''),
        });
      }
    }
  }

  scanDir(kitPath);
  analysis.totalSamples = files.length;

  // Try to map each file
  for (const file of files) {
    let mapped = false;
    const fileName = file.name.toLowerCase();

    // Try each drum type
    for (const [drumType, patterns] of Object.entries(DRUM_PATTERNS)) {
      for (const pattern of patterns) {
        if (fileName.match(pattern)) {
          if (!analysis.mapped[drumType]) {
            analysis.mapped[drumType] = [];
          }

          // Extract velocity/variation info
          const velocityMatch = fileName.match(
            /v?(\d+)|soft|med|hard|low|high/i,
          );
          let velocity = 2; // default medium

          if (velocityMatch) {
            if (velocityMatch[1]) {
              velocity = parseInt(velocityMatch[1]);
            } else if (/soft|low/i.test(velocityMatch[0])) {
              velocity = 1;
            } else if (/hard|high/i.test(velocityMatch[0])) {
              velocity = 3;
            }
          }

          analysis.mapped[drumType].push({
            file: file.path,
            velocity,
            pattern: pattern.toString(),
          });

          mapped = true;
          break;
        }
      }
      if (mapped) break;
    }

    if (!mapped) {
      analysis.unmapped.push(file.path);
    }
  }

  // Find naming patterns
  for (const [drumType, samples] of Object.entries(analysis.mapped)) {
    analysis.patterns[drumType] = samples.length;
  }

  return analysis;
}

// Main analysis
function main() {
  console.log('🔍 Drum Sample Naming Analysis');
  console.log('==============================\n');

  if (!fs.existsSync(KITS_DIR)) {
    console.error(
      '❌ No drum kits found. Run process-and-upload-hydrogen.js first',
    );
    process.exit(1);
  }

  // Get all kit directories
  const categories = fs
    .readdirSync(KITS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const allAnalysis = [];
  const globalStats = {
    totalKits: 0,
    totalSamples: 0,
    mappedSamples: 0,
    unmappedSamples: 0,
    drumTypeCoverage: {},
    commonUnmapped: {},
  };

  // Analyze each kit
  for (const category of categories) {
    const categoryPath = path.join(KITS_DIR, category.name);
    const kits = fs
      .readdirSync(categoryPath, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const kit of kits) {
      const kitPath = path.join(categoryPath, kit.name);
      const analysis = analyzeKit(kitPath);

      allAnalysis.push(analysis);
      globalStats.totalKits++;
      globalStats.totalSamples += analysis.totalSamples;
      globalStats.unmappedSamples += analysis.unmapped.length;
      globalStats.mappedSamples +=
        analysis.totalSamples - analysis.unmapped.length;

      // Track drum type coverage
      for (const drumType of Object.keys(analysis.mapped)) {
        globalStats.drumTypeCoverage[drumType] =
          (globalStats.drumTypeCoverage[drumType] || 0) + 1;
      }

      // Track common unmapped patterns
      for (const unmapped of analysis.unmapped) {
        const baseName = path.basename(unmapped).toLowerCase();
        globalStats.commonUnmapped[baseName] =
          (globalStats.commonUnmapped[baseName] || 0) + 1;
      }
    }
  }

  // Print results
  console.log('📊 Global Statistics:');
  console.log(`Total kits: ${globalStats.totalKits}`);
  console.log(`Total samples: ${globalStats.totalSamples}`);
  console.log(
    `Mapped samples: ${globalStats.mappedSamples} (${((globalStats.mappedSamples / globalStats.totalSamples) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Unmapped samples: ${globalStats.unmappedSamples} (${((globalStats.unmappedSamples / globalStats.totalSamples) * 100).toFixed(1)}%)`,
  );

  console.log('\n🥁 Drum Type Coverage:');
  const sortedCoverage = Object.entries(globalStats.drumTypeCoverage).sort(
    (a, b) => b[1] - a[1],
  );

  for (const [drumType, count] of sortedCoverage) {
    const percentage = ((count / globalStats.totalKits) * 100).toFixed(1);
    console.log(
      `  ${drumType}: ${count}/${globalStats.totalKits} kits (${percentage}%)`,
    );
  }

  console.log('\n❓ Common Unmapped Samples:');
  const sortedUnmapped = Object.entries(globalStats.commonUnmapped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  for (const [sample, count] of sortedUnmapped) {
    if (count > 1) {
      console.log(`  "${sample}" - found in ${count} kits`);
    }
  }

  // Save detailed analysis
  const outputPath = path.join(__dirname, '../temp/drum-analysis.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        summary: globalStats,
        kits: allAnalysis,
      },
      null,
      2,
    ),
  );

  console.log(`\n📄 Detailed analysis saved to: ${outputPath}`);

  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('1. Most kits have kick, snare, and hihat-closed (core drums)');
  console.log(
    '2. Common unmapped samples need pattern rules or manual mapping',
  );
  console.log('3. Some kits use numeric naming (need special handling)');
  console.log(
    '4. Consider fallback to generic "percussion" for unmapped samples',
  );
}

// Run
main();
