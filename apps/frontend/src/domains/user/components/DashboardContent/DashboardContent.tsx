import { Button } from '@/shared/components/ui/button';
import {
  useTransitionPreHeat,
  useViewTransitionRouter,
} from '@/lib/hooks/use-view-transition-router';
import { BassSettingsCard } from '../BassSettingsCard';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export function DashboardContent() {
  const { correlationId, logger } = useCorrelation('DashboardContent');
  // This ensures transitions are pre-heated for smooth first navigation
  const { isPreHeated } = useTransitionPreHeat();
  const { navigateWithTransition } = useViewTransitionRouter();

  const showTransitionStats = () => {
    if (
      typeof window !== 'undefined' &&
      (window as any).__bassnotionTransitionStats
    ) {
      (window as any).__bassnotionTransitionStats();
    } else {
      logger.info(
        'No transition stats available yet. Navigate between pages to see stats.',
      );
    }
  };

  const testTransitions = () => {
    logger.info('Testing transitions...');
    // Test navigation to home and back
    setTimeout(() => navigateWithTransition('/'), 100);
  };

  const handleBassSettingsChange = (settings: {
    stringCount: 4 | 5 | 6;
    maxFrets: number;
  }) => {
    // Emit a custom event that other parts of the app can listen to
    window.dispatchEvent(
      new CustomEvent('bass-settings-changed', {
        detail: settings,
      }),
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        // TODO: Review non-null assertion - consider null safety
        <h2 className="text-xl font-semibold mb-4">Welcome to BassNotion!</h2>
        <p className="text-muted-foreground">Your music learning dashboard.</p>
      </div>

      {/* Bass Configuration Section */}
      <div className="p-4 bg-red-100 border-2 border-red-500 rounded">
        <h2>DEBUG: Bass Settings Card Should Be Here</h2>
        <BassSettingsCard onSettingsChange={handleBassSettingsChange} />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">
          🚀 Enhanced Transitions Active
        </h3>
        <p className="text-muted-foreground mb-4">
          This app uses smooth page transitions with performance monitoring and
          pre-heating.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-green-500">✅</span>
            <span>Enhanced CSS Management</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">✅</span>
            <span>Transition Interrupt Handling</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">✅</span>
            <span>Performance Monitoring</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={isPreHeated() ? 'text-green-500' : 'text-yellow-500'}
            >
              {isPreHeated() ? '✅' : '🔥'}
            </span>
            <span>
              Transition Pre-heating{' '}
              {isPreHeated() ? '(Complete)' : '(In Progress)'}
            </span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={showTransitionStats} variant="outline">
            📊 View Stats
          </Button>

          <Button onClick={testTransitions} variant="outline">
            🧪 Test Transition
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">🔥 Pre-heating System</h3>
        <p className="text-muted-foreground mb-4">
          The transition system pre-heats automatically for smooth first
          impressions.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Automatic pre-heating:</strong> Initializes on page load
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>CSS pre-injection:</strong> Styles ready before first
              transition
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Smart caching:</strong> Maintains performance for
              subsequent transitions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
