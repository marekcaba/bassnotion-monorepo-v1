🚀 Performance Optimization Opportunities
Priority 1: HIGH IMPACT - Quick Wins
1. Add Three.js Code Splitting (15 min, ~600KB savings)
Currently Tone.js is split into chunks, but Three.js and React Three Fiber are NOT:

// Add to next.config.js webpack config after tone chunks:
threeFiber: {
  test: /[\\/]node_modules[\\/]@react-three/,
  name: 'three-fiber',
  priority: 20,
},
three: {
  test: /[\\/]node_modules[\\/]three[\\/]/,
  name: 'three-core',
  priority: 19,
},
2. Memoize Playback Components (High Impact)
Found ZERO React.memo in /domains/playback/components/ (18 components). Key file:
FretboardVisualizer.tsx - Renders Three.js canvas with 8 props, unmemoized
3. Add useShallow to Zustand Selectors (Medium effort, prevents re-renders)
Only 3 files use useShallow (all in DrumPatternEditor). Many older components likely have:

// ❌ BAD - causes re-render on ANY store change
const { isPlaying, tempo } = useStore(state => ({ isPlaying: state.isPlaying, tempo: state.tempo }));

// ✅ GOOD - only re-renders when these specific values change
const { isPlaying, tempo } = useStore(useShallow(state => ({ isPlaying: state.isPlaying, tempo: state.tempo })));
Priority 2: MEDIUM IMPACT
4. Add Sheet Music Library Splitting (~500KB)
VexFlow and OpenSheetMusicDisplay loaded inline but only used in SheetMusic component:

sheetMusic: {
  test: /[\\/]node_modules[\\/](vexflow|opensheetmusicdisplay)/,
  name: 'sheet-music',
  priority: 18,
},
5. Implement Query Prefetching
No prefetchQuery found anywhere. Add to key navigation points:

// On exercise selection - prefetch details before navigation
queryClient.prefetchQuery({
  queryKey: ['exercise', exerciseId],
  queryFn: () => fetchExerciseDetails(exerciseId),
});
6. Defer 3D Canvas Rendering
Canvas creates WebGL context on mount (expensive). Use IntersectionObserver to defer until visible.
Priority 3: ALREADY OPTIMIZED ✅
Feature	Status	Implementation
Tone.js lazy loading	✅ Excellent	TonePreloader.ts - 730ms savings
Lazy component imports	✅ Excellent	lazy-imports.ts
API request deduplication	✅ Good	api-client.ts lines 65-75
Font loading	✅ Good	display: 'swap' configured
Chunk splitting for audio	✅ Good	tone-core, tone-instruments chunks

second investigation:

📋 Recommended Optimizations
1. HIGHEST PRIORITY: Lazy Load Fretboard3D (saves ~400-600KB)
Change in YouTubeWidgetPage.tsx:10:

// ❌ CURRENT - loads Three.js immediately
import Fretboard3D from './FretboardCard/components/Fretboard3D';

// ✅ FIX - lazy load Three.js only when needed
import dynamic from 'next/dynamic';
const Fretboard3D = dynamic(
  () => import('./FretboardCard/components/Fretboard3D'),
  { 
    ssr: false,
    loading: () => <div className="h-full bg-slate-800 animate-pulse" />
  }
);
2. Add Three.js Chunk Splitting in next.config.js
Add these cache groups after toneInstruments (line 52):

// Three.js splitting
threeFiber: {
  test: /[\\/]node_modules[\\/]@react-three/,
  name: 'three-fiber',
  priority: 20,
  reuseExistingChunk: true,
},
threeCore: {
  test: /[\\/]node_modules[\\/]three[\\/]/,
  name: 'three-core',
  priority: 19,
  reuseExistingChunk: true,
},
// Sheet music splitting
sheetMusic: {
  test: /[\\/]node_modules[\\/](vexflow|opensheetmusicdisplay)/,
  name: 'sheet-music',
  priority: 18,
  reuseExistingChunk: true,
},
3. Additional Quick Wins
Optimization	Impact	Effort
Lazy load Fretboard3D	~500KB	5 min
Add Three.js chunk splitting	Better caching	5 min
Add React.memo to FretboardVisualizer	Fewer re-renders	10 min
Add useShallow to Zustand selectors	Fewer re-renders	1 hour
4. Debug/Test Pages to Consider Removing
From the build output, there are 15+ debug/test pages adding to the build:
/click-comparison, /debug-nx-errors, /detect-click-blocker
/diagnose-clicks, /disable-extensions, /emergency-fix
/fix-click-blocking, /fix-global-controls, /identify-tsqd
/remove-tsqd, /safe-fix, /test-audio-flow, /test-auth
These add ~1-2MB total and should be removed or moved to development-only routes.