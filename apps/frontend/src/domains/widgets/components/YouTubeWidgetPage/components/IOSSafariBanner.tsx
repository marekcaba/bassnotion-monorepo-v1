'use client';

/**
 * IOSSafariBanner
 *
 * Renders a non-blocking notice when the user opens a tutorial on iOS Safari.
 * iOS Safari has no AudioWorklet support and Web Worker timing was disabled
 * because it conflicted — so the playback engine degrades to stutter-on-scroll
 * and unreliable sample loading. Rather than letting paying users discover
 * this through broken audio, we tell them up-front and direct them to desktop.
 *
 * Dismissible per-session via sessionStorage. We deliberately do NOT block
 * the page — some users will want to read the tutorial copy and watch the
 * video even if audio is rough.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'bassicology_ios_safari_banner_dismissed';

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
  // Safari UA contains 'Safari' and 'AppleWebKit' but NOT 'Chrome', 'CriOS',
  // 'FxiOS', 'EdgiOS', 'OPiOS' (all of which use WebKit on iOS but identify
  // separately and may have their own audio quirks worth detecting later).
  const isSafari =
    /Safari/.test(ua) &&
    !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

export function IOSSafariBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOSSafari()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // sessionStorage can throw in private mode — fall through and show
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore — banner just reappears next session, not a real problem
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-sm">
      <div className="mx-auto max-w-7xl flex items-start gap-3 px-4 py-2">
        <span className="flex-1">
          <strong>Heads up:</strong> Bassicology audio works best on desktop
          Chrome or Firefox. iOS Safari may stutter or drop sounds. Mobile
          support is on the roadmap.
        </span>
        <button
          onClick={dismiss}
          aria-label="Dismiss iOS Safari notice"
          className="text-amber-200/70 hover:text-amber-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
