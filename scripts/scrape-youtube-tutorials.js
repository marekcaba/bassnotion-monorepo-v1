/**
 * YouTube Bass Tutorial Scraper
 *
 * This script searches YouTube for bass guitar tutorials and saves results to markdown.
 * Requires YOUTUBE_API_KEY environment variable to be set.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SEARCH_QUERY = 'bass guitar tutorial';
const MAX_RESULTS = 200;
const RESULTS_PER_PAGE = 50; // YouTube API max per request

if (!YOUTUBE_API_KEY) {
  console.error('❌ Error: YOUTUBE_API_KEY environment variable is not set');
  console.error(
    'Please set it with: export YOUTUBE_API_KEY="your-api-key-here"',
  );
  process.exit(1);
}

/**
 * Fetch videos from YouTube Data API
 */
async function fetchYouTubeVideos(query, maxResults) {
  const videos = [];
  let nextPageToken = null;
  const totalPages = Math.ceil(maxResults / RESULTS_PER_PAGE);

  console.log(`🔍 Searching YouTube for: "${query}"`);
  console.log(`📊 Target: ${maxResults} videos\n`);

  for (let page = 0; page < totalPages; page++) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.append('part', 'snippet');
      url.searchParams.append('q', query);
      url.searchParams.append('type', 'video');
      url.searchParams.append('maxResults', RESULTS_PER_PAGE);
      url.searchParams.append('key', YOUTUBE_API_KEY);
      url.searchParams.append('order', 'relevance');
      url.searchParams.append('videoDuration', 'any');

      if (nextPageToken) {
        url.searchParams.append('pageToken', nextPageToken);
      }

      console.log(`📄 Fetching page ${page + 1}/${totalPages}...`);
      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `YouTube API error: ${response.status} - ${JSON.stringify(errorData)}`,
        );
      }

      const data = await response.json();

      // Extract video IDs to fetch durations
      const videoIds = data.items
        .map((item) => item.id.videoId)
        .filter(Boolean);

      // Fetch video details including duration
      const detailsUrl = new URL(
        'https://www.googleapis.com/youtube/v3/videos',
      );
      detailsUrl.searchParams.append('part', 'contentDetails,snippet');
      detailsUrl.searchParams.append('id', videoIds.join(','));
      detailsUrl.searchParams.append('key', YOUTUBE_API_KEY);

      const detailsResponse = await fetch(detailsUrl.toString());
      const detailsData = await detailsResponse.json();

      // Map video details
      const videosWithDetails = detailsData.items.map((video) => ({
        id: video.id,
        title: video.snippet.title,
        channel: video.snippet.channelTitle,
        duration: parseDuration(video.contentDetails.duration),
        url: `https://www.youtube.com/watch?v=${video.id}`,
        publishedAt: video.snippet.publishedAt,
      }));

      videos.push(...videosWithDetails);
      console.log(
        `✅ Fetched ${videosWithDetails.length} videos (Total: ${videos.length})`,
      );

      nextPageToken = data.nextPageToken;

      if (!nextPageToken || videos.length >= maxResults) {
        break;
      }

      // Rate limiting: wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Error fetching page ${page + 1}:`, error.message);
      break;
    }
  }

  return videos.slice(0, maxResults);
}

/**
 * Parse ISO 8601 duration to readable format (PT1H2M10S -> 1:02:10)
 */
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Generate markdown document from videos
 */
function generateMarkdown(videos) {
  const timestamp = new Date().toISOString().split('T')[0];

  let markdown = `# Bass Guitar Tutorials - YouTube Search Results\n\n`;
  markdown += `**Search Query:** "${SEARCH_QUERY}"\n`;
  markdown += `**Total Videos:** ${videos.length}\n`;
  markdown += `**Generated:** ${timestamp}\n\n`;
  markdown += `---\n\n`;

  videos.forEach((video, index) => {
    markdown += `## ${index + 1}. ${video.title}\n\n`;
    markdown += `- **Channel:** ${video.channel}\n`;
    markdown += `- **Duration:** ${video.duration}\n`;
    markdown += `- **Link:** [Watch on YouTube](${video.url})\n`;
    markdown += `- **Published:** ${new Date(video.publishedAt).toLocaleDateString()}\n\n`;
  });

  return markdown;
}

/**
 * Main execution
 */
async function main() {
  try {
    const videos = await fetchYouTubeVideos(SEARCH_QUERY, MAX_RESULTS);

    if (videos.length === 0) {
      console.error('❌ No videos found');
      process.exit(1);
    }

    console.log(`\n✅ Successfully fetched ${videos.length} videos`);
    console.log('📝 Generating markdown...');

    const markdown = generateMarkdown(videos);
    const outputPath = join(process.cwd(), 'bass-guitar-tutorials.md');

    writeFileSync(outputPath, markdown, 'utf-8');

    console.log(`\n🎉 Success!`);
    console.log(`📄 Markdown file saved to: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Total videos: ${videos.length}`);
    console.log(
      `   - Unique channels: ${new Set(videos.map((v) => v.channel)).size}`,
    );
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
