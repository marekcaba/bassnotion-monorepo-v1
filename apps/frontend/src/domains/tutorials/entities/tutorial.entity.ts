import { TutorialId } from '../value-objects/tutorial-id.vo';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo';
import { TutorialLevel, TutorialLevelType } from '../value-objects/tutorial-level.vo';

export interface TutorialSection {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  exerciseIds?: string[];
}

export interface TutorialProps {
  id: TutorialId;
  title: string;
  slug: TutorialSlug;
  description: string;
  youtubeId: string;
  duration: number; // in seconds
  authorName: string;
  thumbnailUrl?: string;
  level: TutorialLevel;
  tags: string[];
  isActive: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  sections?: TutorialSection[];
  viewCount?: number;
}

export class Tutorial {
  private constructor(private readonly _props: TutorialProps) {
    Object.freeze(this);
  }

  static create(
    props: Omit<
      TutorialProps,
      'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'tags' | 'viewCount'
    > & {
      isActive?: boolean;
      tags?: string[];
      sections?: TutorialSection[];
      viewCount?: number;
    }
  ): Tutorial {
    const now = new Date();
    return new Tutorial({
      id: TutorialId.create(),
      ...props,
      tags: props.tags || [],
      isActive: props.isActive ?? true,
      viewCount: props.viewCount ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: TutorialProps): Tutorial {
    return new Tutorial(props);
  }

  // Getters
  get id(): TutorialId {
    return this._props.id;
  }

  get title(): string {
    return this._props.title;
  }

  get slug(): TutorialSlug {
    return this._props.slug;
  }

  get description(): string {
    return this._props.description;
  }

  get youtubeId(): string {
    return this._props.youtubeId;
  }

  get duration(): number {
    return this._props.duration;
  }

  get authorName(): string {
    return this._props.authorName;
  }

  get thumbnailUrl(): string | undefined {
    return this._props.thumbnailUrl;
  }

  get level(): TutorialLevel {
    return this._props.level;
  }

  get tags(): string[] {
    return [...this._props.tags];
  }

  get isActive(): boolean {
    return this._props.isActive;
  }

  get publishedAt(): Date | undefined {
    return this._props.publishedAt;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  get sections(): TutorialSection[] {
    return this._props.sections ? [...this._props.sections] : [];
  }

  get viewCount(): number {
    return this._props.viewCount || 0;
  }

  // Business logic methods
  isBeginnerFriendly(): boolean {
    return this._props.level.value === 'beginner';
  }

  getDurationInMinutes(): number {
    return Math.round(this._props.duration / 60);
  }

  getDurationFormatted(): string {
    const minutes = Math.floor(this._props.duration / 60);
    const seconds = this._props.duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  hasTag(tag: string): boolean {
    return this._props.tags.includes(tag.toLowerCase());
  }

  isPublished(): boolean {
    return this._props.isActive && !!this._props.publishedAt;
  }

  canBeAccessedByUser(userLevel: TutorialLevelType): boolean {
    const userLevelObj = TutorialLevel.create(userLevel);
    return userLevelObj.canAccessLevel(this._props.level);
  }

  isLongForm(): boolean {
    return this._props.duration > 1200; // > 20 minutes
  }

  isShortForm(): boolean {
    return this._props.duration <= 600; // <= 10 minutes
  }

  hasSections(): boolean {
    return (this._props.sections?.length || 0) > 0;
  }

  getSectionCount(): number {
    return this._props.sections?.length || 0;
  }

  getTotalExerciseCount(): number {
    if (!this._props.sections) return 0;
    return this._props.sections.reduce(
      (total, section) => total + (section.exerciseIds?.length || 0),
      0
    );
  }

  getSectionAtTime(timeInSeconds: number): TutorialSection | undefined {
    if (!this._props.sections) return undefined;
    return this._props.sections.find(
      section => timeInSeconds >= section.startTime && timeInSeconds < section.endTime
    );
  }

  isPopular(): boolean {
    return this.viewCount > 1000;
  }

  // Factory method for creating from API response
  static fromDTO(dto: any): Tutorial {
    return Tutorial.reconstitute({
      id: TutorialId.create(dto.id),
      title: dto.title,
      slug: TutorialSlug.create(dto.slug),
      description: dto.description,
      youtubeId: dto.youtube_id,
      duration: dto.duration,
      authorName: dto.author_name,
      thumbnailUrl: dto.thumbnail_url,
      level: TutorialLevel.create(dto.level),
      tags: dto.tags || [],
      isActive: dto.is_active ?? true,
      publishedAt: dto.published_at ? new Date(dto.published_at) : undefined,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
      sections: dto.sections,
      viewCount: dto.view_count,
    });
  }

  // Method to convert to API request format
  toDTO(): any {
    return {
      id: this._props.id.value,
      title: this._props.title,
      slug: this._props.slug.value,
      description: this._props.description,
      youtube_id: this._props.youtubeId,
      duration: this._props.duration,
      author_name: this._props.authorName,
      thumbnail_url: this._props.thumbnailUrl,
      level: this._props.level.value,
      tags: this._props.tags,
      is_active: this._props.isActive,
      published_at: this._props.publishedAt?.toISOString(),
      created_at: this._props.createdAt.toISOString(),
      updated_at: this._props.updatedAt.toISOString(),
      sections: this._props.sections,
      view_count: this._props.viewCount,
    };
  }
}