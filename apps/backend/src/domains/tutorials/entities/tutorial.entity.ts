import { TutorialId } from '../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo.js';

export interface TutorialProps {
  id: TutorialId;
  title: string;
  slug: TutorialSlug;
  description: string;
  youtubeId: string;
  duration: number; // in seconds
  authorName: string;
  thumbnailUrl?: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  isActive: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Tutorial {
  private constructor(private props: TutorialProps) {}

  static create(
    props: Omit<
      TutorialProps,
      'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'tags'
    > & {
      isActive?: boolean;
      tags?: string[];
      publishedAt?: Date;
    },
  ): Tutorial {
    const now = new Date();
    return new Tutorial({
      id: TutorialId.create(),
      ...props,
      tags: props.tags || [],
      isActive: props.isActive ?? true,
      createdAt: now,
      updatedAt: now });
  }

  static reconstitute(props: TutorialProps): Tutorial {
    return new Tutorial(props);
  }

  // Getters
  get id(): TutorialId {
    return this.props.id;
  }

  get title(): string {
    return this.props.title;
  }

  get slug(): TutorialSlug {
    return this.props.slug;
  }

  get description(): string {
    return this.props.description;
  }

  get youtubeId(): string {
    return this.props.youtubeId;
  }

  get duration(): number {
    return this.props.duration;
  }

  get authorName(): string {
    return this.props.authorName;
  }

  get thumbnailUrl(): string | undefined {
    return this.props.thumbnailUrl;
  }

  get level(): 'beginner' | 'intermediate' | 'advanced' {
    return this.props.level;
  }

  get tags(): string[] {
    return [...this.props.tags];
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get publishedAt(): Date | undefined {
    return this.props.publishedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business logic methods
  isBeginnerFriendly(): boolean {
    return this.props.level === 'beginner';
  }

  getDurationInMinutes(): number {
    return Math.round(this.props.duration / 60);
  }

  hasTag(tag: string): boolean {
    return this.props.tags.includes(tag.toLowerCase());
  }

  isPublished(): boolean {
    return this.props.isActive && !!this.props.publishedAt;
  }

  canBeAccessedByUser(
    userLevel: 'beginner' | 'intermediate' | 'advanced',
  ): boolean {
    const levels = ['beginner', 'intermediate', 'advanced'];
    const userLevelIndex = levels.indexOf(userLevel);
    const tutorialLevelIndex = levels.indexOf(this.props.level);
    return userLevelIndex >= tutorialLevelIndex;
  }

  // Mutation methods
  updateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Title cannot be empty');
    }
    this.props.title = title.trim();
    this.markAsUpdated();
  }

  updateDescription(description: string): void {
    this.props.description = description.trim();
    this.markAsUpdated();
  }

  updateLevel(level: 'beginner' | 'intermediate' | 'advanced'): void {
    this.props.level = level;
    this.markAsUpdated();
  }

  addTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    if (normalizedTag && !this.props.tags.includes(normalizedTag)) {
      this.props.tags.push(normalizedTag);
      this.markAsUpdated();
    }
  }

  removeTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    const index = this.props.tags.indexOf(normalizedTag);
    if (index > -1) {
      this.props.tags.splice(index, 1);
      this.markAsUpdated();
    }
  }

  publish(): void {
    if (!this.props.publishedAt) {
      this.props.publishedAt = new Date();
      this.props.isActive = true;
      this.markAsUpdated();
    }
  }

  unpublish(): void {
    this.props.isActive = false;
    this.markAsUpdated();
  }

  private markAsUpdated(): void {
    this.props.updatedAt = new Date();
  }

  // Conversion method for persistence
  toPersistence(): any {
    return {
      id: this.props.id.value,
      title: this.props.title,
      slug: this.props.slug.value,
      description: this.props.description,
      youtube_id: this.props.youtubeId,
      duration: this.props.duration,
      author_name: this.props.authorName,
      thumbnail_url: this.props.thumbnailUrl,
      level: this.props.level,
      tags: this.props.tags,
      is_active: this.props.isActive,
      published_at: this.props.publishedAt?.toISOString(),
      created_at: this.props.createdAt.toISOString(),
      updated_at: this.props.updatedAt.toISOString() };
  }
}
