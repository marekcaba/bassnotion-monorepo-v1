'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

interface IdleWarningDialogProps {
  isOpen: boolean;
  onExtendSession: () => void;
  onLogout: () => void;
  countdownSeconds?: number;
}

export function IdleWarningDialog({
  isOpen,
  onExtendSession,
  onLogout,
  countdownSeconds = 300, // 5 minutes
}: IdleWarningDialogProps) {
  const [remainingTime, setRemainingTime] = useState(countdownSeconds);

  useEffect(() => {
    if (!isOpen) {
      setRemainingTime(countdownSeconds);
      return;
    }

    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, countdownSeconds, onLogout]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Timeout Warning</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ve been inactive for a while. For your security,
            you&apos;ll be automatically logged out in{' '}
            <strong className="text-destructive">
              {formatTime(remainingTime)}
            </strong>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onLogout}>Logout Now</AlertDialogCancel>
          <AlertDialogAction onClick={onExtendSession}>
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
