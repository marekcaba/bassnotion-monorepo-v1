import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  EditModeProvider,
  EditModeControls,
  EditModeGuard,
  useEditMode,
  useEditModeCapabilities,
  EditMode,
} from '../EditModeManager';

// Test component to access context
function TestComponent() {
  const { state, setMode, toggleLock, hasCapability } = useEditMode();

  return (
    <div>
      <div data-testid="current-mode">{state.mode}</div>
      <div data-testid="is-locked">{state.isLocked.toString()}</div>
      <div data-testid="can-edit">{hasCapability('canEdit').toString()}</div>
      <div data-testid="can-create">
        {hasCapability('canCreate').toString()}
      </div>
      <div data-testid="can-delete">
        {hasCapability('canDelete').toString()}
      </div>
      <div data-testid="can-publish">
        {hasCapability('canPublish').toString()}
      </div>
      <div data-testid="can-access-advanced">
        {hasCapability('canAccessAdvancedProperties').toString()}
      </div>
      <div data-testid="can-manage-metadata">
        {hasCapability('canManageMetadata').toString()}
      </div>

      <button data-testid="set-view" onClick={() => setMode(EditMode.VIEW)}>
        View
      </button>
      <button data-testid="set-edit" onClick={() => setMode(EditMode.EDIT)}>
        Edit
      </button>
      <button data-testid="set-admin" onClick={() => setMode(EditMode.ADMIN)}>
        Admin
      </button>
      <button data-testid="toggle-lock" onClick={toggleLock}>
        Toggle Lock
      </button>
    </div>
  );
}

function CapabilitiesTestComponent() {
  const capabilities = useEditModeCapabilities();

  return (
    <div>
      <div data-testid="hook-can-edit">{capabilities.canEdit.toString()}</div>
      <div data-testid="hook-can-create">
        {capabilities.canCreate.toString()}
      </div>
      <div data-testid="hook-is-admin">
        {capabilities.isAdminMode.toString()}
      </div>
      <div data-testid="hook-is-edit">{capabilities.isEditMode.toString()}</div>
      <div data-testid="hook-is-view">{capabilities.isViewMode.toString()}</div>
      <div data-testid="hook-is-locked">{capabilities.isLocked.toString()}</div>
    </div>
  );
}

describe('EditModeManager', () => {
  describe('EditModeProvider', () => {
    it('should provide default VIEW mode for regular users', () => {
      render(
        <EditModeProvider userRole="user">
          <TestComponent />
        </EditModeProvider>,
      );

      expect(screen.getByTestId('current-mode')).toHaveTextContent('view');
      expect(screen.getByTestId('can-edit')).toHaveTextContent('false');
      expect(screen.getByTestId('can-create')).toHaveTextContent('false');
      expect(screen.getByTestId('can-delete')).toHaveTextContent('false');
      expect(screen.getByTestId('can-publish')).toHaveTextContent('false');
      expect(screen.getByTestId('can-access-advanced')).toHaveTextContent(
        'false',
      );
      expect(screen.getByTestId('can-manage-metadata')).toHaveTextContent(
        'false',
      );
    });

    it('should allow EDIT mode for admin users', () => {
      render(
        <EditModeProvider userRole="admin" initialMode={EditMode.EDIT}>
          <TestComponent />
        </EditModeProvider>,
      );

      expect(screen.getByTestId('current-mode')).toHaveTextContent('edit');
      expect(screen.getByTestId('can-edit')).toHaveTextContent('true');
      expect(screen.getByTestId('can-create')).toHaveTextContent('true');
      expect(screen.getByTestId('can-delete')).toHaveTextContent('true');
      expect(screen.getByTestId('can-publish')).toHaveTextContent('false');
      expect(screen.getByTestId('can-access-advanced')).toHaveTextContent(
        'false',
      );
    });

    it('should allow ADMIN mode for admin users', () => {
      render(
        <EditModeProvider userRole="admin" initialMode={EditMode.ADMIN}>
          <TestComponent />
        </EditModeProvider>,
      );

      expect(screen.getByTestId('current-mode')).toHaveTextContent('admin');
      expect(screen.getByTestId('can-edit')).toHaveTextContent('true');
      expect(screen.getByTestId('can-create')).toHaveTextContent('true');
      expect(screen.getByTestId('can-delete')).toHaveTextContent('true');
      expect(screen.getByTestId('can-publish')).toHaveTextContent('true');
      expect(screen.getByTestId('can-access-advanced')).toHaveTextContent(
        'true',
      );
      expect(screen.getByTestId('can-manage-metadata')).toHaveTextContent(
        'true',
      );
    });

    it('should prevent regular users from accessing EDIT mode', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Intentionally empty - we just want to suppress console warnings in tests
      });

      render(
        <EditModeProvider userRole="user">
          <TestComponent />
        </EditModeProvider>,
      );

      fireEvent.click(screen.getByTestId('set-edit'));

      expect(screen.getByTestId('current-mode')).toHaveTextContent('view');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot change to mode edit'),
      );

      consoleSpy.mockRestore();
    });

    it('should prevent regular users from accessing ADMIN mode', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Intentionally empty - we just want to suppress console warnings in tests
      });

      render(
        <EditModeProvider userRole="user">
          <TestComponent />
        </EditModeProvider>,
      );

      fireEvent.click(screen.getByTestId('set-admin'));

      expect(screen.getByTestId('current-mode')).toHaveTextContent('view');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot change to mode admin'),
      );

      consoleSpy.mockRestore();
    });

    it('should allow instructors to access EDIT mode but not ADMIN mode', () => {
      render(
        <EditModeProvider userRole="instructor">
          <TestComponent />
        </EditModeProvider>,
      );

      // Should be able to switch to EDIT
      fireEvent.click(screen.getByTestId('set-edit'));
      expect(screen.getByTestId('current-mode')).toHaveTextContent('edit');

      // Should not be able to switch to ADMIN
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Intentionally empty - we just want to suppress console warnings in tests
      });
      fireEvent.click(screen.getByTestId('set-admin'));
      expect(screen.getByTestId('current-mode')).toHaveTextContent('edit');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot change to mode admin'),
      );
      consoleSpy.mockRestore();
    });

    it('should handle locking mechanism', () => {
      render(
        <EditModeProvider userRole="admin" initialMode={EditMode.EDIT}>
          <TestComponent />
        </EditModeProvider>,
      );

      expect(screen.getByTestId('is-locked')).toHaveTextContent('false');
      expect(screen.getByTestId('can-edit')).toHaveTextContent('true');

      // Lock the mode
      fireEvent.click(screen.getByTestId('toggle-lock'));

      expect(screen.getByTestId('is-locked')).toHaveTextContent('true');
      expect(screen.getByTestId('can-edit')).toHaveTextContent('false');

      // Should not be able to change modes when locked
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Intentionally empty - we just want to suppress console warnings in tests
      });
      fireEvent.click(screen.getByTestId('set-admin'));
      expect(screen.getByTestId('current-mode')).toHaveTextContent('edit');
      consoleSpy.mockRestore();

      // Unlock
      fireEvent.click(screen.getByTestId('toggle-lock'));
      expect(screen.getByTestId('is-locked')).toHaveTextContent('false');
      expect(screen.getByTestId('can-edit')).toHaveTextContent('true');
    });

    it('should call onModeChange callback when mode changes', () => {
      const onModeChange = vi.fn();

      render(
        <EditModeProvider userRole="admin" onModeChange={onModeChange}>
          <TestComponent />
        </EditModeProvider>,
      );

      fireEvent.click(screen.getByTestId('set-edit'));

      expect(onModeChange).toHaveBeenCalledWith(EditMode.EDIT);
    });
  });

  describe('useEditModeCapabilities hook', () => {
    it('should provide capability shortcuts', () => {
      render(
        <EditModeProvider userRole="admin" initialMode={EditMode.ADMIN}>
          <CapabilitiesTestComponent />
        </EditModeProvider>,
      );

      expect(screen.getByTestId('hook-can-edit')).toHaveTextContent('true');
      expect(screen.getByTestId('hook-can-create')).toHaveTextContent('true');
      expect(screen.getByTestId('hook-is-admin')).toHaveTextContent('true');
      expect(screen.getByTestId('hook-is-edit')).toHaveTextContent('false');
      expect(screen.getByTestId('hook-is-view')).toHaveTextContent('false');
      expect(screen.getByTestId('hook-is-locked')).toHaveTextContent('false');
    });
  });

  describe('EditModeControls', () => {
    it('should render mode controls for admin user', () => {
      render(
        <EditModeProvider userRole="admin">
          <EditModeControls />
        </EditModeProvider>,
      );

      // Use a more flexible text matcher that handles line breaks
      expect(screen.getByText(/view\s+mode/i)).toBeInTheDocument();
      expect(screen.getByTitle('Switch to edit mode')).toBeInTheDocument();
      expect(screen.getByTitle('Switch to admin mode')).toBeInTheDocument();
    });

    it('should disable unavailable modes for regular users', () => {
      render(
        <EditModeProvider userRole="user">
          <EditModeControls />
        </EditModeProvider>,
      );

      // Use getAllByTitle since there are multiple elements with this title (edit and admin buttons)
      expect(screen.getAllByTitle('Insufficient permissions')).toHaveLength(2);
    });

    it('should show capabilities when enabled', () => {
      render(
        <EditModeProvider userRole="admin" initialMode={EditMode.ADMIN}>
          <EditModeControls showCapabilities={true} />
        </EditModeProvider>,
      );

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Create')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Publish')).toBeInTheDocument();
    });

    it('should hide capabilities when disabled', () => {
      render(
        <EditModeProvider userRole="admin" initialMode={EditMode.ADMIN}>
          <EditModeControls showCapabilities={false} />
        </EditModeProvider>,
      );

      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Create')).not.toBeInTheDocument();
    });
  });

  describe('EditModeGuard', () => {
    function GuardTestComponent() {
      return (
        <EditModeProvider userRole="admin" initialMode={EditMode.EDIT}>
          <EditModeGuard requiredCapability="canEdit">
            <div data-testid="protected-content">Protected Content</div>
          </EditModeGuard>
          <EditModeGuard
            requiredCapability="canPublish"
            fallback={<div data-testid="fallback">No Access</div>}
          >
            <div data-testid="admin-content">Admin Content</div>
          </EditModeGuard>
          <EditModeGuard requiredMode={EditMode.ADMIN}>
            <div data-testid="admin-mode-content">Admin Mode Content</div>
          </EditModeGuard>
        </EditModeProvider>
      );
    }

    it('should render protected content when capability is available', () => {
      render(<GuardTestComponent />);

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should render fallback when capability is not available', () => {
      render(<GuardTestComponent />);

      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });

    it('should render fallback when required mode is not active', () => {
      render(<GuardTestComponent />);

      expect(
        screen.queryByTestId('admin-mode-content'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should throw error when useEditMode is used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - we just want to suppress console errors in tests
      });

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useEditMode must be used within an EditModeProvider');

      consoleSpy.mockRestore();
    });
  });
});
