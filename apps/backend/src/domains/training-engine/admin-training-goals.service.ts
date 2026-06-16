import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type {
  Goal,
  AdminGoalSummary,
  GoalType,
  CreateGoalInput,
  UpdateGoalInput,
} from '@bassnotion/contracts';
import { TrainingEngineRepository } from './repositories/training-engine.repository.js';

const VALID_TYPES: GoalType[] = ['speed', 'knowledge', 'vocabulary', 'feel'];

/**
 * AdminTrainingGoalsService — authoring CRUD for `training_goals` (Phase 5a).
 *
 * Replaces the seed migration as the way goals come into existence: an admin
 * creates/edits goals through /admin/training-goals. Validation is inline
 * (matching the admin-products convention). The backend Supabase client is
 * service-role; the AdminGuard on the controller is the real boundary.
 *
 * IMPORTANT: editing a goal NEVER mutates an in-flight climb — enrollments hold
 * a frozen goal_snapshot (taken at enroll time). So edits are safe to make
 * anytime; only NEW enrollments see the new content.
 */
@Injectable()
export class AdminTrainingGoalsService {
  constructor(private readonly repository: TrainingEngineRepository) {}

  /** The admin list — non-archived goals, each with its live enrollment count. */
  list(): Promise<AdminGoalSummary[]> {
    return this.repository.listAllGoals();
  }

  get(id: string): Promise<Goal | null> {
    return this.repository.findGoalById(id);
  }

  async create(input: CreateGoalInput): Promise<Goal> {
    this.validate(input);
    const slug = await this.uniqueSlug(input.title);
    const now = new Date().toISOString();
    return this.repository.insertGoal({
      slug,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      target: input.target ?? {},
      assessment_config: input.assessmentConfig ?? {},
      block_set: input.blockSet ?? [],
      topics: input.topics ?? [],
      prerequisites: input.prerequisites ?? [],
      day30_milestone: input.day30Milestone ?? {},
      fork_config: input.forkConfig ?? {},
      is_active: input.isActive ?? true,
      created_at: now,
      updated_at: now,
    });
  }

  async update(id: string, patch: UpdateGoalInput): Promise<Goal> {
    if (patch.type && !VALID_TYPES.includes(patch.type)) {
      throw new BadRequestException(`Invalid goal type "${patch.type}"`);
    }
    if (patch.title !== undefined && patch.title.trim().length === 0) {
      throw new BadRequestException('title cannot be empty');
    }
    // Same playability guard as create: a topics edit can't save empty stages.
    if (patch.topics !== undefined) this.validateTopics(patch.topics);
    // Map only the supplied camelCase fields to snake_case columns. slug is
    // intentionally NOT re-derived from a title edit — it's a stable key the
    // enrollment's virtual-tutorial path and any references rely on.
    const row: Record<string, unknown> = {};
    if (patch.type !== undefined) row.type = patch.type;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.target !== undefined) row.target = patch.target;
    if (patch.assessmentConfig !== undefined)
      row.assessment_config = patch.assessmentConfig;
    if (patch.blockSet !== undefined) row.block_set = patch.blockSet;
    if (patch.topics !== undefined) row.topics = patch.topics;
    if (patch.prerequisites !== undefined)
      row.prerequisites = patch.prerequisites;
    if (patch.day30Milestone !== undefined)
      row.day30_milestone = patch.day30Milestone;
    if (patch.forkConfig !== undefined) row.fork_config = patch.forkConfig;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;

    const updated = await this.repository.updateGoal(id, row);
    if (!updated) throw new BadRequestException('Training goal not found');
    return updated;
  }

  /**
   * Hard-delete a goal. By default this is GUARDED against silent data loss:
   * goal_enrollments FK-cascades on goal delete, so deleting a goal with
   * enrollments would wipe those players' climbs + rep history. Refuse; archive
   * or deactivate instead.
   *
   * `force` is the admin override (typed-title confirmation on the client) for
   * deleting a TEST/JUNK goal you don't care about — it cascades deliberately.
   * Pre-production this is how you clean up your own test goals; once real
   * students exist, prefer archive.
   */
  async remove(id: string, force = false): Promise<void> {
    const enrolled = await this.repository.countEnrollmentsForGoal(id);
    if (enrolled > 0 && !force) {
      throw new BadRequestException(
        `Cannot delete: ${enrolled} enrollment(s) reference this goal. ` +
          'Archive it instead (it disappears from the list but keeps existing ' +
          'climbs intact), or force-delete to discard a test goal + its ' +
          'enrollments.',
      );
    }
    await this.repository.deleteGoal(id);
  }

  /** Archive a goal (soft-delete): off the admin list + not enrollable,
   *  reversible, never cascades. The safe way to retire a goal with real
   *  enrollees without destroying their data. */
  async archive(id: string): Promise<Goal> {
    const goal = await this.repository.setGoalArchived(id, true);
    if (!goal) throw new NotFoundException('Training goal not found');
    return goal;
  }

  /** Unarchive a goal — bring it back to the list (still inactive/active per
   *  its is_active flag). */
  async unarchive(id: string): Promise<Goal> {
    const goal = await this.repository.setGoalArchived(id, false);
    if (!goal) throw new NotFoundException('Training goal not found');
    return goal;
  }

  private validate(input: CreateGoalInput): void {
    if (!input.title || input.title.trim().length === 0) {
      throw new BadRequestException('title is required');
    }
    if (!input.type || !VALID_TYPES.includes(input.type)) {
      throw new BadRequestException(
        `type is required and must be one of: ${VALID_TYPES.join(', ')}`,
      );
    }
    this.validateTopics(input.topics);
  }

  /**
   * Reject a multi-topic goal that can't be played: every topic needs a title +
   * a positive quota, and EVERY stage needs at least one inline block. Without
   * this, an empty-stage goal saves fine but 500s the gym at plan time (the
   * GoalNotReadyError path). Validate at the source so the bad state never lands.
   * Skipped when there are no topics (single-focal goals).
   */
  private validateTopics(topics: CreateGoalInput['topics']): void {
    if (!topics || topics.length === 0) return;
    topics.forEach((t, ti) => {
      const label = t.title?.trim() || `topic ${ti + 1}`;
      if (!t.title || t.title.trim().length === 0) {
        throw new BadRequestException(`Topic ${ti + 1} needs a title.`);
      }
      if (!(t.repQuota > 0)) {
        throw new BadRequestException(`"${label}" needs a rep quota > 0.`);
      }
      if (!t.stages || t.stages.length === 0) {
        throw new BadRequestException(`"${label}" needs at least one stage.`);
      }
      t.stages.forEach((s) => {
        const hasBlock = (s.blocks ?? []).some((b) => !!b.block);
        if (!hasBlock) {
          throw new BadRequestException(
            `"${label}" stage ${s.level} has no exercises — add at least one ` +
              'block, or remove the stage.',
          );
        }
      });
    });
  }

  /** Slugify the title; append -2, -3… on collision. */
  private async uniqueSlug(title: string): Promise<string> {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    let slug = base || 'goal';
    for (let attempt = 2; attempt < 50; attempt++) {
      // Check ANY goal (active or not) — findGoalBySlug filters is_active and
      // would miss an inactive collision, causing a 23501 on insert.
      const exists = await this.repository.goalSlugExists(slug);
      if (!exists) return slug;
      slug = `${base}-${attempt}`;
    }
    // Extremely unlikely; fall back to a timestamp-ish suffix-free guard.
    throw new BadRequestException('Could not derive a unique slug from title');
  }
}
