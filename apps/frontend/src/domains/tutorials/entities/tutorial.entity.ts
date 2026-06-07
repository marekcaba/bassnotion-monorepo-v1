import { TutorialId } from '../value-objects/tutorial-id.vo';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo';
import {
  TutorialLevel,
  TutorialLevelType,
} from '../value-objects/tutorial-level.vo';
import type { UnderstandQuestion, AnyBlock } from '@bassnotion/contracts';

export interface TutorialSection {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  exerciseIds?: string[];
}

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
  level: TutorialLevel;
  tags: string[];
  isActive: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  sections?: TutorialSection[];
  viewCount?: number;
  // New fields for draft and MIDI support
  status?: TutorialStatus;
  lastModified?: Date;
  autoSaveVersion?: number;
  drummerMidiUrl?: string;
  basslineMidiUrl?: string;
  harmonyMidiUrl?: string;
  deletedAt?: Date;
  // Core Concept fields
  coreConceptDescription?: string;
  coreConceptPoints?: string[];
  teachingTakeaway?: any; // JSON object for teaching takeaway data
  // Creator fields for YouTube attribution
  creatorName?: string;
  creatorChannelUrl?: string;
  creatorAvatarUrl?: string;
  creatorSubscriberCount?: number;
  exerciseCount?: number;
  // Act 1: Understand fields
  understandVideoUrl?: string;
  understandVideoLibraryId?: string;
  understandHeadline?: string;
  understandQuestions?: UnderstandQuestion[];
  titleHighlightWords?: string[];
  sidebarTitle?: string;
  // Modular block system
  blocks?: AnyBlock[];
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
    },
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

  // New getters for draft and MIDI support
  get status(): TutorialStatus {
    return this._props.status || 'draft';
  }

  get lastModified(): Date | undefined {
    return this._props.lastModified;
  }

  get autoSaveVersion(): number {
    return this._props.autoSaveVersion || 0;
  }

  get drummerMidiUrl(): string | undefined {
    return this._props.drummerMidiUrl;
  }

  get basslineMidiUrl(): string | undefined {
    return this._props.basslineMidiUrl;
  }

  get harmonyMidiUrl(): string | undefined {
    return this._props.harmonyMidiUrl;
  }

  get deletedAt(): Date | undefined {
    return this._props.deletedAt;
  }

  get coreConceptDescription(): string | undefined {
    return this._props.coreConceptDescription;
  }

  get coreConceptPoints(): string[] {
    return this._props.coreConceptPoints || [];
  }

  get teachingTakeaway(): any {
    return this._props.teachingTakeaway || {};
  }

  get creatorName(): string | undefined {
    return this._props.creatorName;
  }

  get creatorChannelUrl(): string | undefined {
    return this._props.creatorChannelUrl;
  }

  get creatorAvatarUrl(): string | undefined {
    return this._props.creatorAvatarUrl;
  }

  get creatorSubscriberCount(): number | undefined {
    return this._props.creatorSubscriberCount;
  }

  get exerciseCount(): number {
    return this._props.exerciseCount ?? 0;
  }

  // Act 1: Understand getters
  get understandVideoUrl(): string | undefined {
    return this._props.understandVideoUrl;
  }

  get understandVideoLibraryId(): string | undefined {
    return this._props.understandVideoLibraryId;
  }

  get understandHeadline(): string | undefined {
    return this._props.understandHeadline;
  }

  get understandQuestions(): UnderstandQuestion[] {
    return this._props.understandQuestions || [];
  }

  get titleHighlightWords(): string[] {
    return this._props.titleHighlightWords || [];
  }

  get sidebarTitle(): string | undefined {
    return this._props.sidebarTitle;
  }

  get blocks(): AnyBlock[] {
    return this._props.blocks || [];
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
      0,
    );
  }

  getSectionAtTime(timeInSeconds: number): TutorialSection | undefined {
    if (!this._props.sections) return undefined;
    return this._props.sections.find(
      (section) =>
        timeInSeconds >= section.startTime && timeInSeconds < section.endTime,
    );
  }

  isPopular(): boolean {
    return this.viewCount > 1000;
  }

  // Factory method for creating from API response
  static fromDTO(dto: any): Tutorial {
    // Handle missing or invalid level by defaulting to 'beginner'
    let level: TutorialLevel;
    if (dto.level && TutorialLevel.isValid(dto.level)) {
      level = TutorialLevel.create(dto.level);
    } else if (dto.difficulty && TutorialLevel.isValid(dto.difficulty)) {
      // Fallback to 'difficulty' field if 'level' is missing
      level = TutorialLevel.create(dto.difficulty);
    } else {
      // Default to beginner if no valid level is provided
      level = TutorialLevel.beginner();
    }

    return Tutorial.reconstitute({
      id: TutorialId.create(dto.id),
      title: dto.title,
      slug: TutorialSlug.create(dto.slug),
      description: dto.description,
      youtubeId: dto.youtube_id || dto.youtubeId || '',
      duration: dto.duration,
      authorName: dto.author_name || dto.authorName || 'Unknown',
      thumbnailUrl: dto.thumbnail_url || dto.thumbnailUrl,
      level,
      tags: dto.tags || [],
      isActive: dto.is_active ?? true,
      publishedAt: dto.published_at ? new Date(dto.published_at) : undefined,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
      sections: dto.sections,
      viewCount: dto.view_count || 0,
      // New fields for draft and MIDI support
      status: dto.status || 'draft',
      lastModified: dto.last_modified ? new Date(dto.last_modified) : undefined,
      autoSaveVersion: dto.auto_save_version || 0,
      drummerMidiUrl: dto.drummer_midi_url,
      basslineMidiUrl: dto.bassline_midi_url,
      harmonyMidiUrl: dto.harmony_midi_url,
      deletedAt: dto.deleted_at ? new Date(dto.deleted_at) : undefined,
      coreConceptDescription: dto.core_concept_description,
      coreConceptPoints: dto.core_concept_points || [],
      teachingTakeaway: dto.teaching_takeaway || {},
      // Creator fields for YouTube attribution
      creatorName: dto.creator_name,
      creatorChannelUrl: dto.creator_channel_url,
      creatorAvatarUrl: dto.creator_avatar_url,
      creatorSubscriberCount: dto.creator_subscriber_count,
      exerciseCount: dto.exercise_count,
      // Act 1: Understand fields
      understandVideoUrl: dto.understand_video_url,
      understandVideoLibraryId: dto.understand_video_library_id,
      understandHeadline: dto.understand_headline,
      understandQuestions: dto.understand_questions || [],
      titleHighlightWords: dto.title_highlight_words || [],
      sidebarTitle: dto.sidebar_title,
      // Modular block system
      blocks: dto.blocks || [],
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
      // New fields for draft and MIDI support
      status: this._props.status || 'draft',
      last_modified: this._props.lastModified?.toISOString(),
      auto_save_version: this._props.autoSaveVersion || 0,
      drummer_midi_url: this._props.drummerMidiUrl,
      bassline_midi_url: this._props.basslineMidiUrl,
      harmony_midi_url: this._props.harmonyMidiUrl,
      deleted_at: this._props.deletedAt?.toISOString(),
      core_concept_description: this._props.coreConceptDescription,
      core_concept_points: this._props.coreConceptPoints || [],
      teaching_takeaway: this._props.teachingTakeaway || {},
      // Creator fields for YouTube attribution
      creator_name: this._props.creatorName,
      creator_channel_url: this._props.creatorChannelUrl,
      creator_avatar_url: this._props.creatorAvatarUrl,
      creator_subscriber_count: this._props.creatorSubscriberCount,
      // Act 1: Understand fields
      understand_video_url: this._props.understandVideoUrl,
      understand_video_library_id: this._props.understandVideoLibraryId,
      understand_headline: this._props.understandHeadline,
      understand_questions: this._props.understandQuestions || [],
      title_highlight_words: this._props.titleHighlightWords || [],
      sidebar_title: this._props.sidebarTitle,
      // Modular block system
      blocks: this._props.blocks || [],
    };
  }
}
