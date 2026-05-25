'use client';

import {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FOUNDER_CARD_CONFIG_DEFAULTS,
  type FounderCardConfig,
  founderCardConfigSchema,
} from '@bassnotion/contracts';
import { supabase } from '@/infrastructure/supabase/client';
import { FounderCard } from '@/shared/founder-card/FounderCard';

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; config: FounderCardConfig }
  | { kind: 'error'; message: string };

/**
 * Each entry maps a FounderCardConfig key to the form field type and its
 * label. Order in this array drives form layout. Numeric `*SizePx` keys
 * render as number inputs with the schema's per-key min/max; everything
 * else renders as a text field. Textarea is opted-into per-key to keep
 * the form compact.
 */
type FieldConfig = {
  key: keyof FounderCardConfig;
  label: string;
  hint?: string;
  textarea?: boolean;
};

const SECTIONS: { title: string; fields: FieldConfig[] }[] = [
  {
    title: '1. Eyebrow',
    fields: [
      { key: 'eyebrowText', label: 'Text' },
      { key: 'eyebrowSizePx', label: 'Font size (px)' },
    ],
  },
  {
    title: '2. Headline + subhead',
    fields: [
      {
        key: 'headlinePrefix',
        label: 'Headline prefix',
        hint: 'e.g. "Become a"',
      },
      {
        key: 'headlineAccent',
        label: 'Headline accent',
        hint: 'rendered in orange',
      },
      { key: 'headlineSizePx', label: 'Headline size (px)' },
      { key: 'subheadText', label: 'Italic subhead' },
      { key: 'subheadSizePx', label: 'Subhead size (px)' },
    ],
  },
  {
    title: '3. Vision paragraph',
    fields: [
      {
        key: 'visionText',
        label: 'Vision',
        hint: 'Wrap text in **like this** for inline bold.',
        textarea: true,
      },
      { key: 'visionSizePx', label: 'Font size (px)' },
    ],
  },
  {
    title: '4. Three bullets',
    fields: [
      { key: 'bullet1Lead', label: 'Bullet 1 lead', hint: 'bold' },
      { key: 'bullet1Body', label: 'Bullet 1 body' },
      { key: 'bullet2Lead', label: 'Bullet 2 lead', hint: 'bold' },
      { key: 'bullet2Body', label: 'Bullet 2 body' },
      { key: 'bullet3Lead', label: 'Bullet 3 lead', hint: 'bold' },
      { key: 'bullet3Body', label: 'Bullet 3 body' },
      { key: 'bulletsSizePx', label: 'Bullets size (px)' },
    ],
  },
  {
    title: '5. Price block',
    fields: [
      { key: 'priceHeadline', label: 'Headline' },
      { key: 'priceHeadlineSizePx', label: 'Headline size (px)' },
      { key: 'priceCaption', label: 'Caption' },
      { key: 'priceCaptionSizePx', label: 'Caption size (px)' },
    ],
  },
  {
    title: '6. Progress bar',
    fields: [
      {
        key: 'progressClaimedSuffix',
        label: 'Claimed suffix',
        hint: 'Use {total} for the total spots placeholder.',
      },
      {
        key: 'progressClosesLabel',
        label: 'Right-side label',
        hint: 'Use {total} for the total spots placeholder.',
      },
    ],
  },
  {
    title: '7. Objection handler',
    fields: [
      { key: 'objectionLead', label: 'Lead', hint: 'bold' },
      {
        key: 'objectionBody',
        label: 'Body',
        hint: 'Wrap text in **like this** for inline white highlight.',
        textarea: true,
      },
      { key: 'objectionSizePx', label: 'Font size (px)' },
    ],
  },
  {
    title: '8. CTA + skip',
    fields: [
      { key: 'ctaPrimary', label: 'Primary CTA' },
      { key: 'ctaSecondary', label: 'Secondary CTA caption' },
      { key: 'skipText', label: 'Skip button text' },
    ],
  },
];

function isNumericKey(key: keyof FounderCardConfig): boolean {
  return key.endsWith('SizePx');
}

export default function FounderCardAdminPage() {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [draft, setDraft] = useState<FounderCardConfig | null>(null);
  // Mock progress count for the preview; real counter is fetched live on /.
  const previewClaimed = 13;
  const previewTotal = 100;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const fetchConfig = useCallback(async () => {
    setLoadState({ kind: 'loading' });
    try {
      if (!apiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL is not configured');
      }
      const res = await fetch(`${apiUrl}/api/v1/founders/card-config`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const json = await res.json();
      const parsed = founderCardConfigSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error(
          'Server returned a config that failed schema validation',
        );
      }
      setLoadState({ kind: 'ready', config: parsed.data });
      setDraft(parsed.data);
    } catch (err) {
      setLoadState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const isDirty = useMemo(() => {
    if (!draft || loadState.kind !== 'ready') return false;
    return JSON.stringify(draft) !== JSON.stringify(loadState.config);
  }, [draft, loadState]);

  const validation = useMemo(() => {
    if (!draft) return null;
    return founderCardConfigSchema.safeParse(draft);
  }, [draft]);

  const handleField =
    (key: keyof FounderCardConfig) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!draft) return;
      const raw = e.target.value;
      const next: FounderCardConfig = isNumericKey(key)
        ? { ...draft, [key]: raw === '' ? 0 : Number(raw) }
        : { ...draft, [key]: raw };
      setDraft(next);
    };

  const handleSave = async () => {
    if (!draft || !validation?.success) return;
    setSaveState({ kind: 'saving' });
    try {
      if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is not configured');
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not signed in — log in as admin first.');

      const res = await fetch(`${apiUrl}/api/v1/founders/card-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(validation.data),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `Access denied (${res.status}). Your account needs profiles.role='admin'.`,
        );
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Backend returned ${res.status}: ${text.slice(0, 200)}`,
        );
      }
      const json = await res.json();
      const parsed = founderCardConfigSchema.parse(json);
      setLoadState({ kind: 'ready', config: parsed });
      setDraft(parsed);
      setSaveState({ kind: 'saved', at: Date.now() });
    } catch (err) {
      setSaveState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleReset = () => {
    if (loadState.kind === 'ready') {
      setDraft(loadState.config);
      setSaveState({ kind: 'idle' });
    }
  };

  const handleLoadDefaults = () => {
    setDraft(FOUNDER_CARD_CONFIG_DEFAULTS);
    setSaveState({ kind: 'idle' });
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Founder Card</h1>
          <p className="text-sm text-gray-500 mt-1">
            Edit copy + font sizes on the post-signup founder upsell. Changes go
            live the moment you click Save (next visitor sees them).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLoadDefaults}
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
            title="Reset all fields to the originally-shipped copy"
          >
            Load defaults
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || saveState.kind === 'saving'}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30"
          >
            Revert
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              !isDirty || !validation?.success || saveState.kind === 'saving'
            }
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saveState.kind === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <SaveStatusBar state={saveState} dirty={isDirty} />

      {loadState.kind === 'loading' ? (
        <div className="text-gray-500 py-12 text-center">Loading config…</div>
      ) : loadState.kind === 'error' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 mt-4">
          <div className="font-medium">Couldn&apos;t load config</div>
          <div className="text-sm mt-1">{loadState.message}</div>
        </div>
      ) : draft ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4 items-start">
          {/* Form column */}
          <div className="space-y-6">
            {SECTIONS.map((section) => (
              <FormSection key={section.title} title={section.title}>
                {section.fields.map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    hint={field.hint}
                    error={extractFieldError(validation, field.key)}
                  >
                    {field.textarea ? (
                      <textarea
                        value={String(draft[field.key])}
                        onChange={handleField(field.key)}
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    ) : isNumericKey(field.key) ? (
                      <input
                        type="number"
                        step="0.5"
                        value={String(draft[field.key])}
                        onChange={handleField(field.key)}
                        className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm tabular-nums text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(draft[field.key])}
                        onChange={handleField(field.key)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    )}
                  </Field>
                ))}
              </FormSection>
            ))}
          </div>

          {/* Live preview column */}
          <div className="lg:sticky lg:top-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Live preview
            </div>
            <div className="rounded-lg border border-gray-800 bg-[#15110D] p-6">
              <FounderCard
                config={draft}
                claimed={previewClaimed}
                total={previewTotal}
              />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Counter shows a placeholder ({previewClaimed}/{previewTotal}). The
              live page fetches the real count from{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5">
                /api/v1/founders/count
              </code>
              .
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {hint ? (
          <span className="ml-1.5 text-gray-400 font-normal">— {hint}</span>
        ) : null}
      </label>
      {children}
      {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

function SaveStatusBar({ state, dirty }: { state: SaveState; dirty: boolean }) {
  if (state.kind === 'error') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        <b className="font-semibold">Save failed.</b> {state.message}
      </div>
    );
  }
  if (state.kind === 'saved' && !dirty) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        Saved. Visitors see the new copy on the next homepage load.
      </div>
    );
  }
  if (dirty) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Unsaved changes — click Save to publish them.
      </div>
    );
  }
  return null;
}

function extractFieldError(
  validation: ReturnType<typeof founderCardConfigSchema.safeParse> | null,
  key: keyof FounderCardConfig,
): string | undefined {
  if (!validation || validation.success) return undefined;
  const issue = validation.error.issues.find((i) => i.path[0] === key);
  return issue?.message;
}
