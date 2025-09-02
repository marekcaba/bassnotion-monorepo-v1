import { CreatorId } from '../value-objects/creator-id.vo.js';
import { ChannelUrl } from '../value-objects/channel-url.vo.js';

export interface CreatorProps {
  id: CreatorId;
  channelUrl: ChannelUrl;
  channelId?: string | null;
  creatorName: string;
  subscriberCount?: number;
  subscriberCountFormatted?: string;
  thumbnailUrl?: string;
  lastFetchedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCreatorProps {
  channelUrl: ChannelUrl;
  channelId?: string | null;
  creatorName: string;
  subscriberCount?: number;
  thumbnailUrl?: string;
}

export class Creator {
  private constructor(private props: CreatorProps) {}

  // Getters
  get id(): CreatorId {
    return this.props.id;
  }

  get channelUrl(): ChannelUrl {
    return this.props.channelUrl;
  }

  get channelId(): string | null | undefined {
    return this.props.channelId;
  }

  get creatorName(): string {
    return this.props.creatorName;
  }

  get subscriberCount(): number | undefined {
    return this.props.subscriberCount;
  }

  get subscriberCountFormatted(): string | undefined {
    return this.props.subscriberCountFormatted;
  }

  get thumbnailUrl(): string | undefined {
    return this.props.thumbnailUrl;
  }

  get lastFetchedAt(): Date | undefined {
    return this.props.lastFetchedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
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
      thumbnailUrl: props.thumbnailUrl,
      lastFetchedAt: now,
      createdAt: now,
      updatedAt: now });
  }

  static reconstitute(props: CreatorProps): Creator {
    return new Creator(props);
  }

  // Business logic methods
  isStale(hoursThreshold = 24): boolean {
    if (!this.props.lastFetchedAt) return true;

    const now = new Date();
    const hoursSinceLastFetch =
      (now.getTime() - this.props.lastFetchedAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastFetch >= hoursThreshold;
  }

  hasHighSubscriberCount(threshold = 100000): boolean {
    return (this.props.subscriberCount || 0) >= threshold;
  }

  isVerified(): boolean {
    // In YouTube, channels with custom URLs or certain subscriber counts are typically verified
    // This is a simplified check
    return this.hasHighSubscriberCount(100000) && !!this.props.channelId;
  }

  // Mutation methods
  updateStats(stats: {
    subscriberCount?: number;
    creatorName?: string;
    thumbnailUrl?: string;
  }): void {
    this.props.updatedAt = new Date();
    this.props.lastFetchedAt = new Date();

    if (stats.subscriberCount !== undefined) {
      this.props.subscriberCount = stats.subscriberCount;
      this.props.subscriberCountFormatted = Creator.formatSubscriberCount(
        stats.subscriberCount,
      );
    }

    if (stats.creatorName !== undefined) {
      this.props.creatorName = stats.creatorName;
    }

    if (stats.thumbnailUrl !== undefined) {
      this.props.thumbnailUrl = stats.thumbnailUrl;
    }
  }

  markAsFetched(): void {
    this.props.lastFetchedAt = new Date();
    this.props.updatedAt = new Date();
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

  // Persistence conversion
  toPersistence(): Record<string, any> {
    return {
      id: this.props.id.value,
      channel_url: this.props.channelUrl.value,
      channel_id: this.props.channelId,
      creator_name: this.props.creatorName,
      subscriber_count: this.props.subscriberCount,
      subscriber_count_formatted: this.props.subscriberCountFormatted,
      thumbnail_url: this.props.thumbnailUrl,
      last_fetched_at: this.props.lastFetchedAt?.toISOString(),
      created_at: this.props.createdAt.toISOString(),
      updated_at: this.props.updatedAt.toISOString() };
  }
}
