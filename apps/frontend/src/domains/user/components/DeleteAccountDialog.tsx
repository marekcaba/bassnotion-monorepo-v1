'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { useToast } from '@/shared/hooks/use-toast';

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required for account deletion'),
});

type DeleteAccountData = z.infer<typeof deleteAccountSchema>;

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  isLoading?: boolean;
}

export function DeleteAccountDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteAccountDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<DeleteAccountData>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      password: '',
    },
  });

  const handleConfirm = async (data: DeleteAccountData) => {
    try {
      await onConfirm(data.password);
      form.reset();
      onClose();
    } catch (error) {
      console.error('Account deletion error:', error);
      toast({
        title: 'Failed to delete account',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <>
      <style>{`
        /* Target the specific RadixUI overlay with data attributes - ENTRANCE */
        .fixed.inset-0.z-50.bg-black\\/80[data-state="open"],
        [data-state="open"].fixed.inset-0.z-50.bg-black\\/80,
        .fixed.inset-0.z-50[data-state="open"].bg-black\\/80 {
          animation: overlayShow 500ms ease-out forwards !important;
        }
        
        /* Target the specific RadixUI overlay with data attributes - EXIT */
        .fixed.inset-0.z-50.bg-black\\/80[data-state="closed"],
        [data-state="closed"].fixed.inset-0.z-50.bg-black\\/80,
        .fixed.inset-0.z-50[data-state="closed"].bg-black\\/80 {
          animation: overlayHide 400ms ease-out forwards !important;
        }
        
        /* Override Tailwind fade-in-0 class specifically - ENTRANCE */
        [data-state="open"].fade-in-0,
        .fade-in-0[data-state="open"],
        [data-state="open"].animate-in.fade-in-0 {
          animation: overlayShow 500ms ease-out forwards !important;
        }
        
        /* Override Tailwind fade-in-0 class specifically - EXIT */
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
        
        /* Content animation - ENTRANCE */
        .dialog-content[data-state="open"] {
          animation: contentShow 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        /* Content animation - EXIT */
        .dialog-content[data-state="closed"] {
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
        
        .dialog-icon-red {
          transition: all 0.3s ease;
        }
        
        .dialog-icon-red:hover {
          transform: scale(1.1) rotate(5deg);
          background-color: #ef4444;
        }
      `}</style>
      
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent 
          className="dialog-content fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 shadow-2xl rounded-lg p-6"
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="dialog-icon-red p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-gray-900 dark:text-gray-100">Delete Account</DialogTitle>
                <DialogDescription className="mt-1 text-gray-600 dark:text-gray-400">
                  This action cannot be undone. This will permanently delete your
                  account and remove all your data.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleConfirm)} className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-200 dark:border-red-900">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                  To confirm deletion, please enter your password:
                </p>
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            disabled={isLoading}
                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            <span className="sr-only">
                              {showPassword ? 'Hide password' : 'Show password'}
                            </span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isLoading || !form.formState.isValid}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Account'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
} 