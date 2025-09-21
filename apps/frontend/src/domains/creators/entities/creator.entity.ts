import { CreatorId } from '../value-objects/creator-id.vo';
import { ChannelUrl } from '../value-objects/channel-url.vo';

export interface CreatorStats {
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
}

export interface CreatorProps {
  id: CreatorId;
  channelUrl: ChannelUrl;
  channelId?: string | null;
  creatorName: string;
  subscriberCount?: number;
  subscriberCountFormatted?: string;
  videoCount?: number;
  viewCount?: number;
  thumbnailUrl?: string;
  bannerUrl?: string;
  description?: string;
  country?: string;
  customUrl?: string;
  publishedAt?: Date;
  lastFetchedAt?: Date;
  isVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCreatorProps {
  channelUrl: ChannelUrl;
  channelId?: string | null;
  creatorName: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
  thumbnailUrl?: string;
  bannerUrl?: string;
  description?: string;
  country?: string;
  customUrl?: string;
  publishedAt?: Date;
  isVerified?: boolean;
}

export class Creator {
  private constructor(private readonly _props: CreatorProps) {
    Object.freeze(this);
  }

  // Factory methods
  static create(props: CreateCreatorProps): Creator {
    const now = new Date();
    return new Creator({
      id: CreatorId.create(),
      channelUrl: props.channelUrl,
      channelId: props.channelId,
      creatorName: props.creatorName,
      subscriberCount: props.subscriberCount,
      subscriberCountFormatted: props.subscriberCount
        ? Creator.formatSubscriberCount(props.subscriberCount)
        : undefined,
      videoCount: props.videoCount,
      viewCount: props.viewCount,
      thumbnailUrl: props.thumbnailUrl,
      bannerUrl: props.bannerUrl,
      description: props.description,
      country: props.country,
      customUrl: props.customUrl,
      publishedAt: props.publishedAt,
      isVerified: props.isVerified,
      lastFetchedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: CreatorProps): Creator {
    return new Creator(props);
  }

  // Getters
  get id(): CreatorId {
    return this._props.id;
  }

  get channelUrl(): ChannelUrl {
    return this._props.channelUrl;
  }

  get channelId(): string | null | undefined {
    return this._props.channelId;
  }

  get creatorName(): string {
    return this._props.creatorName;
  }

  get subscriberCount(): number | undefined {
    return this._props.subscriberCount;
  }

  get subscriberCountFormatted(): string | undefined {
    return this._props.subscriberCountFormatted;
  }

  get videoCount(): number | undefined {
    return this._props.videoCount;
  }

  get viewCount(): number | undefined {
    return this._props.viewCount;
  }

  get thumbnailUrl(): string | undefined {
    return this._props.thumbnailUrl;
  }

  get bannerUrl(): string | undefined {
    return this._props.bannerUrl;
  }

  get description(): string | undefined {
    return this._props.description;
  }

  get country(): string | undefined {
    return this._props.country;
  }

  get customUrl(): string | undefined {
    return this._props.customUrl;
  }

  get publishedAt(): Date | undefined {
    return this._props.publishedAt;
  }

  get lastFetchedAt(): Date | undefined {
    return this._props.lastFetchedAt;
  }

  get isVerified(): boolean {
    return this._props.isVerified ?? false;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  // Business logic methods
  isStale(hoursThreshold = 24): boolean {
    if (!this._props.lastFetchedAt) return true;

    const now = new Date();
    const hoursSinceLastFetch =
      (now.getTime() - this._props.lastFetchedAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastFetch >= hoursThreshold;
  }

  hasHighSubscriberCount(threshold = 100000): boolean {
    return (this._props.subscriberCount || 0) >= threshold;
  }

  isEstablished(): boolean {
    // Channel is considered established if it has:
    // - More than 10k subscribers
    // - More than 50 videos
    // - Has been active for more than 1 year
    const hasEnoughSubscribers = (this._props.subscriberCount || 0) >= 10000;
    const hasEnoughVideos = (this._props.videoCount || 0) >= 50;
    const isOldEnough = this._props.publishedAt
      ? new Date().getTime() - this._props.publishedAt.getTime() >
        365 * 24 * 60 * 60 * 1000
      : false;

    return hasEnoughSubscribers && hasEnoughVideos && isOldEnough;
  }

  getEngagementRate(): number | null {
    if (
      !this._props.viewCount ||
      !this._props.videoCount ||
      !this._props.subscriberCount
    ) {
      return null;
    }

    const avgViewsPerVideo = this._props.viewCount / this._props.videoCount;
    const engagementRate =
      (avgViewsPerVideo / this._props.subscriberCount) * 100;

    return Math.round(engagementRate * 100) / 100; // Round to 2 decimal places
  }

  getChannelAge(): { years: number; months: number } | null {
    if (!this._props.publishedAt) return null;

    const now = new Date();
    const published = new Date(this._props.publishedAt);

    let years = now.getFullYear() - published.getFullYear();
    let months = now.getMonth() - published.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    return { years, months };
  }

  getStats(): CreatorStats {
    return {
      subscriberCount: this._props.subscriberCount,
      videoCount: this._props.videoCount,
      viewCount: this._props.viewCount,
    };
  }

  // Helper methods
  private static formatSubscriberCount(count: number): string {
    if (count >= 1000000) {
      const millions = (count / 1000000).toFixed(1);
      return `${millions}M subscribers`;
    } else if (count >= 1000) {
      const thousands = (count / 1000).toFixed(1);
      return `${thousands}K subscribers`;
    } else {
      return `${count} subscribers`;
    }
  }

  // Factory method for creating from API response
  static fromDTO(dto: any): Creator {
    return Creator.reconstitute({
      id: CreatorId.create(dto.id),
      channelUrl: ChannelUrl.create(dto.channel_url),
      channelId: dto.channel_id,
      creatorName: dto.creator_name,
      subscriberCount: dto.subscriber_count,
      subscriberCountFormatted: dto.subscriber_count_formatted,
      videoCount: dto.video_count,
      viewCount: dto.view_count,
      thumbnailUrl: dto.thumbnail_url,
      bannerUrl: dto.banner_url,
      description: dto.description,
      country: dto.country,
      customUrl: dto.custom_url,
      publishedAt: dto.published_at ? new Date(dto.published_at) : undefined,
      lastFetchedAt: dto.last_fetched_at
        ? new Date(dto.last_fetched_at)
        : undefined,
      isVerified: dto.is_verified,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
    });
  }

  // Method to convert to API request format
  toDTO(): any {
    return {
      id: this._props.id.value,
      channel_url: this._props.channelUrl.value,
      channel_id: this._props.channelId,
      creator_name: this._props.creatorName,
      subscriber_count: this._props.subscriberCount,
      subscriber_count_formatted: this._props.subscriberCountFormatted,
      video_count: this._props.videoCount,
      view_count: this._props.viewCount,
      thumbnail_url: this._props.thumbnailUrl,
      banner_url: this._props.bannerUrl,
      description: this._props.description,
      country: this._props.country,
      custom_url: this._props.customUrl,
      published_at: this._props.publishedAt?.toISOString(),
      last_fetched_at: this._props.lastFetchedAt?.toISOString(),
      is_verified: this._props.isVerified,
      created_at: this._props.createdAt.toISOString(),
      updated_at: this._props.updatedAt.toISOString(),
    };
  }
}
