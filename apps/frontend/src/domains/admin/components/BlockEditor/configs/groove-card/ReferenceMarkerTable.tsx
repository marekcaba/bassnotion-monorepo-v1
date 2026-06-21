'use client';

/**
 * ReferenceMarkerTable — the per-marker authoring matrix (bass-coach ground truth).
 *
 * One row per marker (= one note-start in the coach recording). The admin assigns, as a
 * bassist thinks (NO MIDI): STRING + FRET (→ the pitch to listen for, shown live in the
 * →note column), PLUCK style, ROLE, and a hammer-on/pull-off connection FROM the previous
 * marker. The rich annotated recording is the ground truth the student is graded against.
 *
 * Selection is by marker `id` (stable across the editor's re-sorts), kept in sync with the
 * waveform: click a row → the canvas highlights that marker, and vice versa. Lives BELOW
 * the canvas as plain DOM, so its controls physically cannot fire canvas pointer events.
 */

import { useCallback, useMemo, useState } from 'react';
import type {
  PluckStyle,
  MarkerRole,
  MarkerConnection,
} from '@bassnotion/contracts';
import type { RefMarker } from './ReferenceTransientEditor';
import {
  calculatePitch,
  midiPitchToNoteName,
  BASS_TUNINGS,
} from '@/domains/admin/utils/fretboardCalculations';

const PLUCK_STYLES: PluckStyle[] = [
  'finger',
  'pick',
  'slap_thumb',
  'pop',
  'mute_thumb',
  'tap',
];
const ROLES: MarkerRole[] = ['normal', 'ghost', 'dead', 'accent'];
const CONNECTIONS: MarkerConnection[] = ['hammer_on', 'pull_off', 'slide'];

const PLUCK_LABEL: Record<PluckStyle, string> = {
  finger: 'finger',
  pick: 'pick',
  slap_thumb: 'slap (thumb)',
  pop: 'pop',
  mute_thumb: 'mute thumb',
  tap: 'tap',
};
const CONN_LABEL: Record<MarkerConnection, string> = {
  hammer_on: 'hammer-on',
  pull_off: 'pull-off',
  slide: 'slide',
};

interface Props {
  markers: RefMarker[];
  bassType: '4' | '5' | '6';
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Update a single field of one marker (by id). The editor handles re-commit/save. */
  onUpdate: (id: number, patch: Partial<RefMarker>) => void;
  /** Stamp a patch across many markers at once (fill-down). One commit. */
  onBulkUpdate: (ids: number[], patch: Partial<RefMarker>) => void;
  /** Play a marker's note (audition), by index. */
  onPlay: (index: number) => void;
}

/** Open-string note names for the current bass, indexed by string number (1-based). */
function useOpenStringNames(bassType: '4' | '5' | '6'): string[] {
  return useMemo(() => {
    const tuning = BASS_TUNINGS[bassType];
    // tuning[0] = string 1 (highest); produce ['', name1, name2, ...] (1-based).
    return ['', ...tuning.map((midi) => midiPitchToNoteName(midi))];
  }, [bassType]);
}

/** The live note name for a string+fret, or '—' if not fully set. */
function noteFor(
  string: number | null | undefined,
  fret: number | null | undefined,
  bassType: '4' | '5' | '6',
): string {
  if (string == null || fret == null) return '—';
  try {
    return midiPitchToNoteName(calculatePitch(string, fret, bassType));
  } catch {
    return '—';
  }
}

export function ReferenceMarkerTable({
  markers,
  bassType,
  selectedId,
  onSelect,
  onUpdate,
  onBulkUpdate,
  onPlay,
}: Props) {
  const stringNames = useOpenStringNames(bassType);
  const stringCount = BASS_TUNINGS[bassType].length;
  const annotated = markers.filter((m) => m.string != null && m.fret != null).length;

  // Multi-select (for fill-down): a set of marker ids; shift-click extends a range from
  // the last single-clicked anchor. The single-selected marker (selectedId) is the anchor.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hideAnnotated, setHideAnnotated] = useState(false);

  // The rows actually shown. Hide-annotated collapses a 35-row wall to the few that still
  // need a pitch. We keep the ORIGINAL index (for ▶ playNote + the # column) alongside.
  const rows = useMemo(() => {
    return markers
      .map((m, originalIndex) => ({ m, originalIndex }))
      .filter(
        ({ m }) => !hideAnnotated || m.string == null || m.fret == null,
      );
  }, [markers, hideAnnotated]);

  /** Click a row: shift extends the multi-select range from the anchor; plain click sets
   *  the single selection + resets the multi-select to just this row. */
  const clickRow = useCallback(
    (id: number, withShift: boolean) => {
      if (withShift && selectedId != null) {
        const aIdx = markers.findIndex((m) => m.id === selectedId);
        const bIdx = markers.findIndex((m) => m.id === id);
        if (aIdx >= 0 && bIdx >= 0) {
          const [lo, hi] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
          setSelectedIds(new Set(markers.slice(lo, hi + 1).map((m) => m.id)));
          return;
        }
      }
      onSelect(id);
      setSelectedIds(new Set([id]));
    },
    [markers, selectedId, onSelect],
  );

  /** Move the single selection up/down by one VISIBLE row (keyboard nav). */
  const moveSelection = useCallback(
    (delta: 1 | -1) => {
      if (rows.length === 0) return;
      const cur = rows.findIndex((r) => r.m.id === selectedId);
      const nextRow =
        cur < 0 ? rows[0]! : rows[Math.max(0, Math.min(rows.length - 1, cur + delta))]!;
      onSelect(nextRow.m.id);
      setSelectedIds(new Set([nextRow.m.id]));
    },
    [rows, selectedId, onSelect],
  );

  /** Fill a field down across the multi-selected rows (or the single selection). */
  const fillDown = useCallback(
    (patch: Partial<RefMarker>) => {
      const ids =
        selectedIds.size > 0
          ? [...selectedIds]
          : selectedId != null
            ? [selectedId]
            : [];
      if (ids.length > 0) onBulkUpdate(ids, patch);
    },
    [selectedIds, selectedId, onBulkUpdate],
  );

  if (markers.length === 0) {
    return (
      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
        No markers yet — add transients on the waveform above, then author them here.
      </p>
    );
  }

  const fillTarget = markers.find((m) => m.id === selectedId);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#9aa0ad', marginBottom: 4 }}>
        <span>
          Markers: {markers.length} · Annotated: {annotated}/{markers.length}
          {annotated < markers.length && (
            <span style={{ color: '#e0b24a' }}>
              {' '}· ⚠ {markers.length - annotated} missing pitch
            </span>
          )}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <input type="checkbox" checked={hideAnnotated} onChange={(e) => setHideAnnotated(e.target.checked)} />
          hide annotated
        </label>
        {/* FILL-DOWN: stamp the SELECTED row's value into all shift-selected rows. */}
        <span style={{ color: '#6b7280' }}>
          fill {selectedIds.size > 1 ? `${selectedIds.size} rows` : 'selection'} ▾
        </span>
        <button type="button" style={fillBtn} disabled={!fillTarget} onClick={() => fillDown({ string: fillTarget?.string ?? null })} title="fill the selected row's STRING down">str</button>
        <button type="button" style={fillBtn} disabled={!fillTarget} onClick={() => fillDown({ fret: fillTarget?.fret ?? null })} title="fill the selected row's FRET down">fret</button>
        <button type="button" style={fillBtn} disabled={!fillTarget} onClick={() => fillDown({ pluckStyle: fillTarget?.pluckStyle ?? null })} title="fill the selected row's PLUCK down">pluck</button>
        <span style={{ color: '#6b7280' }}>· ↑/↓ to walk rows · shift-click to range-select</span>
      </div>
      <div
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
        }}
        style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, outline: 'none' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: '#14161b', color: '#9aa0ad' }}>
              <th style={th}>#</th>
              <th style={th}>▶</th>
              <th style={th}>time</th>
              <th style={th}>string</th>
              <th style={th}>fret</th>
              <th style={th}>→note</th>
              <th style={th}>pluck</th>
              <th style={th}>role</th>
              <th style={th}>⟂ from prev</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, originalIndex: i }) => {
              const isSel = m.id === selectedId;
              const inMulti = selectedIds.has(m.id) && selectedIds.size > 1;
              const note = noteFor(m.string, m.fret, bassType);
              const missing = m.string == null || m.fret == null;
              return (
                <tr
                  key={m.id}
                  onClick={(e) => clickRow(m.id, e.shiftKey)}
                  style={{
                    background: isSel
                      ? 'rgba(106,208,140,0.14)'
                      : inMulti
                        ? 'rgba(122,162,255,0.12)'
                        : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  <td style={td}>{i + 1}</td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(i);
                      }}
                      style={playBtn}
                      title="hear this note"
                    >
                      ▶
                    </button>
                  </td>
                  <td style={{ ...td, color: '#6b7280' }}>{m.timeSec.toFixed(3)}</td>
                  <td style={td}>
                    <select
                      value={m.string ?? ''}
                      onChange={(e) =>
                        onUpdate(m.id, {
                          string: e.target.value
                            ? (Number(e.target.value) as RefMarker['string'])
                            : null,
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={sel}
                    >
                      <option value="">—</option>
                      {Array.from({ length: stringCount }, (_, s) => s + 1).map((s) => (
                        <option key={s} value={s}>
                          {stringNames[s]} (str {s})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={m.fret ?? ''}
                      onChange={(e) =>
                        onUpdate(m.id, {
                          fret: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{ ...sel, width: 44 }}
                    />
                  </td>
                  <td style={{ ...td, fontWeight: 600, color: missing ? '#e0b24a' : '#6ad08c' }}>
                    {note}
                    {missing && <span title="pitch not set"> ⚠</span>}
                  </td>
                  <td style={td}>
                    <select
                      value={m.pluckStyle ?? ''}
                      onChange={(e) =>
                        onUpdate(m.id, {
                          pluckStyle: (e.target.value || null) as PluckStyle | null,
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={sel}
                    >
                      <option value="">finger (default)</option>
                      {PLUCK_STYLES.filter((p) => p !== 'finger').map((p) => (
                        <option key={p} value={p}>
                          {PLUCK_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>
                    <select
                      value={m.role ?? ''}
                      onChange={(e) =>
                        onUpdate(m.id, { role: (e.target.value || null) as MarkerRole | null })
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={sel}
                    >
                      <option value="">normal</option>
                      {ROLES.filter((r) => r !== 'normal').map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>
                    <select
                      value={m.connectionFromPrev ?? ''}
                      onChange={(e) =>
                        onUpdate(m.id, {
                          connectionFromPrev: (e.target.value || null) as MarkerConnection | null,
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      disabled={i === 0}
                      style={{
                        ...sel,
                        opacity: i === 0 ? 0.4 : 1,
                        borderColor: m.connectionStale ? '#e0b24a' : 'rgba(255,255,255,0.1)',
                      }}
                      title={
                        i === 0
                          ? 'the first marker has no previous note'
                          : m.connectionStale
                            ? '⚠ the previous note changed (you dragged a marker) — re-check this connection'
                            : ''
                      }
                    >
                      <option value="">—</option>
                      {CONNECTIONS.map((c) => (
                        <option key={c} value={c}>
                          {CONN_LABEL[c]}
                        </option>
                      ))}
                    </select>
                    {m.connectionStale && (
                      <span style={{ color: '#e0b24a', marginLeft: 3 }} title="predecessor changed — re-check">⚠</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '5px 6px',
  fontWeight: 500,
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '3px 6px', color: '#e7e9ee' };
const sel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  color: '#e7e9ee',
  fontSize: 11,
  padding: '2px 4px',
};
const playBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#6ad08c',
  cursor: 'pointer',
  fontSize: 12,
  padding: 0,
};
const fillBtn: React.CSSProperties = {
  background: 'rgba(122,162,255,0.12)',
  border: '1px solid rgba(122,162,255,0.3)',
  borderRadius: 4,
  color: '#aebfff',
  fontSize: 10,
  padding: '2px 6px',
  cursor: 'pointer',
};
