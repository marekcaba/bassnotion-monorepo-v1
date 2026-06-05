'use client';

/**
 * The account gate — shown when an ANONYMOUS user conquers a groove. Framed
 * as "keep your win," never a paywall (the playing was already free). On
 * confirm it routes to /register; the pending conquer is already stashed in
 * the drill store and replays after signup (see useConquerReplay).
 *
 * Deliberately NOT AuthGuard: anonymous users must keep playing freely. This
 * is an in-place Dialog at the single save moment only.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

interface SaveAccountGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Groove name, for the copy ("Keep your Pocket Funk win"). */
  grooveName: string;
}

export function SaveAccountGate({
  open,
  onOpenChange,
  grooveName,
}: SaveAccountGateProps) {
  const { navigateWithTransition } = useViewTransitionRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keep your win</DialogTitle>
          <DialogDescription>
            You just conquered{' '}
            <span className="font-semibold text-foreground">{grooveName}</span>.
            Create a free account to save it, track your progress, and pick up
            right where you left off.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="sm:mr-auto"
          >
            Not now — keep playing
          </Button>
          <Button onClick={() => navigateWithTransition('/register')}>
            Create a free account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
