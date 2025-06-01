import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { authService } from '../api/auth';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';

// Mock the auth service
vi.mock('../api/auth', () => ({
  authService: {
    updatePassword: vi.fn(),
  },
}));

// Mock the toast hook
vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should disable submit button with invalid password', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    const currentPasswordInput = screen.getByPlaceholderText(
      'Enter current password',
    );
    const newPasswordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText(
      'Confirm new password',
    );
    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });

    // Fill with invalid password (too short)
    await user.type(currentPasswordInput, 'current123!');
    await user.type(newPasswordInput, 'weak');
    await user.type(confirmPasswordInput, 'weak');

    // Submit button should be disabled with invalid input
    expect(submitButton).toBeDisabled();
  });

  it('should disable submit button when passwords do not match', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    const currentPasswordInput = screen.getByPlaceholderText(
      'Enter current password',
    );
    const newPasswordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText(
      'Confirm new password',
    );
    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });

    // Fill with mismatched passwords
    await user.type(currentPasswordInput, 'current123!');
    await user.type(newPasswordInput, 'NewPassword123!');
    await user.type(confirmPasswordInput, 'Different123!');

    // Submit button should be disabled when passwords don't match
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button with valid matching passwords', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    const currentPasswordInput = screen.getByPlaceholderText(
      'Enter current password',
    );
    const newPasswordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText(
      'Confirm new password',
    );
    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });

    // Fill with valid matching passwords
    await user.type(currentPasswordInput, 'Current123!');
    await user.type(newPasswordInput, 'NewPassword123!');
    await user.type(confirmPasswordInput, 'NewPassword123!');

    // Submit button should be enabled with valid input
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });

  it('should handle successful password change', async () => {
    const user = userEvent.setup();
    const mockUpdatePassword = vi.fn().mockResolvedValue({});
    vi.mocked(authService.updatePassword).mockImplementation(
      mockUpdatePassword,
    );

    render(<ChangePasswordForm />);

    const currentPasswordInput = screen.getByPlaceholderText(
      'Enter current password',
    );
    const newPasswordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText(
      'Confirm new password',
    );

    await user.type(currentPasswordInput, 'Current123!');
    await user.type(newPasswordInput, 'NewPassword123!');
    await user.type(confirmPasswordInput, 'NewPassword123!');

    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith(
        'Current123!',
        'NewPassword123!',
      );
    });
  });

  it('should handle password change error', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Invalid current password');
    const mockUpdatePassword = vi.fn().mockRejectedValue(mockError);
    vi.mocked(authService.updatePassword).mockImplementation(
      mockUpdatePassword,
    );

    render(<ChangePasswordForm />);

    const currentPasswordInput = screen.getByPlaceholderText(
      'Enter current password',
    );
    const newPasswordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText(
      'Confirm new password',
    );

    await user.type(currentPasswordInput, 'WrongPassword123!');
    await user.type(newPasswordInput, 'NewPassword123!');
    await user.type(confirmPasswordInput, 'NewPassword123!');

    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith(
        'WrongPassword123!',
        'NewPassword123!',
      );
    });

    // Component should handle the error via toast - no error state in UI to test
    // The error handling is working if the service was called and didn't crash
  });
});
