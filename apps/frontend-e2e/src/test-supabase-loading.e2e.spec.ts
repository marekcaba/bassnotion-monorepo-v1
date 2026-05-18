import { test, expect } from './fixtures';

test.describe('Test Supabase Sample Loading', () => {
  test('verify Supabase samples can be loaded', async ({ page }) => {
    test.setTimeout(60000); // 60 seconds

    // Go to test page
    await page.goto('http://localhost:3001/test-transport');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Test loading a single Supabase sample URL directly
    const sampleLoaded = await page.evaluate(async () => {
      try {
        const testUrl =
          'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/Keyboards/salamander/v8/C4.mp3';
        const response = await fetch(testUrl);

        console.log('Supabase fetch response:', {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch: ${response.status} ${response.statusText}`,
          );
        }

        const blob = await response.blob();
        console.log('Sample blob size:', blob.size);

        return {
          success: true,
          size: blob.size,
          type: blob.type,
        };
      } catch (error) {
        console.error('Failed to load Supabase sample:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    console.log('Sample load result:', sampleLoaded);
    expect(sampleLoaded.success).toBe(true);
    expect(sampleLoaded.size).toBeGreaterThan(0);
  });
});
