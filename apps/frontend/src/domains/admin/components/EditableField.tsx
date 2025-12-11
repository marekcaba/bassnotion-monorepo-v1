'use client';

import React, { useState, useCallback } from 'react';
import { Check, X, Edit2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'textarea' | 'select';
  placeholder?: string;
  options?: { label: string; value: string }[];
  className?: string;
  children?: React.ReactNode;
}

export function EditableField({
  value,
  onSave,
  type = 'text',
  placeholder = '',
  options = [],
  className = '',
  children,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const handleSave = useCallback(() => {
    onSave(localValue);
    setIsEditing(false);
  }, [localValue, onSave]);

  const handleCancel = useCallback(() => {
    setLocalValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && type !== 'textarea') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        handleCancel();
      }
    },
    [type, handleSave, handleCancel],
  );

  if (isEditing) {
    return (
      <div className={`editable-field-editing ${className}`}>
        {type === 'textarea' ? (
          <textarea
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
            autoFocus
          />
        ) : type === 'select' ? (
          <select
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
            autoFocus
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
            autoFocus
          />
        )}
        <div className="flex gap-2 mt-2">
          <Button size="sm" onClick={handleSave}>
            <Check className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`editable-field group relative ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {children || <span>{value || placeholder}</span>}
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-0 right-0 opacity-50 hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        <Edit2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
