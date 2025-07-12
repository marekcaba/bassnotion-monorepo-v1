import React, { useState } from 'react';
import type { StringCount, SelectedDotsMap } from '../types/fretboardTypes';

interface FretboardControlsProps {
  stringCount: StringCount;
  onStringCountChange: (count: StringCount) => boolean; // Returns true if change was successful
  hasSelectedDots: boolean;
  onClearDots: () => void;
  onResetTiltToDefault: () => void;
  onSetTiltToFlat: () => void;
  selectedDots: SelectedDotsMap;
  hasDotsOnHiddenStrings: (
    currentStringCount: StringCount,
    newStringCount: StringCount,
    selectedDots: SelectedDotsMap,
  ) => boolean;
}

export const FretboardControls: React.FC<FretboardControlsProps> = ({
  stringCount,
  onStringCountChange,
  onClearDots,
  onResetTiltToDefault,
  onSetTiltToFlat,
  selectedDots,
  hasDotsOnHiddenStrings,
}) => {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const handleStringCountChange = (newCount: StringCount) => {
    // Check if this change would hide strings with selected dots
    if (hasDotsOnHiddenStrings(stringCount, newCount, selectedDots)) {
      // Show warning message
      let hiddenStrings = '';
      if (stringCount === 5 && newCount === 4) {
        hiddenStrings = 'B string (lowest)';
      } else if (stringCount === 6 && newCount === 5) {
        hiddenStrings = 'C string (highest)';
      } else if (stringCount === 6 && newCount === 4) {
        hiddenStrings = 'B string (lowest) and C string (highest)';
      }

      setWarningMessage(
        `Cannot switch to ${newCount} strings while there are selected dots on the ${hiddenStrings}. Please clear those dots first or reset the fretboard.`,
      );

      // Auto-hide warning after 5 seconds
      setTimeout(() => setWarningMessage(null), 5000);
      return;
    }

    // Clear any existing warning
    setWarningMessage(null);

    // Attempt to change string count
    const success = onStringCountChange(newCount);
    if (!success) {
      setWarningMessage('Failed to change string count. Please try again.');
      setTimeout(() => setWarningMessage(null), 3000);
    }
  };

  const getStringButtonClassName = (count: StringCount) => {
    const isCurrentCount = stringCount === count;
    const wouldHideDotsOnClick = hasDotsOnHiddenStrings(
      stringCount,
      count,
      selectedDots,
    );

    if (isCurrentCount) {
      return 'bg-blue-500 text-white';
    } else if (wouldHideDotsOnClick) {
      return 'bg-red-600 text-white cursor-not-allowed opacity-75';
    } else {
      return 'bg-slate-700 text-slate-300 hover:bg-slate-600';
    }
  };

  return (
    <div className="mb-4 relative">
      {/* Warning message */}
      {warningMessage && (
        <div className="mb-3 p-3 bg-red-900/50 border border-red-600 rounded-md">
          <p className="text-red-200 text-sm">{warningMessage}</p>
        </div>
      )}

      <div
        className="flex justify-center gap-2 flex-wrap overflow-visible relative"
        role="toolbar"
        aria-label="Fretboard controls"
      >
        <fieldset className="flex gap-2">
          <legend className="sr-only">String count selection</legend>
          {[4, 5, 6].map((count) => {
            const wouldHideDotsOnClick = hasDotsOnHiddenStrings(
              stringCount,
              count as StringCount,
              selectedDots,
            );

            // Generate specific tooltip message
            let tooltipMessage = `Switch to ${count} string mode`;
            if (wouldHideDotsOnClick) {
              if (stringCount === 5 && count === 4) {
                tooltipMessage =
                  'Please remove notes from the B string (lowest) to switch to 4-string mode';
              } else if (stringCount === 6 && count === 5) {
                tooltipMessage =
                  'Please remove notes from the C string (highest) to switch to 5-string mode';
              } else if (stringCount === 6 && count === 4) {
                tooltipMessage =
                  'Please remove notes from the B string (lowest) and C string (highest) to switch to 4-string mode';
              }
            }

            return (
              <div key={count} className="relative group">
                <button
                  onClick={() => handleStringCountChange(count as StringCount)}
                  disabled={wouldHideDotsOnClick}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStringButtonClassName(count as StringCount)}`}
                  aria-pressed={stringCount === count}
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
        <button
          onClick={onClearDots}
          className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label="Reset all selected fretboard dots"
        >
          Reset
        </button>
        <button
          onClick={onResetTiltToDefault}
          className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          title="Reset tilt to default 35°"
          aria-label="Reset fretboard tilt to default 35 degrees"
        >
          Default
        </button>
        <button
          onClick={onSetTiltToFlat}
          className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-purple-600 text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          title="Set tilt to flat view (0°)"
          aria-label="Set fretboard tilt to flat view, 0 degrees"
        >
          Flat
        </button>
      </div>
    </div>
  );
};
