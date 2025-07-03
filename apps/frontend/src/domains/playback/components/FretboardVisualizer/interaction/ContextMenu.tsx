'use client';

import React, { useEffect, useRef } from 'react';
import type { ExerciseNote } from '../types/fretboard.js';

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  selectedNote: ExerciseNote | null;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onProperties: () => void;
}

export function ContextMenu({
  isVisible,
  position,
  selectedNote,
  onClose,
  onCopy,
  onPaste,
  onDelete,
  onDuplicate,
  onProperties,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }

    // Return undefined for the else case to satisfy TypeScript
    return undefined;
  }, [isVisible, onClose]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible) return;

      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          onDelete();
          onClose();
          break;
        default:
          break;
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }

    // Return undefined for the else case to satisfy TypeScript
    return undefined;
  }, [isVisible, onClose, onDelete]);

  if (!isVisible) return null;

  const menuItems = [
    {
      label: 'Copy',
      shortcut: 'Ctrl+C',
      onClick: () => {
        onCopy();
        onClose();
      },
      disabled: !selectedNote,
    },
    {
      label: 'Paste',
      shortcut: 'Ctrl+V',
      onClick: () => {
        onPaste();
        onClose();
      },
      disabled: false, // TODO: Check if clipboard has note data
    },
    {
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      onClick: () => {
        onDuplicate();
        onClose();
      },
      disabled: !selectedNote,
    },
    { type: 'separator' },
    {
      label: 'Delete',
      shortcut: 'Del',
      onClick: () => {
        onDelete();
        onClose();
      },
      disabled: !selectedNote,
      className: 'text-red-400 hover:text-red-300',
    },
    { type: 'separator' },
    {
      label: 'Properties',
      shortcut: '',
      onClick: () => {
        onProperties();
        onClose();
      },
      disabled: !selectedNote,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-lg py-2 min-w-[160px]"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {menuItems.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={index} className="border-t border-slate-600 my-1" />;
        }

        return (
          <button
            key={index}
            onClick={item.onClick}
            disabled={item.disabled}
            className={`
              w-full px-3 py-2 text-left text-sm
              flex justify-between items-center
              hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
              ${item.className || 'text-slate-200 hover:text-white'}
            `}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-slate-400 text-xs ml-4">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
