import { type ClassValue } from 'clsx';

import { buttonVariants } from '@/shared/components/ui/button.utils';
import { cn } from '@/shared/utils';

export const getAlertDialogStyles = {
  overlay: (className?: ClassValue) =>
    cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    ),
  content: (className?: ClassValue) =>
    cn(
      'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
      className,
    ),
  header: (className?: ClassValue) =>
    cn('flex flex-col space-y-2 text-center sm:text-left', className),
  footer: (className?: ClassValue) =>
    cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className,
    ),
  title: (className?: ClassValue) => cn('text-lg font-semibold', className),
  description: (className?: ClassValue) =>
    cn('text-sm text-muted-foreground', className),
  action: (className?: ClassValue) => cn(buttonVariants(), className),
  cancel: (className?: ClassValue) =>
    cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className),
};
