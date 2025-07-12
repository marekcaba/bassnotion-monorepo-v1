'use client';

import React, { useState, useRef, useEffect } from 'react';

interface VolumeKnobProps {
  value: number; // 0-100
  onChange: (value: number) => void;
  color?: string; // Accent color for the indicator
  size?: number; // Size in pixels
  isMuted?: boolean;
  onMuteToggle?: () => void;
}

export function VolumeKnob({ 
  value = 50, 
  onChange, 
  color = 'bg-emerald-400',
  size = 56,
  isMuted = false,
  onMuteToggle 
}: VolumeKnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const knobRef = useRef<HTMLDivElement>(null);
  const centerButtonRef = useRef<HTMLButtonElement>(null);
  const startAngleRef = useRef<number>(0);
  const startValueRef = useRef<number>(0);
  
  // Update current value when prop changes
  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  // Convert value (0-100) to rotation angle (-135 to 135 degrees)
  const valueToAngle = (val: number) => {
    return (val / 100) * 270 - 135;
  };

  // Convert angle to value
  const angleToValue = (angle: number) => {
    const normalized = ((angle + 135) / 270) * 100;
    return Math.max(0, Math.min(100, Math.round(normalized)));
  };

  // Calculate angle from mouse/touch position
  const getAngleFromEvent = (clientX: number, clientY: number) => {
    if (!knobRef.current) return 0;
    
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    if (angle > 315) angle = 315; // Max angle
    if (angle < 45 && angle > 0) angle = 45; // Min angle
    
    return angle - 180; // Convert to -135 to 135 range
  };

  const handleStart = (clientX: number, clientY: number) => {
    console.log('VolumeKnob: Starting drag at', clientX, clientY);
    setIsDragging(true);
    startAngleRef.current = clientX; // Store starting X position for horizontal drag
    startValueRef.current = value;
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    // Calculate horizontal movement
    const deltaX = clientX - startAngleRef.current;
    const sensitivity = 0.5; // Adjust sensitivity (lower = more sensitive)
    const valueChange = deltaX * sensitivity;
    
    // Calculate new value based on horizontal movement
    const newValue = Math.max(0, Math.min(100, startValueRef.current + valueChange));
    const roundedValue = Math.round(newValue);
    console.log('VolumeKnob: Moving to', roundedValue, 'deltaX:', deltaX);
    
    // Update local state immediately for visual feedback
    setCurrentValue(roundedValue);
    onChange(roundedValue);
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  // Mouse and touch events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Prevent scrolling
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };
    
    const handleMouseUp = () => {
      handleEnd();
    };
    
    const handleTouchEnd = () => {
      handleEnd();
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  // Use the actual volume value for display, not the muted state
  const displayValue = isMuted ? value : currentValue;
  const rotation = valueToAngle(displayValue);

  return (
    <div className="relative select-none" style={{ width: size, height: size, userSelect: 'none' }}>
      {/* Outer ring with neumorphic effect */}
      <div 
        ref={knobRef}
        className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-[8px_8px_16px_rgba(0,0,0,0.8),-8px_-8px_16px_rgba(255,255,255,0.15)] cursor-pointer transition-all duration-200 hover:shadow-[9px_9px_18px_rgba(0,0,0,0.85),-9px_-9px_18px_rgba(255,255,255,0.175)] select-none"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleStart(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          const touch = e.touches[0];
          handleStart(touch.clientX, touch.clientY);
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Inner knob with inset shadow */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 shadow-[inset_3px_3px_6px_rgba(0,0,0,0.8),inset_-3px_-3px_6px_rgba(255,255,255,0.2)]">
          {/* Metallic center */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800">
            {/* Pointer indicator */}
            <div 
              className="absolute inset-0"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {/* Pointer line */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0.5 h-1/3 bg-white rounded-full shadow-[0_0_3px_rgba(255,255,255,0.8)]" />
            </div>
            {/* Center Mute Button - now allows drag pass-through */}
            <div
              ref={centerButtonRef}
              onMouseDown={(e) => {
                // Allow drag to start from center, but record the mouse down for click detection
                const startX = e.clientX;
                const startY = e.clientY;
                
                const handleClick = (e: MouseEvent) => {
                  const endX = e.clientX;
                  const endY = e.clientY;
                  const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                  
                  // Only trigger mute if it's a click (not a drag)
                  if (distance < 5) {
                    e.preventDefault();
                    e.stopPropagation();
                    onMuteToggle?.();
                  }
                  
                  document.removeEventListener('mouseup', handleClick);
                };
                
                document.addEventListener('mouseup', handleClick);
              }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-all duration-100 flex items-center justify-center group cursor-pointer pointer-events-auto ${
                isMuted 
                  ? 'bg-slate-800 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.8),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.9),inset_-3px_-3px_6px_rgba(255,255,255,0.15)]'
                  : 'bg-slate-700 shadow-[2px_2px_4px_rgba(0,0,0,0.8),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[3px_3px_6px_rgba(0,0,0,0.9),-3px_-3px_6px_rgba(255,255,255,0.15)]'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_4px_rgba(239,68,68,0.8)]" />
              ) : (
                <div className={`w-2.5 h-2.5 ${color} rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)]`} />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Dot indicators around the knob */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 11 }, (_, i) => {
          const angle = (i / 10) * 270 - 135;
          const isActive = displayValue >= (i * 10);
          const radius = size / 2 + 8;
          const x = Math.cos((angle - 90) * Math.PI / 180) * radius;
          const y = Math.sin((angle - 90) * Math.PI / 180) * radius;
          
          return (
            <div
              key={i}
              className={`absolute w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                isActive ? color : 'bg-slate-600'
              }`}
              style={{
                left: `${size / 2 + x - 3}px`,
                top: `${size / 2 + y - 3}px`,
              }}
            />
          );
        })}
      </div>
      
    </div>
  );
}