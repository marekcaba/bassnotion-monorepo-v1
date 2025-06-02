'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
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
    <>
      <style>{`
        /* Target the specific RadixUI alert dialog overlay - ENTRANCE */
        .fixed.inset-0.z-50.bg-black\\/80[data-state="open"],
        [data-state="open"].fixed.inset-0.z-50.bg-black\\/80,
        .fixed.inset-0.z-50[data-state="open"].bg-black\\/80 {
          animation: overlayShow 500ms ease-out forwards !important;
        }
        
        /* Target the specific RadixUI alert dialog overlay - EXIT */
        .fixed.inset-0.z-50.bg-black\\/80[data-state="closed"],
        [data-state="closed"].fixed.inset-0.z-50.bg-black\\/80,
        .fixed.inset-0.z-50[data-state="closed"].bg-black\\/80 {
          animation: overlayHide 400ms ease-out forwards !important;
        }
        
        /* Override Tailwind fade-in-0 class specifically for alert dialog - ENTRANCE */
        [data-state="open"].fade-in-0,
        .fade-in-0[data-state="open"],
        [data-state="open"].animate-in.fade-in-0 {
          animation: overlayShow 500ms ease-out forwards !important;
        }
        
        /* Override Tailwind fade-in-0 class specifically for alert dialog - EXIT */
        [data-state="closed"].fade-in-0,
        .fade-in-0[data-state="closed"],
        [data-state="closed"].animate-in.fade-in-0 {
          animation: overlayHide 400ms ease-out forwards !important;
        }
        
        @keyframes overlayShow {
          from {
            opacity: 0;
            background-color: rgba(0, 0, 0, 0);
          }
          to {
            opacity: 1;
            background-color: rgba(0, 0, 0, 0.8);
          }
        }
        
        @keyframes overlayHide {
          from {
            opacity: 1;
            background-color: rgba(0, 0, 0, 0.8);
          }
          to {
            opacity: 0;
            background-color: rgba(0, 0, 0, 0);
          }
        }
        
        /* Content animation for alert dialog - ENTRANCE */
        .alert-dialog-content[data-state="open"] {
          animation: contentShow 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        /* Content animation for alert dialog - EXIT */
        .alert-dialog-content[data-state="closed"] {
          animation: contentHide 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        @keyframes contentShow {
          from {
            opacity: 0;
            transform: translate(-50%, -48%) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        @keyframes contentHide {
          from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          to {
            opacity: 0;
            transform: translate(-50%, -48%) scale(0.96);
          }
        }
        
        .dialog-icon-orange {
          transition: all 0.3s ease;
        }
        
        .dialog-icon-orange:hover {
          transform: scale(1.1) rotate(5deg);
          background-color: #f97316;
        }
      `}</style>
      
      <AlertDialog open={isOpen}>
        <AlertDialogContent className="alert-dialog-content max-w-md bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 shadow-2xl rounded-lg p-6">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="dialog-icon-orange p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <AlertDialogTitle className="text-gray-900 dark:text-gray-100">Session Timeout Warning</AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-gray-600 dark:text-gray-400">
                  You&apos;ve been inactive for a while. For your security,
                  you&apos;ll be automatically logged out in{' '}
                  <strong className="text-orange-600 dark:text-orange-400">
                    {formatTime(remainingTime)}
                  </strong>
                  .
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          
          <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-900 mt-4">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Your session will expire automatically to protect your account. Click "Stay Logged In" to continue your session.
            </p>
          </div>
          
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel 
              onClick={onLogout}
              className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
            >
              Logout Now
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={onExtendSession}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Stay Logged In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
