/**
 * Initialization Sequence Logger
 *
 * Minimal diagnostic logger for tracking audio initialization flow.
 * Filter console with: [INIT-SEQ]
 */

type InitStep =
  | 'provider-mount'
  | 'create-services-start'
  | 'create-services-done'
  | 'services-init-start'
  | 'audiocontext-created'
  | 'services-init-done'
  | 'state-updated'
  | 'resume-effect-mounted'
  | 'resume-effect-ready'
  | 'listener-registered'
  | 'user-gesture-detected'
  | 'resume-called'
  | 'resume-success'
  | 'resume-failed';

interface StepData {
  timestamp: number;
  contextState?: string;
  sampleRate?: number;
  error?: string;
  [key: string]: any;
}

class InitSequenceLogger {
  private stepCounter = 0;
  private enabled = true;

  log(step: InitStep, data?: Partial<StepData>) {
    if (!this.enabled) return;

    this.stepCounter++;
    const timestamp = Date.now();

    const logData: StepData = {
      timestamp,
      ...data,
    };

    console.log(
      `[INIT-SEQ ${this.stepCounter}] ${step.toUpperCase()}`,
      logData,
    );
  }

  enable() {
    this.enabled = true;
    console.log('[INIT-SEQ] Logger enabled - filter console with "[INIT-SEQ"');
  }

  disable() {
    this.enabled = false;
  }

  reset() {
    this.stepCounter = 0;
  }
}

// Export singleton
export const initSeq = new InitSequenceLogger();

// Make available on window for debugging
if (typeof window !== 'undefined') {
  (window as any).initSeq = initSeq;
}
