/**
 * topicLadder — the content-ladder planner brain (BASS_GYM_CONTENT_LADDER_EPIC.md
 * Build A, founder-locked 2026-06-16).
 *
 * PURE functions over (frozen topics, rep history) — no I/O, no clock, no
 * randomness, fully Vitest-tested in isolation. They turn a multi-topic goal
 * into the three decisions the engine needs each day:
 *
 *   1. deriveTopicProgress — per-topic quota tally + current stage, from
 *      rep_results.topicId (the founder-decided rep↔topic attribution).
 *   2. selectTopicForRep — TODAY's topic = the least-advanced ACTIVE topic
 *      (fewest reps logged vs quota; completed topics drop out). Foundational
 *      topics (higher quota) naturally hold attention longer.
 *   3. resolveStage — the topic's CURRENT stage = the highest stage whose
 *      introduceAfterReps threshold the topic's rep count has met (self-paced
 *      level bump). The stage carries the fresh blocks the rep is built from.
 *
 * The actual rep MATERIALIZATION reuses the SAME ladder machinery as SPEED
 * (generateRep) — these only choose WHICH topic + stage + blocks; generateRep
 * brackets the tempo and stamps the bricks. No new DSP, no new executor.
 */

import type {
  RepResult,
  Stage,
  Topic,
  TopicProgress,
} from '../types/training.js';

/** Reps logged in one topic = the count of rep_results stamped with its id. */
function repsLoggedForTopic(topicId: string, history: RepResult[]): number {
  let n = 0;
  for (const r of history) if (r.topicId === topicId) n++;
  return n;
}

/**
 * The current stage for a topic given how many reps the student has logged in
 * it. Stages bump self-paced (epic §5 decision 3): the CURRENT stage is the
 * highest-`level` stage whose `introduceAfterReps` the rep count has reached.
 * Stages are evaluated by ascending level; a mis-ordered authoring array is
 * tolerated (we sort a copy). Always returns a stage (the topic has ≥1); falls
 * back to the lowest stage when none qualifies (e.g. a non-zero stage-1 gate).
 */
export function resolveStage(topic: Topic, repsLogged: number): Stage {
  const ordered = [...topic.stages].sort((a, b) => a.level - b.level);
  let current = ordered[0];
  for (const stage of ordered) {
    if (repsLogged >= stage.introduceAfterReps) current = stage;
  }
  return current;
}

/**
 * Per-topic progress for every topic on the goal — the quota tallies (drives the
 * student's progress bars) + the derived current stage level (drives the
 * planner). Pure derivation from the frozen topics + rep history.
 */
export function deriveTopicProgress(
  topics: Topic[],
  history: RepResult[],
): TopicProgress[] {
  return topics.map((topic) => {
    const repsLogged = repsLoggedForTopic(topic.id, history);
    return {
      topicId: topic.id,
      title: topic.title,
      repsLogged,
      repQuota: topic.repQuota,
      isComplete: repsLogged >= topic.repQuota,
      currentStageLevel: resolveStage(topic, repsLogged).level,
    };
  });
}

/**
 * Today's topic — the least-advanced ACTIVE topic (founder decision: serve the
 * topic with the fewest reps logged so the foundational/weighted topics hold
 * attention until they catch up). Completed topics drop out. Ties break by the
 * authoring order (the topics array order = the admin's intended sequence), so
 * the result is deterministic.
 *
 * Returns null when every topic is complete (the goal is done — nothing to
 * serve) or when there are no topics.
 */
export function selectTopicForRep(
  topics: Topic[],
  progress: TopicProgress[],
): Topic | null {
  const byId = new Map(progress.map((p) => [p.topicId, p]));
  const active = topics.filter((t) => !(byId.get(t.id)?.isComplete ?? false));
  if (active.length === 0) return null;

  // Least reps logged wins; the authoring order is the stable tie-break (a topic
  // earlier in the array is "introduced first", so it leads at equal progress).
  let best = active[0];
  let bestReps = byId.get(best.id)?.repsLogged ?? 0;
  for (let i = 1; i < active.length; i++) {
    const t = active[i];
    const reps = byId.get(t.id)?.repsLogged ?? 0;
    if (reps < bestReps) {
      best = t;
      bestReps = reps;
    }
  }
  return best;
}

/** Is the whole goal complete? Every topic's quota met (epic §0 contract). */
export function isGoalComplete(progress: TopicProgress[]): boolean {
  return progress.length > 0 && progress.every((p) => p.isComplete);
}
