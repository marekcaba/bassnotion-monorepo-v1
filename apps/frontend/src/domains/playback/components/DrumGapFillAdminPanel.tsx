'use client';

/**
 * DrumGapFillAdminPanel — a floating, dev-only tuning panel for the drum
 * time-stretch gap-fill engine (LAUNCH-06).
 *
 * WHY THIS EXISTS. The granular hi-hat tail-fill (see buildExtendedTail.ts) has
 * a genuine design tension: a faithful natural decay (short τ) is honest but
 * doesn't bridge the silent gaps a slowdown opens, while a long sustain fills
 * the gap but risks an unnatural noise pad. There is no analytically "correct"
 * value — it's an ear call. This panel exposes every knob LIVE on the playing
 * DrumSlicePlayer (via PlaybackEngine.setDrumGapFillParams) so the behaviour can
 * be dialled in by ear, in real time, A/B'd against the dry slicer with the
 * Solo Drums toggle.
 *
 * It is intentionally self-contained: it reaches the engine through
 * WindowRegistry (the same accessor the groove-card hook uses) rather than
 * threading props through the control tree, because it's a transient dev tool,
 * not product UI. Mount it behind a dev gate (see isAdminPanelEnabled()).
 *
 * Scheduling knobs (gap/guard/min/fade) take effect on the next scheduled slice
 * with zero rebuild. DSP knobs (maxFillConfidence, τ, grain) re-precompute the
 * per-slice fill buffers synchronously (tens of ms) — fine while tuning.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { WindowRegistry } from '../services/WindowRegistry';

/** Mirrors DrumSlicePlayer.GapFillParams (kept local so this component doesn't
 *  pull the player type — the engine is `any` through WindowRegistry anyway). */
interface GapFillParams {
  gapFill: boolean;
  minGapToFillSeconds: number;
  fillTransientGuardSeconds: number;
  minFillSeconds: number;
  fadeOutSeconds: number;
  maxFillConfidence: number;
  sustainTauSeconds: number | undefined;
  sustainGrainSeconds: number | undefined;
  // Hybrid WSOLA continuous-bed stretch (the real slow-tempo hi-hat fix).
  wsola: boolean;
  strongConfidenceThreshold: number;
  wsolaWindowSeconds: number;
  wsolaHopFraction: number;
  wsolaSearchSeconds: number;
  transientBodySeconds: number;
  transientDuckDepth: number;
  bedTransientNotch: number;
  bedNotchSeconds: number;
  transientBlendSeconds: number;
}

interface EngineLike {
  getDrumGapFillState?: () => {
    params: GapFillParams;
    qualifyingFills: number;
    textureRegions?: number;
  } | null;
  setDrumGapFillParams?: (p: Partial<GapFillParams>) => void;
  setDrumGapFill?: (on: boolean) => void;
  setDrumWsola?: (on: boolean) => void;
  setDrumDiagnosticSolo?: (opts: {
    muteBed?: boolean;
    muteOverlays?: boolean;
  }) => void;
  setInstrumentMuted?: (instrument: string, muted: boolean) => void;
}

function getEngine(): EngineLike | null {
  return (WindowRegistry.getPlaybackEngine() as EngineLike | null) ?? null;
}

/** Gate: show the panel only when explicitly opted in. Set
 *  NEXT_PUBLIC_DRUM_ADMIN_PANEL=true in .env.local, or append ?drumadmin=1 to
 *  the URL (handy on the deployed waitlist without an env change). */
export function isDrumAdminPanelEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (
      typeof process !== 'undefined' &&
      process.env?.NEXT_PUBLIC_DRUM_ADMIN_PANEL === 'true'
    ) {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('drumadmin') === '1';
  } catch {
    return false;
  }
}

/** One labelled slider row that patches a single numeric param on change. */
function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  format,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const shown = format ? format(value) : value.toFixed(3);
  return (
    <div style={{ marginBottom: 10, opacity: disabled ? 0.45 : 1 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 11,
          marginBottom: 2,
        }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#9be9a8' }}>
          {shown}
          {unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#22c55e' }}
      />
      {hint ? (
        <div style={{ fontSize: 9.5, color: '#8a8a8a', lineHeight: 1.25 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

const MS = (v: number) => `${Math.round(v * 1000)}`;

export function DrumGapFillAdminPanel() {
  // Gate decision depends on `window` (URL query / env), so it MUST NOT run
  // during SSR or the first client render — doing so renders the panel on the
  // client but null on the server → a hydration mismatch. Start disabled
  // (matches the server's null), then enable after mount.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (isDrumAdminPanelEnabled()) setEnabled(true);
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const [armed, setArmed] = useState(false); // is a DrumSlicePlayer present?
  const [qualifying, setQualifying] = useState(0); // legacy fill count
  const [textureRegions, setTextureRegions] = useState(0); // WSOLA region count
  const [solo, setSolo] = useState(false);
  const [soloBigHits, setSoloBigHits] = useState(false); // mute bed → hear overlays
  const [soloBed, setSoloBed] = useState(false); // mute overlays → hear bed
  const [showLegacy, setShowLegacy] = useState(false); // collapse old synth fill
  // τ / grain "auto" means: send undefined → buildExtendedTail fits per-slice.
  const [tauAuto, setTauAuto] = useState(true);
  const [grainAuto, setGrainAuto] = useState(true);
  const [p, setP] = useState<GapFillParams>({
    gapFill: false,
    minGapToFillSeconds: 0.04,
    fillTransientGuardSeconds: 0.018,
    minFillSeconds: 0.03,
    fadeOutSeconds: 0.012,
    maxFillConfidence: 0.6,
    sustainTauSeconds: 0.06,
    sustainGrainSeconds: 0.045,
    wsola: true,
    strongConfidenceThreshold: 0.3,
    wsolaWindowSeconds: 0.025,
    wsolaHopFraction: 0.1,
    wsolaSearchSeconds: 0.006,
    transientBodySeconds: 0.21,
    transientDuckDepth: 1.0,
    bedTransientNotch: 1.0,
    bedNotchSeconds: 0.14,
    transientBlendSeconds: 0.115,
  });

  // Mirror the full applied config in a ref so the poll loop can re-push it onto
  // a freshly-armed player WITHOUT a stale closure (settings survive a re-play).
  const appliedRef = useRef<{
    p: GapFillParams;
    tauAuto: boolean;
    grainAuto: boolean;
    solo: boolean;
  }>({ p, tauAuto, grainAuto, solo });
  appliedRef.current = { p, tauAuto, grainAuto, solo };

  // Push the panel's current config onto whatever player is live now.
  const reapply = useCallback(() => {
    const engine = getEngine();
    if (!engine) return;
    const { p: cur, tauAuto: ta, grainAuto: ga, solo: so } = appliedRef.current;
    engine.setDrumWsola?.(cur.wsola);
    engine.setDrumGapFill?.(cur.gapFill);
    engine.setDrumGapFillParams?.({
      minGapToFillSeconds: cur.minGapToFillSeconds,
      fillTransientGuardSeconds: cur.fillTransientGuardSeconds,
      minFillSeconds: cur.minFillSeconds,
      fadeOutSeconds: cur.fadeOutSeconds,
      maxFillConfidence: cur.maxFillConfidence,
      sustainTauSeconds: ta ? undefined : cur.sustainTauSeconds,
      sustainGrainSeconds: ga ? undefined : cur.sustainGrainSeconds,
      strongConfidenceThreshold: cur.strongConfidenceThreshold,
      wsolaWindowSeconds: cur.wsolaWindowSeconds,
      wsolaHopFraction: cur.wsolaHopFraction,
      wsolaSearchSeconds: cur.wsolaSearchSeconds,
      transientBodySeconds: cur.transientBodySeconds,
      transientDuckDepth: cur.transientDuckDepth,
      bedTransientNotch: cur.bedTransientNotch,
      bedNotchSeconds: cur.bedNotchSeconds,
      transientBlendSeconds: cur.transientBlendSeconds,
    });
    engine.setInstrumentMuted?.('audio-bass', so);
    engine.setInstrumentMuted?.('audio-harmony', so);
  }, []);

  // Poll the engine: detect arm/re-arm, refresh the qualifying-fill count. On
  // the FIRST ever arm, seed our controls from the engine's live values; on
  // every SUBSEQUENT (re)arm — a fresh player from a re-play — re-push our
  // config so the user's tuning isn't lost.
  const everSeededRef = useRef(false);
  const wasArmedRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const engine = getEngine();
      const state = engine?.getDrumGapFillState?.() ?? null;
      if (!state) {
        setArmed(false);
        wasArmedRef.current = false;
        return;
      }
      setArmed(true);
      setQualifying(state.qualifyingFills);
      setTextureRegions(state.textureRegions ?? 0);
      if (!everSeededRef.current) {
        everSeededRef.current = true;
        wasArmedRef.current = true;
        const live = state.params;
        setP((prev) => ({
          ...prev,
          ...live,
          // keep our display defaults when the engine reports "auto" (undefined)
          sustainTauSeconds: live.sustainTauSeconds ?? prev.sustainTauSeconds,
          sustainGrainSeconds:
            live.sustainGrainSeconds ?? prev.sustainGrainSeconds,
        }));
        setTauAuto(live.sustainTauSeconds == null);
        setGrainAuto(live.sustainGrainSeconds == null);
      } else if (!wasArmedRef.current) {
        // Re-armed (new player) after a previous arm — re-push our config.
        wasArmedRef.current = true;
        reapply();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled, reapply]);

  // Push a partial patch to the live engine + mirror into local state.
  const patch = useCallback((next: Partial<GapFillParams>) => {
    setP((prev) => ({ ...prev, ...next }));
    getEngine()?.setDrumGapFillParams?.(next);
  }, []);

  const toggleGapFill = useCallback(
    (on: boolean) => {
      setP((prev) => ({ ...prev, gapFill: on }));
      const engine = getEngine();
      // setDrumGapFill builds fills lazily on first enable; setDrumGapFillParams
      // also accepts gapFill, but use the dedicated toggle to match its lazy path.
      engine?.setDrumGapFill?.(on);
    },
    [],
  );

  const toggleWsola = useCallback((on: boolean) => {
    setP((prev) => ({ ...prev, wsola: on }));
    getEngine()?.setDrumWsola?.(on);
  }, []);

  // Diagnostic solo: mute bed (hear only crisp overlaid kicks/snares) or mute
  // overlays (hear only the stretched bed texture). Mutually exclusive.
  const toggleSoloBigHits = useCallback((on: boolean) => {
    setSoloBigHits(on);
    if (on) setSoloBed(false);
    getEngine()?.setDrumDiagnosticSolo?.({
      muteBed: on,
      muteOverlays: on ? false : undefined,
    });
  }, []);
  const toggleSoloBed = useCallback((on: boolean) => {
    setSoloBed(on);
    if (on) setSoloBigHits(false);
    getEngine()?.setDrumDiagnosticSolo?.({
      muteOverlays: on,
      muteBed: on ? false : undefined,
    });
  }, []);

  const toggleSolo = useCallback((on: boolean) => {
    setSolo(on);
    const engine = getEngine();
    engine?.setInstrumentMuted?.('audio-bass', on);
    engine?.setInstrumentMuted?.('audio-harmony', on);
  }, []);

  const setTauAutoMode = useCallback(
    (auto: boolean) => {
      setTauAuto(auto);
      // auto → clear the override (undefined); manual → send the slider value.
      getEngine()?.setDrumGapFillParams?.({
        sustainTauSeconds: auto ? undefined : p.sustainTauSeconds,
      });
    },
    [p.sustainTauSeconds],
  );

  const setGrainAutoMode = useCallback(
    (auto: boolean) => {
      setGrainAuto(auto);
      getEngine()?.setDrumGapFillParams?.({
        sustainGrainSeconds: auto ? undefined : p.sustainGrainSeconds,
      });
    },
    [p.sustainGrainSeconds],
  );

  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 2147483000,
        width: collapsed ? 'auto' : 300,
        maxHeight: '85vh',
        overflowY: 'auto',
        background: 'rgba(17,17,20,0.96)',
        color: '#e6e6e6',
        border: '1px solid #2e2e36',
        borderRadius: 10,
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12,
        padding: collapsed ? '8px 12px' : 14,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          gap: 10,
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ fontWeight: 700, letterSpacing: 0.3 }}>
          🥁 Drum Stretch
        </span>
        <span style={{ color: '#8a8a8a', fontSize: 11 }}>
          {armed ? `${textureRegions} hits` : 'no player'}{' '}
          {collapsed ? '▸' : '▾'}
        </span>
      </div>

      {collapsed ? null : (
        <div style={{ marginTop: 12 }}>
          {!armed ? (
            <div style={{ color: '#d99', marginBottom: 10, fontSize: 11 }}>
              Press play on a Groove Card to arm the drum slicer, then tune here.
            </div>
          ) : null}

          {/* WSOLA master toggle — the real slow-tempo hi-hat fix */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={p.wsola}
              onChange={(e) => toggleWsola(e.target.checked)}
              style={{ accentColor: '#22c55e' }}
            />
            <span style={{ fontWeight: 600 }}>
              Smooth stretch (WSOLA) {p.wsola ? 'ON' : 'OFF'}
            </span>
          </label>
          <div
            style={{
              fontSize: 9.5,
              color: '#8a8a8a',
              marginBottom: 12,
              lineHeight: 1.3,
            }}
          >
            Stretches the WHOLE loop smoothly (no silent gaps) and overlays
            bit-exact kick/snare attacks on top — the big hits stay crisp,
            everything else slows/speeds continuously.
          </div>

          {/* Solo drums — A/B against the dry slicer */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={solo}
              onChange={(e) => toggleSolo(e.target.checked)}
              style={{ accentColor: '#22c55e' }}
            />
            <span style={{ fontWeight: 600 }}>Solo drums</span>
            <span style={{ color: '#8a8a8a', fontSize: 10 }}>
              (mutes bass + harmony)
            </span>
          </label>

          {/* DIAGNOSTIC: solo the bed vs the overlays to localize a double */}
          <div
            style={{
              border: '1px solid #3a3320',
              background: 'rgba(224,161,6,0.06)',
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#e0a106',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Diagnose a double (solo a layer)
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={soloBigHits}
                onChange={(e) => toggleSoloBigHits(e.target.checked)}
                style={{ accentColor: '#e0a106' }}
              />
              <span style={{ fontWeight: 600 }}>Only big hits</span>
              <span style={{ color: '#8a8a8a', fontSize: 10 }}>
                (mute bed → crisp kicks/snares only)
              </span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={soloBed}
                onChange={(e) => toggleSoloBed(e.target.checked)}
                style={{ accentColor: '#e0a106' }}
              />
              <span style={{ fontWeight: 600 }}>Only bed</span>
              <span style={{ color: '#8a8a8a', fontSize: 10 }}>
                (mute overlays → stretched texture only)
              </span>
            </label>
            <div style={{ fontSize: 9.5, color: '#8a8a8a', marginTop: 6, lineHeight: 1.3 }}>
              If the double is in &ldquo;Only bed&rdquo; → the bed isn&rsquo;t
              removing the hit. If &ldquo;Only big hits&rdquo; is clean but the
              full mix doubles → bed/overlay timing.
            </div>
          </div>

          {/* WSOLA tuning */}
          <div
            style={{
              borderTop: '1px solid #2e2e36',
              paddingTop: 10,
              marginBottom: 14,
              opacity: p.wsola ? 1 : 0.5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Transient overlay (live — no rebuild)
            </div>

            <SliderRow
              label="Big-hit threshold"
              hint="Which onsets get a crisp BIT-EXACT attack overlaid on the smooth bed. At/above = kick/snare (overlaid sharp). Lower → more hits get the crisp overlay; raise if a hat starts sounding doubled. The headline knob."
              value={p.strongConfidenceThreshold}
              min={0.1}
              max={1}
              step={0.05}
              format={(v) => v.toFixed(2)}
              disabled={!p.wsola}
              onChange={(v) => patch({ strongConfidenceThreshold: v })}
            />
            <SliderRow
              label="Attack body"
              hint="How long the crisp bit-exact attack plays over the bed. Short = just the punch; longer = more of the dry hit (and more space for a full kick/snare body) but risks doubling with the bed."
              value={p.transientBodySeconds}
              min={0.02}
              max={0.3}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ transientBodySeconds: v })}
            />
            <SliderRow
              label="Bed duck depth"
              hint="How far the bed dips UNDER each crisp attack (the floor of the crossfade). 100% = no dip (full blend, bed stays up); lower = bed drops more. Raise toward 100% if the ducking sounds too prominent / holey."
              value={p.transientDuckDepth}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              disabled={!p.wsola}
              onChange={(v) => patch({ transientDuckDepth: v })}
            />
            <SliderRow
              label="Crossfade blend"
              hint="Width of the EQUAL-POWER crossfade between the crisp hit and the bed. Wider = the bed fades down/up more gradually around each hit (smoother blend, less of an abrupt duck). The knob for 'blend them nicely'."
              value={p.transientBlendSeconds}
              min={0.005}
              max={0.15}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ transientBlendSeconds: v })}
            />
            <SliderRow
              label="Remove hits from bed"
              hint="Cuts the kick/snare BODY out of the smooth bed before stretching, so the stretch can't duplicate it elsewhere (the 'doubled body, no transient' artifact). 100% = bodies fully removed; the crisp overlays carry all the punch. Drop toward 0% to hear the old full-bed behavior. (rebuilds)"
              value={p.bedTransientNotch}
              min={0}
              max={1}
              step={0.1}
              format={(v) => `${Math.round(v * 100)}%`}
              disabled={!p.wsola}
              onChange={(v) => patch({ bedTransientNotch: v })}
            />

            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                margin: '14px 0 8px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Bed quality (rebuilds on change)
            </div>
            <SliderRow
              label="Window"
              hint="WSOLA analysis window. Bigger = smoother bed; smaller = crisper but more flutter risk."
              value={p.wsolaWindowSeconds}
              min={0.02}
              max={0.08}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ wsolaWindowSeconds: v })}
            />
            <SliderRow
              label="Overlap (hop fraction)"
              hint="Synthesis hop as a fraction of the window. 0.25 = 75% overlap (COLA, no flutter). Smaller = denser/smoother, heavier."
              value={p.wsolaHopFraction}
              min={0.1}
              max={0.5}
              step={0.05}
              format={(v) => `${Math.round((1 - v) * 100)}% ov`}
              disabled={!p.wsola}
              onChange={(v) => patch({ wsolaHopFraction: v })}
            />
            <SliderRow
              label="Search radius"
              hint="Cross-correlation lag search. Bigger finds a better in-phase window (less comb) but costs CPU."
              value={p.wsolaSearchSeconds}
              min={0.004}
              max={0.02}
              step={0.002}
              unit="ms"
              format={MS}
              disabled={!p.wsola}
              onChange={(v) => patch({ wsolaSearchSeconds: v })}
            />
          </div>

          {/* Legacy synth fill — superseded by WSOLA, collapsed by default */}
          <div
            style={{
              fontSize: 10,
              color: '#6a6a6a',
              cursor: 'pointer',
              marginBottom: showLegacy ? 8 : 0,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
            onClick={() => setShowLegacy((s) => !s)}
          >
            {showLegacy ? '▾' : '▸'} Legacy synth fill (superseded)
          </div>

          {!showLegacy ? null : (
          <>
          {/* gapFill master toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={p.gapFill}
              onChange={(e) => toggleGapFill(e.target.checked)}
              style={{ accentColor: '#22c55e' }}
            />
            <span style={{ fontWeight: 600 }}>
              Gap-fill {p.gapFill ? 'ON' : 'OFF'}{' '}
              <span style={{ color: '#8a8a8a', fontWeight: 400 }}>
                ({qualifying} fills)
              </span>
            </span>
          </label>

          <div
            style={{
              borderTop: '1px solid #2e2e36',
              paddingTop: 10,
              opacity: p.gapFill ? 1 : 0.5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Sustain (DSP — rebuilds fills)
            </div>

            {/* τ — the headline knob */}
            <div style={{ marginBottom: 4 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  color: '#8a8a8a',
                  marginBottom: 2,
                }}
              >
                <input
                  type="checkbox"
                  checked={tauAuto}
                  onChange={(e) => setTauAutoMode(e.target.checked)}
                  style={{ accentColor: '#22c55e' }}
                />
                decay τ: fit per-slice (auto)
              </label>
            </div>
            <SliderRow
              label="Decay τ"
              hint="Bigger = the fill sustains longer (bridges the gap) but risks a noise pad. Smaller = a short natural-decay wisp."
              value={p.sustainTauSeconds ?? 0.06}
              min={0.02}
              max={0.6}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.gapFill || tauAuto}
              onChange={(v) => patch({ sustainTauSeconds: v })}
            />

            <div style={{ marginBottom: 4 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  color: '#8a8a8a',
                  marginBottom: 2,
                }}
              >
                <input
                  type="checkbox"
                  checked={grainAuto}
                  onChange={(e) => setGrainAutoMode(e.target.checked)}
                  style={{ accentColor: '#22c55e' }}
                />
                grain: default (auto)
              </label>
            </div>
            <SliderRow
              label="Grain size"
              hint="Granular window. Bigger = smoother/denser bed; too big colours the noise."
              value={p.sustainGrainSeconds ?? 0.045}
              min={0.01}
              max={0.12}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.gapFill || grainAuto}
              onChange={(v) => patch({ sustainGrainSeconds: v })}
            />

            <SliderRow
              label="Max fill confidence"
              hint="Skip fills on hits LOUDER than this (kicks/snares). Higher = more slices qualify; too high fills primary transients = false pulse."
              value={p.maxFillConfidence}
              min={0.1}
              max={1}
              step={0.05}
              format={(v) => v.toFixed(2)}
              disabled={!p.gapFill}
              onChange={(v) => patch({ maxFillConfidence: v })}
            />

            <div
              style={{
                fontSize: 10,
                color: '#8a8a8a',
                margin: '12px 0 8px',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Scheduling (live — no rebuild)
            </div>

            <SliderRow
              label="Min gap to fill"
              hint="Only fill when the real silent gap after a slice exceeds this."
              value={p.minGapToFillSeconds}
              min={0.01}
              max={0.3}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.gapFill}
              onChange={(v) => patch({ minGapToFillSeconds: v })}
            />
            <SliderRow
              label="Transient guard"
              hint="Stop the fill this long before the next onset so its fade-out clears the next hit's attack."
              value={p.fillTransientGuardSeconds}
              min={0.004}
              max={0.06}
              step={0.002}
              unit="ms"
              format={MS}
              disabled={!p.gapFill}
              onChange={(v) => patch({ fillTransientGuardSeconds: v })}
            />
            <SliderRow
              label="Min fill length"
              hint="Don't bother filling a hole shorter than this."
              value={p.minFillSeconds}
              min={0.01}
              max={0.2}
              step={0.005}
              unit="ms"
              format={MS}
              disabled={!p.gapFill}
              onChange={(v) => patch({ minFillSeconds: v })}
            />
            <SliderRow
              label="Crossfade (fade in/out)"
              hint="Fade-in overlaps the slice's fade-out; fade-out ducks before the next onset."
              value={p.fadeOutSeconds}
              min={0.002}
              max={0.05}
              step={0.002}
              unit="ms"
              format={MS}
              disabled={!p.gapFill}
              onChange={(v) => patch({ fadeOutSeconds: v })}
            />
          </div>
          </>
          )}

          <div style={{ fontSize: 9.5, color: '#6a6a6a', marginTop: 12 }}>
            Slow the tempo below default (ratio &lt; 1) to hear the texture
            stretch — it only acts on a slowdown. Toggle Solo drums to A/B WSOLA
            on vs off.
          </div>
        </div>
      )}
    </div>
  );
}

export default DrumGapFillAdminPanel;
