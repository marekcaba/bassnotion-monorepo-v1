import React, { createContext, useContext, useState, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Eye, Edit, Settings, Lock, Unlock } from 'lucide-react';

// Epic 5 EditMode Framework - Formal implementation
export enum EditMode {
  VIEW = 'view', // Read-only viewing (Epic 3)
  EDIT = 'edit', // Basic editing (Epic 3)
  ADMIN = 'admin', // Full admin capabilities (Epic 5)
}

export interface EditModeCapabilities {
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canAccessAdvancedProperties: boolean;
  canManageMetadata: boolean;
}

export interface EditModeState {
  mode: EditMode;
  capabilities: EditModeCapabilities;
  isLocked: boolean;
  lockReason?: string;
}

export interface EditModeContextValue {
  state: EditModeState;
  setMode: (mode: EditMode) => void;
  toggleLock: () => void;
  hasCapability: (capability: keyof EditModeCapabilities) => boolean;
  canChangeMode: (targetMode: EditMode) => boolean;
}

// Context for EditMode management
const EditModeContext = createContext<EditModeContextValue | null>(null);

// Hook to use EditMode context
export function useEditMode(): EditModeContextValue {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
}

// Default capabilities for each mode
const getDefaultCapabilities = (mode: EditMode): EditModeCapabilities => {
  switch (mode) {
    case EditMode.VIEW:
      return {
        canEdit: false,
        canCreate: false,
        canDelete: false,
        canPublish: false,
        canAccessAdvancedProperties: false,
        canManageMetadata: false,
      };
    case EditMode.EDIT:
      return {
        canEdit: true,
        canCreate: true,
        canDelete: true,
        canPublish: false,
        canAccessAdvancedProperties: false,
        canManageMetadata: false,
      };
    case EditMode.ADMIN:
      return {
        canEdit: true,
        canCreate: true,
        canDelete: true,
        canPublish: true,
        canAccessAdvancedProperties: true,
        canManageMetadata: true,
      };
    default:
      return getDefaultCapabilities(EditMode.VIEW);
  }
};

export interface EditModeProviderProps {
  children: React.ReactNode;
  initialMode?: EditMode;
  userRole?: 'user' | 'admin' | 'instructor';
  onModeChange?: (mode: EditMode) => void;
}

// Provider component for EditMode
export function EditModeProvider({
  children,
  initialMode = EditMode.VIEW,
  userRole = 'user',
  onModeChange,
}: EditModeProviderProps) {
  const [mode, setModeState] = useState<EditMode>(initialMode);
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string>();

  const capabilities = getDefaultCapabilities(mode);

  const canChangeMode = useCallback(
    (targetMode: EditMode): boolean => {
      if (isLocked) return false;

      // Role-based access control
      switch (targetMode) {
        case EditMode.VIEW:
          return true; // Everyone can view
        case EditMode.EDIT:
          return userRole !== 'user'; // Instructors and admins can edit
        case EditMode.ADMIN:
          return userRole === 'admin'; // Only admins can access admin mode
        default:
          return false;
      }
    },
    [isLocked, userRole],
  );

  const setMode = useCallback(
    (newMode: EditMode) => {
      if (!canChangeMode(newMode)) {
        console.warn(
          `Cannot change to mode ${newMode} - insufficient permissions or locked`,
        );
        return;
      }

      setModeState(newMode);
      onModeChange?.(newMode);
    },
    [canChangeMode, onModeChange],
  );

  const toggleLock = useCallback(() => {
    if (isLocked) {
      setIsLocked(false);
      setLockReason(undefined);
    } else {
      setIsLocked(true);
      setLockReason('Manually locked to prevent accidental changes');
    }
  }, [isLocked]);

  const hasCapability = useCallback(
    (capability: keyof EditModeCapabilities): boolean => {
      return capabilities[capability] && !isLocked;
    },
    [capabilities, isLocked],
  );

  const contextValue: EditModeContextValue = {
    state: {
      mode,
      capabilities,
      isLocked,
      lockReason,
    },
    setMode,
    toggleLock,
    hasCapability,
    canChangeMode,
  };

  return (
    <EditModeContext.Provider value={contextValue}>
      {children}
    </EditModeContext.Provider>
  );
}

export interface EditModeControlsProps {
  className?: string;
  showCapabilities?: boolean;
}

// UI component for EditMode controls
export function EditModeControls({
  className = '',
  showCapabilities = true,
}: EditModeControlsProps) {
  const { state, setMode, toggleLock, canChangeMode } = useEditMode();

  const getModeIcon = (mode: EditMode) => {
    switch (mode) {
      case EditMode.VIEW:
        return <Eye className="w-4 h-4" />;
      case EditMode.EDIT:
        return <Edit className="w-4 h-4" />;
      case EditMode.ADMIN:
        return <Settings className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  const getModeColor = (mode: EditMode) => {
    switch (mode) {
      case EditMode.VIEW:
        return 'bg-gray-100 text-gray-800';
      case EditMode.EDIT:
        return 'bg-blue-100 text-blue-800';
      case EditMode.ADMIN:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Current Mode Display */}
      <div className="flex items-center gap-2">
        <Badge className={getModeColor(state.mode)}>
          {getModeIcon(state.mode)}
          <span className="ml-1 capitalize">{state.mode} Mode</span>
        </Badge>

        {state.isLocked && (
          <Badge variant="outline" className="text-orange-600">
            <Lock className="w-3 h-3 mr-1" />
            Locked
          </Badge>
        )}
      </div>

      {/* Mode Change Buttons */}
      <div className="flex gap-1">
        {Object.values(EditMode).map((mode) => (
          <Button
            key={mode}
            variant={state.mode === mode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode(mode)}
            disabled={!canChangeMode(mode) || state.mode === mode}
            title={
              !canChangeMode(mode)
                ? 'Insufficient permissions'
                : `Switch to ${mode} mode`
            }
          >
            {getModeIcon(mode)}
            <span className="ml-1 capitalize">{mode}</span>
          </Button>
        ))}
      </div>

      {/* Lock Toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleLock}
        title={state.isLocked ? 'Unlock editing' : 'Lock to prevent changes'}
      >
        {state.isLocked ? (
          <Unlock className="w-4 h-4" />
        ) : (
          <Lock className="w-4 h-4" />
        )}
      </Button>

      {/* Capabilities Display */}
      {showCapabilities && (
        <div className="flex gap-1">
          {Object.entries(state.capabilities).map(
            ([capability, enabled]) =>
              enabled && (
                <Badge
                  key={capability}
                  variant="secondary"
                  className="text-xs"
                  title={`${capability}: ${enabled ? 'Enabled' : 'Disabled'}`}
                >
                  {capability
                    .replace('can', '')
                    .replace(/([A-Z])/g, ' $1')
                    .trim()}
                </Badge>
              ),
          )}
        </div>
      )}
    </div>
  );
}

export interface EditModeGuardProps {
  children: React.ReactNode;
  requiredCapability?: keyof EditModeCapabilities;
  requiredMode?: EditMode;
  fallback?: React.ReactNode;
}

// Component to conditionally render based on EditMode capabilities
export function EditModeGuard({
  children,
  requiredCapability,
  requiredMode,
  fallback = null,
}: EditModeGuardProps) {
  const { state, hasCapability } = useEditMode();

  // Check mode requirement
  if (requiredMode && state.mode !== requiredMode) {
    return <>{fallback}</>;
  }

  // Check capability requirement
  if (requiredCapability && !hasCapability(requiredCapability)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Hook for capability-based conditional logic
export function useEditModeCapabilities() {
  const { hasCapability, state } = useEditMode();

  return {
    canEdit: hasCapability('canEdit'),
    canCreate: hasCapability('canCreate'),
    canDelete: hasCapability('canDelete'),
    canPublish: hasCapability('canPublish'),
    canAccessAdvancedProperties: hasCapability('canAccessAdvancedProperties'),
    canManageMetadata: hasCapability('canManageMetadata'),
    isAdminMode: state.mode === EditMode.ADMIN,
    isEditMode: state.mode === EditMode.EDIT,
    isViewMode: state.mode === EditMode.VIEW,
    isLocked: state.isLocked,
  };
}
