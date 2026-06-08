/**
 * Unit tests for useGrooveCardKeyboard — arrow-key transpose wiring.
 * Verifies: ←/→ map to ∓1 absolute offset via setKey, the isReady gate,
 * the typing guard, modifier-chord pass-through, and listener cleanup.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGrooveCardKeyboard } from '../useGrooveCardKeyboard.js';

function press(
  key: string,
  opts: {
    target?: EventTarget;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    code?: string;
  } = {},
): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', {
    key,
    code: opts.code,
    ctrlKey: opts.ctrlKey,
    metaKey: opts.metaKey,
    altKey: opts.altKey,
    cancelable: true,
    bubbles: true,
  });
  // jsdom doesn't let you set `target` via the constructor; define it.
  if (opts.target) {
    Object.defineProperty(ev, 'target', { value: opts.target });
  }
  window.dispatchEvent(ev);
  return ev;
}

describe('useGrooveCardKeyboard', () => {
  afterEach(() => vi.restoreAllMocks());

  /** Mount the hook with default fns; returns the spies for assertions. */
  function mount(
    args: {
      currentSemitones?: number;
      enabled?: boolean;
      lockTranspose?: boolean;
    } = {},
  ) {
    const setKey = vi.fn();
    const togglePlay = vi.fn();
    const toggleBassMute = vi.fn();
    const utils = renderHook(() =>
      useGrooveCardKeyboard({
        currentSemitones: args.currentSemitones ?? 0,
        setKey,
        togglePlay,
        toggleBassMute,
        enabled: args.enabled ?? true,
        lockTranspose: args.lockTranspose ?? false,
      }),
    );
    return { setKey, togglePlay, toggleBassMute, ...utils };
  }

  // ── transpose ─────────────────────────────────────────────────────────
  it('ArrowRight transposes up: setKey(current + 1)', () => {
    const { setKey } = mount({ currentSemitones: 2 });
    press('ArrowRight');
    expect(setKey).toHaveBeenCalledWith(3);
  });

  it('ArrowLeft transposes down: setKey(current - 1)', () => {
    const { setKey } = mount({ currentSemitones: 2 });
    press('ArrowLeft');
    expect(setKey).toHaveBeenCalledWith(1);
  });

  it('passes an absolute offset (relies on setKey to clamp) at the edge', () => {
    const { setKey } = mount({ currentSemitones: 6 });
    press('ArrowRight');
    // We still call with 7; clamping is setKey's job (mirrors the buttons).
    expect(setKey).toHaveBeenCalledWith(7);
  });

  // ── transpose lock (Dynamic Loop engaged) ───────────────────────────────
  it('lockTranspose: ←/→ do NOT call setKey (the cycle owns the key)', () => {
    const { setKey } = mount({ currentSemitones: 2, lockTranspose: true });
    press('ArrowRight');
    press('ArrowLeft');
    expect(setKey).not.toHaveBeenCalled();
  });

  it('lockTranspose: ←/→ still preventDefault (no page scroll-jump)', () => {
    mount({ lockTranspose: true });
    const ev = press('ArrowRight');
    expect(ev.defaultPrevented).toBe(true);
  });

  it('lockTranspose does NOT block Space (play/pause) or M (mute)', () => {
    const { togglePlay, toggleBassMute } = mount({ lockTranspose: true });
    press(' ', { code: 'Space' });
    press('m');
    expect(togglePlay).toHaveBeenCalledTimes(1);
    expect(toggleBassMute).toHaveBeenCalledTimes(1);
  });

  // ── play/pause (Space) ──────────────────────────────────────────────────
  it('Space toggles play (key " ")', () => {
    const { togglePlay } = mount();
    press(' ', { code: 'Space' });
    expect(togglePlay).toHaveBeenCalledTimes(1);
  });

  it('Space toggles play and suppresses page scroll (preventDefault)', () => {
    const { togglePlay } = mount();
    const ev = press(' ', { code: 'Space' });
    expect(togglePlay).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('Space does NOT toggle when a <button> has focus (avoids double-fire)', () => {
    const { togglePlay } = mount();
    const button = document.createElement('button');
    const ev = press(' ', { code: 'Space', target: button });
    // Let the button's native Space-activation handle it; we stay out.
    expect(togglePlay).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('Space does nothing while typing in an INPUT', () => {
    const { togglePlay } = mount();
    const input = document.createElement('input');
    press(' ', { code: 'Space', target: input });
    expect(togglePlay).not.toHaveBeenCalled();
  });

  // ── bass mute (M) ───────────────────────────────────────────────────────
  it('M toggles the bass mute (lowercase and uppercase)', () => {
    const { toggleBassMute } = mount();
    press('m');
    expect(toggleBassMute).toHaveBeenCalledTimes(1);
    press('M');
    expect(toggleBassMute).toHaveBeenCalledTimes(2);
  });

  it('M does nothing while typing in an INPUT', () => {
    const { toggleBassMute } = mount();
    const input = document.createElement('input');
    press('m', { target: input });
    expect(toggleBassMute).not.toHaveBeenCalled();
  });

  it('M does not preventDefault (not a browser-default action)', () => {
    mount();
    const ev = press('m');
    expect(ev.defaultPrevented).toBe(false);
  });

  // ── gates / guards ──────────────────────────────────────────────────────
  it('does nothing when disabled (not ready)', () => {
    const { setKey, togglePlay, toggleBassMute } = mount({ enabled: false });
    press('ArrowRight');
    press(' ', { code: 'Space' });
    press('m');
    expect(setKey).not.toHaveBeenCalled();
    expect(togglePlay).not.toHaveBeenCalled();
    expect(toggleBassMute).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys', () => {
    const { setKey, togglePlay, toggleBassMute } = mount();
    press('a');
    press('ArrowUp');
    press('ArrowDown');
    expect(setKey).not.toHaveBeenCalled();
    expect(togglePlay).not.toHaveBeenCalled();
    expect(toggleBassMute).not.toHaveBeenCalled();
  });

  it('ignores arrows while typing in an INPUT', () => {
    const { setKey } = mount();
    const input = document.createElement('input');
    press('ArrowRight', { target: input });
    expect(setKey).not.toHaveBeenCalled();
  });

  it('ignores arrows in a TEXTAREA and contentEditable', () => {
    const { setKey } = mount();
    const textarea = document.createElement('textarea');
    press('ArrowLeft', { target: textarea });

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    // jsdom reflects isContentEditable from the attribute.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    press('ArrowLeft', { target: editable });

    expect(setKey).not.toHaveBeenCalled();
  });

  it('leaves modifier chords (Cmd/Ctrl/Alt + key) to the browser', () => {
    const { setKey, togglePlay } = mount();
    press('ArrowRight', { metaKey: true });
    press('ArrowLeft', { ctrlKey: true });
    press(' ', { code: 'Space', metaKey: true });
    expect(setKey).not.toHaveBeenCalled();
    expect(togglePlay).not.toHaveBeenCalled();
  });

  it('calls preventDefault only on a handled arrow', () => {
    mount();
    const handled = press('ArrowRight');
    expect(handled.defaultPrevented).toBe(true);

    const unhandled = press('ArrowUp');
    expect(unhandled.defaultPrevented).toBe(false);
  });

  it('removes the listener on unmount', () => {
    const { setKey, togglePlay, toggleBassMute, unmount } = mount();
    unmount();
    press('ArrowRight');
    press(' ', { code: 'Space' });
    press('m');
    expect(setKey).not.toHaveBeenCalled();
    expect(togglePlay).not.toHaveBeenCalled();
    expect(toggleBassMute).not.toHaveBeenCalled();
  });
});
