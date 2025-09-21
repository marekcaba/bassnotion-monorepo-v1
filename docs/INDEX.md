# BassNotion Documentation Index

This is the central catalog for all documentation. Please refer to this index before creating new documentation.

## 📋 Documentation Guidelines

**IMPORTANT**: Before creating ANY new documentation, read [DOCUMENTATION_GUIDELINES.md](./DOCUMENTATION_GUIDELINES.md)

## 🏗️ Project Architecture

### Core Architecture
- [Tech Stack Overview](./2.%20Technical%20docs/6.%20Tech-Stack.md)
- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [API Quick Start](./API_QUICK_START.md) - Getting started with the API
- [Security Guidelines](./SECURITY.md) - Security best practices

### Audio & Playback System
- [Unified Transport & Track System](./UNIFIED-TRANSPORT-TRACK-SYSTEM.md) - Core playback architecture
- [Professional DAW Synchronization](./professional-daw-synchronization-architecture.md)
- [Professional Instruments Implementation](./professional-instruments-implementation.md)
- [Audio Pipeline Integration Tests](./AUDIO-PIPELINE-INTEGRATION-TESTS.md)
- [Sample Loading Flow](./SAMPLE-LOADING-FLOW.md)

#### Playback Domain Deep Dives
- [Dependency Injection Architecture](./playback/dependency-injection-architecture.md)
- [DI Examples & Patterns](./playback/di-examples.md)
- [DI Test Patterns](./playback/di-test-patterns.md)
- [Performance Optimization](./playback/PERFORMANCE-OPTIMIZATION.md)
- [MIDI Lookahead Integration](./playback/MIDI-LOOKAHEAD-INTEGRATION.md)

### UI Components
- [UI Component Inventory](./ui-component-inventory.md) - All UI components catalog
- [3D Fretboard Implementation](./fretboard-3d-implementation.md)
- [Fretboard Grid Connections](./fretboard-grid-connections.md)

### Instrument Implementations
- [Drum Kit Architecture](./drum-kit-architecture.md)
- [Salamander Piano Implementation](./salamander-piano-implementation.md)

## 👨‍💻 Developer Resources

### Getting Started
- [Developer Guide](./developer-handbook/DEVELOPER_GUIDE.md) - **START HERE**
- [New Developer Checklist](./developer-handbook/NEW_DEVELOPER_CHECKLIST.md)
- [Quick Reference](./developer-handbook/QUICK_REFERENCE.md)

### Development Guidelines
- [Coding Standards](./developer-handbook/CODING_STANDARDS.md)
- [React Query Integration](./2.%20Technical%20docs/7.%20React-Query-Integration.md)
- [Zod Validation Guidelines](./2.%20Technical%20docs/9.%20Zod-Validation-Guidelines.md)
- [Build and Development](./2.%20Technical%20docs/10.%20Build-and-Development.md)

### Debugging & Monitoring
- [Troubleshooting Flowchart](./developer-handbook/TROUBLESHOOTING_FLOWCHART.md)
- [Debugging Examples](./developer-handbook/DEBUGGING_EXAMPLES.md)
- [Correlation & Logging](./developer-handbook/CORRELATION_AND_LOGGING.md)
- [Logging Guide](./LOGGING-GUIDE.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)
- [Monitoring Dashboard](./MONITORING_DASHBOARD.md)
- [Sentry Setup](./SENTRY_SETUP.md)

### Known Issues & Gotchas
- [React Rendering Gotchas](./REACT-RENDERING-GOTCHAS.md) - **CRITICAL**
- [Click Blocking Debug Progress](./CLICK-BLOCKING-DEBUG-PROGRESS.md)

### Testing
- [E2E Testing Complete Guide](./2.%20Technical%20docs/8.%20E2E-Testing-Complete-Guide.md)
- [Test Coverage Enhancement Plan](./test-coverage-enhancement-plan.md)
- [Testing Scale Solutions](./testing-scale-solutions.md)

## 📅 Project Management

### Active Stories
Located in `2. Stories/2. 🚧 in-progress/EPIC 3/`:
- [EPIC 3.18 - FAANG Web DAW Architecture](./2.%20Stories/2.%20🚧%20in-progress/EPIC%203/EPIC-3.18-faang-web-daw-architecture.md)
- [Story 3.19 - Logic Pro X-Grade Transport System](./NEW%20STORIES/Story-3.19:%20Logic%20Pro%20X-Grade%20Transport%20System.md)
- [Story 3.21 - Track Based Architecture Migration](./NEW%20STORIES/Story-3.21-Track-Based-Architecture-Migration-Phase-1.md)
- [Story 3.22 - Professional DAW Sequencer](./NEW%20STORIES/Story%203.22:%20Professional%20DAW%20Sequencer.md)

### Story Archive
- All completed story documentation in `2. Stories/2. 🚧 in-progress/EPIC 3/stories/`

## 🔧 Backend & Infrastructure

- [YouTube Batch System](./youtube-batch-system.md)
- [Pre-commit Hooks](./PRE_COMMIT_HOOKS.md)
- [Rate Limiting Guide](./developer-handbook/RATE_LIMITING_GUIDE.md)
- [Middleware Guide](./developer-handbook/MIDDLEWARE_GUIDE.md)

## 📊 Architecture Analysis & Planning

### System Analysis (from root → architecture/analysis/)
- [BassNotion Architecture Analysis](./architecture/analysis/BASSNOTION-ARCHITECTURE-ANALYSIS.md)
- [Playback Domain Analysis](./architecture/analysis/PLAYBACK_DOMAIN_ANALYSIS.md)
- [Exercise Repository FAANG Analysis](./architecture/analysis/EXERCISE_REPOSITORY_FAANG_ANALYSIS.md)
- [User Auth Repository Analysis](./architecture/analysis/USER_AUTH_REPOSITORY_ANALYSIS.md)
- [Audit 08/25 Report](./architecture/analysis/AUDIT_08_25.md)
- [Phase 7 Deep Investigation](./architecture/analysis/PHASE_7_DEEP_INVESTIGATION.md)
- [Phase 7 Migration Analysis](./architecture/analysis/PHASE_7_MIGRATION_ANALYSIS.md)
- [Root Files Audit](./architecture/analysis/ROOT_FILES_AUDIT.md) - Audit of files in root directory

### Architecture Plans
- [Multi-Track Timing Extraction Plan](./architecture/MULTI_TRACK_TIMING_EXTRACTION_PLAN.md)
- [Pattern Scheduling Extraction Plan](./architecture/PATTERN_SCHEDULING_EXTRACTION_PLAN.md)
- [Widget Sync Extraction Plan](./architecture/WIDGET_SYNC_EXTRACTION_PLAN.md)

## 📦 Implementation Summaries

### Completed Implementations (from root → implementations/)
- [Phase 2 Hybrid Architecture Progress](./implementations/PHASE_2_HYBRID_ARCHITECTURE_PROGRESS.md) - **NEW** Breaking down 3,301-line god object
- [Phase 1 Data Extraction Summary](./implementations/PHASE_1_DATA_EXTRACTION_SUMMARY.md) - 75% code reduction via JSON configs
- [Playback Domain Migration Summary](./implementations/PLAYBACK-DOMAIN-MIGRATION-SUMMARY.md) - Complete modular architecture migration
- [Unified Progressive Loading System](./implementations/UNIFIED-PROGRESSIVE-LOADING-SYSTEM.md)
- [Log Aggregation Complete](./implementations/LOG_AGGREGATION_COMPLETE.md)
- [Structured Logging Implementation Summary](./implementations/STRUCTURED_LOGGING_IMPLEMENTATION_SUMMARY.md)
- [Structured Logging Migration Complete](./implementations/STRUCTURED_LOGGING_MIGRATION_COMPLETE.md)
- [Widget Consolidation Summary](./implementations/WIDGET_CONSOLIDATION_SUMMARY.md)
- [Widget Sync Extraction Complete](./implementations/WIDGET_SYNC_EXTRACTION_COMPLETE.md)

### Migration Guides
- [Playback Module Migration](./implementations/playback-module-migration.md) - **NEW** Services to modules architecture migration
- [Storage Modules Migration Guide](./implementations/MIGRATION-GUIDE-STORAGE-MODULES.md) - Migrating from SupabaseAssetClient to SupabaseProviderAdvanced
- [Migration Plan: SupabaseAssetClient](./implementations/MIGRATION-PLAN-SUPABASE-ASSET-CLIENT.md) - Detailed migration phases and status
- [Migration Plan: BaseAudioPlugin](./implementations/MIGRATION-PLAN-BASE-AUDIO-PLUGIN.md) - Plugin system migration
- [Migration Completed: Phase 1](./implementations/MIGRATION-COMPLETED-PHASE-1.md) - Phase 1 completion summary

## 🚨 Deprecated/Archive

### Recent Fixes (from root → archived/fixes/)
- [AudioContext Fixes Summary](./archived/fixes/AUDIOCONTEXT-FIXES-SUMMARY.md)
- [Creator Test Fix Summary](./archived/fixes/CREATOR_TEST_FIX_SUMMARY.md)
- [Harmony Test Button Performance Fix](./archived/fixes/HARMONY-TEST-BUTTON-PERFORMANCE-FIX.md)
- [Harmony Three-Phase Loading Fix](./archived/fixes/HARMONY-THREE-PHASE-LOADING-FIX.md)
- [Story 3.25 Unified Loading Fix](./archived/fixes/STORY-3.25-UNIFIED-LOADING-FIX.md)
- [Test Transport Fixes](./archived/fixes/test-transport-fixes.md)
- [Test Transport Restart](./archived/fixes/test-transport-restart.md)
- [TODO Revert](./archived/fixes/TODO-revert.md)

### Old Documentation (DO NOT USE)
- `archived/claude-code-trash-bin-2024-08-25/` - Historical fixes from August 2024
- `archived/project-planning-memory-bank/` - Historical project planning docs (pre-2025)
- `CLAUDE CODE TRASH BIN/` - Deprecated docs

### Migration Guides (Historical)
- [Old Transport Files Migration](./old-transport-files-migration.md)
- [Transport Compatibility Report](./transport-compatibility-report.md)
- [Region Migration Guide](./REGION_MIGRATION_GUIDE.md)

## 📝 Templates & Examples

- [Drum Manifest Template](./drum-manifest-template.json)
- [Example Manifest - Classic 808](./example-manifest-classic-808.json)
- [Drum Variation System](./drum-variation-system.tsx)

## 🔍 How to Find Documentation

1. **For new features**: Check active stories in `NEW STORIES/`
2. **For debugging**: Start with `developer-handbook/TROUBLESHOOTING_FLOWCHART.md`
3. **For architecture**: Check the Architecture section above
4. **For coding**: See `developer-handbook/CODING_STANDARDS.md`
5. **For old fixes**: Check `archived/` (but prefer current docs)

## ⚠️ Before Creating New Documentation

1. Check if it already exists in this index
2. Read `DOCUMENTATION_GUIDELINES.md`
3. Consider if it belongs in an existing document
4. Use the proper folder structure
5. Update this INDEX.md file

---

**Last Updated**: September 2025
**Maintained By**: Development Team