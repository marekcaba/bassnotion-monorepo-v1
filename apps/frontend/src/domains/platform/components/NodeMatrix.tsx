'use client';

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type CSSProperties,
} from 'react';
import { Play, Loader2, X } from 'lucide-react';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { useAuth } from '@/domains/user/hooks/use-auth';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/shared/components/ui/avatar';

// ─── Skill domain types ──────────────────────────────────────────────
type SkillId = 'time' | 'sound' | 'hands' | 'ear' | 'neck' | 'theory' | 'foundation';
type SynthesisId = 'groove' | 'pocket' | 'voice' | 'intervals' | 'navigation' | 'flow' | 'transcription';

interface SkillNode {
  id: SkillId;
  label: string;
  /** Total dots (milestones) for this level */
  total: number;
  /** Dots already filled */
  filled: number;
  /** Current level (drives core size) */
  level: number;
  /** Angle in degrees around the constellation (0 = right, -90 = top) */
  angle: number;
}

interface SynthesisNode {
  id: SynthesisId;
  label: string;
  /** The two parent skills that combine */
  parents: [SkillId, SkillId];
  /** Angle in degrees (midpoint between parents) */
  angle: number;
  /** Current level (1-5) */
  level: number;
}

// ─── Level-based color system ────────────────────────────────────────
// All nodes of the same level share the same color
const LEVEL_COLORS: Record<number, { base: string; glow: string }> = {
  1: { base: '#E8A44A', glow: 'rgba(232,164,74,0.25)' },   // orange
  2: { base: '#5B8DEF', glow: 'rgba(91,141,239,0.25)' },   // blue
  3: { base: '#6BCF8E', glow: 'rgba(107,207,142,0.25)' },   // green
  4: { base: '#C77DFF', glow: 'rgba(199,125,255,0.25)' },   // purple
  5: { base: '#FF7EB3', glow: 'rgba(255,126,179,0.25)' },   // pink
};

function colorForLevel(level: number): { base: string; glow: string } {
  return LEVEL_COLORS[Math.min(level, 5)] ?? { base: '#E8A44A', glow: 'rgba(232,164,74,0.25)' };
}

// (Legacy per-ID maps removed — all color lookups now use colorForLevel)

// ─── Static mock data (will be replaced with real API data) ──────────
// 7 primary nodes evenly spaced (360/7 ≈ 51.43°)
// Foundation anchored at bottom (90°). Starting angle offset so slot 4 = 90°.
// CW order: Time → Sound → Hands → Ear → Foundation → Neck → Theory
const STEP = 360 / 7;
const START = 90 - STEP * 4; // ≈ -115.71° — so slot 4 lands exactly at 90°
const MOCK_NODES: SkillNode[] = [
  { id: 'time',       label: 'Time',       total: 8,  filled: 5, level: 2, angle: START },
  { id: 'sound',      label: 'Sound',      total: 12, filled: 8, level: 3, angle: START + STEP },
  { id: 'hands',      label: 'Hands',      total: 8,  filled: 4, level: 1, angle: START + STEP * 2 },
  { id: 'ear',        label: 'Ear',        total: 8,  filled: 2, level: 1, angle: START + STEP * 3 },
  { id: 'foundation', label: 'Foundation', total: 10, filled: 6, level: 2, angle: START + STEP * 4 },  // = 90° (bottom)
  { id: 'neck',       label: 'Neck',       total: 8,  filled: 1, level: 1, angle: START + STEP * 5 },
  { id: 'theory',     label: 'Theory',     total: 8,  filled: 3, level: 1, angle: START + STEP * 6 },
];

// ─── Static mock data for synthesis nodes ────────────────────────────
// Each placed at the midpoint between its neighboring primaries (half-slots)
const MOCK_SYNTHESIS: SynthesisNode[] = [
  { id: 'groove',        label: 'Groove',        parents: ['time', 'hands'],      angle: START + STEP * 0.5, level: 2 },  // between time & sound
  { id: 'voice',         label: 'Voice',         parents: ['sound', 'hands'],     angle: START + STEP * 1.5, level: 1 },  // between sound & hands
  { id: 'pocket',        label: 'Pocket',        parents: ['time', 'ear'],        angle: START + STEP * 2.5, level: 1 },  // between hands & ear
  { id: 'transcription', label: 'Transcription', parents: ['ear', 'neck'],        angle: START + STEP * 3.5, level: 1 },  // between ear & foundation
  { id: 'flow',          label: 'Flow',          parents: ['time', 'foundation'], angle: START + STEP * 4.5, level: 1 },  // between foundation & neck
  { id: 'intervals',     label: 'Intervals',     parents: ['ear', 'theory'],      angle: START + STEP * 5.5, level: 1 },  // between neck & theory
  { id: 'navigation',    label: 'Navigation',    parents: ['neck', 'theory'],     angle: START + STEP * 6.5, level: 1 },  // between theory & time (wraps)
];

// ─── Sizing helpers (scale = 1 at 640px baseline) ───────────────────
const DESIGN_BASELINE = 640;

function coreSize(level: number, scale: number): number {
  const base = level >= 5 ? 120 : level >= 4 ? 100 : level >= 3 ? 84 : level >= 2 ? 68 : 52;
  return Math.round(base * scale);
}

function orbitalSize(level: number, scale: number): number {
  const base = level >= 5 ? 164 : level >= 4 ? 138 : level >= 3 ? 114 : level >= 2 ? 92 : 72;
  return Math.round(base * scale);
}

// ─── Orbital Dot ─────────────────────────────────────────────────────
function OrbitalDot({
  index,
  total,
  filled,
  radius,
  color,
  scale,
  glow,
}: {
  index: number;
  total: number;
  filled: number;
  radius: number;
  color: { base: string; glow: string };
  scale: number;
  glow: number;
}) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const x = radius + radius * Math.cos(angle);
  const y = radius + radius * Math.sin(angle);

  const isFilled = index < filled;
  const isActive = index === filled && filled < total;
  const dotSize = Math.max(Math.round(9 * scale), 5);
  const borderWidth = Math.max(1.5 * scale, 1);

  return (
    <span
      className="absolute rounded-full"
      style={{
        width: dotSize,
        height: dotSize,
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        border: `${borderWidth}px solid ${isFilled || isActive ? color.base : color.base + '30'}`,
        background: isFilled || isActive ? color.base : color.base + '10',
        boxShadow:
          isActive
            ? `0 0 ${10 * scale * glow}px ${color.base}`
            : isFilled
              ? `0 0 ${6 * scale * glow}px ${color.glow}`
              : 'none',
        animation: isActive ? 'dot-pulse 2.4s ease-in-out infinite' : 'none',
        '--dot-color': color.base,
      } as CSSProperties}
    />
  );
}

// ─── Arc connecting filled dots ──────────────────────────────────────
function OrbitalArc({
  total,
  filled,
  radius,
  color,
  scale,
  glow,
}: {
  total: number;
  filled: number;
  /** Same radius value used by OrbitalDot */
  radius: number;
  color: string;
  scale: number;
  glow: number;
}) {
  // Include the active/pulsing dot (index === filled) in the arc
  const arcEnd = filled < total ? filled : filled - 1;
  if (arcEnd < 1) return null;

  // Dots use: x = radius + radius * cos(angle), y = radius + radius * sin(angle)
  // So the center of the dot coordinate space is (radius, radius)
  const svgSize = radius * 2 + 12; // extra room so stroke isn't clipped
  const offset = 6; // half of extra room

  const startAngle = (0 / total) * 2 * Math.PI - Math.PI / 2;
  const endAngle = (arcEnd / total) * 2 * Math.PI - Math.PI / 2;

  const x1 = offset + radius + radius * Math.cos(startAngle);
  const y1 = offset + radius + radius * Math.sin(startAngle);
  const x2 = offset + radius + radius * Math.cos(endAngle);
  const y2 = offset + radius + radius * Math.sin(endAngle);

  const largeArc = arcEnd / total > 0.5 ? 1 : 0;

  return (
    <svg
      className="pointer-events-none absolute z-[1]"
      width={svgSize}
      height={svgSize}
      style={{ left: -6, top: -6, overflow: 'visible' }}
    >
      <path
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={Math.max(3.5 * scale, 1.5)}
        opacity={0.35 * glow}
      />
    </svg>
  );
}

// ─── Node descriptions (mock — will come from API) ──────────────────
const SKILL_DESCRIPTIONS: Record<SkillId, string> = {
  time: 'Rhythm, subdivision, and feel — the pulse that holds everything together.',
  sound: 'Tone production, dynamics, and articulation — how your bass speaks.',
  hands: 'Left & right hand mechanics — speed, accuracy, and fluency.',
  ear: 'Interval recognition, chord tones, and hearing what comes next.',
  neck: 'Fretboard navigation, patterns, and instant recall across all positions.',
  theory: 'Harmony, scales, and structure — the language behind the music.',
  foundation: 'Form, discipline, and the mindset of a working musician.',
};

const SYNTHESIS_DESCRIPTIONS: Record<SynthesisId, string> = {
  groove: 'Where time meets hands — making the rhythm feel alive.',
  pocket: 'Time meets ear — locking in with what you hear around you.',
  voice: 'Sound meets hands — shaping tone through technique.',
  intervals: 'Ear meets theory — hearing the harmony, naming the notes.',
  navigation: 'Neck meets theory — knowing where to go before you get there.',
  flow: 'Time meets foundation — discipline in motion, playing with form.',
  transcription: 'Ear meets neck — turning what you hear into what you play.',
};

// ─── Selected node type ─────────────────────────────────────────────
type SelectedNode =
  | { kind: 'skill'; node: SkillNode }
  | { kind: 'synthesis'; node: SynthesisNode };

// ─── Single Skill Node ───────────────────────────────────────────────
function SkillNodeElement({
  node,
  x,
  y,
  scale,
  glow,
  onSelect,
}: {
  node: SkillNode;
  x: number;
  y: number;
  scale: number;
  glow: number;
  onSelect: () => void;
}) {
  const color = colorForLevel(node.level);
  const core = coreSize(node.level, scale);
  const orbital = orbitalSize(node.level, scale);
  const dotRadius = orbital / 2 + 1;
  const labelSize = Math.max(14 * scale, 10);
  const coreLabelSize = Math.max(14 * scale, 9);
  const borderWidth = Math.max(2 * scale, 1);

  return (
    <div
      className="absolute z-[12]"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
    <div
      className="flex cursor-pointer flex-col items-center transition-transform duration-400 ease-out hover:scale-[1.08]"
      onClick={onSelect}
    >
      {/* Orbital system */}
      <div
        className="relative"
        style={{ width: orbital, height: orbital, marginBottom: Math.round(6 * scale) }}
      >
        {/* Arc connecting filled dots */}
        <OrbitalArc
          total={node.total}
          filled={node.filled}
          radius={dotRadius}
          color={color.base}
          scale={scale}
          glow={glow}
        />

        {/* Core circle */}
        <div
          className="absolute left-1/2 top-1/2 z-[2] flex items-center justify-center rounded-full"
          style={{
            width: core,
            height: core,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle at 40% 35%, ${color.glow}, rgba(12,11,15,0.9))`,
            border: `${borderWidth}px solid rgba(255,255,255,0.12)`,
            boxShadow: `0 0 ${Math.round(30 * scale * glow)}px ${color.glow}`,
          }}
        >
          <span
            className="font-mono font-medium"
            style={{ color: color.base, fontSize: coreLabelSize }}
          >
            {node.filled}/{node.total}
          </span>
        </div>

        {/* Orbital dots */}
        {Array.from({ length: node.total }, (_, i) => (
          <OrbitalDot
            key={i}
            index={i}
            total={node.total}
            filled={node.filled}
            radius={dotRadius}
            color={color}
            scale={scale}
            glow={glow}
          />
        ))}
      </div>

      {/* Label */}
      <span
        className="whitespace-nowrap text-center font-serif text-[#E8E4DD]"
        style={{ fontSize: labelSize }}
      >
        {node.label}
      </span>
    </div>
    </div>
  );
}

// ─── Synthesis sizing (smaller than primary nodes) ──────────────────
function synthesisCoreSize(level: number, scale: number): number {
  const base = level >= 5 ? 72 : level >= 4 ? 62 : level >= 3 ? 52 : level >= 2 ? 44 : 36;
  return Math.round(base * scale);
}

// ─── Synthesis Node (outer ring) ────────────────────────────────────
function SynthesisNodeElement({
  node,
  x,
  y,
  scale,
  glow,
  onSelect,
}: {
  node: SynthesisNode;
  x: number;
  y: number;
  scale: number;
  glow: number;
  onSelect: () => void;
}) {
  const color = colorForLevel(node.level);
  const core = synthesisCoreSize(node.level, scale);
  const coreLabelSize = Math.max(10 * scale, 7);
  const labelSize = Math.max(11 * scale, 8);
  const borderWidth = Math.max(1.5 * scale, 1);

  return (
    <div
      className="absolute z-[12]"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="flex cursor-pointer flex-col items-center opacity-25 transition-all duration-400 ease-out hover:scale-[1.1] hover:opacity-100" onClick={onSelect}>
        {/* Core circle */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: core,
            height: core,
            background: `radial-gradient(circle at 40% 35%, ${color.glow}, rgba(12,11,15,0.92))`,
            border: `${borderWidth}px solid rgba(255,255,255,0.10)`,
            boxShadow: `0 0 ${Math.round(20 * scale * glow)}px ${color.glow}`,
          }}
        >
          <span
            className="font-mono font-medium"
            style={{ color: color.base, fontSize: coreLabelSize }}
          >
            L{node.level}
          </span>
        </div>

        {/* Label */}
        <span
          className="whitespace-nowrap text-center font-medium tracking-wide"
          style={{ color: color.base, opacity: 0.7, fontSize: labelSize, marginTop: Math.round(6 * scale) }}
        >
          {node.label}
        </span>
      </div>
    </div>
  );
}

// ─── SVG lines connecting synthesis to parents ──────────────────────
function SynthesisLines({
  synthNodes,
  synthPositions,
  primaryPositions,
}: {
  synthNodes: SynthesisNode[];
  synthPositions: Record<string, { x: number; y: number }>;
  primaryPositions: Record<string, { x: number; y: number }>;
}) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full">
      {synthNodes.map((s) => {
        const sp = synthPositions[s.id];
        if (!sp) return null;
        return s.parents.map((parentId) => {
          const pp = primaryPositions[parentId];
          if (!pp) return null;
          return (
            <line
              key={`${s.id}-${parentId}`}
              x1={sp.x}
              y1={sp.y}
              x2={pp.x}
              y2={pp.y}
              stroke={colorForLevel(s.level).base}
              strokeWidth={1}
              opacity={0.08}
              strokeDasharray="3 5"
            />
          );
        });
      })}
    </svg>
  );
}

// ─── SVG Radial Lines (center to each node) ─────────────────────────
function RadialLines({
  nodes,
  positions,
  center,
}: {
  nodes: SkillNode[];
  positions: Record<string, { x: number; y: number }>;
  center: { x: number; y: number };
}) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full">
      {nodes.map((n) => {
        const p = positions[n.id];
        if (!p) return null;
        return (
          <line
            key={`center-${n.id}`}
            x1={center.x}
            y1={center.y}
            x2={p.x}
            y2={p.y}
            stroke={colorForLevel(n.level).base}
            strokeWidth={1}
            opacity={0.06}
            strokeDasharray="2 6"
          />
        );
      })}
    </svg>
  );
}

// ─── Center Avatar Node ──────────────────────────────────────────────
function CenterNode({
  displayName,
  avatarUrl,
  radius,
  scale,
  glow,
}: {
  displayName?: string;
  avatarUrl?: string;
  radius: number;
  scale: number;
  glow: number;
}) {
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';
  const diameter = Math.max(radius * 1.4 - 40 * scale, 100 * scale);
  const avatarSize = Math.round(56 * scale);
  const nameSize = Math.max(20 * scale, 13);
  const titleSize = Math.max(9 * scale, 7);
  const mottoSize = Math.max(11 * scale, 8);
  const borderWidth = Math.max(1.5 * scale, 1);

  return (
    <div
      className="absolute left-1/2 top-1/2 z-10 flex flex-col items-center justify-center rounded-full"
      style={{
        width: diameter,
        height: diameter,
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(circle at 40% 35%, rgba(232,164,74,0.18), rgba(20,19,24,0.95) 65%)',
        border: `${borderWidth}px solid rgba(232,164,74,0.15)`,
        boxShadow: [
          `0 0 ${Math.round(50 * scale * glow)}px rgba(232,164,74,0.12)`,
          `0 0 ${Math.round(100 * scale * glow)}px rgba(232,164,74,0.05)`,
          `inset 0 0 ${Math.round(40 * scale)}px rgba(0,0,0,0.4)`,
        ].join(', '),
      }}
    >
      {/* Avatar */}
      <Avatar
        className="ring-2 ring-[#E8A44A]/25"
        style={{
          width: avatarSize,
          height: avatarSize,
          marginBottom: Math.round(10 * scale),
          boxShadow: `0 0 ${Math.round(30 * scale * glow)}px rgba(232,164,74,0.2)`,
        }}
      >
        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName ?? ''} />}
        <AvatarFallback
          className="bg-gradient-to-br from-[#E8A44A]/20 to-[#1A1820] font-serif font-semibold text-[#E8A44A]"
          style={{ fontSize: Math.round(22 * scale) }}
        >
          {initial}
        </AvatarFallback>
      </Avatar>

      {/* Name */}
      <div
        className="font-serif font-semibold text-[#E8E4DD]"
        style={{ fontSize: nameSize, marginBottom: Math.round(3 * scale) }}
      >
        {displayName || 'Player'}
      </div>

      {/* Title / rank */}
      <div
        className="font-mono uppercase text-[#E8A44A]"
        style={{ fontSize: titleSize, letterSpacing: '2px', marginBottom: Math.round(10 * scale) }}
      >
        Bass Player
      </div>

      {/* Motto / tagline */}
      <div
        className="max-w-[70%] text-center font-serif italic text-[#8A8690]"
        style={{ fontSize: mottoSize, lineHeight: 1.4 }}
      >
        Your journey through the low end starts here
      </div>
    </div>
  );
}

// ─── Session Card ────────────────────────────────────────────────────
export function SessionCard() {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318] p-[22px]">
      {/* Top accent line */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8A44A] to-transparent opacity-40" />

      <div className="mb-3.5 font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
        Today&apos;s Session
      </div>

      <div className="mb-3.5 flex items-start justify-between">
        <div>
          <div className="font-serif text-[22px] text-[#E8E4DD]">The Grid</div>
          <div className="max-w-[240px] text-xs leading-[1.45] text-[#8A8690]">
            Where you place a note matters more than what note you play.
          </div>
        </div>
        <div className="whitespace-nowrap text-right">
          <div className="font-mono text-[22px] font-light text-[#E8E4DD]">
            20
          </div>
          <div className="font-mono text-[11px] text-[#5A5660]">min</div>
        </div>
      </div>

      {/* Tags */}
      <div className="mb-[18px] flex flex-wrap gap-1.5">
        {(['time', 'sound', 'hands'] as SkillId[]).map((id) => {
          const nodeLevel = MOCK_NODES.find((n) => n.id === id)?.level ?? 1;
          const c = colorForLevel(nodeLevel);
          return (
            <span
              key={id}
              className="rounded-full px-2.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.5px]"
              style={{
                color: c.base,
                borderWidth: 1,
                borderColor: c.glow,
                background: `${c.base}08`,
              }}
            >
              {id}
            </span>
          );
        })}
      </div>

      {/* Start button */}
      <button className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-br from-[#E8A44A] to-[#D4903A] px-4 py-3 text-sm font-semibold text-[#0C0B0F] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(232,164,74,0.3)]">
        <Play className="size-4" fill="currentColor" />
        Start Session
      </button>
    </div>
  );
}

// ─── Progress Card ───────────────────────────────────────────────────
interface Recording {
  name: string;
  session: string;
  duration: string;
  faded?: boolean;
}

const MOCK_RECORDINGS: Recording[] = [
  { name: 'Duration Dial — Mixed', session: 'Session 2 · Yesterday', duration: '0:18' },
  { name: 'The 50/50 — Final Take', session: 'Session 1 · 2 days ago', duration: '0:24' },
  { name: 'Day 1 — Before Muting', session: 'Session 1 · 2 days ago', duration: '0:15', faded: true },
];

export function ProgressCard() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318] p-[22px]">
      <div className="mb-3.5 font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
        Your Progress
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {[
          { value: '8', label: 'Takes' },
          { value: '48m', label: 'Today' },
          { value: '5', label: 'Grooves' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-3 text-center"
          >
            <div className="font-mono text-lg font-medium text-[#E8E4DD]">
              {s.value}
            </div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-[#5A5660]">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Recordings list */}
      <div className="flex flex-col gap-1.5">
        {MOCK_RECORDINGS.map((rec) => (
          <div
            key={rec.name}
            className="flex cursor-pointer items-center gap-2.5 rounded-[7px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 transition-all hover:border-white/10 hover:bg-white/[0.04]"
            style={{ opacity: rec.faded ? 0.45 : 1 }}
          >
            {/* Play icon */}
            <div className="flex size-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#5A5660]">
              <svg
                viewBox="0 0 24 24"
                className="ml-[1.5px] size-[9px] fill-[#8A8690]"
              >
                <polygon points="8,5 19,12 8,19" />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-[#E8E4DD]">{rec.name}</div>
              <div className="font-mono text-[10px] text-[#5A5660]">
                {rec.session}
              </div>
            </div>

            <div className="shrink-0 font-mono text-[10px] text-[#8A8690]">
              {rec.duration}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Node Info Circle (replaces center avatar on selection) ─────────
function NodeInfoCircle({
  selected,
  radius,
  scale,
  glow,
  onDismiss,
}: {
  selected: SelectedNode;
  /** The constellation inner radius in px — info circle fits inside */
  radius: number;
  scale: number;
  glow: number;
  onDismiss: () => void;
}) {
  const isSkill = selected.kind === 'skill';
  const node = selected.node;
  const id = node.id;
  const color = colorForLevel(node.level);
  const description = isSkill
    ? SKILL_DESCRIPTIONS[id as SkillId]
    : SYNTHESIS_DESCRIPTIONS[id as SynthesisId];

  const diameter = Math.max(radius * 1.4 - 40 * scale, 100 * scale);
  const borderWidth = Math.max(1.5 * scale, 1);
  const closeSize = Math.max(16 * scale, 12);
  const badgeSize = Math.max(10 * scale, 7);
  const nameSize = Math.max(24 * scale, 14);
  const kindSize = Math.max(9 * scale, 7);
  const descSize = Math.max(12 * scale, 9);
  const descMaxW = Math.round(200 * scale);
  const progressBarW = Math.round(96 * scale);
  const progressBarH = Math.max(3 * scale, 2);

  return (
    <>
      {/* Invisible backdrop to catch clicks outside */}
      <div
        className="absolute inset-0 z-[9]"
        onClick={onDismiss}
      />

      {/* Info circle */}
      <div
        className="absolute left-1/2 top-1/2 z-[11] flex flex-col items-center justify-center rounded-full"
        style={{
          width: diameter,
          height: diameter,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle at 45% 40%, ${color.glow}, rgba(12,11,15,0.96) 70%)`,
          border: `${borderWidth}px solid ${color.base}40`,
          boxShadow: `0 0 ${Math.round(60 * scale * glow)}px ${color.glow}, inset 0 0 ${Math.round(40 * scale)}px rgba(0,0,0,0.3)`,
          animation: 'infoCircleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — absolute so it doesn't push content down */}
        <button
          onClick={onDismiss}
          className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full text-[#5A5660] transition-colors hover:bg-white/[0.06] hover:text-[#E8E4DD]"
          style={{ top: Math.round(16 * scale), padding: Math.round(4 * scale) }}
          aria-label="Close"
        >
          <X style={{ width: closeSize, height: closeSize }} />
        </button>

        {/* Level badge */}
        <div
          className="rounded-full font-mono font-semibold uppercase"
          style={{
            color: color.base,
            border: `1px solid ${color.base}50`,
            background: `${color.base}10`,
            fontSize: badgeSize,
            letterSpacing: '2px',
            paddingInline: Math.round(12 * scale),
            paddingBlock: Math.round(2 * scale),
            marginBottom: Math.round(8 * scale),
          }}
        >
          Level {node.level}
        </div>

        {/* Node name */}
        <div
          className="font-serif"
          style={{ color: color.base, fontSize: nameSize, marginBottom: Math.round(4 * scale) }}
        >
          {node.label}
        </div>

        {/* Kind label */}
        <div
          className="font-mono uppercase text-[#5A5660]"
          style={{ fontSize: kindSize, letterSpacing: '2px', marginBottom: Math.round(12 * scale) }}
        >
          {isSkill ? 'Core Skill' : 'Synthesis'}
        </div>

        {/* Description */}
        <p
          className="text-center leading-[1.5] text-[#8A8690]"
          style={{ fontSize: descSize, maxWidth: descMaxW, marginBottom: Math.round(16 * scale) }}
        >
          {description}
        </p>

        {/* Progress (for skill nodes) */}
        {isSkill && (
          <div className="flex flex-col items-center">
            {/* Progress bar */}
            <div
              className="overflow-hidden rounded-full bg-white/[0.06]"
              style={{ width: progressBarW, height: progressBarH, marginBottom: Math.round(6 * scale) }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${((selected.node as SkillNode).filled / (selected.node as SkillNode).total) * 100}%`,
                  background: color.base,
                }}
              />
            </div>
            <span className="font-mono text-[#5A5660]" style={{ fontSize: Math.max(10 * scale, 7) }}>
              {(selected.node as SkillNode).filled} / {(selected.node as SkillNode).total} milestones
            </span>
          </div>
        )}

        {/* Parents (for synthesis nodes) */}
        {!isSkill && (
          <div className="flex items-center" style={{ gap: Math.round(8 * scale) }}>
            {(selected.node as SynthesisNode).parents.map((parentId) => {
              const parentLevel = MOCK_NODES.find((n) => n.id === parentId)?.level ?? 1;
              const pc = colorForLevel(parentLevel);
              return (
              <span
                key={parentId}
                className="rounded-full font-mono uppercase"
                style={{
                  color: pc.base,
                  border: `1px solid ${pc.base}40`,
                  background: `${pc.base}08`,
                  fontSize: Math.max(9 * scale, 7),
                  letterSpacing: '0.5px',
                  paddingInline: Math.round(8 * scale),
                  paddingBlock: Math.round(2 * scale),
                }}
              >
                {parentId}
              </span>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main NodeMatrix Component ───────────────────────────────────────
export function NodeMatrix() {
  const { profile, isLoading, isHydrated } = useUserProfile();
  const { isAuthenticated, isReady } = useAuth();
  const [size, setSize] = useState(0);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const glowIntensity = 0.5;

  // Use a callback ref + ResizeObserver so we measure as soon as the
  // wrapper div actually mounts in the DOM. A regular ref + useEffect([])
  // misses the case where the loading guard renders first (so the div
  // doesn't exist on mount), and a dep-less useEffect never re-runs.
  const roRef = useRef<ResizeObserver | null>(null);
  const wrapperRef = useCallback((node: HTMLDivElement | null) => {
    // Clean up previous observer
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (node) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) setSize(w);
        }
      });
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);

  const handleDismiss = useCallback(() => setSelectedNode(null), []);

  // Scale factor: 1.0 at 640px baseline, capped at 1 for large screens
  const scale = useMemo(() => (size > 0 ? Math.min(size / DESIGN_BASELINE, 1) : 1), [size]);

  // Compute positions
  const center = useMemo(() => ({ x: size / 2, y: size / 2 }), [size]);
  const innerRadius = useMemo(() => size * 0.40, [size]);
  const outerRadius = useMemo(() => size * 0.40, [size]);

  const positions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const node of MOCK_NODES) {
      const rad = (node.angle * Math.PI) / 180;
      map[node.id] = {
        x: center.x + innerRadius * Math.cos(rad),
        y: center.y + innerRadius * Math.sin(rad),
      };
    }
    return map;
  }, [center, innerRadius]);

  const synthPositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const node of MOCK_SYNTHESIS) {
      const rad = (node.angle * Math.PI) / 180;
      map[node.id] = {
        x: center.x + outerRadius * Math.cos(rad),
        y: center.y + outerRadius * Math.sin(rad),
      };
    }
    return map;
  }, [center, outerRadius]);

  // Show loading spinner when:
  // - Auth not initialized yet, OR
  // - Profile query is actively loading, OR
  // - User is authenticated but profile hasn't arrived yet (query was disabled during redirect)
  if (!isReady || isLoading || !isHydrated || (isAuthenticated && !profile)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#E8A44A]" />
      </div>
    );
  }

  const displayName = profile?.displayName;
  const avatarUrl = profile?.avatarUrl;

  return (
    <div className="relative flex min-h-[calc(100svh-10rem)] flex-1 items-center justify-center px-2 sm:px-4 md:px-6 lg:min-h-0 lg:h-full overflow-hidden">
      {/* Keyframe injection for dot-pulse animation */}
      <style>{`
        @keyframes dot-pulse {
          0%, 100% { box-shadow: 0 0 6px var(--dot-color); transform: translate(-50%, -50%) scale(1); }
          50% { box-shadow: 0 0 14px var(--dot-color); transform: translate(-50%, -50%) scale(1.3); }
        }
        @keyframes infoCircleIn {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(232,164,74,0.015)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_35%_35%,rgba(91,141,239,0.01)_0%,transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_65%_55%,rgba(199,125,255,0.01)_0%,transparent_40%)]" />
      </div>

      {/* Constellation */}
      <div
        ref={wrapperRef}
        className="relative w-full max-w-[640px] aspect-square mx-auto overflow-visible"
      >

          {size > 0 && (
            <>
              <RadialLines
                nodes={MOCK_NODES}
                positions={positions}
                center={center}
              />

              <SynthesisLines
                synthNodes={MOCK_SYNTHESIS}
                synthPositions={synthPositions}
                primaryPositions={positions}
              />

              {selectedNode ? (
                <NodeInfoCircle
                  selected={selectedNode}
                  radius={innerRadius}
                  scale={scale}
                  glow={glowIntensity}
                  onDismiss={handleDismiss}
                />
              ) : (
                <CenterNode
                  displayName={displayName ?? undefined}
                  avatarUrl={avatarUrl ?? undefined}
                  radius={innerRadius}
                  scale={scale}
                  glow={glowIntensity}
                />
              )}

              {/* Inner ring: primary skill nodes */}
              {MOCK_NODES.map((node) => {
                const pos = positions[node.id];
                if (!pos) return null;
                return (
                  <SkillNodeElement
                    key={node.id}
                    node={node}
                    x={pos.x}
                    y={pos.y}
                    scale={scale}
                    glow={glowIntensity}
                    onSelect={() => setSelectedNode({ kind: 'skill', node })}
                  />
                );
              })}

              {/* Outer ring: synthesis nodes */}
              {MOCK_SYNTHESIS.map((node) => {
                const pos = synthPositions[node.id];
                if (!pos) return null;
                return (
                  <SynthesisNodeElement
                    key={node.id}
                    node={node}
                    x={pos.x}
                    y={pos.y}
                    scale={scale}
                    glow={glowIntensity}
                    onSelect={() => setSelectedNode({ kind: 'synthesis', node })}
                  />
                );
              })}
            </>
          )}
        </div>
    </div>
  );
}
