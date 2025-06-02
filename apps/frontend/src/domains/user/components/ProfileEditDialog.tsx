'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  userProfileSchema,
  type UserProfileData,
} from '@bassnotion/contracts';
import { z } from 'zod';
import { Loader2, Save, User } from 'lucide-react';

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
import { useAuth } from '../hooks/use-auth';

// Custom schema that properly handles only displayName and bio
const profileEditSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  bio: z.string().optional(),
});

type ProfileEditData = z.infer<typeof profileEditSchema>;

interface ProfileEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: {
    displayName: string;
    bio?: string;
    avatarUrl?: string;
  };
  onSubmit: (data: UserProfileData) => Promise<void>;
}

export function ProfileEditDialog({
  isOpen,
  onClose,
  initialData,
  onSubmit,
}: ProfileEditDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<ProfileEditData>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      displayName: initialData.displayName || '',
      bio: initialData.bio || '',
    },
    mode: 'onSubmit', // Only validate on submit
  });

  // Check if form has been modified
  const isDirty = form.formState.isDirty;

  // Update form values when initialData changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      console.log('[ProfileEditDialog] Dialog opened with initialData:', initialData);
      form.reset({
        displayName: initialData.displayName || '',
        bio: initialData.bio || '',
      });
      console.log('[ProfileEditDialog] Form reset with values:', {
        displayName: initialData.displayName || '',
        bio: initialData.bio || '',
      });
    }
  }, [isOpen, initialData, form]);

  const handleSubmit = async (data: ProfileEditData) => {
    try {
      setIsLoading(true);
      
      // Transform data to match the expected format, preserving avatarUrl
      const submitData: UserProfileData = {
        displayName: data.displayName,
        bio: data.bio || undefined,
        avatarUrl: initialData.avatarUrl || undefined, // Preserve existing avatar
      };

      await onSubmit(submitData);
      form.reset(data); // Reset form with new data
      onClose();
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: 'Failed to update profile',
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
    form.reset(); // Reset form when closing
    onClose();
  };

  return (
    <>
      <style>{`
        /* Enhanced overlay animation - ENTRANCE */
        [data-state="open"].fixed.inset-0.z-50 {
          animation: overlayShow 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }
        
        /* Enhanced overlay animation - EXIT */
        [data-state="closed"].fixed.inset-0.z-50 {
          animation: overlayHide 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }
        
        @keyframes overlayShow {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(4px);
          }
        }
        
        @keyframes overlayHide {
          from {
            opacity: 1;
            backdrop-filter: blur(4px);
          }
          to {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
        }
        
        /* Enhanced content animation - ENTRANCE */
        .dialog-content-animated[data-state="open"] {
          animation: contentShow 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        /* Enhanced content animation - EXIT */
        .dialog-content-animated[data-state="closed"] {
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
      `}</style>
      
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent 
          className="dialog-content-animated fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 shadow-2xl rounded-lg p-6"
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full transition-all duration-300 hover:scale-110 hover:rotate-6 hover:bg-green-500">
                <User className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <DialogTitle className="text-gray-900 dark:text-gray-100">Edit Profile</DialogTitle>
                <DialogDescription className="mt-1 text-gray-600 dark:text-gray-400">
                  Update your profile information and settings.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-900">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-green-800 dark:text-green-200">Display Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your display name"
                            disabled={isLoading}
                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-green-800 dark:text-green-200">Bio</FormLabel>
                        <FormControl>
                          <textarea
                            placeholder="Tell us about yourself..."
                            className="min-h-[80px] w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isLoading}
                            {...field}
                          />
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
                  disabled={isLoading || !isDirty}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
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