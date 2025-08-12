#!/usr/bin/env node

/**
 * Test script to verify Tone.Sampler implementation
 */

import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

// Setup browser-like environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.fetch = fetch;

// Test the Tone.Sampler URLs
async function testToneSamplerUrls() {
  console.log('🎹 Testing Tone.Sampler URLs...\n');

  const baseUrl = 'https://tonejs.github.io/audio/salamander/';
  const sampleFiles = [
    'A0.mp3', 'C1.mp3', 'Ds1.mp3', 'Fs1.mp3', 'A1.mp3',
    'C2.mp3', 'Ds2.mp3', 'Fs2.mp3', 'A2.mp3', 'C3.mp3',
    'Ds3.mp3', 'Fs3.mp3', 'A3.mp3', 'C4.mp3', 'Ds4.mp3',
    'Fs4.mp3', 'A4.mp3', 'C5.mp3', 'Ds5.mp3', 'Fs5.mp3',
    'A5.mp3', 'C6.mp3', 'Ds6.mp3', 'Fs6.mp3', 'A6.mp3',
    'C7.mp3', 'Ds7.mp3', 'Fs7.mp3', 'A7.mp3', 'C8.mp3'
  ];

  let successCount = 0;
  let failCount = 0;

  for (const file of sampleFiles) {
    const url = baseUrl + file;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        console.log(`✅ ${file} - OK (${response.headers.get('content-length')} bytes)`);
        successCount++;
      } else {
        console.log(`❌ ${file} - Failed (${response.status})`);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ ${file} - Error: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`✅ Success: ${successCount}/${sampleFiles.length}`);
  console.log(`❌ Failed: ${failCount}/${sampleFiles.length}`);

  if (successCount === sampleFiles.length) {
    console.log('\n🎉 All Salamander Piano samples are accessible from Tone.js CDN!');
  } else {
    console.log('\n⚠️  Some samples are not accessible. Check the URLs.');
  }
}

// Run the test
testToneSamplerUrls().catch(console.error);