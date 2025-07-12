import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

interface DotDropdownMenuProps {
  isOpen: boolean;
  children: React.ReactNode; // The trigger element (dot)
  onAddSecondNote: () => void;
  onRemoveNote: () => void;
  onOpenChange: (open: boolean) => void;
}

export const DotDropdownMenu: React.FC<DotDropdownMenuProps> = ({
  isOpen,
  children,
  onAddSecondNote,
  onRemoveNote,
  onOpenChange,
}) => {
  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-auto min-w-fit bg-gray-800 border border-gray-600 shadow-lg rounded-md z-[9999]"
        align="start"
        side="right"
      >
        <DropdownMenuItem
          className="text-gray-200 hover:bg-gray-700 focus:bg-gray-700 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onAddSecondNote();
          }}
        >
          Add a second note
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-gray-200 hover:bg-gray-700 focus:bg-gray-700 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveNote();
          }}
        >
          Remove selected note
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
