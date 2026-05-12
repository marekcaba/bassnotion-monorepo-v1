import type { AnyBlock } from '@bassnotion/contracts';
import { TutorialId } from '../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo.js';

export type TutorialStatus = 'draft' | 'published' | 'archived';

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
  // New fields for draft and MIDI support
  status?: TutorialStatus;
  lastModified?: Date;
  autoSaveVersion?: number;
  drummerMidiUrl?: string;
  basslineMidiUrl?: string;
  harmonyMidiUrl?: string;
  deletedAt?: Date;
  // Creator fields for YouTube attribution
  creatorName?: string;
  creatorChannelUrl?: string;
  creatorAvatarUrl?: string;
  creatorSubscriberCount?: number;
  category?: string;
  // Modular block system
  blocks?: AnyBlock[];
  // Act 1: Understand fields (legacy)
  understandVideoUrl?: string;
  understandVideoLibraryId?: string;
  understandHeadline?: string;
  understandQuestions?: any[];
  titleHighlightWords?: string[];
  sidebarTitle?: string;
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
      updatedAt: now,
    });
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

  // New getters for draft and MIDI support
  get status(): TutorialStatus {
    return this.props.status || 'draft';
  }

  get lastModified(): Date | undefined {
    return this.props.lastModified;
  }

  get autoSaveVersion(): number {
    return this.props.autoSaveVersion || 0;
  }

  get drummerMidiUrl(): string | undefined {
    return this.props.drummerMidiUrl;
  }

  get basslineMidiUrl(): string | undefined {
    return this.props.basslineMidiUrl;
  }

  get harmonyMidiUrl(): string | undefined {
    return this.props.harmonyMidiUrl;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  get creatorName(): string | undefined {
    return this.props.creatorName;
  }

  get creatorChannelUrl(): string | undefined {
    return this.props.creatorChannelUrl;
  }

  get creatorAvatarUrl(): string | undefined {
    return this.props.creatorAvatarUrl;
  }

  get creatorSubscriberCount(): number | undefined {
    return this.props.creatorSubscriberCount;
  }

  get category(): string | undefined {
    return this.props.category;
  }

  // Act 1: Understand getters
  get understandVideoUrl(): string | undefined {
    return this.props.understandVideoUrl;
  }

  get understandVideoLibraryId(): string | undefined {
    return this.props.understandVideoLibraryId;
  }

  get understandHeadline(): string | undefined {
    return this.props.understandHeadline;
  }

  get understandQuestions(): any[] {
    return this.props.understandQuestions || [];
  }

  get titleHighlightWords(): string[] {
    return this.props.titleHighlightWords || [];
  }

  get sidebarTitle(): string | undefined {
    return this.props.sidebarTitle;
  }

  get blocks(): AnyBlock[] {
    return this.props.blocks || [];
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
    return this.status === 'published';
  }

  isDraft(): boolean {
    return this.status === 'draft';
  }

  isArchived(): boolean {
    return this.status === 'archived';
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
      updated_at: this.props.updatedAt.toISOString(),
      // New fields for draft and MIDI support
      status: this.props.status || 'draft',
      last_modified: this.props.lastModified?.toISOString(),
      auto_save_version: this.props.autoSaveVersion || 0,
      drummer_midi_url: this.props.drummerMidiUrl,
      bassline_midi_url: this.props.basslineMidiUrl,
      harmony_midi_url: this.props.harmonyMidiUrl,
      deleted_at: this.props.deletedAt?.toISOString(),
      // Creator fields for YouTube attribution
      creator_name: this.props.creatorName,
      creator_channel_url: this.props.creatorChannelUrl,
      creator_avatar_url: this.props.creatorAvatarUrl,
      creator_subscriber_count: this.props.creatorSubscriberCount,
      category: this.props.category,
      // Modular block system
      blocks: this.props.blocks || [],
      // Act 1: Understand fields (legacy)
      understand_video_url: this.props.understandVideoUrl,
      understand_video_library_id: this.props.understandVideoLibraryId,
      understand_headline: this.props.understandHeadline,
      understand_questions: this.props.understandQuestions,
      title_highlight_words: this.props.titleHighlightWords,
      sidebar_title: this.props.sidebarTitle,
    };
  }
}
