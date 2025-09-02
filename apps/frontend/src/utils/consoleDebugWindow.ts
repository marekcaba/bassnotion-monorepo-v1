/**
 * Creates a debug window that's guaranteed to be interactive
 */

let debugWindow: HTMLDivElement | null = null;
let contentDiv: HTMLDivElement | null = null;

export function createDebugWindow() {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    return null;

  // Remove existing window if any
  if (debugWindow) {
    debugWindow.remove();
  }

  // Create main container
  debugWindow = document.createElement('div');
  debugWindow.id = 'console-debug-window';
  debugWindow.style.cssText = `
    position: fixed;
    bottom: 0;
    right: 0;
    width: 500px;
    max-height: 400px;
    background: rgba(0, 0, 0, 0.95);
    color: white;
    font-family: monospace;
    font-size: 12px;
    padding: 0;
    overflow: hidden;
    z-index: 2147483647;
    border: 2px solid #666;
    border-radius: 4px 4px 0 0;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    background: #333;
    padding: 10px;
    border-bottom: 1px solid #666;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  `;

  const title = document.createElement('span');
  title.style.cssText = 'font-weight: bold; color: #ff9900;';
  title.textContent = '🐛 Console Debug Output';

  const controls = document.createElement('div');
  controls.style.cssText = 'display: flex; gap: 8px;';

  // Create buttons
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy All';
  copyBtn.style.cssText = `
    background: #555;
    color: white;
    border: 1px solid #888;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 11px;
    font-family: monospace;
  `;
  copyBtn.onmouseover = () => (copyBtn.style.background = '#666');
  copyBtn.onmouseout = () => (copyBtn.style.background = '#555');
  copyBtn.onclick = () => {
    const logs = Array.from(contentDiv?.children || [])
      .map((child) => child.textContent)
      .join('\\n');
    navigator.clipboard
      .writeText(logs)
      .then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy All'), 1000);
      })
      .catch(() => {
        // Fallback for clipboard API failure
        const textarea = document.createElement('textarea');
        textarea.value = logs;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy All'), 1000);
      });
  };

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.style.cssText = copyBtn.style.cssText;
  clearBtn.onmouseover = () => (clearBtn.style.background = '#666');
  clearBtn.onmouseout = () => (clearBtn.style.background = '#555');
  clearBtn.onclick = () => {
    if (contentDiv) contentDiv.innerHTML = '';
  };

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    background: #600;
    color: white;
    border: 1px solid #888;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 11px;
    font-family: monospace;
  `;
  closeBtn.onmouseover = () => (closeBtn.style.background = '#800');
  closeBtn.onmouseout = () => (closeBtn.style.background = '#600');
  closeBtn.onclick = () => {
    if (debugWindow) debugWindow.style.display = 'none';
  };

  // Assemble header
  controls.appendChild(copyBtn);
  controls.appendChild(clearBtn);
  controls.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(controls);

  // Create content area
  contentDiv = document.createElement('div');
  contentDiv.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    user-select: text;
    cursor: text;
  `;

  // Assemble window
  debugWindow.appendChild(header);
  debugWindow.appendChild(contentDiv);
  document.body.appendChild(debugWindow);

  return debugWindow;
}

export function logToDebugWindow(level: string, ...args: any[]) {
  if (!debugWindow || debugWindow.style.display === 'none') {
    createDebugWindow();
  }

  if (!contentDiv) return;

  const emoji =
    {
      log: '📝',
      warn: '⚠️',
      error: '❌',
      info: 'ℹ️',
      debug: '🐛',
    }[level] || '📝';

  const message = args
    .map((arg) =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(' ');

  const entry = document.createElement('div');
  entry.style.cssText = `
    margin-bottom: 4px;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.4;
  `;

  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  entry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${emoji} ${message}`;
  contentDiv.appendChild(entry);
  contentDiv.scrollTop = contentDiv.scrollHeight;
}

// Export for use in console restoration
export const debugLog = {
  log: (...args: any[]) => logToDebugWindow('log', ...args),
  warn: (...args: any[]) => logToDebugWindow('warn', ...args),
  error: (...args: any[]) => logToDebugWindow('error', ...args),
  info: (...args: any[]) => logToDebugWindow('info', ...args),
  debug: (...args: any[]) => logToDebugWindow('debug', ...args),
};
