'use client';

import React from 'react';
import { Upload, Save, FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { Exercise } from '@bassnotion/contracts';

interface SheetPlayerToolbarProps {
  exercise?: Exercise;
  onImport: () => void;
  onSave: () => void;
  onExportPDF: () => void;
  disabled?: boolean;
}

export function SheetPlayerToolbar({
  exercise,
  onImport,
  onSave,
  onExportPDF,
  disabled = false,
}: SheetPlayerToolbarProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-3 border-t border-slate-700/30">
      {/* Import Button */}
      {/* <button
        onClick={onImport}
        disabled={disabled}
        className="px-3 py-1 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 text-slate-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <Upload className="w-4 h-4" />
        <span>Import</span>
      </button> */}

      {/* Save Button */}
      {/* <button
        onClick={onSave}
        disabled={disabled || !exercise}
        className="px-3 py-1 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 text-slate-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <Save className="w-4 h-4" />
        <span>Save</span>
      </button> */}

      {/* PDF Export Button */}
      {/* <button
        onClick={onExportPDF}
        disabled={disabled || !exercise}
        className="px-3 py-1 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 text-slate-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <FileText className="w-4 h-4" />
        <span>PDF</span>
      </button> */}
    </div>
  );
}
