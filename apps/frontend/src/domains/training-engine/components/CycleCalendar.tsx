'use client';

/**
 * CycleCalendar — Backstage › Your progress: a macOS-style calendar of the user's BILLING CYCLE,
 * with the days they banked a rep lit up.
 *
 * macOS Calendar behaviour: ONE month is visible at rest, and scrolling SNAPS to the next/previous
 * month. Each month section shows its full weeks (the week containing the 1st → the week containing
 * the last day), so boundary days spill in dimmed from the neighbouring month — like macOS. The
 * sections are scroll-snap targets stacked vertically; out-of-view months scroll off.
 *
 * The strip spans ~3 months centered on the cycle start (prev / cycle / next). Days INSIDE the
 * billing cycle (enroll/purchase day → the same day next month) are bright + can ring; days outside
 * (other months, or before/after the cycle) are dimmed. A rep day gets an Apple-activity-ring fill;
 * today gets a ring outline.
 *
 * Data comes from useCycleRepCalendar (active enrollment → cycle window + the rep-day set).
 */

import React from 'react';

import {
  useCycleRepCalendar,
  localDayKey,
} from '../hooks/useCycleRepCalendar';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Monday-based weekday index (0=Mon … 6=Sun) for a JS getDay() (0=Sun … 6=Sat). */
function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/** Midnight of a date (local) — for date-only [start, end) comparisons. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

interface DayCell {
  date: Date;
  inThisMonth: boolean; // belongs to the section's month (vs a dimmed spillover day)
  inCycle: boolean; // within [cycleStart, cycleEnd)
  hasRep: boolean; // ≥1 rep banked
  isToday: boolean;
}

interface MonthSection {
  key: string; // 'YYYY-MM'
  label: string; // 'July 2026'
  isCycleMonth: boolean; // contains the cycle start day → scroll target on load
  weeks: DayCell[][]; // full Mon→Sun weeks covering this month
}

export function CycleCalendar() {
  const { cycleStart, cycleEnd, repDays, enrollment, isLoading, error } =
    useCycleRepCalendar();

  const today = React.useMemo(() => new Date(), []);
  const todayKey = localDayKey(today);

  // Anchor month: the cycle-start month (or this month if no active cycle yet). Offsets below are
  // RELATIVE to this anchor month (0 = anchor, −1 = prev, +1 = next, …).
  const anchor = React.useMemo(() => {
    const base = cycleStart ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [cycleStart, today]);

  // OPEN-ENDED range of month offsets [startOff, endOff] (inclusive) around the anchor. We extend
  // it lazily as you scroll near an edge → infinite scroll both ways. Initial window: ±2 months.
  const [range, setRange] = React.useState({ startOff: -2, endOff: 2 });
  // Re-center the window on the anchor whenever it (re)resolves.
  React.useEffect(() => {
    setRange({ startOff: -2, endOff: 2 });
  }, [anchor]);

  // Build one month section for an absolute (year, month). Full Mon→Sun weeks covering the month;
  // neighbouring spillover days are dimmed (inThisMonth=false).
  const buildMonth = React.useCallback(
    (year: number, month: number): MonthSection => {
      const cycleMonthIdx = cycleStart
        ? cycleStart.getFullYear() * 12 + cycleStart.getMonth()
        : -1;
      const norm = new Date(year, month, 1);
      const y = norm.getFullYear();
      const mo = norm.getMonth();
      const lastDay = new Date(y, mo + 1, 0).getDate();
      const lead = mondayIndex(new Date(y, mo, 1).getDay());
      const weekCount = Math.ceil((lead + lastDay) / 7);

      const cursor = new Date(y, mo, 1 - lead);
      const weeks: DayCell[][] = [];
      for (let w = 0; w < weekCount; w++) {
        const week: DayCell[] = [];
        for (let d = 0; d < 7; d++) {
          const date = new Date(cursor);
          const inCycle =
            !!cycleStart &&
            !!cycleEnd &&
            startOfDay(date) >= startOfDay(cycleStart) &&
            startOfDay(date) < startOfDay(cycleEnd);
          week.push({
            date,
            inThisMonth: date.getMonth() === mo,
            inCycle,
            hasRep: repDays.has(localDayKey(date)),
            isToday: localDayKey(date) === todayKey,
          });
          cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
      }
      return {
        key: `${y}-${String(mo + 1).padStart(2, '0')}`,
        label: `${MONTHS[mo]} ${y}`,
        isCycleMonth: y * 12 + mo === cycleMonthIdx,
        weeks,
      };
    },
    [cycleStart, cycleEnd, repDays, todayKey],
  );

  // The rendered sections, one per offset in the current range.
  const sections = React.useMemo<MonthSection[]>(() => {
    const out: MonthSection[] = [];
    for (let off = range.startOff; off <= range.endOff; off++) {
      out.push(buildMonth(anchor.getFullYear(), anchor.getMonth() + off));
    }
    return out;
  }, [anchor, range, buildMonth]);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  // Which month section is currently in view (drives the header label + arrow disabled states).
  const [activeIdx, setActiveIdx] = React.useState(1); // default to the middle (cycle) month
  const activeIdxRef = React.useRef(1);
  // While a glide animation is running we ignore further input + the scroll listener (so the eased
  // motion isn't interrupted or double-counted).
  const animatingRef = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const cooldownUntilRef = React.useRef(0); // ignore wheel steps until this time (momentum settle)

  const setActive = React.useCallback((idx: number) => {
    activeIdxRef.current = idx;
    setActiveIdx(idx);
  }, []);

  // Glide the strip to a section with a SLOW ease-in-out animation (not the browser's fast native
  // smooth-scroll). The arrows, the wheel, and the initial cycle jump all route through this.
  const glideToSection = React.useCallback(
    (idx: number, durationMs = 520) => {
      const container = scrollRef.current;
      const el = container?.children[idx] as HTMLElement | undefined;
      if (!container || !el) return;

      const from = container.scrollTop;
      const to = el.offsetTop - container.offsetTop;
      if (Math.abs(to - from) < 1) {
        setActive(idx);
        return;
      }

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      animatingRef.current = true;
      setActive(idx);
      let startTs: number | null = null;
      // Smooth ease-in-out (cosine) — gentle accel + decel.
      const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

      const step = (ts: number) => {
        if (startTs == null) startTs = ts;
        const t = Math.min(1, (ts - startTs) / durationMs);
        container.scrollTop = from + (to - from) * ease(t);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          animatingRef.current = false;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [setActive],
  );

  // STEP one month, infinite-scroll-aware. dir = +1 (next) or −1 (prev). Extends the open-ended
  // month range as needed so you never hit an end:
  //   • forward to the last section → APPEND a month, then glide to it (indices unchanged).
  //   • backward to the first section → PREPEND a month; that shifts every index +1, so we record a
  //     pending compensation (handled in a layout effect after the new section renders) and the
  //     glide target accounts for the shift.
  const pendingPrependRef = React.useRef<{ targetIdx: number } | null>(null);
  const stepBy = React.useCallback(
    (dir: 1 | -1) => {
      const cur = activeIdxRef.current;
      const count = sectionCountRef.current;
      if (dir === 1) {
        const next = cur + 1;
        if (next >= count - 1) setRange((r) => ({ ...r, endOff: r.endOff + 1 }));
        glideToSection(next);
      } else {
        if (cur <= 0) {
          // Prepend one month. After render every index shifts +1, so the month we're viewing moves
          // to index (cur+1) and the NEW previous month is at index cur (0). The layout effect bumps
          // scrollTop to hold the view, then glides to the new prev month at index `cur`.
          pendingPrependRef.current = { targetIdx: cur };
          setRange((r) => ({ ...r, startOff: r.startOff - 1 }));
        } else {
          glideToSection(cur - 1);
        }
      }
    },
    [glideToSection],
  );

  // After a PREPEND renders, the strip grew at the top by one section → everything moved down by
  // one section-height. Bump scrollTop by that height (so the view doesn't jump), fix activeIdx,
  // then glide to the prev month.
  React.useLayoutEffect(() => {
    const pending = pendingPrependRef.current;
    const container = scrollRef.current;
    if (!pending || !container) return;
    pendingPrependRef.current = null;
    const firstNew = container.children[0] as HTMLElement | undefined;
    const second = container.children[1] as HTMLElement | undefined;
    if (firstNew && second) {
      const sectionH = second.offsetTop - firstNew.offsetTop;
      container.scrollTop += sectionH; // keep the previously-visible month in place
      activeIdxRef.current += 1; // indices shifted +1 from the prepend
    }
    glideToSection(pending.targetIdx);
  }, [sections, glideToSection]);

  // Snap instantly (no animation) — for the initial cycle-month jump.
  const jumpToSection = React.useCallback(
    (idx: number) => {
      const container = scrollRef.current;
      const el = container?.children[idx] as HTMLElement | undefined;
      if (!container || !el) return;
      container.scrollTop = el.offsetTop - container.offsetTop;
      setActive(idx);
    },
    [setActive],
  );

  // WHEEL → one month per swipe, eased. Non-passive native listener (a React onWheel is passive, so
  // preventDefault wouldn't stop the page) so we own the wheel. The momentum tail of a single
  // trackpad swipe streams events for ~600ms+, and the per-event deltas oscillate wildly (so
  // signal-shape detection is unreliable). The robust answer: step on the first event, then a fixed
  // cooldown that OUTLASTS the tail (see the handler).
  const GLIDE_MS = 520;
  const sectionCountRef = React.useRef(sections.length);
  sectionCountRef.current = sections.length;
  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const mag = Math.abs(e.deltaY);
      if (mag < 2) return;

      const now = performance.now();
      // SIMPLE + ROBUST: step on the first qualifying event, then ignore ALL wheel until a fixed
      // cooldown that OUTLASTS the trackpad's momentum tail (logs: a single swipe streams events for
      // ~600ms+). Signal-shape detection (rising edge / decay) was unreliable — the per-event deltas
      // oscillate wildly within one swipe, so a "rise" never cleared. A human can't intentionally
      // re-swipe faster than the cooldown anyway, and the glide is 520ms.
      const COOLDOWN_MS = 900;
      const inCooldown = now < cooldownUntilRef.current;

      if (animatingRef.current || inCooldown) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      cooldownUntilRef.current = now + COOLDOWN_MS; // block the whole momentum tail + a re-swipe gap
      stepBy(dir);
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, [glideToSection]);

  // Jump to the cycle month on first resolve (instant, no glide).
  const didScrollRef = React.useRef(false);
  React.useEffect(() => {
    if (didScrollRef.current || !cycleStart) return;
    const id = requestAnimationFrame(() => {
      const idx = sections.findIndex((s) => s.isCycleMonth);
      if (idx >= 0 && scrollRef.current) {
        didScrollRef.current = true;
        jumpToSection(idx);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [cycleStart, sections, jumpToSection]);

  // Cancel any in-flight glide on unmount.
  React.useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const repCountThisCycle = repDays.size;
  const activeLabel = sections[activeIdx]?.label ?? '';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318] p-[22px]">
      {/* Header — label + month name & ‹ › arrows in the top-right (macOS style). */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
            Your progress
          </div>
          {enrollment && (
            <div className="mt-0.5 text-[11px] text-[#8A8690]">
              {repCountThisCycle} {repCountThisCycle === 1 ? 'day' : 'days'} this
              cycle
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="min-w-[96px] text-right font-mono text-[12px] tabular-nums text-[#E8E4DD]">
            {activeLabel}
          </span>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => {
              if (!animatingRef.current) stepBy(-1);
            }}
            className="flex size-6 items-center justify-center rounded-md text-[#8A8690] transition-colors hover:bg-white/5 hover:text-[#E8E4DD]"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => {
              if (!animatingRef.current) stepBy(1);
            }}
            className="flex size-6 items-center justify-center rounded-md text-[#8A8690] transition-colors hover:bg-white/5 hover:text-[#E8E4DD]"
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekday header. */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="text-center font-mono text-[10px] uppercase tracking-[1px] text-[#5A5660]"
          >
            {w}
          </div>
        ))}
      </div>

      {/* macOS-style snap strip: each MONTH is a scroll-snap section. One month fills the viewport;
          scrolling snaps to the next/previous. Out-of-view months scroll off. */}
      <div
        ref={scrollRef}
        // flex-1 → fills the card height. We DRIVE the scroll programmatically (glideToSection) for
        // a slow eased month-to-month motion — so native snap is OFF (it fights the animation) and
        // overflow is HIDDEN (no native scrollbar; the wheel handler owns paging). Each month is
        // h-full so exactly one fills the view.
        className="flex-1 overflow-hidden"
      >
        {sections.map((section) => (
          <div
            key={section.key}
            // h-full → each month fills the viewport; only ONE shows at rest. The month NAME lives
            // in the header (top-right), not inline here.
            className="flex h-full flex-col justify-center gap-1"
          >
            {section.weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((c, di) => (
                  <DayButton key={di} cell={c} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 font-mono text-[10px] text-[#FF7E7E]">{error}</p>
      )}
      {!error && !isLoading && !enrollment && (
        <p className="mt-3 text-[11px] text-[#5A5660]">
          No active goal yet — your cycle calendar appears once you start one in
          the gym.
        </p>
      )}
    </div>
  );
}

/** One day cell. Spillover (other-month) or out-of-cycle → dimmed. Rep day → activity-ring fill.
 *  Today → ring outline. */
function DayButton({ cell }: { cell: DayCell }) {
  const { date, inThisMonth, inCycle, hasRep, isToday } = cell;
  const day = date.getDate();

  let cls =
    'relative mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] text-[13px] tabular-nums transition-colors';
  let style: React.CSSProperties = {};

  if (hasRep && inThisMonth) {
    cls += ' font-semibold text-[#1a1206]';
    style = {
      background:
        'radial-gradient(circle at 50% 40%, #F0B95C 0%, #E8A44A 70%, #D4903A 100%)',
      boxShadow:
        '0 0 0 1px rgba(232,164,74,0.55), 0 2px 10px rgba(232,164,74,0.25)',
    };
  } else if (inThisMonth && inCycle) {
    cls += ' text-[#E8E4DD] hover:bg-white/[0.04]';
  } else if (inThisMonth) {
    // In the section's month but outside the cycle — mid-dim.
    cls += ' text-[#6b6770]';
  } else {
    // Spillover day from a neighbouring month — most dim.
    cls += ' text-[#3a383f]';
  }

  return (
    <div className={cls} style={style}>
      {isToday && !(hasRep && inThisMonth) && (
        <span
          className="absolute inset-0 rounded-[10px]"
          style={{ boxShadow: 'inset 0 0 0 1.5px rgba(232,164,74,0.7)' }}
          aria-hidden
        />
      )}
      {day}
    </div>
  );
}
