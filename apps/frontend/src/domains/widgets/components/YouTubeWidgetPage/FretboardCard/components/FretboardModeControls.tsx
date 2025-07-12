import React from 'react';
import type { StringCount } from '../types/fretboardTypes';

interface FretboardModeControlsProps {
  mode: '2d' | '3d';

  // 3D mode props
  stringCount?: StringCount;
  onStringCountChange?: (count: StringCount) => void;
  cameraMode?: 'overview' | 'action';
  onCameraModeChange?: (mode: 'overview' | 'action') => void;
  onReset?: () => void;
  warningMessage?: string | null;
  wouldHideDotsOnStringCountChange?: (count: StringCount) => boolean;
  getTooltipMessage?: (count: StringCount) => string;

  // 2D mode props (for FretboardControls)
  hasSelectedDots?: boolean;
  onClearDots?: () => void;
  onResetTiltToDefault?: () => void;
  onSetTiltToFlat?: () => void;
  selectedDots?: Map<string, number[]>;
  hasDotsOnHiddenStrings?: (
    currentCount: StringCount,
    newCount: StringCount,
    dots: Map<string, number[]>,
  ) => boolean;

  // Children for 2D mode
  children?: React.ReactNode;
}

/**
 * Component that renders mode-specific controls for the fretboard
 * Either 3D mode controls or wraps 2D mode controls
 */
export function FretboardModeControls({
  mode,
  stringCount = 4,
  onStringCountChange,
  cameraMode = 'overview',
  onCameraModeChange,
  onReset,
  warningMessage,
  wouldHideDotsOnStringCountChange,
  getTooltipMessage,
  children,
}: FretboardModeControlsProps) {
  if (mode === '2d') {
    // For 2D mode, just render the children (FretboardControls)
    return <>{children}</>;
  }

  // 3D Mode Controls
  return (
    <div className="mb-4 relative">
      {/* Warning message for 3D mode */}
      {warningMessage && (
        <div className="mb-3 p-3 bg-red-900/50 border border-red-600 rounded-md">
          <p className="text-red-200 text-sm">{warningMessage}</p>
        </div>
      )}

      <div
        className="flex justify-center gap-2 flex-wrap overflow-visible relative"
        role="toolbar"
        aria-label="3D Fretboard controls"
      >
        {/* String Count Toggle - With validation */}
        <fieldset className="flex gap-2">
          <legend className="sr-only">String count selection</legend>
          {[4, 5, 6].map((count) => {
            const wouldHideDotsOnClick =
              wouldHideDotsOnStringCountChange?.(count as StringCount) || false;
            const isCurrentCount = stringCount === count;
            const tooltipMessage =
              getTooltipMessage?.(count as StringCount) ||
              `Switch to ${count} string mode`;

            return (
              <div key={count} className="relative group">
                <button
                  onClick={() => onStringCountChange?.(count as StringCount)}
                  disabled={wouldHideDotsOnClick}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isCurrentCount
                      ? 'bg-blue-500 text-white'
                      : wouldHideDotsOnClick
                        ? 'bg-red-600 text-white cursor-not-allowed opacity-75'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                  aria-pressed={isCurrentCount}
                  aria-label={`Select ${count} string bass guitar${wouldHideDotsOnClick ? ' (disabled: would hide selected dots)' : ''}`}
                >
                  {count} String
                </button>

                {/* Tooltip on hover - positioned below button with higher z-index */}
                <div
                  className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 text-xs rounded-md whitespace-nowrap pointer-events-none transition-opacity duration-200 z-[9999] ${
                    wouldHideDotsOnClick
                      ? 'bg-red-900 text-red-100 opacity-0 group-hover:opacity-100'
                      : 'bg-slate-700 text-slate-200 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <div
                    className={`absolute bottom-full left-1/2 transform -translate-x-1/2 -mb-1 border-4 border-transparent ${
                      wouldHideDotsOnClick
                        ? 'border-b-red-900'
                        : 'border-b-slate-700'
                    }`}
                  />
                  {tooltipMessage}
                </div>
              </div>
            );
          })}
        </fieldset>

        {/* Action Buttons */}
        <button
          onClick={onReset}
          className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label="Reset all selected fretboard dots"
        >
          Reset
        </button>

        <button
          onClick={() => onCameraModeChange?.('overview')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 ${
            cameraMode === 'overview'
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          title="Set camera to overview mode"
          aria-label="Set camera to overview mode"
        >
          Overview
        </button>

        <button
          onClick={() => onCameraModeChange?.('action')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            cameraMode === 'action'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          title="Set camera to action mode (focuses on selected notes)"
          aria-label="Set camera to action mode"
        >
          Action
        </button>
      </div>
    </div>
  );
}
