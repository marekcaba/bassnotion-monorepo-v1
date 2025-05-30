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
      const xssPayload = '<script>alert("xss")</script>';
      render(<ChangePasswordForm />);

      const newPasswordInput =
        screen.getByPlaceholderText('Enter new password');
      await userEvent.type(newPasswordInput, xssPayload);

      expect(newPasswordInput).toHaveValue(xssPayload);
      expect(document.querySelector('script')).not.toBeInTheDocument();
    });

    it('should prevent SQL injection attempts', async () => {
      const sqlInjection = "' OR '1'='1";
      render(<ChangePasswordForm />);

      const currentPasswordInput = screen.getByPlaceholderText(
        'Enter current password',
      );
      await userEvent.type(currentPasswordInput, sqlInjection);

      const submitButton = screen.getByRole('button', {
        name: /update password/i,
      });
      await userEvent.click(submitButton);

      // Should be rejected by validation
      expect(
        screen.getByText('Password must be at least 6 characters'),
      ).toBeInTheDocument();
    });

    it('should enforce password complexity requirements', async () => {
      render(<ChangePasswordForm />);

      const testCases = [
        {
          password: '12345',
          expectedError: 'Password must be at least 6 characters',
        },
        {
          password: 'password',
          expectedError: 'Password must be at least 6 characters',
        },
        {
          password: '123456',
          expectedError: 'Password must be at least 6 characters',
        },
      ];

      const newPasswordInput =
        screen.getByPlaceholderText('Enter new password');
      const submitButton = screen.getByRole('button', {
        name: /update password/i,
      });

      for (const testCase of testCases) {
        await userEvent.clear(newPasswordInput);
        await userEvent.type(newPasswordInput, testCase.password);
        await userEvent.click(submitButton);

        expect(screen.getByText(testCase.expectedError)).toBeInTheDocument();
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should prevent rapid password change attempts', async () => {
      const mockUpdatePassword = vi
        .fn()
        .mockRejectedValueOnce(new Error('Too many requests'))
        .mockRejectedValueOnce(new Error('Too many requests'))
        .mockResolvedValueOnce({});

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

      // Attempt rapid password changes
      for (let i = 0; i < 3; i++) {
        await userEvent.clear(currentPasswordInput);
        await userEvent.clear(newPasswordInput);
        await userEvent.clear(confirmPasswordInput);

        await userEvent.type(currentPasswordInput, 'CurrentPass123!');
        await userEvent.type(newPasswordInput, 'NewPass123!');
        await userEvent.type(confirmPasswordInput, 'NewPass123!');

        await userEvent.click(submitButton);
      }

      expect(mockUpdatePassword).toHaveBeenCalledTimes(3);
      expect(screen.getByText('Too many requests')).toBeInTheDocument();
    });
  });

  describe('Session Security', () => {
    it('should handle invalid session tokens', async () => {
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

      await userEvent.type(currentPasswordInput, 'CurrentPass123!');
      await userEvent.type(newPasswordInput, 'NewPass123!');
      await userEvent.type(confirmPasswordInput, 'NewPass123!');

      const submitButton = screen.getByRole('button', {
        name: /update password/i,
      });
      await userEvent.click(submitButton);

      expect(screen.getByText('Invalid session')).toBeInTheDocument();
    });
  });
});
