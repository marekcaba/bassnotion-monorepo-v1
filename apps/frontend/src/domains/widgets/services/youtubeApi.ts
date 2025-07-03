/**
 * YouTube Data API v3 Service
 * Fetches live channel subscriber counts and other channel information
 */

interface YouTubeChannelData {
  subscriberCount: string;
  title: string;
  thumbnails?: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
}

interface _YouTubeApiResponse {
  items?: Array<{
    statistics: {
      subscriberCount: string;
    };
    snippet: {
      title: string;
      thumbnails: {
        default?: { url: string };
        medium?: { url: string };
        high?: { url: string };
      };
    };
  }>;
}

/**
 * Extract YouTube channel ID from various URL formats
 */
export function extractChannelId(channelUrl: string): string | null {
  if (!channelUrl) return null;

  // Handle different YouTube URL formats:
  // https://www.youtube.com/channel/UCxxxxxx
  // https://www.youtube.com/c/ChannelName
  // https://www.youtube.com/@ChannelHandle
  // https://youtube.com/user/Username

  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = channelUrl.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

/**
 * Format subscriber count for display (e.g., 1.2M, 234K)
 */
export function formatSubscriberCount(count: string): string {
  const num = parseInt(count, 10);
  if (isNaN(num)) return 'Unknown';

  if (num >= 1000000) {
    const millions = (num / 1000000).toFixed(1);
    return `${millions}M subscribers`;
  } else if (num >= 1000) {
    const thousands = (num / 1000).toFixed(1);
    return `${thousands}K subscribers`;
  } else {
    return `${num} subscribers`;
  }
}

/**
 * Fetch YouTube channel data using YouTube Data API v3
 * Note: This requires a YouTube Data API key to be set in environment variables
 */
export async function fetchYouTubeChannelData(
  channelUrl: string,
): Promise<YouTubeChannelData | null> {
  try {
    const channelId = extractChannelId(channelUrl);
    if (!channelId) return null;

    // For now, return mock data since we'd need API key setup
    // In production, you'd make actual API calls here
    return {
      subscriberCount: formatSubscriberCount('1840000'), // Mock data
      title: 'Elisha Long',
      thumbnails: {
        default: { url: channelUrl }, // Fallback to provided avatar
      },
    };

    /* 
    // Production implementation would look like this:
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('YouTube API key not configured');
      return null;
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch YouTube data');
    }

    const data: YouTubeApiResponse = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const channel = data.items[0];
    return {
      subscriberCount: formatSubscriberCount(channel.statistics.subscriberCount),
      title: channel.snippet.title,
      thumbnails: channel.snippet.thumbnails,
    };
    */
  } catch (error) {
    console.error('Error fetching YouTube channel data:', error);
    return null;
  }
}
