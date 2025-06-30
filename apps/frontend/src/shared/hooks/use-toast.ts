'use client';

// Inspired by react-hot-toast library
import * as React from 'react';

import type { ToastActionElement } from '@/shared/components/ui/toast';

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

export interface Toast {
  id?: string;
  title?: string;
  description?: string;
  action?: ToastActionElement;
  variant?: 'default' | 'destructive' | 'success';
}

export interface ToasterToast extends Toast {
  id: string;
  title?: string;
  description?: string;
  action?: ToastActionElement;
  dismiss?: () => void;
  duration?: number;
  update?: (props: ToasterToast) => void;
}

type Action =
  | {
      type: 'add_toast';
      toast: ToasterToast;
    }
  | {
      type: 'update_toast';
      toast: Partial<ToasterToast>;
      id: string;
    }
  | {
      type: 'dismiss_toast';
      toastId?: string;
    }
  | {
      type: 'remove_toast';
      toastId?: string;
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: 'remove_toast',
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'add_toast':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'update_toast':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, ...action.toast } : t,
        ),
      };

    case 'dismiss_toast': {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          // TODO: Review non-null assertion - consider null safety
          t.id === toastId || !toastId
            ? {
                ...t,
                dismiss: () =>
                  dispatch({ type: 'dismiss_toast', toastId: t.id }),
              }
            : t,
        ),
      };
    }

    case 'remove_toast':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

function toast({ ...props }: Toast) {
  const id = crypto.randomUUID();

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'update_toast',
      id,
      toast: props,
    });

  const dismiss = () => dispatch({ type: 'dismiss_toast', toastId: id });

  dispatch({
    type: 'add_toast',
    toast: {
      ...props,
      id,
      dismiss,
      update,
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'dismiss_toast', toastId }),
  };
}

export { useToast, toast };
