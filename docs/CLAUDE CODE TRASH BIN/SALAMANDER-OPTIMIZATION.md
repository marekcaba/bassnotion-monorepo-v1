# Salamander Piano Sample Loading Optimization

## Problem
HarmonyWidget was taking 10+ seconds to load samples, loading 9 velocity layers with 30 samples each (270+ total samples).

## Solution
Reduced velocity layers from 9 to 5 while maintaining good dynamic range:

### Previous Configuration (9 layers)
```javascript
layersToLoad = [
  'v1', 'v3', 'v6', 'v8', 'v10', 'v11', 'v12', 'v14', 'v16'
];
```
- Total samples: 270+ (9 layers × 30 samples)
- Load time: 10+ seconds
- Memory: ~85MB

### Optimized Configuration (5 layers)
```javascript
layersToLoad = [
  'v1',   // pianissimo (velocity 0-8)
  'v6',   // piano (velocity 41-48)
  'v10',  // mezzo-forte (velocity 73-80)
  'v14',  // forte (velocity 105-112)
  'v16',  // fortissimo (velocity 121-127)
];
```
- Total samples: 150 (5 layers × 30 samples)
- Load time: ~5-6 seconds
- Memory: ~47MB
- Dynamic range: Still covers pp to ff

## Benefits
1. **44% reduction in samples** (270 → 150)
2. **~50% faster loading** (10s → 5s)
3. **45% less memory usage** (85MB → 47MB)
4. **Maintained dynamic range** - still covers full soft to loud spectrum

## Files Modified
- `/apps/frontend/src/domains/playback/services/plugins/SalamanderVelocitySampler.ts`
  - Line 288-294: Updated default layers
  - Line 845: Updated fallback layers
  - Line 1179: Updated smart loading layers

## Testing
1. Load page and watch console for "Loading velocity layers: v1, v6, v10, v14, v16"
2. Sample loading should complete in ~5-6 seconds
3. All dynamics from pp to ff should still work properly
4. Memory usage should be reduced by ~45%