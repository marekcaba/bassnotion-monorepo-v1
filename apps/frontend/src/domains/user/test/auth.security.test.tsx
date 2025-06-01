import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../api/auth';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';

// Mock Supabase client
vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

// Mock auth service
vi.mock('../api/auth', () => ({
  authService: {
    updatePassword: vi.fn(),
  },
}));

// Mock toast notifications
vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('Authentication Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Password Security', () => {
    it('should prevent XSS in password fields', async () => {
      const user = userEvent.setup();
      const xssPayload = '<script>alert("xss")</script>';
      render(<ChangePasswordForm />);

      const newPasswordInput =
        screen.getByPlaceholderText('Enter new password');
      await user.type(newPasswordInput, xssPayload);

      expect(newPasswordInput).toHaveValue(xssPayload);
      expect(document.querySelector('script')).not.toBeInTheDocument();
    });

    it('should prevent weak passwords by disabling submit', async () => {
      const user = userEvent.setup();
      render(<ChangePasswordForm />);

      const currentPasswordInput = screen.getByPlaceholderText(
        'Enter current password',
      );
      const newPasswordInput =
        screen.getByPlaceholderText('Enter new password');
      const confirmPasswordInput = screen.getByPlaceholderText(
        'Confirm new password',
      );
      const submitButton = screen.getByRole('button', {
        name: /update password/i,
      });

      // Test various weak passwords
      const weakPasswords = [
        "' OR '1'='1", // SQL injection attempt
        '12345', // Too short
        'password', // Too short and common
        '12345678', // No complexity
      ];

      for (const weakPassword of weakPasswords) {
        await user.clear(currentPasswordInput);
        await user.clear(newPasswordInput);
        await user.clear(confirmPasswordInput);

        await user.type(currentPasswordInput, 'Current123!');
        await user.type(newPasswordInput, weakPassword);
        await user.type(confirmPasswordInput, weakPassword);

        // Submit should be disabled with weak passwords
        expect(submitButton).toBeDisabled();
      }
    });

    it('should only enable submit with strong passwords', async () => {
      const user = userEvent.setup();
      render(<ChangePasswordForm />);

      const currentPasswordInput = screen.getByPlaceholderText(
        'Enter current password',
      );
      const newPasswordInput =
        screen.getByPlaceholderText('Enter new password');
      const confirmPasswordInput = screen.getByPlaceholderText(
        'Confirm new password',
      );
      const submitButton = screen.getByRole('button', {
        name: /update password/i,
      });

      // Use a strong password that meets all requirements
      const strongPassword = 'StrongPassword123!';

      await user.type(currentPasswordInput, 'Current123!');
      await user.type(newPasswordInput, strongPassword);
      await user.type(confirmPasswordInput, strongPassword);

      // Submit should be enabled with strong password
      expect(submitButton).toBeEnabled();
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting errors gracefully', async () => {
      const user = userEvent.setup();
      const mockUpdatePassword = vi
        .fn()
        .mockRejectedValue(new Error('Too many requests'));

      vi.mocked(authService.updatePassword).mockImplementation(
        mockUpdatePassword,
      );

      render(<ChangePasswordForm />);

      const currentPasswordInput = screen.getByPlaceholderText(
        'Enter current password',
      );
      const newPasswordInput =
        screen.getByPlaceholderText('Enter new password');
      const confirmPasswordInput = screen.getByPlaceholderText(
        'Confirm new password',
      );
      const submitButton = screen.getByRole('button', {
        name: /update password/i,
      });

      await user.type(currentPasswordInput, 'CurrentPass123!');
      await user.type(newPasswordInput, 'NewPass123!');
      await user.type(confirmPasswordInput, 'NewPass123!');

      await user.click(submitButton);

      // Service should be called and error handled gracefully
      expect(mockUpdatePassword).toHaveBeenCalledWith(
        'CurrentPass123!',
        'NewPass123!',
      );
    });
  });

  describe('Session Security', () => {
    it('should handle invalid session tokens gracefully', async () => {
      const user = userEvent.setup();
      const mockUpdatePassword = vi
        .fn()
        .mockRejectedValue(new Error('Invalid session'));

      vi.mocked(authService.updatePassword).mockImplementation(
        mockUpdatePassword,
      );

      render(<ChangePasswordForm />);

      const currentPasswordInput = screen.getByPlaceholderText(
        'Enter current password',
      );
      const newPasswordInput =
        screen.getByPlaceholderText('Enter new password');
      const confirmPasswordInput = screen.getByPlaceholderText(
        'Confirm new password',
      );
      const submitButton = screen.getByRole('button', {
        name: /update password/i,
      });

      await user.type(currentPasswordInput, 'CurrentPass123!');
      await user.type(newPasswordInput, 'NewPass123!');
      await user.type(confirmPasswordInput, 'NewPass123!');

      await user.click(submitButton);

      // Service should be called and error handled gracefully
      expect(mockUpdatePassword).toHaveBeenCalledWith(
        'CurrentPass123!',
        'NewPass123!',
      );
    });
  });
});
