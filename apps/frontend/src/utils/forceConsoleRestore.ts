/**
 * Force restore console methods to their original implementations
 * This fixes issues where console logging is broken in certain pages
 */

// Capture the REAL console methods from an iframe
export function forceConsoleRestore() {
  if (typeof window === 'undefined') return;

  try {
    // Create a hidden iframe to get pristine console
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Get the pristine console from the iframe
    const pristineConsole = iframe.contentWindow?.console;

    if (pristineConsole) {
      // Restore all console methods
      console.log = pristineConsole.log.bind(pristineConsole);
      console.warn = pristineConsole.warn.bind(pristineConsole);
      console.error = pristineConsole.error.bind(pristineConsole);
      console.info = pristineConsole.info.bind(pristineConsole);
      console.debug = pristineConsole.debug.bind(pristineConsole);
      console.trace = pristineConsole.trace.bind(pristineConsole);
      console.table = pristineConsole.table.bind(pristineConsole);
      console.group = pristineConsole.group.bind(pristineConsole);
      console.groupEnd = pristineConsole.groupEnd.bind(pristineConsole);
      console.time = pristineConsole.time.bind(pristineConsole);
      console.timeEnd = pristineConsole.timeEnd.bind(pristineConsole);

      logger.info('✅ Console restored using iframe technique');
    }

    // Remove the iframe
    document.body.removeChild(iframe);
  } catch (error) {
    // Fallback: try to restore from window.console prototype
    try {
      const nativeLog = Function.prototype.call.bind(console.log);
      console.log = nativeLog;
      logger.info('✅ Console restored using prototype technique');
    } catch (e) {
      // Last resort: create new functions
      const log = (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg),
          )
          .join(' ');

        // Try to output somehow
        if (typeof window !== 'undefined' && window.document) {
          const debugDiv =
            document.getElementById('console-debug') ||
            (() => {
              const div = document.createElement('div');
              div.id = 'console-debug';
              div.style.position = 'fixed';
              div.style.bottom = '0';
              div.style.right = '0';
              div.style.background = 'black';
              div.style.color = 'white';
              div.style.padding = '10px';
              div.style.maxHeight = '200px';
              div.style.overflow = 'auto';
              div.style.fontSize = '12px';
              div.style.zIndex = '9999';
              document.body.appendChild(div);
              return div;
            })();

          const logEntry = document.createElement('div');
          logEntry.textContent = `[LOG] ${message}`;
          debugDiv.appendChild(logEntry);
          debugDiv.scrollTop = debugDiv.scrollHeight;
        }
      };

      console.log = log;
      console.warn = log;
      console.error = log;
      console.info = log;
    }
  }
}

// Auto-restore on import
if (typeof window !== 'undefined') {
  forceConsoleRestore();
}
