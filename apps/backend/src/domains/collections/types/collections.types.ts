/**
 * Collections domain types — DB-driven Bassment sidebar folders.
 *
 * A `collection` is a real folder (replacing the hardcoded PRODUCT_FOLDERS array
 * + the brittle tutorials.category string-match). `collection_tutorials` is the
 * many-to-many assignment of tutorials to folders.
 *
 * Owned packs are NOT collections — they surface as VIRTUAL folders computed
 * from product_contents at read time (see CollectionsService), so this domain
 * never mutates tutorial gating (which product_contents already owns).
 */

/** Mirrors content gating (free/member/product) so folders gate like content. */
export type CollectionAccessTier = 'free' | 'member' | 'product';

/** A folder row (the `collections` table). */
export interface Collection {
  id: string;
  slug: string;
  title: string;
  description?: string;
  accessTier: CollectionAccessTier;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** One folder↔tutorial assignment (the `collection_tutorials` table). */
export interface CollectionTutorial {
  id: string;
  collectionId: string;
  tutorialId: string;
  sortOrder: number;
  createdAt: Date;
}

/** Admin create input. slug/title required; the rest default in the repo. */
export interface CreateCollectionInput {
  slug: string;
  title: string;
  description?: string;
  accessTier?: CollectionAccessTier;
  sortOrder?: number;
  isActive?: boolean;
}

/** Admin update input — every field optional (partial patch). */
export type UpdateCollectionInput = Partial<CreateCollectionInput>;

/** Admin input to assign a tutorial to a folder. */
export interface AssignTutorialInput {
  tutorialId: string;
  sortOrder?: number;
}

/**
 * The shape GET /collections returns per folder. `tutorialIds` are ordered for
 * display; the frontend joins them against the tutorials it already loads (via
 * GET /tutorials), so this endpoint doesn't re-serialize tutorial content.
 *
 * `source` distinguishes a real DB folder from a virtual pack-folder.
 * `isLocked` is a UX hint: a folder the caller can SEE the existence of (an
 * upsell teaser) but not access — the sidebar renders it with an upgrade lock.
 */
export interface CollectionView {
  id: string;
  slug: string;
  title: string;
  description?: string;
  accessTier: CollectionAccessTier;
  sortOrder: number;
  source: 'collection' | 'product';
  isLocked: boolean;
  tutorialIds: string[];
}
