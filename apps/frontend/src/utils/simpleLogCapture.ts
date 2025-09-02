/**
 * Ultra-simple log capture that just works
 */

const logBuffer: string[] = [];

export function captureLog(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const logEntry = `[${timestamp}] ${message}`;
  logBuffer.push(logEntry);

  // Also try to update any existing display
  updateLogDisplay();
}

export function createSimpleLogDisplay() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Remove any existing display
  const existing = document.getElementById('simple-log-display');
  if (existing) existing.remove();

  // Create container
  const container = document.createElement('div');
  container.id = 'simple-log-display';
  container.setAttribute(
    'style',
    `
    position: fixed !important;
    bottom: 10px !important;
    right: 10px !important;
    width: 600px !important;
    height: 300px !important;
    background: white !important;
    border: 3px solid red !important;
    padding: 10px !important;
    z-index: 2147483647 !important;
    font-family: monospace !important;
    font-size: 12px !important;
    box-shadow: 0 0 20px rgba(0,0,0,0.5) !important;
  `,
  );

  // Create textarea
  const textarea = document.createElement('textarea');
  textarea.id = 'log-textarea';
  textarea.setAttribute(
    'style',
    `
    width: 100% !important;
    height: calc(100% - 40px) !important;
    border: 1px solid #ccc !important;
    padding: 5px !important;
    font-family: monospace !important;
    font-size: 11px !important;
    resize: none !important;
    background: #f5f5f5 !important;
    color: black !important;
  `,
  );
  textarea.readOnly = true;
  textarea.value = logBuffer.join('\n');

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.setAttribute(
    'style',
    `
    margin-top: 5px !important;
    text-align: right !important;
  `,
  );

  // Create select all button
  const selectButton = document.createElement('button');
  selectButton.textContent = 'Select All';
  selectButton.setAttribute(
    'style',
    `
    padding: 5px 10px !important;
    margin-right: 5px !important;
    background: #007bff !important;
    color: white !important;
    border: none !important;
    cursor: pointer !important;
    font-size: 12px !important;
  `,
  );
  selectButton.addEventListener('click', () => {
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile
  });

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.setAttribute(
    'style',
    `
    padding: 5px 10px !important;
    background: #dc3545 !important;
    color: white !important;
    border: none !important;
    cursor: pointer !important;
    font-size: 12px !important;
  `,
  );
  closeButton.addEventListener('click', () => {
    container.remove();
  });

  // Assemble
  buttonContainer.appendChild(selectButton);
  buttonContainer.appendChild(closeButton);
  container.appendChild(textarea);
  container.appendChild(buttonContainer);
  document.body.appendChild(container);

  // Update with current logs
  updateLogDisplay();
}

function updateLogDisplay() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const textarea = document.getElementById(
    'log-textarea',
  ) as HTMLTextAreaElement;
  if (textarea) {
    textarea.value = logBuffer.join('\n');
    textarea.scrollTop = textarea.scrollHeight;
  }
}

// Export a simple log function
export const simpleLog = (message: string, data?: any) => {
  const fullMessage = data
    ? `${message} ${JSON.stringify(data, null, 2)}`
    : message;
  captureLog(fullMessage);
};

// Auto-create display on load - DISABLED to prevent blocking clicks
// if (typeof window !== 'undefined') {
//   setTimeout(() => {
//     createSimpleLogDisplay();
//     captureLog('📋 Simple log capture initialized');
//   }, 1000);
// }
