'use client';

/**
 * InstrumentSelector Component
 *
 * Dropdown selector for choosing the harmony instrument.
 */

import React from 'react';
import type { InstrumentSelectorProps, KeyboardInstrumentType } from '../types.js';
import { KeyboardInstrument } from '../types.js';

/**
 * Format instrument key for display
 */
function formatInstrumentName(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Instrument selector dropdown
 */
export const InstrumentSelector: React.FC<InstrumentSelectorProps> = React.memo(
  ({ currentInstrument, onInstrumentChange }) => {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 w-16">Sound:</span>
        <select
          value={currentInstrument}
          onChange={(e) =>
            onInstrumentChange(e.target.value as KeyboardInstrumentType)
          }
          className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
        >
          {Object.entries(KeyboardInstrument).map(([key, value]) => (
            <option key={value} value={value}>
              {formatInstrumentName(key)}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

InstrumentSelector.displayName = 'InstrumentSelector';
