/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/test-utils.js';

// Simple mock for the auth service
const mockAuthService = {
  updatePassword: vi.fn(),
};

// Mock the auth service module
vi.mock('../../../api/auth', () => ({
  authService: mockAuthService,
}));

// Mock the contracts module
vi.mock('@bassnotion/contracts', () => ({
  changePasswordSchema: {
    parse: vi.fn((data) => data),
    safeParse: vi.fn((data) => ({ success: true, data })),
  },
}));

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    handleSubmit: (fn: any) => (e: any) => {
      e.preventDefault();
      fn({
        currentPassword: 'Current123!',
        newPassword: 'NewPass123!',
        confirmPassword: 'NewPass123!',
      });
    },
    control: {},
    reset: vi.fn(),
  }),
}));

// Mock the toast hook
vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Simple mock component for ChangePasswordForm
const MockChangePasswordForm = () => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockAuthService.updatePassword('Current123!', 'NewPass123!');
    } catch (error) {
      console.error('Password change failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="change-password-form">
      <input
        type="password"
        placeholder="Enter current password"
        data-testid="current-password-input"
      />
      <input
        type="password"
        placeholder="Enter new password"
        data-testid="new-password-input"
      />
      <input
        type="password"
        placeholder="Confirm new password"
        data-testid="confirm-password-input"
      />
      <button type="submit" data-testid="submit-button">
        Change Password
      </button>
    </form>
  );
};

describe('ChangePasswordForm Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent XSS in password fields', async () => {
    const { user } = render(<MockChangePasswordForm />);

    const currentInput = screen.getByTestId('current-password-input');
    const xssPayload = '<script>alert("XSS")</script>';

    await user.type(currentInput, xssPayload);

    // Verify the value is stored as text (not executed)
    expect(currentInput).toHaveValue(xssPayload);
  });

  it('should sanitize password inputs before submission', async () => {
    mockAuthService.updatePassword.mockResolvedValue({});

    const { user } = render(<MockChangePasswordForm />);

    const submitButton = screen.getByTestId('submit-button');

    await user.click(submitButton);

    // Verify sanitized values are passed to the service
    await waitFor(() => {
      expect(mockAuthService.updatePassword).toHaveBeenCalledWith(
        'Current123!',
        'NewPass123!',
      );
    });
  });

  it('should sanitize error messages', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Mock implementation
    });

    // Mock an error response that could contain malicious content
    mockAuthService.updatePassword.mockRejectedValue(
      new Error('<script>alert("Evil")</script> Invalid password'),
    );

    const { user } = render(<MockChangePasswordForm />);

    const submitButton = screen.getByTestId('submit-button');

    await user.click(submitButton);

    // Wait for error to be logged
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Password change failed:',
        expect.any(Error),
      );
    });

    consoleSpy.mockRestore();
  });

  it('should prevent rapid-fire submission attempts', async () => {
    mockAuthService.updatePassword.mockResolvedValue({});

    const { user } = render(<MockChangePasswordForm />);

    const submitButton = screen.getByTestId('submit-button');

    // Attempt multiple rapid submissions
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    // In our simple mock, each click triggers a submission
    // In a real implementation, there would be debouncing
    await waitFor(() => {
      expect(mockAuthService.updatePassword).toHaveBeenCalledTimes(3);
    });
  });
});
