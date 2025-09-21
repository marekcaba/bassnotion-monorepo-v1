/**
 * Mock Worker for test environment
 * Provides a basic Worker implementation for tests
 */

export class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(public url: string | URL) {}

  postMessage(message: any): void {
    // Simulate async message handling
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: message }));
      }
    }, 0);
  }

  terminate(): void {
    // No-op
  }
}

export function setupWorkerMock() {
  if (typeof Worker === 'undefined') {
    (global as any).Worker = MockWorker;
  }
}

export function cleanupWorkerMock() {
  if ((global as any).Worker === MockWorker) {
    delete (global as any).Worker;
  }
}
