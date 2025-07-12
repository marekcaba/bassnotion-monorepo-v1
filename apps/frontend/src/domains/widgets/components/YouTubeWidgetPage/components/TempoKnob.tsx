'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TempoKnobProps {
  value: number; // BPM value (e.g., 60-200)
  onChange: (value: number) => void;
  min?: number; // Minimum BPM
  max?: number; // Maximum BPM
  size?: number; // Size in pixels
}

export function TempoKnob({ 
  value = 120, 
  onChange, 
  min = 60,
  max = 200,
  size = 56
}: TempoKnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<number>(0);
  const startValueRef = useRef<number>(0);
  const dragStartTimeRef = useRef<number>(0);
  const hasDraggedRef = useRef<boolean>(false);
  
  // Convert BPM value to rotation angle (-135 to 135 degrees)
  const valueToAngle = (val: number) => {
    const normalizedValue = (val - min) / (max - min);
    return normalizedValue * 270 - 135;
  };

  const handleStart = (clientX: number) => {
    setIsDragging(true);
    startPosRef.current = clientX;
    startValueRef.current = value;
    dragStartTimeRef.current = Date.now();
    hasDraggedRef.current = false;
  };


  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    
    const deltaX = Math.abs(clientX - startPosRef.current);
    
    // Mark as dragged if moved more than 3 pixels
    if (deltaX > 3) {
      hasDraggedRef.current = true;
    }
    
    const sensitivity = 0.25;
    const valueChange = (clientX - startPosRef.current) * sensitivity;
    const newValue = Math.max(min, Math.min(max, Math.round(startValueRef.current + valueChange)));
    
    // Only call onChange if value actually changed
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleEnd = (e?: MouseEvent | TouchEvent) => {
    const wasShortClick = Date.now() - dragStartTimeRef.current < 200;
    const didNotDrag = !hasDraggedRef.current;
    
    // If it was a short click without dragging, treat as click
    if (wasShortClick && didNotDrag && e) {
      const clientX = e instanceof MouseEvent ? e.clientX : (e as TouchEvent).changedTouches[0].clientX;
      
      if (knobRef.current) {
        const rect = knobRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        
        if (clientX < centerX) {
          // Left side - decrease tempo
          const newValue = Math.max(min, value - 1);
          onChange(newValue);
        } else {
          // Right side - increase tempo
          const newValue = Math.min(max, value + 1);
          onChange(newValue);
        }
      }
    }
    
    setIsDragging(false);
  };

  // Mouse and touch events
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };
    const handleMouseUp = (e: MouseEvent) => handleEnd(e);
    const handleTouchEnd = (e: TouchEvent) => handleEnd(e);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, value, onChange, min, max]);

  const rotation = valueToAngle(value);
  const progress = (value - min) / (max - min);

  return (
    <div className="relative select-none flex flex-col items-center" style={{ userSelect: 'none' }}>
      {/* Tempo Knob on Top */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Single plane neumorphic knob */}
        <div 
          ref={knobRef}
          className="absolute inset-0 rounded-full bg-slate-800 shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(255,255,255,0.1)] cursor-pointer transition-all duration-200 hover:shadow-[9px_9px_18px_rgba(0,0,0,0.6),-9px_-9px_18px_rgba(255,255,255,0.12)] select-none overflow-hidden"
          onMouseDown={(e) => {
            e.preventDefault();
            handleStart(e.clientX);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleStart(e.touches[0].clientX);
          }}
          onDragStart={(e) => e.preventDefault()}
        >
          {/* Left half hover area */}
          <div className="absolute inset-y-0 left-0 w-1/2 hover:bg-slate-700/20 transition-colors duration-150 rounded-l-full" />
          
          {/* Right half hover area */}
          <div className="absolute inset-y-0 right-0 w-1/2 hover:bg-slate-700/20 transition-colors duration-150 rounded-r-full" />
          
          {/* Vertical divider line */}
          <div className="absolute top-1 bottom-1 left-1/2 w-px bg-slate-600/40 -translate-x-1/2" />
          
          {/* Subtle minus/plus indicators */}
          <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold pointer-events-none">−</div>
          <div className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold pointer-events-none">+</div>
        </div>
        
        {/* Circular gradient stripe */}
        <div className="absolute inset-0 pointer-events-none">
          <svg
            width={size + 16}
            height={size + 16}
            className="absolute"
            style={{ left: '-8px', top: '-8px' }}
          >
            <defs>
              <linearGradient id="tempoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#f97316" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
              </linearGradient>
            </defs>
            
            <g style={{ transform: `rotate(-225deg)`, transformOrigin: `${(size + 16) / 2}px ${(size + 16) / 2}px` }}>
              {/* Background track */}
              <circle
                cx={(size + 16) / 2}
                cy={(size + 16) / 2}
                r={size / 2 + 6}
                fill="none"
                stroke="rgba(71, 85, 105, 0.3)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(270 / 360) * 2 * Math.PI * (size / 2 + 6)} ${2 * Math.PI * (size / 2 + 6)}`}
                strokeDashoffset={0}
              />
              
              {/* Active stripe */}
              <circle
                cx={(size + 16) / 2}
                cy={(size + 16) / 2}
                r={size / 2 + 6}
                fill="none"
                stroke="url(#tempoGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${progress * (270 / 360) * 2 * Math.PI * (size / 2 + 6)} ${2 * Math.PI * (size / 2 + 6)}`}
                strokeDashoffset={0}
                className="transition-all duration-200"
                style={{ filter: 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.6))' }}
              />
            </g>
          </svg>
        </div>
      </div>
      
      {/* BPM Display Below Knob */}
      <div className="text-sm font-semibold text-slate-200 mt-3">
        {value} BPM
      </div>
    </div>
  );
}