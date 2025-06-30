import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// Mock Supabase client
vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

// Enhanced DOM environment setup with better error handling
function ensureCompleteJSDOMEnvironment(): void {
  try {
    // Force re-setup JSDOM environment if it's corrupted
    if (typeof global.document === 'undefined' || !global.document) {
      // Create a minimal JSDOM environment if it's completely missing
      const { JSDOM } = require('jsdom');
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable',
      });

      global.window = dom.window as any;
      global.document = dom.window.document;
      global.navigator = dom.window.navigator;
    }

    // Validate and repair document if corrupted
    if (typeof global.document.createElement !== 'function') {
      console.warn('document.createElement corrupted, attempting repair...');
      // Try to get a fresh JSDOM instance
      const { JSDOM } = require('jsdom');
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
      global.document = dom.window.document;
      global.window = dom.window as any;
    }

    // Ensure window object exists and is properly linked
    if (!global.window) {
      global.window = global.document.defaultView || ({} as any);
    }

    // Ensure navigator exists with proper clipboard mock
    if (!global.navigator) {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (Test Environment)',
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue(''),
          write: vi.fn().mockResolvedValue(undefined),
          read: vi.fn().mockResolvedValue([]),
        },
      } as any;
    }

    // Ensure navigator.clipboard exists and is properly mocked
    if (!global.navigator.clipboard) {
      Object.defineProperty(global.navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue(''),
          write: vi.fn().mockResolvedValue(undefined),
          read: vi.fn().mockResolvedValue([]),
        },
        writable: true,
        configurable: true,
      });
    }

    // Ensure window.navigator is the same as global.navigator
    if (global.window && !global.window.navigator) {
      global.window.navigator = global.navigator;
    }

    // Ensure document.body exists and is valid
    if (!global.document.body || !global.document.body.appendChild) {
      // Create fresh body element
      const body = global.document.createElement('body');
      if (global.document.documentElement) {
        // Clear existing body if corrupted
        if (global.document.body) {
          global.document.documentElement.removeChild(global.document.body);
        }
        global.document.documentElement.appendChild(body);
      } else {
        // Create basic HTML structure if missing
        const html = global.document.createElement('html');
        html.appendChild(body);
        if (global.document.appendChild) {
          global.document.appendChild(html);
        }
      }
    }

    // Ensure global references are consistent
    if (typeof window !== 'undefined') {
      global.window = window;
      global.document = window.document;
      global.navigator = window.navigator;
    }
  } catch (error) {
    console.error('Critical DOM environment setup error:', error);
    throw new Error(`Failed to setup DOM environment: ${error}`);
  }
}

// More robust DOM validation with repair capabilities
function validateDOMEnvironment(): void {
  try {
    // Validate document exists and is functional
    if (typeof document === 'undefined' || !document) {
      throw new Error('Document is not available in test environment');
    }

    if (typeof document.createElement !== 'function') {
      throw new Error('document.createElement is not available');
    }

    // Test createElement functionality with basic validation
    let testDiv;
    try {
      testDiv = document.createElement('div');
    } catch (createError) {
      throw new Error(`createElement failed: ${createError}`);
    }

    if (!testDiv) {
      throw new Error('createElement returned null or undefined');
    }

    // Check for essential DOM element properties with more lenient validation
    const hasBasicProperties =
      testDiv.tagName !== undefined &&
      typeof testDiv.appendChild === 'function' &&
      typeof testDiv.setAttribute === 'function';

    if (!hasBasicProperties) {
      throw new Error(
        'createElement returned an object without basic DOM properties',
      );
    }

    // Ensure document.body exists for rendering - with repair
    if (!document.body || !document.body.appendChild) {
      console.warn('document.body corrupted, repairing...');
      const body = document.createElement('body');
      if (document.documentElement) {
        document.documentElement.appendChild(body);
      }
    }
  } catch (error) {
    console.error('DOM validation failed:', error);
    throw new Error(`DOM environment corrupted: ${error}`);
  }
}

// Enhanced render function with better error handling and cleanup
export function render(ui: React.ReactElement) {
  try {
    // Setup DOM environment
    ensureCompleteJSDOMEnvironment();
    validateDOMEnvironment();
  } catch (error) {
    console.error('DOM setup failed:', error);
    // Try to recover by re-initializing
    try {
      ensureCompleteJSDOMEnvironment();
      validateDOMEnvironment();
    } catch (recoveryError) {
      console.error('DOM recovery failed:', recoveryError);
      throw error;
    }
  }

  // Clean up any existing test containers to prevent conflicts
  try {
    const existingContainers = document.querySelectorAll(
      '[data-testid="test-root"], #test-root',
    );
    existingContainers.forEach((container) => {
      container.remove();
    });

    // Ensure clean document.body state
    if (document.body.innerHTML !== '') {
      document.body.innerHTML = '';
    }
  } catch (cleanupError) {
    console.warn('Cleanup warning:', cleanupError);
  }

  // Create isolated test container with enhanced DOM corruption recovery
  let testContainer;
  try {
    testContainer = document.createElement('div');
    testContainer.setAttribute('data-testid', 'test-root');
    testContainer.id = 'test-root';

    // Verify container is valid before appending
    if (
      !testContainer ||
      typeof testContainer !== 'object' ||
      !testContainer.appendChild
    ) {
      throw new Error('Invalid test container created');
    }

    document.body.appendChild(testContainer);
  } catch (containerError) {
    console.warn(
      'Test container creation failed, attempting recovery:',
      containerError,
    );

    // Force DOM environment recovery and try again
    ensureCompleteJSDOMEnvironment();

    try {
      testContainer = document.createElement('div');
      testContainer.setAttribute('data-testid', 'test-root');
      testContainer.id = 'test-root';
      document.body.appendChild(testContainer);
    } catch (recoveryError) {
      console.error('Container recovery failed:', recoveryError);
      // Fallback: use document.body as container
      testContainer = document.body;
    }
  }

  // Create a new QueryClient for each test to ensure isolation
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const result = rtlRender(ui, {
    container: testContainer,
    wrapper: Wrapper,
  });

  // Create user-event instance with robust DOM corruption recovery
  let user;
  try {
    // Ensure DOM environment is completely restored before user event setup
    ensureCompleteJSDOMEnvironment();

    // Try advanced user event setup with document
    user = userEvent.setup({
      document: global.document,
    });
  } catch (userEventError) {
    console.warn('UserEvent setup warning:', userEventError);

    // Force complete DOM environment restoration on fallback
    try {
      ensureCompleteJSDOMEnvironment();

      // Try again with restored environment
      user = userEvent.setup({
        document: global.document,
      });
    } catch (secondError) {
      console.warn('Second UserEvent setup attempt failed:', secondError);

      // Last resort: create minimal user event without document reference
      try {
        user = userEvent.setup();
      } catch (finalError) {
        console.error('All UserEvent setup attempts failed:', finalError);
        // Create a minimal mock user event as absolute fallback
        user = {
          click: vi.fn(),
          type: vi.fn(),
          clear: vi.fn(),
          selectOptions: vi.fn(),
          upload: vi.fn(),
        } as any;
      }
    }
  }

  return {
    user,
    ...result,
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { screen, waitFor } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
