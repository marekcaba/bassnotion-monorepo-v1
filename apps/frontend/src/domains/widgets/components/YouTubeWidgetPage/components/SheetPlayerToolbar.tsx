'use client';

import type { Exercise } from '@bassnotion/contracts';

interface SheetPlayerToolbarProps {
  exercise?: Exercise;
  onImport: () => void;
  onSave: () => void;
  onExportPDF: () => void;
  disabled?: boolean;
}

// All three toolbar buttons (Import / Save / PDF) were commented out long
// before launch — the component was still rendering an empty bordered strip
// under the sheet music. Returning null until any of them ship.
//
// When wiring buttons back, restore the markup from git history rather than
// from comments — comments rot.
export function SheetPlayerToolbar(_props: SheetPlayerToolbarProps) {
  return null;
}
