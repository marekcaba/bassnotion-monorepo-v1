'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginData } from '@bassnotion/contracts';
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/shared/components/ui/button';
import { GoogleSignInButton } from '@/shared/components/ui/google-sign-in-button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';

interface LoginFormProps {
  onSubmit: (data: LoginData) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onCreateAccount?: (data: LoginData) => void;
  isLoading?: boolean;
  isGoogleLoading?: boolean;
  showCreateAccountButton?: boolean;
  className?: string;
}

export function LoginForm({
  onSubmit,
  onGoogleSignIn,
  onCreateAccount,
  isLoading = false,
  isGoogleLoading = false,
  showCreateAccountButton = false,
  className,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmit = async (data: LoginData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      // Error handling will be done by the parent component
      console.error('Login error:', error);
    }
  };

  const handleCreateAccount = () => {
    const currentData = form.getValues();
    onCreateAccount?.(currentData);
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-center">Welcome Back</h2>
        <p className="text-muted-foreground text-center mt-2">
          Sign in to continue your bass learning journey
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    autoComplete="email"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isLoading}
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={togglePasswordVisibility}
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

          <div className="flex items-center justify-between">
            <Button variant="link" className="p-0 h-auto text-sm">
              Forgot password?
            </Button>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !form.formState.isValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </Button>

          {/* Show Create Account button when login fails */}
          {showCreateAccountButton && (
            <div className="mt-4 p-4 bg-muted/50 border rounded-lg">
              <p className="text-sm text-muted-foreground text-center mb-3">
                Don't have an account with this email?
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleCreateAccount}
                disabled={!form.formState.isValid}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account with These Credentials
              </Button>
            </div>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <GoogleSignInButton
            onClick={onGoogleSignIn}
            isLoading={isGoogleLoading}
          />
        </form>
      </Form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Button variant="link" className="p-0 h-auto">
            Create account
          </Button>
        </p>
      </div>
    </div>
  );
}
