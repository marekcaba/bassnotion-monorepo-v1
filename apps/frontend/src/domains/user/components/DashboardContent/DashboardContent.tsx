import { Button } from '@/shared/components/ui/button';

export function DashboardContent() {
  const showTransitionStats = () => {
    if (typeof window !== 'undefined' && (window as any).__bassnotionTransitionStats) {
      (window as any).__bassnotionTransitionStats();
    } else {
      console.log('No transition stats available yet. Navigate between pages to see stats.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Welcome to BassNotion!</h2>
        <p className="text-muted-foreground">Your music learning dashboard.</p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">🚀 Enhanced Transitions Active</h3>
        <p className="text-muted-foreground mb-4">
          This app now uses Framer Commerce-inspired page transitions with performance monitoring!
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
        </div>
        
        <Button 
          onClick={showTransitionStats}
          variant="outline" 
          className="mt-4"
        >
          📊 View Transition Stats
        </Button>
        
        <p className="text-sm text-muted-foreground mt-2">
          Navigate between pages, then click to see performance data in console
        </p>
      </div>
    </div>
  );
} 