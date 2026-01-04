/**
 * XStateDebugPanel - Visual debug panel for XState machines
 *
 * Phase 5: Provides a floating UI panel for quick access to XState debugging tools.
 *
 * Features:
 * - Toggle button in corner of screen (development only)
 * - Quick access to open visual inspector
 * - View state history inline
 * - Show registered actors and their current states
 * - Performance metrics display
 *
 * Usage:
 * Add to your app (e.g., in layout.tsx):
 *
 * ```tsx
 * <XStateDebugPanel />
 * ```
 *
 * The panel only renders in development mode and can be toggled with keyboard shortcut.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getInspector,
  isDevToolsInitialized,
  getRegisteredActors,
  type StateHistoryTracker,
} from './devtools.js';
import { useXStateDevTools } from './XStateDevToolsProvider.js';

// ============================================================================
// Types
// ============================================================================

export interface XStateDebugPanelProps {
  /** Position of the panel toggle button */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Keyboard shortcut to toggle panel (default: Alt+X) */
  keyboardShortcut?: string;
  /** Initial expanded state */
  defaultExpanded?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    position: 'fixed' as const,
    zIndex: 99999,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    fontSize: '12px',
  },
  toggleButton: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#7c3aed',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.2s, background-color 0.2s',
  },
  toggleButtonHover: {
    transform: 'scale(1.1)',
    backgroundColor: '#6d28d9',
  },
  panel: {
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    padding: '12px',
    minWidth: '320px',
    maxWidth: '400px',
    maxHeight: '500px',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #313244',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#cba6f7',
    margin: 0,
  },
  section: {
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#89b4fa',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  button: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'background-color 0.2s',
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: '#313244',
    color: '#cdd6f4',
  },
  actorItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 8px',
    backgroundColor: '#313244',
    borderRadius: '4px',
    marginBottom: '4px',
  },
  actorName: {
    color: '#f9e2af',
    fontWeight: 500,
  },
  actorState: {
    color: '#a6e3a1',
    fontSize: '11px',
    padding: '2px 6px',
    backgroundColor: '#1e1e2e',
    borderRadius: '3px',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    borderBottom: '1px solid #313244',
  },
  historyTime: {
    color: '#6c7086',
    fontSize: '10px',
    minWidth: '70px',
  },
  historyState: {
    color: '#89b4fa',
    fontWeight: 500,
  },
  historyDuration: {
    color: '#f38ba8',
    fontSize: '10px',
    marginLeft: 'auto',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 'bold' as const,
  },
  badgeSuccess: {
    backgroundColor: '#1e4620',
    color: '#a6e3a1',
  },
  badgeWarning: {
    backgroundColor: '#4d3800',
    color: '#f9e2af',
  },
  closeButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#6c7086',
    cursor: 'pointer',
    fontSize: '16px',
  },
  shortcutHint: {
    fontSize: '10px',
    color: '#6c7086',
    marginTop: '8px',
    textAlign: 'center' as const,
  },
};

// ============================================================================
// Component
// ============================================================================

export function XStateDebugPanel({
  position = 'bottom-right',
  keyboardShortcut = 'alt+x',
  defaultExpanded = false,
}: XStateDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHovered, setIsHovered] = useState(false);
  const [actors, setActors] = useState<Map<string, { id: string; state: string }>>(new Map());
  const [historyEntries, setHistoryEntries] = useState<Array<{
    time: string;
    state: string;
    duration?: string;
  }>>([]);

  const devtools = useXStateDevTools();

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Position styles
  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-left': { bottom: '16px', left: '16px' },
    'bottom-right': { bottom: '16px', right: '16px' },
    'top-left': { top: '16px', left: '16px' },
    'top-right': { top: '16px', right: '16px' },
  };

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = keyboardShortcut.toLowerCase().split('+');
      const altRequired = keys.includes('alt');
      const ctrlRequired = keys.includes('ctrl');
      const shiftRequired = keys.includes('shift');
      const key = keys.filter((k) => !['alt', 'ctrl', 'shift'].includes(k))[0];

      if (
        e.altKey === altRequired &&
        e.ctrlKey === ctrlRequired &&
        e.shiftKey === shiftRequired &&
        e.key.toLowerCase() === key
      ) {
        e.preventDefault();
        setIsExpanded((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcut]);

  // Refresh actors periodically when panel is open
  useEffect(() => {
    if (!isExpanded) return;

    const refreshActors = () => {
      const registeredActors = getRegisteredActors();
      const actorMap = new Map<string, { id: string; state: string }>();

      registeredActors.forEach((actor, id) => {
        try {
          const snapshot = actor.getSnapshot();
          actorMap.set(id, {
            id,
            state: typeof snapshot.value === 'string' ? snapshot.value : JSON.stringify(snapshot.value),
          });
        } catch {
          actorMap.set(id, { id, state: 'unknown' });
        }
      });

      setActors(actorMap);
    };

    refreshActors();
    const interval = setInterval(refreshActors, 1000);
    return () => clearInterval(interval);
  }, [isExpanded]);

  // Refresh history when panel is open
  useEffect(() => {
    if (!isExpanded) return;

    const refreshHistory = () => {
      const playbackHistory = (window as WindowWithHistory).__xstatePlaybackHistory;
      const pageInitHistory = (window as WindowWithHistory).__xstatePageInitHistory;

      const entries: Array<{ time: string; state: string; duration?: string; source: string }> = [];

      if (playbackHistory) {
        const history = playbackHistory.getLastN(5);
        history.forEach((entry) => {
          entries.push({
            time: new Date(entry.timestamp).toISOString().split('T')[1].slice(0, 12),
            state: `[PB] ${entry.state}`,
            duration: entry.duration ? `${entry.duration}ms` : undefined,
            source: 'playback',
          });
        });
      }

      if (pageInitHistory) {
        const history = pageInitHistory.getLastN(5);
        history.forEach((entry) => {
          entries.push({
            time: new Date(entry.timestamp).toISOString().split('T')[1].slice(0, 12),
            state: `[PI] ${entry.state}`,
            duration: entry.duration ? `${entry.duration}ms` : undefined,
            source: 'pageInit',
          });
        });
      }

      // Sort by time
      entries.sort((a, b) => a.time.localeCompare(b.time));

      setHistoryEntries(entries.slice(-10));
    };

    refreshHistory();
    const interval = setInterval(refreshHistory, 500);
    return () => clearInterval(interval);
  }, [isExpanded]);

  // Open inspector
  const handleOpenInspector = useCallback(() => {
    const inspector = getInspector();
    if (inspector) {
      inspector.start();
    } else {
      console.warn('[XStateDebugPanel] Inspector not initialized');
    }
  }, []);

  // Print history to console
  const handlePrintHistory = useCallback(() => {
    const playbackHistory = (window as WindowWithHistory).__xstatePlaybackHistory;
    const pageInitHistory = (window as WindowWithHistory).__xstatePageInitHistory;

    console.log('%c=== XState History ===', 'color: #7c3aed; font-weight: bold; font-size: 14px');

    if (playbackHistory) {
      console.log('%cPlayback Machine:', 'color: #89b4fa; font-weight: bold');
      playbackHistory.printFormatted();
    }

    if (pageInitHistory) {
      console.log('%cPage Init Machine:', 'color: #a6e3a1; font-weight: bold');
      pageInitHistory.printFormatted();
    }
  }, []);

  // Clear history
  const handleClearHistory = useCallback(() => {
    const playbackHistory = (window as WindowWithHistory).__xstatePlaybackHistory;
    const pageInitHistory = (window as WindowWithHistory).__xstatePageInitHistory;

    playbackHistory?.clear();
    pageInitHistory?.clear();
    setHistoryEntries([]);
  }, []);

  return (
    <div style={{ ...styles.container, ...positionStyles[position] }}>
      {!isExpanded ? (
        // Toggle button
        <button
          style={{
            ...styles.toggleButton,
            ...(isHovered ? styles.toggleButtonHover : {}),
          }}
          onClick={() => setIsExpanded(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title={`XState DevTools (${keyboardShortcut})`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      ) : (
        // Expanded panel
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <h3 style={styles.title}>XState DevTools</h3>
            <button
              style={styles.closeButton}
              onClick={() => setIsExpanded(false)}
              title="Close"
            >
              x
            </button>
          </div>

          {/* Status */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Status</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span
                style={{
                  ...styles.badge,
                  ...(isDevToolsInitialized() ? styles.badgeSuccess : styles.badgeWarning),
                }}
              >
                {isDevToolsInitialized() ? 'Initialized' : 'Not Initialized'}
              </span>
              <span style={{ color: '#6c7086' }}>
                {actors.size} actor{actors.size !== 1 ? 's' : ''} registered
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Actions</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={handleOpenInspector}
              >
                Open Inspector
              </button>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={handlePrintHistory}
              >
                Print History
              </button>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={handleClearHistory}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Actors */}
          {actors.size > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Registered Actors</div>
              {Array.from(actors.values()).map((actor) => (
                <div key={actor.id} style={styles.actorItem}>
                  <span style={styles.actorName}>{actor.id}</span>
                  <span style={styles.actorState}>{actor.state}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recent History */}
          {historyEntries.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Recent Transitions</div>
              {historyEntries.map((entry, i) => (
                <div key={i} style={styles.historyItem}>
                  <span style={styles.historyTime}>{entry.time}</span>
                  <span style={styles.historyState}>{entry.state}</span>
                  {entry.duration && (
                    <span style={styles.historyDuration}>{entry.duration}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Shortcut hint */}
          <div style={styles.shortcutHint}>
            Press {keyboardShortcut.toUpperCase()} to toggle
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Window Type Extension
// ============================================================================

interface WindowWithHistory extends Window {
  __xstatePlaybackHistory?: StateHistoryTracker;
  __xstatePageInitHistory?: StateHistoryTracker;
}

// ============================================================================
// Exports
// ============================================================================

export default XStateDebugPanel;
