'use client';

/**
 * GrooveCardBlockForm — LAUNCH-02.5e admin form (single-key-set + PitchShift).
 *
 * Three stem URL inputs (bass / drums / harmony) plus title / subtitle /
 * BPM / original-key / length-bars. Stems are delivered at originalKey;
 * the runtime renders ±6 semitones via the pitch-shift engine on bass +
 * harmony (drums stay un-shifted by design).
 *
 * Follows the ExplainBlockForm convention: vanilla React (no react-hook-
 * form), raw text inputs for URLs. Admin paste-uploads URLs they've
 * already pushed to the `audio-samples` Supabase bucket.
 *
 * Server-side Zod validation at save time enforces the stem shape, the
 * bucket path pattern, and BPM/length bounds — see
 * apps/backend/src/domains/tutorials/admin-tutorials.service.ts.
 */

import { useCallback } from 'react';
import type {
  GrooveCardBlockConfig,
  GrooveCardStemSet,
  ReferenceDropConfig,
} from '@bassnotion/contracts';
import { StemUploadButton } from './groove-card/StemUploadButton';
import { ChordChartEditor } from './groove-card/ChordChartEditor';
import { BasslineVariantsEditor } from './groove-card/BasslineVariantsEditor';
import { CompletionCriterionFields } from './CompletionCriterionFields';
import { useGrooveLibrary } from '@/domains/drill/hooks/useGrooveLibrary';

interface GrooveCardBlockFormProps {
  config: GrooveCardBlockConfig;
  onChange: (config: GrooveCardBlockConfig) => void;
  /** Current tutorial's slug; used to build storage paths for stem
   * uploads (`audio-samples/grooves/{tutorialSlug}/{keyFolder}/{stem}.ogg`).
   * If absent (e.g. on a brand-new unsaved tutorial that hasn't
   * received its slug yet), the upload button degrades to a `disabled`
   * state with a hint. */
  tutorialSlug?: string;
}

// Musical stems the admin uploads. The metronome click is NOT here —
// it's a fixed shared metronome (MIDI in /app, one bundled sample on
// the waitlist), never uploaded per groove.
// Bass is NOT here — it's authored as "Bass A" inside the Lines & Fills editor
// below (which owns the bass stem + its alternate lines + fills, one unified
// list). Drums + harmony stay as the fixed backing stems.
const STEM_SLOTS = ['drums', 'harmony'] as const;

export function GrooveCardBlockForm({
  config,
  onChange,
  tutorialSlug,
}: GrooveCardBlockFormProps) {
  const updateField = useCallback(
    <K extends keyof GrooveCardBlockConfig>(
      field: K,
      value: GrooveCardBlockConfig[K],
    ) => {
      onChange({ ...config, [field]: value });
    },
    [config, onChange],
  );

  const updateStem = useCallback(
    (stem: keyof GrooveCardStemSet, url: string) => {
      const current = config.stems ?? { bass: '', drums: '', harmony: '' };
      onChange({
        ...config,
        stems: { ...current, [stem]: url },
      });
    },
    [config, onChange],
  );

  const { data: library } = useGrooveLibrary();
  const grooves = library?.grooves ?? [];
  const usingLibrary = !!config.grooveId;

  return (
    <div className="space-y-4 text-sm">
      {/* Library picker — choose a reusable groove, or author inline below. */}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs uppercase tracking-wider text-white/40">
          Groove source
        </legend>
        <label className="block space-y-1">
          <span className="text-xs text-white/50">Use a library groove</span>
          <select
            value={config.grooveId ?? ''}
            onChange={(e) =>
              updateField('grooveId', e.target.value || undefined)
            }
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
          >
            <option value="">— Author inline (one-off) —</option>
            {grooves.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · {g.originalKey} · {g.originalBpm} BPM
              </option>
            ))}
          </select>
        </label>
        {usingLibrary && (
          <p className="text-xs text-white/40">
            Stems, default key/tempo &amp; length come from the library groove.
            Override the starting key/tempo for THIS drill below.
          </p>
        )}
      </fieldset>

      {/* Per-use overrides — only when referencing a library groove. */}
      {usingLibrary && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs uppercase tracking-wider text-white/40">
            Per-use overrides (this drill only)
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-white/50">
                Start key (± semitones)
              </span>
              <input
                type="number"
                value={config.keyOverride ?? ''}
                onChange={(e) =>
                  updateField(
                    'keyOverride',
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="0"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/50">Start tempo (BPM)</span>
              <input
                type="number"
                value={config.tempoOverride ?? ''}
                onChange={(e) =>
                  updateField(
                    'tempoOverride',
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="from groove"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30"
              />
            </label>
          </div>
        </fieldset>
      )}

      {/* Inline authoring — only when NOT referencing a library groove. */}
      {!usingLibrary && (
        <>
          {/* Basics */}
          <fieldset className="space-y-2">
            <legend className="text-xs uppercase tracking-wider text-white/40 mb-1">
              Basics
            </legend>
            <input
              type="text"
              value={config.title ?? ''}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Title (e.g. Greasy Pocket)"
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30"
            />
            <input
              type="text"
              value={config.subtitle ?? ''}
              onChange={(e) => updateField('subtitle', e.target.value)}
              placeholder="Subtitle (e.g. Funk in E)"
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30"
            />
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-white/50">Original BPM</span>
                <input
                  type="number"
                  min={50}
                  max={180}
                  value={config.originalBpm ?? 100}
                  onChange={(e) =>
                    updateField('originalBpm', Number(e.target.value))
                  }
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-white/50">Original Key</span>
                <input
                  type="text"
                  value={config.originalKey ?? ''}
                  onChange={(e) => updateField('originalKey', e.target.value)}
                  placeholder="E"
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-white/50">Length (bars)</span>
                <input
                  type="number"
                  min={1}
                  value={config.lengthBars ?? 4}
                  onChange={(e) =>
                    updateField('lengthBars', Number(e.target.value))
                  }
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white"
                />
              </label>
            </div>
            <label className="space-y-1 block">
              <span className="text-xs text-white/50">
                YouTube URL (optional)
              </span>
              <input
                type="text"
                value={config.youtubeUrl ?? ''}
                onChange={(e) =>
                  updateField('youtubeUrl', e.target.value || undefined)
                }
                placeholder="YouTube video URL or 11-char ID — shown above the card"
                className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30"
              />
            </label>
          </fieldset>

          {/* Chord chart — sparse harmony changes shown to the player as they
              play along. Grid is lengthBars × 16 sixteenth-note slots. */}
          <fieldset className="space-y-2">
            <ChordChartEditor
              theme="dark"
              lengthBars={config.lengthBars ?? 4}
              value={config.chordChart}
              onChange={(chart) => updateField('chordChart', chart)}
            />
          </fieldset>
        </>
      )}

      {/* Drill — set these to make the card a DRILL BRICK in a session.
          A `role` turns on caps + the conquer→advance behaviour; leave
          "None" for an ordinary tutorial/marketing card. */}
      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wider text-white/40 mb-1">
          Drill (optional) — only for session bricks
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-white/50">Brick role</span>
            <select
              value={config.role ?? ''}
              onChange={(e) =>
                updateField(
                  'role',
                  e.target.value
                    ? (e.target.value as GrooveCardBlockConfig['role'])
                    : undefined,
                )
              }
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white"
            >
              <option value="">None (plain card)</option>
              <option value="groove">Groove (new skill)</option>
              <option value="connecting">Connecting (chord-to-chord)</option>
              <option value="review">Review (past groove)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-white/50">Timebox (min)</span>
            <input
              type="number"
              min={1}
              value={config.timeboxMinutes ?? ''}
              onChange={(e) =>
                updateField(
                  'timeboxMinutes',
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="5"
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30"
            />
          </label>
        </div>
        <p className="text-xs text-white/40">
          Set a role to make this a drill brick (free-vs-member caps + conquer
          advances the session). Timebox drives the per-brick session clock.
        </p>
      </fieldset>

      {/* Reference-Drop — the pulse-steadiness drill (Lock The Pocket). The
          chosen reference stem(s) fade out for N bars then back in on a bar
          boundary; the return reveals tempo drift. All admin-authored here. */}
      <ReferenceDropFields
        value={config.referenceDrop}
        onChange={(rd) => updateField('referenceDrop', rd)}
      />

      {/* Completion criterion — how this drill brick is "done". */}
      <CompletionCriterionFields
        value={config.completionCriterion}
        onChange={(c) => updateField('completionCriterion', c)}
      />

      {/* Stems — inline authoring only (library grooves carry their own). */}
      {!usingLibrary && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs uppercase tracking-wider text-white/40">
            Backing stems — delivered at original key; runtime pitch-shifts ±6
            semitones
          </legend>
          <p className="text-xs text-white/40">
            Drums &amp; harmony write to the <code>audio-samples</code> Supabase
            bucket. The bass is authored below in Lines &amp; Fills (as “Bass
            A”).
          </p>
          <div className="space-y-2 rounded-lg border border-white/10 p-3">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {STEM_SLOTS.map((stem) => (
                <StemUploadButton
                  key={stem}
                  value={config.stems?.[stem] ?? ''}
                  onChange={(url) => updateStem(stem, url)}
                  stemLabel={stem}
                  uploadContext={{
                    tutorialSlug: tutorialSlug ?? 'unsaved',
                    keyFolder:
                      (config.originalKey ?? '').trim().length > 0
                        ? config.originalKey!
                        : 'default',
                    stem,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Bass (as "Bass A" = the main bass stem) + alternate lines + fills.
              The main bass writes to stems.bass (PUBLIC audio-samples bucket);
              alternate lines + fills write to the PRIVATE premium-basslines
              bucket. One unified list. */}
          <BasslineVariantsEditor
            variants={config.stems?.bassVariants ?? []}
            mainBassUrl={config.stems?.bass ?? ''}
            onChangeMainBass={(url) => updateStem('bass', url)}
            mainBassUploadContext={{
              tutorialSlug: tutorialSlug ?? 'unsaved',
              keyFolder:
                (config.originalKey ?? '').trim().length > 0
                  ? config.originalKey!
                  : 'default',
              stem: 'bass',
            }}
            lengthBars={config.lengthBars ?? 4}
            bpm={config.originalBpm ?? 100}
            slug={tutorialSlug ?? 'unsaved'}
            onChange={(bassVariants) => {
              const current = config.stems ?? {
                bass: '',
                drums: '',
                harmony: '',
              };
              onChange({ ...config, stems: { ...current, bassVariants } });
            }}
            // Bass A's sheet notation lives on the config (it's the main bass,
            // not a variant); each alternate line / fill carries its own on its
            // variant. The editor authors both, per row.
            bassANotation={config.bassNotation}
            onChangeBassANotation={(bassNotation) =>
              onChange({ ...config, bassNotation })
            }
          />
        </fieldset>
      )}

      {/* Captions: card-wide UX copy lives in
          apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/captions.ts
          (DEFAULT_PREVIEW_CAPTION + DEFAULT_STATE_CAPTIONS). Edit that
          file to change the copy site-wide — no admin form needed.

          Allow bookmark: contract-only field, no UI surface in v1.
          When the bookmark feature lands, re-expose here. */}
    </div>
  );
}

/** Form defaults the admin SEES and can change — NOT engine constants. Enabling
 *  the drill seeds these; every field is then editable. */
const REFERENCE_DROP_DEFAULT: ReferenceDropConfig = {
  enabled: true,
  everyBars: 4,
  dropForBars: 2,
  dropTargets: ['drums'],
  fadeMs: 80,
};

/**
 * Reference-Drop admin control. Enable toggle reveals the cadence + targets +
 * fade. All values are written straight onto the block's `referenceDrop` config
 * (nothing hardcoded in the engine — the hook reads exactly what's set here).
 */
function ReferenceDropFields({
  value,
  onChange,
}: {
  value?: ReferenceDropConfig;
  onChange: (rd: ReferenceDropConfig | undefined) => void;
}) {
  const enabled = !!value?.enabled;
  const rd = value ?? REFERENCE_DROP_DEFAULT;

  const toggle = (on: boolean) =>
    onChange(on ? { ...REFERENCE_DROP_DEFAULT, ...value, enabled: true } : undefined);

  const set = <K extends keyof ReferenceDropConfig>(
    key: K,
    v: ReferenceDropConfig[K],
  ) => onChange({ ...rd, [key]: v, enabled: true });

  const toggleTarget = (target: 'drums' | 'click') => {
    const has = rd.dropTargets.includes(target);
    const next = has
      ? rd.dropTargets.filter((t) => t !== target)
      : [...rd.dropTargets, target];
    // An enabled drill must fade something — ignore an attempt to clear the last.
    if (next.length === 0) return;
    set('dropTargets', next);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs uppercase tracking-wider text-white/40">
        Reference-Drop (pulse drill) — optional
      </legend>
      <label className="flex items-center gap-2 text-xs text-white/60">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
        />
        Drop the reference periodically to train pulse-steadiness
      </label>

      {enabled && (
        <div className="space-y-2 rounded-lg border border-white/10 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-white/50">Drop every (bars)</span>
              <input
                type="number"
                min={1}
                value={rd.everyBars}
                onChange={(e) =>
                  set('everyBars', Math.max(1, Number(e.target.value)))
                }
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/50">Stays dropped (bars)</span>
              <input
                type="number"
                min={1}
                value={rd.dropForBars}
                onChange={(e) =>
                  set('dropForBars', Math.max(1, Number(e.target.value)))
                }
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
              />
            </label>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-white/50">Drop which reference</span>
            <div className="flex gap-4 text-xs text-white/70">
              {(['drums', 'click'] as const).map((target) => (
                <label key={target} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={rd.dropTargets.includes(target)}
                    onChange={() => toggleTarget(target)}
                  />
                  {target === 'drums' ? 'Drums (musical)' : 'Click (metronome)'}
                </label>
              ))}
            </div>
          </div>
          <label className="space-y-1 block">
            <span className="text-xs text-white/50">Fade (ms)</span>
            <input
              type="number"
              min={0}
              value={rd.fadeMs ?? 80}
              onChange={(e) =>
                set('fadeMs', Math.max(0, Number(e.target.value)))
              }
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <p className="text-xs text-white/40">
            The reference fades out for {rd.dropForBars} bar
            {rd.dropForBars === 1 ? '' : 's'} every {rd.everyBars}, returning on
            the bar — the player holds the pulse through the gap.
          </p>
        </div>
      )}
    </fieldset>
  );
}
