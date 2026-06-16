'use client';

/**
 * TopicStageEditor — author a training goal's CONTENT LADDER
 * (BASS_GYM_CONTENT_LADDER_EPIC.md, Build B).
 *
 * A goal becomes ~3 TOPICS (student-facing skill areas, each with a rep QUOTA),
 * each carrying internal STAGES (admin-only difficulty/sequence rungs). Per
 * stage the admin authors FRESH blocks inline via the existing BlockEditor
 * (founder decision §5: stage content is fresh, not reused library content) —
 * the same editor /tutorials uses, so groove-card / task / Reference-Drop
 * content all author identically.
 *
 * Controlled: owns no canonical state — `value: Topic[]` in, `onChange` out, so
 * the admin page can fold the result into CreateGoalInput.topics. The student
 * never sees "stages"; they see one quota bar per topic.
 */

import { useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { AnyBlock, BlockRef, Stage, Topic } from '@bassnotion/contracts';

import { BlockEditor } from './BlockEditor';
import { Button } from '@/shared/components/ui/button';

interface TopicStageEditorProps {
  value: Topic[];
  onChange: (topics: Topic[]) => void;
  /** Slug the groove-card stem uploads compose their storage path from (passed
   *  straight through to BlockEditor). Optional pre-create. */
  tutorialSlug?: string;
  /** Which topic/stage panels are expanded — kept in the parent so the page
   *  controls layout. Keyed `${topicIdx}` and `${topicIdx}:${stageIdx}`. */
  expanded: Set<string>;
  onToggleExpanded: (key: string) => void;
}

let idSeq = 0;
/** Client-side stable-ish id for a new topic (slugified title is set on edit). */
function newTopicId(): string {
  idSeq += 1;
  return `topic-${idSeq}-${Math.round(performance.now())}`;
}

/** BlockRef[] (a stage's stored shape) → AnyBlock[] (what BlockEditor edits). */
function refsToBlocks(refs: BlockRef[]): AnyBlock[] {
  return refs
    .map((r) => r.block)
    .filter((b): b is AnyBlock => !!b);
}

/** AnyBlock[] (BlockEditor output) → BlockRef[] (a stage's stored shape). Each
 *  block is embedded inline under `block` — the self-contained seed shape the
 *  engine resolves without a library lookup. */
function blocksToRefs(blocks: AnyBlock[]): BlockRef[] {
  return blocks.map((b, i) => ({
    blockId: b.id,
    // L2 = "today"; the engine re-stamps the ladder level per brick at plan
    // time, so this is just a stable default for the stored ref.
    ladderPosition: 'L2' as const,
    block: { ...b, order: i },
  }));
}

function emptyStage(level: number): Stage {
  return {
    level,
    // Stage 1 is always available; later stages gate on reps-in-topic.
    introduceAfterReps: level === 1 ? 0 : 0,
    blocks: [],
  };
}

export function TopicStageEditor({
  value,
  onChange,
  tutorialSlug,
  expanded,
  onToggleExpanded,
}: TopicStageEditorProps) {
  const patchTopic = useCallback(
    (idx: number, patch: Partial<Topic>) => {
      onChange(value.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
    },
    [value, onChange],
  );

  const patchStage = useCallback(
    (topicIdx: number, stageIdx: number, patch: Partial<Stage>) => {
      onChange(
        value.map((t, i) =>
          i === topicIdx
            ? {
                ...t,
                stages: t.stages.map((s, j) =>
                  j === stageIdx ? { ...s, ...patch } : s,
                ),
              }
            : t,
        ),
      );
    },
    [value, onChange],
  );

  const addTopic = useCallback(() => {
    onChange([
      ...value,
      {
        id: newTopicId(),
        title: '',
        repQuota: 10,
        stages: [emptyStage(1)],
      },
    ]);
  }, [value, onChange]);

  const removeTopic = useCallback(
    (idx: number) => onChange(value.filter((_, i) => i !== idx)),
    [value, onChange],
  );

  const addStage = useCallback(
    (topicIdx: number) => {
      const t = value[topicIdx];
      const nextLevel = (t.stages.at(-1)?.level ?? 0) + 1;
      patchTopic(topicIdx, { stages: [...t.stages, emptyStage(nextLevel)] });
    },
    [value, patchTopic],
  );

  const removeStage = useCallback(
    (topicIdx: number, stageIdx: number) => {
      const t = value[topicIdx];
      patchTopic(topicIdx, {
        stages: t.stages.filter((_, j) => j !== stageIdx),
      });
    },
    [value, patchTopic],
  );

  const totalQuota = value.reduce((sum, t) => sum + (t.repQuota || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {value.length} topic{value.length === 1 ? '' : 's'}
          {value.length > 0 && (
            <span className="text-gray-400">
              {' '}
              · {totalQuota} reps to complete the goal
            </span>
          )}
        </p>
      </div>

      {value.map((topic, ti) => {
        const topicKey = `${ti}`;
        const topicOpen = expanded.has(topicKey);
        return (
          <div
            key={topic.id}
            className="rounded-lg border border-gray-200 bg-gray-50/60"
          >
            {/* Topic header row */}
            <div className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => onToggleExpanded(topicKey)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={topicOpen ? 'Collapse topic' : 'Expand topic'}
              >
                {topicOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <input
                value={topic.title}
                onChange={(e) => patchTopic(ti, { title: e.target.value })}
                placeholder={`Topic ${ti + 1} (e.g. Hold the Engine)`}
                className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400"
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500">
                quota
                <input
                  type="number"
                  min={1}
                  value={topic.repQuota}
                  onChange={(e) =>
                    patchTopic(ti, { repQuota: Number(e.target.value) })
                  }
                  className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                />
              </label>
              <button
                type="button"
                onClick={() => removeTopic(ti)}
                className="shrink-0 rounded-md border border-red-300 p-1.5 text-red-600 hover:bg-red-50"
                aria-label="Remove topic"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Stages */}
            {topicOpen && (
              <div className="space-y-2 border-t border-gray-200 p-3">
                {topic.stages.map((stage, si) => {
                  const stageKey = `${ti}:${si}`;
                  const stageOpen = expanded.has(stageKey);
                  const blocks = refsToBlocks(stage.blocks);
                  return (
                    <div
                      key={si}
                      className="rounded-md border border-gray-200 bg-white"
                    >
                      <div className="flex flex-wrap items-center gap-2 p-2.5">
                        <button
                          type="button"
                          onClick={() => onToggleExpanded(stageKey)}
                          className="text-gray-400 hover:text-gray-600"
                          aria-label={
                            stageOpen ? 'Collapse stage' : 'Expand stage'
                          }
                        >
                          {stageOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#B97216]">
                          Stage {stage.level}
                        </span>
                        <label className="flex items-center gap-1 text-xs text-gray-500">
                          after
                          <input
                            type="number"
                            min={0}
                            value={stage.introduceAfterReps}
                            onChange={(e) =>
                              patchStage(ti, si, {
                                introduceAfterReps: Number(e.target.value),
                              })
                            }
                            className="w-14 rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900"
                          />
                          reps
                        </label>
                        <label className="flex items-center gap-1 text-xs text-gray-500">
                          tempo
                          <input
                            type="number"
                            placeholder="min"
                            value={stage.tempoBand?.[0] ?? ''}
                            onChange={(e) => {
                              const min = Number(e.target.value);
                              const max = stage.tempoBand?.[1] ?? min;
                              patchStage(ti, si, {
                                tempoBand: e.target.value
                                  ? [min, max]
                                  : undefined,
                              });
                            }}
                            className="w-14 rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900"
                          />
                          –
                          <input
                            type="number"
                            placeholder="max"
                            value={stage.tempoBand?.[1] ?? ''}
                            onChange={(e) => {
                              const max = Number(e.target.value);
                              const min = stage.tempoBand?.[0] ?? max;
                              patchStage(ti, si, {
                                tempoBand: e.target.value
                                  ? [min, max]
                                  : undefined,
                              });
                            }}
                            className="w-14 rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900"
                          />
                        </label>
                        <span className="text-xs text-gray-400">
                          {blocks.length} block{blocks.length === 1 ? '' : 's'}
                        </span>
                        {topic.stages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStage(ti, si)}
                            className="ml-auto rounded border border-red-200 p-1 text-red-500 hover:bg-red-50"
                            aria-label="Remove stage"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {stageOpen && (
                        <div className="border-t border-gray-100 p-2.5">
                          {/* BlockEditor is built for the DARK admin/tutorials
                              shell (text-white, bg-white/5…). This page is the
                              LIGHT admin shell, so embed it on a dark surface —
                              otherwise its white text is invisible on white.
                              Wrapping (vs. recoloring BlockEditor) keeps the dark
                              /admin/tutorials usage untouched. */}
                          <div className="rounded-lg bg-[#100E0D] p-3 text-white">
                            <BlockEditor
                              blocks={blocks}
                              exercises={[]}
                              tutorialSlug={tutorialSlug}
                              onBlocksChange={(next) =>
                                patchStage(ti, si, {
                                  blocks: blocksToRefs(next),
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => addStage(ti)}
                  className="text-xs font-medium text-[#B97216] hover:underline"
                >
                  + Add stage
                </button>
              </div>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={addTopic}
        className="w-full border-dashed"
      >
        <Plus className="mr-1 h-4 w-4" />
        Add topic
      </Button>
    </div>
  );
}
