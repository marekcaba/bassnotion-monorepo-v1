'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  changePasswordSchema,
  type ChangePasswordData,
} from '@bassnotion/contracts';
import { Loader2, Eye, EyeOff, Key } from 'lucide-react';

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
import { authService } from '../../api/auth';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordDialog({
  isOpen,
  onClose,
}: ChangePasswordDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handleSubmit = async (data: ChangePasswordData) => {
    try {
      setIsLoading(true);
      await authService.updatePassword(data.currentPassword, data.newPassword);

      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully.',
        variant: 'success',
      });

      form.reset();
      onClose();
    } catch (error) {
      console.error('Password change error:', error);
      toast({
        title: 'Failed to change password',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
          // TODO: Review non-null assertion - consider null safety
          animation: overlayShow 500ms ease-out forwards !important;
        }
        
        /* Target the specific RadixUI overlay with data attributes - EXIT */
        .fixed.inset-0.z-50.bg-black\\/80[data-state="closed"],
        [data-state="closed"].fixed.inset-0.z-50.bg-black\\/80,
        .fixed.inset-0.z-50[data-state="closed"].bg-black\\/80 {
          // TODO: Review non-null assertion - consider null safety
          animation: overlayHide 400ms ease-out forwards !important;
        }
        
        /* Override Tailwind fade-in-0 class specifically - ENTRANCE */
        [data-state="open"].fade-in-0,
        .fade-in-0[data-state="open"],
        [data-state="open"].animate-in.fade-in-0 {
          // TODO: Review non-null assertion - consider null safety
          animation: overlayShow 500ms ease-out forwards !important;
        }
        
        /* Override Tailwind fade-in-0 class specifically - EXIT */
        [data-state="closed"].fade-in-0,
        .fade-in-0[data-state="closed"],
        [data-state="closed"].animate-in.fade-in-0 {
          // TODO: Review non-null assertion - consider null safety
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
        
        .dialog-icon-blue {
          transition: all 0.3s ease;
        }
        
        .dialog-icon-blue:hover {
          transform: scale(1.1) rotate(5deg);
          background-color: #3b82f6;
        }
      `}</style>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="dialog-content fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 shadow-2xl rounded-lg p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="dialog-icon-blue p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-gray-900 dark:text-gray-100">
                  Change Password
                </DialogTitle>
                <DialogDescription className="mt-1 text-gray-600 dark:text-gray-400">
                  Update your account password. Make sure to use a strong,
                  unique password.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-800 dark:text-blue-200">
                          Current Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showCurrentPassword ? 'text' : 'password'}
                              placeholder="Enter current password"
                              disabled={isLoading}
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() =>
                                // TODO: Review non-null assertion - consider null safety
                                setShowCurrentPassword(!showCurrentPassword)
                              }
                              disabled={isLoading}
                            >
                              {showCurrentPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                              <span className="sr-only">
                                {showCurrentPassword
                                  ? 'Hide password'
                                  : 'Show password'}
                              </span>
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-800 dark:text-blue-200">
                          New Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showNewPassword ? 'text' : 'password'}
                              placeholder="Enter new password"
                              disabled={isLoading}
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() =>
                                // TODO: Review non-null assertion - consider null safety
                                setShowNewPassword(!showNewPassword)
                              }
                              disabled={isLoading}
                            >
                              {showNewPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                              <span className="sr-only">
                                {showNewPassword
                                  ? 'Hide password'
                                  : 'Show password'}
                              </span>
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-800 dark:text-blue-200">
                          Confirm New Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Confirm new password"
                              disabled={isLoading}
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() =>
                                // TODO: Review non-null assertion - consider null safety
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              disabled={isLoading}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                              <span className="sr-only">
                                {showConfirmPassword
                                  ? 'Hide password'
                                  : 'Show password'}
                              </span>
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                  // TODO: Review non-null assertion - consider null safety
                  disabled={isLoading || !form.formState.isValid}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
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
