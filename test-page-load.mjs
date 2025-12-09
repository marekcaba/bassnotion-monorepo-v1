// Simple script to test if page loads without crashing
import { chromium } from 'playwright';

async function testPageLoad() {
  console.log('🔍 Testing page load...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ CONSOLE ERROR:', msg.text());
    }
  });

  // Listen for page errors
  page.on('pageerror', err => {
    console.log('❌ PAGE ERROR:', err.message);
  });

  try {
    console.log('📍 Navigating to page...');
    await page.goto('http://localhost:3001/library/how-to-find-notes-on-the-bass-fretboard', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('✅ Page loaded with domcontentloaded');

    // Wait a bit to see if page crashes
    await page.waitForTimeout(5000);

    console.log('✅ Page stable after 5 seconds');

    // Check if page is responsive
    const title = await page.title();
    console.log('📄 Page title:', title);

    console.log('\n✅ SUCCESS: Page loaded without crashing');

  } catch (error) {
    console.log('\n❌ FAILED:', error.message);
  }

  // Keep browser open for manual inspection
  console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);

  await browser.close();
}

testPageLoad().catch(console.error);
