/**
 * drillBricks — derive "is this a drill?" and the brick list from a tutorial's
 * blocks. A drill is just a tutorial whose blocks are drill bricks; there's no
 * separate flag (see domains/drill/constants.ts). A block counts as a drill
 * brick when it's a task block, or a groove-card carrying a `role` /
 * `completionCriterion`. Plain video/text/exercise blocks are ignored here.
 *
 * Used by the session frame (plan + summary screens) to list today's bricks and
 * decide whether to show the frame at all.
 */

import type {
  AnyBlock,
  Tutorial,
  DrillCompletionCriterion,
  GrooveCardBlockConfig,
  TaskBlockConfig,
} from '@bassnotion/contracts';

/** One drill brick, flattened for the plan/summary UI. */
export interface DrillBrick {
  /** Block id — joins to BlockProgressEntry / blockProgress map. */
  id: string;
  /** Which kind of brick (drives the icon + "no audio" hint). */
  kind: 'groove' | 'task';
  /** Human label for the plan/summary row. */
  title: string;
  /** Optional second line (groove subtitle / task heading). */
  subtitle?: string;
  /** How this brick completes; absent only on malformed bricks. */
  criterion?: DrillCompletionCriterion;
  /** Display clock hint in minutes (groove timebox), if any. */
  timeboxMinutes?: number;
}

/**
 * True when a single block is a drill brick (task, or a drill-tagged
 * groove-card). A groove-card with neither `role` nor `completionCriterion` is
 * a plain marketing/tutorial card, not a brick.
 */
export function isDrillBrickBlock(block: AnyBlock): boolean {
  if (block.type === 'task') return true;
  if (block.type === 'groove-card') {
    const cfg = block.config as GrooveCardBlockConfig;
    return !!cfg.role || !!cfg.completionCriterion;
  }
  return false;
}

/**
 * True when the tutorial should render as a drill session (plan → run →
 * summary). Auto-detected: at least one block is a drill brick.
 */
export function isDrillTutorial(
  tutorial: Pick<Tutorial, 'blocks'> | null | undefined,
): boolean {
  const blocks = tutorial?.blocks ?? [];
  return blocks.some((b) => isDrillBrickBlock(b as AnyBlock));
}

/**
 * Flatten a tutorial's drill bricks (in block order) for the plan/summary UI.
 * Non-brick blocks are skipped. Returns [] for a non-drill tutorial.
 */
export function getDrillBricks(
  tutorial: Pick<Tutorial, 'blocks'> | null | undefined,
): DrillBrick[] {
  const blocks = (tutorial?.blocks ?? []) as AnyBlock[];
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .filter(isDrillBrickBlock)
    .map((block) => {
      if (block.type === 'task') {
        const cfg = block.config as TaskBlockConfig;
        return {
          id: block.id,
          kind: 'task' as const,
          title: cfg.heading?.trim() || block.title || 'Practice',
          subtitle: cfg.instruction,
          criterion: cfg.completionCriterion,
        };
      }
      // groove-card
      const cfg = block.config as GrooveCardBlockConfig;
      return {
        id: block.id,
        kind: 'groove' as const,
        title: cfg.title?.trim() || block.title || 'Groove',
        subtitle: cfg.subtitle,
        criterion: cfg.completionCriterion,
        timeboxMinutes: cfg.timeboxMinutes,
      };
    });
}

/** A short "Practice 5 min" / "Play 4×" / "Clean pass" label for a criterion. */
export function describeCriterion(
  criterion: DrillCompletionCriterion | undefined,
): string {
  if (!criterion) return 'Free practice';
  switch (criterion.type) {
    case 'time':
      return criterion.target ? `Practice ${criterion.target} min` : 'Practice';
    case 'loops':
      return criterion.target ? `Play ${criterion.target}×` : 'Play the loop';
    case 'conquer':
      return 'Clean pass';
    case 'manual':
      return "Until you're done";
    default:
      return 'Practice';
  }
}
