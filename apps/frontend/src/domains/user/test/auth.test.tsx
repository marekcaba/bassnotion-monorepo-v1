import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { AuthService } from '../api/auth';
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

  it('should validate password requirements', async () => {
    render(<ChangePasswordForm />);

    // Try submitting with weak password
    const currentPasswordInput = screen.getByPlaceholderText(
      'Enter current password',
    );
    const newPasswordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText(
      'Confirm new password',
    );

    fireEvent.change(currentPasswordInput, {
      target: { value: 'current123!' },
    });
    fireEvent.change(newPasswordInput, { target: { value: 'weak' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'weak' } });

    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText('Password must be at least 6 characters'),
      ).toBeInTheDocument();
    });
  });

  it('should validate password match', async () => {
    render(<ChangePasswordForm />);

    const currentPasswordInput = screen.getByPlaceholderText(
      'Enter current password',
    );
    const newPasswordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText(
      'Confirm new password',
    );

    fireEvent.change(currentPasswordInput, {
      target: { value: 'current123!' },
    });
    fireEvent.change(newPasswordInput, {
      target: { value: 'newPassword123!' },
    });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'different123!' },
    });

    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  it('should handle successful password change', async () => {
    const mockUpdatePassword = vi.fn().mockResolvedValue({});
    (AuthService as any).updatePassword = mockUpdatePassword;

    render(<ChangePasswordForm />);

    const currentPasswordInput = screen.getByPlaceholderText(
      'Enter current password',
    );
    const newPasswordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText(
      'Confirm new password',
    );

    fireEvent.change(currentPasswordInput, {
      target: { value: 'current123!' },
    });
    fireEvent.change(newPasswordInput, {
      target: { value: 'newPassword123!' },
    });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'newPassword123!' },
    });

    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith(
        'current123!',
        'newPassword123!',
      );
    });
  });

  it('should handle password change error', async () => {
    const mockError = new Error('Invalid current password');
    const mockUpdatePassword = vi.fn().mockRejectedValue(mockError);
    (AuthService as any).updatePassword = mockUpdatePassword;

    render(<ChangePasswordForm />);

    const currentPasswordInput = screen.getByPlaceholderText(
      'Enter current password',
    );
    const newPasswordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText(
      'Confirm new password',
    );

    fireEvent.change(currentPasswordInput, {
      target: { value: 'wrongPassword123!' },
    });
    fireEvent.change(newPasswordInput, {
      target: { value: 'newPassword123!' },
    });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'newPassword123!' },
    });

    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid current password')).toBeInTheDocument();
    });
  });
});
