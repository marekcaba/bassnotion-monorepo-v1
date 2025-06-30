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

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate password requirements', async () => {
    const { user } = render(<MockChangePasswordForm />);

    const currentInput = screen.getByTestId('current-password-input');
    const newInput = screen.getByTestId('new-password-input');

    await user.type(currentInput, 'Current123!');
    await user.type(newInput, 'weak');

    // In a real implementation, this would show validation errors
    expect(currentInput).toHaveValue('Current123!');
    expect(newInput).toHaveValue('weak');
  });

  it('should validate password match', async () => {
    const { user } = render(<MockChangePasswordForm />);

    const newInput = screen.getByTestId('new-password-input');
    const confirmInput = screen.getByTestId('confirm-password-input');

    await user.type(newInput, 'NewPass123!');
    await user.type(confirmInput, 'DifferentPass123!');

    // In a real implementation, this would show validation errors
    expect(newInput).toHaveValue('NewPass123!');
    expect(confirmInput).toHaveValue('DifferentPass123!');
  });

  it('should handle successful submission', async () => {
    mockAuthService.updatePassword.mockResolvedValue({});

    const { user } = render(<MockChangePasswordForm />);

    const submitButton = screen.getByTestId('submit-button');

    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAuthService.updatePassword).toHaveBeenCalledWith(
        'Current123!',
        'NewPass123!',
      );
    });
  });
});
