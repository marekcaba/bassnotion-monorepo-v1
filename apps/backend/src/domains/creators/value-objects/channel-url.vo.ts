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
      /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/@[a-zA-Z0-9_-]+$/,
      /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/[a-zA-Z0-9_-]+$/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  }

  extractChannelId(): string | null {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = this.value.match(pattern);
      if (match && match[1]) return match[1];
    }

    return null;
  }

  getChannelType(): 'channel' | 'c' | 'user' | 'handle' | null {
    if (this.value.includes('/channel/')) return 'channel';
    if (this.value.includes('/c/')) return 'c';
    if (this.value.includes('/user/')) return 'user';
    if (this.value.includes('/@')) return 'handle';
    return null;
  }

  equals(other: ChannelUrl): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
