export type ChannelType = 'channel' | 'c' | 'user' | 'handle';

export class ChannelUrl {
  private constructor(public readonly value: string) {
    Object.freeze(this);
  }

  static create(value: string): ChannelUrl {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new Error('Channel URL cannot be empty');
    }

    if (!this.isValidChannelUrl(trimmed)) {
      throw new Error('Invalid YouTube channel URL format');
    }

    return new ChannelUrl(trimmed);
  }

  private static isValidChannelUrl(url: string): boolean {
    // Check if it's a valid YouTube channel URL
    const patterns = [
      /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/[a-zA-Z0-9_-]+$/,
      /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/c\/[a-zA-Z0-9_-]+$/,
      /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/@[a-zA-Z0-9_.-]+$/,
      /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/[a-zA-Z0-9_-]+$/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  }

  extractChannelId(): string | null {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_.-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = this.value.match(pattern);
      if (match && match[1]) return match[1];
    }

    return null;
  }

  getChannelType(): ChannelType | null {
    if (this.value.includes('/channel/')) return 'channel';
    if (this.value.includes('/c/')) return 'c';
    if (this.value.includes('/user/')) return 'user';
    if (this.value.includes('/@')) return 'handle';
    return null;
  }

  getNormalizedUrl(): string {
    // Always return with https:// prefix
    if (!this.value.startsWith('http')) {
      return `https://${this.value}`;
    }
    return this.value;
  }

  getUsername(): string | null {
    const channelId = this.extractChannelId();
    const type = this.getChannelType();
    
    if (type === 'handle' && channelId) {
      return channelId; // Without the @ symbol
    }
    
    return null;
  }

  equals(other: ChannelUrl): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  // Static helper to create from various formats
  static fromUsername(username: string): ChannelUrl {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    return new ChannelUrl(`https://www.youtube.com/${cleanUsername}`);
  }

  static fromChannelId(channelId: string): ChannelUrl {
    return new ChannelUrl(`https://www.youtube.com/channel/${channelId}`);
  }
}