'use client';

import React from 'react';

interface LooperKnobProps {
  selectedBars: number | null; // null means looper is off
  onBarSelect: (bars: number | null) => void;
  size?: number;
}

export function LooperKnob({
  selectedBars,
  onBarSelect,
  size = 50,
}: LooperKnobProps) {
  const handleSectionClick = (bars: number) => {
    if (selectedBars === bars) {
      // If clicking the same section, turn off looper
      onBarSelect(null);
    } else {
      // Select new section
      onBarSelect(bars);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Knob with stripe container */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Single plane neumorphic knob - same style as tempo knob */}
        <div className="absolute inset-0 rounded-full bg-slate-800 shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(255,255,255,0.1)] cursor-pointer transition-all duration-200 hover:shadow-[9px_9px_18px_rgba(0,0,0,0.6),-9px_-9px_18px_rgba(255,255,255,0.12)] select-none overflow-hidden">
          {/* Top quarter - 1 bar (top-right quarter) */}
          <div
            className="absolute inset-0 hover:bg-slate-700/20 transition-colors duration-150 cursor-pointer"
            style={{
              clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)',
            }}
            onClick={() => handleSectionClick(1)}
          />

          {/* Right quarter - 2 bars (bottom-right quarter) */}
          <div
            className="absolute inset-0 hover:bg-slate-700/20 transition-colors duration-150 cursor-pointer"
            style={{
              clipPath: 'polygon(50% 50%, 100% 50%, 100% 100%, 50% 100%)',
            }}
            onClick={() => handleSectionClick(2)}
          />

          {/* Bottom quarter - 4 bars (bottom-left quarter) */}
          <div
            className="absolute inset-0 hover:bg-slate-700/20 transition-colors duration-150 cursor-pointer"
            style={{
              clipPath: 'polygon(50% 50%, 50% 100%, 0% 100%, 0% 50%)',
            }}
            onClick={() => handleSectionClick(4)}
          />

          {/* Left quarter - 8 bars (top-left quarter) */}
          <div
            className="absolute inset-0 hover:bg-slate-700/20 transition-colors duration-150 cursor-pointer"
            style={{
              clipPath: 'polygon(50% 50%, 0% 50%, 0% 0%, 50% 0%)',
            }}
            onClick={() => handleSectionClick(8)}
          />

          {/* Divider lines - like tempo knob */}
          {/* Vertical line */}
          <div className="absolute top-1 bottom-1 left-1/2 w-px bg-slate-600/40 -translate-x-1/2" />
          {/* Horizontal line */}
          <div className="absolute left-1 right-1 top-1/2 h-px bg-slate-600/40 -translate-y-1/2" />

          {/* Section numbers - positioned in the center of each quarter */}
          {/* Top quarter (1) - center of top-right triangle */}
          <div
            className="absolute text-xs text-slate-400 font-medium pointer-events-none"
            style={{
              top: '25%',
              left: '75%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            1
          </div>
          {/* Right quarter (2) - center of bottom-right triangle */}
          <div
            className="absolute text-xs text-slate-400 font-medium pointer-events-none"
            style={{
              top: '75%',
              left: '75%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            2
          </div>
          {/* Bottom quarter (4) - center of bottom-left triangle */}
          <div
            className="absolute text-xs text-slate-400 font-medium pointer-events-none"
            style={{
              top: '75%',
              left: '25%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            4
          </div>
          {/* Left quarter (8) - center of top-left triangle */}
          <div
            className="absolute text-xs text-slate-400 font-medium pointer-events-none"
            style={{
              top: '25%',
              left: '25%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            8
          </div>
        </div>

        {/* Circular stripe with selection highlighting */}
        <div className="absolute inset-0 pointer-events-none">
          <svg
            width={size + 16}
            height={size + 16}
            className="absolute"
            style={{ left: '-8px', top: '-8px' }}
          >
            {/* Background charcoal stripe */}
            <circle
              cx={(size + 16) / 2}
              cy={(size + 16) / 2}
              r={size / 2 + 6}
              fill="none"
              stroke="rgba(71, 85, 105, 0.7)"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Highlighted quarter stripe - only when selected */}
            {selectedBars !== null && (
              <g>
                <defs>
                  <linearGradient
                    id={`looperGradient-${selectedBars}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#f97316" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
                  </linearGradient>
                  <mask id={`quarterMask-${selectedBars}`}>
                    <rect width="100%" height="100%" fill="black" />
                    <path
                      d={`M ${(size + 16) / 2} ${(size + 16) / 2} ${
                        selectedBars === 1
                          ? `L ${(size + 16) / 2} 0 A ${size / 2 + 6} ${size / 2 + 6} 0 0 1 ${size + 16} ${(size + 16) / 2} Z` // Top-right
                          : selectedBars === 2
                            ? `L ${size + 16} ${(size + 16) / 2} A ${size / 2 + 6} ${size / 2 + 6} 0 0 1 ${(size + 16) / 2} ${size + 16} Z` // Bottom-right
                            : selectedBars === 4
                              ? `L ${(size + 16) / 2} ${size + 16} A ${size / 2 + 6} ${size / 2 + 6} 0 0 1 0 ${(size + 16) / 2} Z` // Bottom-left
                              : `L 0 ${(size + 16) / 2} A ${size / 2 + 6} ${size / 2 + 6} 0 0 1 ${(size + 16) / 2} 0 Z` // Top-left (8 bars)
                      }`}
                      fill="white"
                    />
                  </mask>
                </defs>
                <circle
                  cx={(size + 16) / 2}
                  cy={(size + 16) / 2}
                  r={size / 2 + 6}
                  fill="none"
                  stroke={`url(#looperGradient-${selectedBars})`}
                  strokeWidth="3"
                  strokeLinecap="round"
                  mask={`url(#quarterMask-${selectedBars})`}
                  style={{
                    filter: 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.6))',
                  }}
                />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
