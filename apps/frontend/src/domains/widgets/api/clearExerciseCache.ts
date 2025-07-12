// Utility to clear exercise cache from browser console
// Run this in browser console: window.clearExerciseCache()

export function clearExerciseCache() {
  // This will be injected into window object
  console.log('🧹 Clearing exercise cache...');

  // Clear any localStorage items related to exercises
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('exercise') || key.includes('Exercise'))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    console.log(`  Removed: ${key}`);
  });

  // Also try to clear module-level cache if available
  if (typeof window !== 'undefined') {
    (window as any).__clearExerciseCache?.();
  }

  console.log(
    '✅ Exercise cache cleared. Refresh the page to load new exercises.',
  );
}

// Make it available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).clearExerciseCache = clearExerciseCache;
}
