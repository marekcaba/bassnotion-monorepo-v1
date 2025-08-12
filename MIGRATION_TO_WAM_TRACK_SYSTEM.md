# Migration Guide: Widget System → WAM Plugin Track Architecture

## 🎯 GOAL: Complete Migration to Professional DAW Architecture

Transform BassNotion from widget-based pattern system to track-based WAM plugin system for professional DAW-level functionality.

---

## 📋 MIGRATION CHECKLIST

### ✅ **PHASE 1: NEW ARCHITECTURE COMPONENTS** (COMPLETED)
- [x] UnifiedTransport with sample-accurate timing
- [x] EventBus for service communication  
- [x] Track system with multi-track support
- [x] WAM Drummer plugin implementation
- [x] New hooks: `useTrack`, `useWAMPlugin`

### 🚧 **PHASE 2: WIDGET MIGRATION** (IN PROGRESS)
- [ ] **DrummerWidget** → Track-based WAM plugin
- [ ] **HarmonyWidget** → Track-based WAM plugin
- [ ] **MetronomeWidget** → Track-based WAM plugin
- [ ] **BassWidget** → Track-based WAM plugin (if exists)

### 🗑️ **PHASE 3: OLD SYSTEM CLEANUP** (PENDING)
- [ ] Remove old pattern registration system
- [ ] Remove widget singleton utilities
- [ ] Remove PatternScheduler from UnifiedTransport
- [ ] Remove WidgetTrackAdapter
- [ ] Clean up service registry

---

## 🔄 WIDGET MIGRATION STEPS

### **Step 1: Replace Imports**

**OLD:**
```typescript
import { usePatternRegistration } from '@/domains/widgets/hooks/usePatternRegistration';
import { useWidgetSync } from '@/domains/widgets/hooks/useWidgetSync';
import { widgetSingleton } from '@/domains/widgets/utils/widgetSingleton';
```

**NEW:**
```typescript
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useWAMPlugin } from '@/domains/playback/hooks/useWAMPlugin';
```

### **Step 2: Replace Hook Usage**

**OLD PATTERN REGISTRATION:**
```typescript
const syncResult = useWidgetSync({
  widgetId: 'drummer-widget',
  subscribeTo: ['PLAY', 'STOP', 'PAUSE', 'TEMPO_CHANGE', 'SEEK'],
});

const patternReg = usePatternRegistration({
  widgetId: 'drummer-widget',
  widgetType: 'drums',
  enabled: true
});
```

**NEW TRACK SYSTEM:**
```typescript
// Create dedicated track for this widget
const track = useTrack({
  trackId: 'drummer-track',
  name: 'Drummer',
  type: 'drums',
  debugMode: true
});

// Load WAM plugin into track
const wamPlugin = useWAMPlugin({
  track: track.track,
  pluginUrl: '/wam/drummer-plugin',
  autoLoad: true,
  debugMode: true
});

// Transport state comes from track
const { isPlaying, tempo, currentTime } = track;
```

### **Step 3: Replace Pattern Registration**

**OLD:**
```typescript
patternReg.registerPattern(drumPattern, (event, time) => {
  // Handle pattern events
});
```

**NEW:**
```typescript
// Send pattern directly to WAM plugin
const wamPattern = {
  hihat: patterns.hihat,
  snare: patterns.snare,
  kick: patterns.kick,
  tempo: tempo,
  timeSignature: [4, 4]
};

wamPlugin.setParameter('pattern', wamPattern);
wamPlugin.setParameter('enabled', isPlaying);
```

### **Step 4: Replace Transport Controls**

**OLD:**
```typescript
// Widgets shouldn't control transport directly
```

**NEW:**
```typescript
// Each widget can control its track
const handlePlay = () => track.play();
const handleStop = () => track.stop();
const handleMute = () => track.mute();
```

---

## 🗂️ FILE CHANGES REQUIRED

### **Widget Files to Migrate:**
1. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget.tsx`
2. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx`
3. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/MetronomeWidget.tsx`

### **Files to DELETE after migration:**
1. `apps/frontend/src/domains/widgets/hooks/usePatternRegistration.ts`
2. `apps/frontend/src/domains/widgets/hooks/useWidgetSync.ts` 
3. `apps/frontend/src/domains/widgets/utils/widgetSingleton.ts`
4. `apps/frontend/src/domains/playback/services/adapters/WidgetTrackAdapter.ts`
5. `apps/frontend/src/domains/playback/services/PatternScheduler.ts` (if not used by UnifiedTransport)

### **Files to MODIFY:**
1. `apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts` - Remove PatternScheduler dependency
2. `apps/frontend/src/domains/playback/providers/AudioProvider.tsx` - Remove pattern scheduler initialization

---

## 🎛️ NEW WIDGET ARCHITECTURE

### **Professional DAW Pattern:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Widget        │    │     Track       │    │   WAM Plugin    │
│   (UI Controller)│───▶│   (Audio Channel)│───▶│   (Instrument)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       │                        │                        │
       │                        │                        │
       ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Pattern UI     │    │  Volume/Pan/FX  │    │  Audio Processing│
│  Transport UI   │    │  Mute/Solo      │    │  Sample Playback │
│  Parameter UI   │    │  Routing        │    │  MIDI Events    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Benefits of New Architecture:**
- ✅ **Sample-accurate timing** via UnifiedTransport
- ✅ **Multi-track support** (multiple drums, bass, etc.)
- ✅ **Professional mixing** (volume, pan, mute, solo per track)
- ✅ **Plugin ecosystem** (load any WAM plugin)
- ✅ **DAW-level functionality** (like Logic Pro X, Ableton)
- ✅ **Clean separation** (UI vs Audio processing)
- ✅ **No more timing conflicts** (single master clock)

---

## 🚀 MIGRATION EXECUTION PLAN

### **Week 1: DrummerWidget Migration**
1. **Day 1-2**: Test new hooks with existing DrummerWidget
2. **Day 3-4**: Refactor DrummerWidget to use track system
3. **Day 5**: Test and debug drum track functionality

### **Week 2: Other Widgets Migration**
1. **Day 1-2**: Migrate HarmonyWidget to track system
2. **Day 3-4**: Migrate MetronomeWidget to track system  
3. **Day 5**: Integration testing with all widgets

### **Week 3: System Cleanup**
1. **Day 1-2**: Remove old pattern registration system
2. **Day 3-4**: Clean up UnifiedTransport and service registry
3. **Day 5**: Final testing and performance optimization

---

## 🧪 TESTING STRATEGY

### **Per-Widget Testing:**
```typescript
// Test track creation
const track = useTrack({ trackId: 'test-track', name: 'Test', type: 'drums' });
expect(track.isReady).toBe(true);

// Test WAM plugin loading
const plugin = useWAMPlugin({ track: track.track, pluginUrl: '/wam/test' });
expect(plugin.isLoaded).toBe(true);

// Test audio triggering
plugin.trigger(36, 0.8); // Kick drum
expect(audioOutput).toHaveBeenTriggered();

// Test transport integration
track.play();
expect(track.isPlaying).toBe(true);
```

### **Integration Testing:**
- Multiple tracks playing simultaneously
- Sample-accurate synchronization between tracks
- Volume/mute/solo functionality per track
- Transport controls affecting all tracks

---

## 📊 SUCCESS METRICS

### **Functional Requirements:**
- [ ] All widgets work with track system
- [ ] Sample-accurate timing maintained (<1ms drift)
- [ ] No pattern registration errors
- [ ] Clean service initialization
- [ ] No SSR errors

### **Performance Requirements:**
- [ ] Track creation <100ms
- [ ] WAM plugin loading <500ms
- [ ] Audio triggering <10ms latency
- [ ] Memory usage doesn't increase >20%

### **User Experience:**
- [ ] Same UI functionality as before
- [ ] Improved audio quality and timing
- [ ] No regression in features
- [ ] Better error handling and loading states

---

## 🎯 FINAL RESULT

After migration, BassNotion will have:

1. **Professional DAW Architecture**: Track-based system like Logic Pro X
2. **WAM Plugin Ecosystem**: Can load any WAM-compatible plugin
3. **Sample-Accurate Timing**: <1ms precision across all tracks
4. **Multi-Track Support**: Multiple drums, bass, harmony tracks
5. **Clean Codebase**: No more complex pattern registration
6. **Scalable System**: Easy to add new instruments/effects

**This transforms BassNotion from a widget-based app to a true professional web DAW!** 🎵
