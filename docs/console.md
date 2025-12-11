tone-core.js:18  * Tone.js v15.1.22 * 
WurlitzerVelocitySampler.ts:88 [WURLITZER CONSTRUCTOR] {instanceId: 'WV1765448517037-nlset'}
structured-logger.js:186 [INFO] [frontend:AudioProvider] AudioProvider: Feature flags: {USE_NEW_AUDIO_ENGINE: true, USE_NEW_DEPENDENCY_INJECTION: true, ROLLBACK_TO_OLD_SYSTEM: false, ENABLE_MIGRATION_MONITORING: true, ROLLOUT_PERCENTAGE: 100, …}
initSequenceLogger.ts:47 [INIT-SEQ 1] PROVIDER-MOUNT {timestamp: 1765448517390, shouldUseLegacyProvider: false}
initSequenceLogger.ts:47 [INIT-SEQ 2] CREATE-SERVICES-START {timestamp: 1765448517390}
structured-logger.js:186 [INFO] [frontend:AudioProvider] AudioProvider: Starting createCoreServicesWithPreInit... 
logger.ts:325 [AudioEventRouter] 📝 AudioEventRouter constructed 
AudioDebugger.ts:38 [AudioEventRouter] constructed 
logger.ts:325 [InstrumentRegistry] 📝 InstrumentRegistry initialized 
structured-logger.js:186 [INFO] [VelocityLayerSelector] VelocityLayerSelector created {instrument: 'wurlitzer', hasPerNoteRanges: false, noteCount: 0}
logger.ts:325 [PlaybackEngine] 📝 PlaybackEngine initialized {instanceId: 'z57sigvms', config: {…}}
initSequenceLogger.ts:47 [INIT-SEQ 3] RESUME-EFFECT-MOUNTED {timestamp: 1765448517393, isInitialized: false, hasCoreServices: false}
PluginManager.ts:613 [PLAYBACK-ENGINE][Plugin] Starting WamKeyboardPlugin registration...
logger.ts:325 [PluginManager] 📝 🎹 Registering WamKeyboardPlugin for harmony... 
PluginManager.ts:622 [PLAYBACK-ENGINE][Plugin] WamKeyboardPlugin registered successfully
logger.ts:325 [PluginManager] 📝 ✅ WamKeyboardPlugin registered (id: wam-keyboard) 
initSequenceLogger.ts:47 [INIT-SEQ 4] PROVIDER-MOUNT {timestamp: 1765448517414, shouldUseLegacyProvider: false}
initSequenceLogger.ts:47 [INIT-SEQ 5] RESUME-EFFECT-MOUNTED {timestamp: 1765448517415, isInitialized: false, hasCoreServices: false}
initSequenceLogger.ts:47 [INIT-SEQ 6] CREATE-SERVICES-DONE {timestamp: 1765448517434}
structured-logger.js:186 [INFO] [frontend:AudioProvider] AudioProvider: createCoreServicesWithPreInit completed successfully 
structured-logger.js:186 [INFO] [frontend:AudioProvider] AudioProvider: Starting eager initialization (AudioContext will be suspended)... 
GlobalSampleCache.ts:144 [INDEXEDDB-DEBUG] Initializing LocalProvider...
GlobalSampleCache.ts:155 [INDEXEDDB-DEBUG] LocalProvider instance created: true
initSequenceLogger.ts:47 [INIT-SEQ 7] SERVICES-INIT-START {timestamp: 1765448517495}
structured-logger.js:186 [INFO] [frontend:AudioProvider] AudioProvider: Starting services.initialize() - will create AudioContext in suspended state 
logger.ts:325 [PreloadableInstrumentRegistry] 📝 PreloadableInstrumentRegistry created 
logger.ts:325 [PreloadableInstrumentRegistry] 📝 Registry initialized with EventBus and AudioEngine 
CoreServices.ts:184 [DEBUG-INIT] 🔍 About to call audioEngine.initialize()...
AudioEngine.ts:229 [AUDIOENGINE-INIT] Step 1: Starting preInitialize()
AudioEngine.ts:232 [AUDIOENGINE-INIT] Step 1: preInitialize() done
AudioEngine.ts:234 [AUDIOENGINE-INIT] Step 2: Getting or creating AudioContext
AudioEngine.ts:239 [AUDIOENGINE-INIT] Step 2: AudioContext ready, state: running
AudioEngine.ts:244 [AUDIOENGINE-INIT] Step 3: Initializing ToneWrapper
AudioEngine.ts:247 [AUDIOENGINE-INIT] Step 3: ToneWrapper initialized
AudioEngine.ts:253 [AUDIOENGINE-INIT] Step 4: Applying timing config
AudioEngine.ts:256 [AUDIOENGINE-INIT] Step 4: Timing config applied
AudioEngine.ts:258 [AUDIOENGINE-INIT] Step 5: Setting up state change handling
AudioEngine.ts:265 [AUDIOENGINE-INIT] Step 5: State change handler registered
AudioEngine.ts:269 [AUDIOENGINE-INIT] Step 6: Validation check
AudioEngine.ts:276 [AUDIOENGINE-INIT] Step 6: Validation disabled
CoreServices.ts:187 [DEBUG-INIT] ✅ audioEngine.initialize() completed!
CoreServices.ts:191 [DEBUG-INIT] 🔍 About to call registry.initialize()...
ServiceRegistry.ts:187 [DEBUG-REGISTRY] 🔍 Initialization order: (6) ['eventBus', 'audioEngine', 'unifiedTransport', 'pluginManager', 'audioEventRouter', 'instrumentRegistry']
ServiceRegistry.ts:193 [DEBUG-REGISTRY] Processing service: eventBus
ServiceRegistry.ts:228 [DEBUG-REGISTRY] 🚀 Calling initialize() on eventBus...
logger.ts:325 [service] ⚙️ Initializing eventBus 
ServiceRegistry.ts:233 [DEBUG-REGISTRY] ✅ eventBus.initialize() completed
logger.ts:325 [service] ⚙️ eventBus initialized successfully 
ServiceRegistry.ts:193 [DEBUG-REGISTRY] Processing service: audioEngine
ServiceRegistry.ts:228 [DEBUG-REGISTRY] 🚀 Calling initialize() on audioEngine...
logger.ts:325 [service] ⚙️ Initializing audioEngine 
ServiceRegistry.ts:233 [DEBUG-REGISTRY] ✅ audioEngine.initialize() completed
logger.ts:325 [service] ⚙️ audioEngine initialized successfully 
ServiceRegistry.ts:193 [DEBUG-REGISTRY] Processing service: unifiedTransport
ServiceRegistry.ts:228 [DEBUG-REGISTRY] 🚀 Calling initialize() on unifiedTransport...
logger.ts:325 [service] ⚙️ Initializing unifiedTransport 
structured-logger.js:186 [INFO] [AudioWorkletManager] AudioWorkletManager initialized {updateInterval: 0.00267, lookAheadTime: 0.2, workletPath: '/worklets/timing-processor.js'}
structured-logger.js:186 [INFO] [SampleAccurateClock] SampleAccurateClock initialized {updateInterval: 0.00267, lookAheadTime: 0.2, driftThreshold: 1, workletPath: undefined}
structured-logger.js:186 [INFO] [frontend:AudioProvider] AudioContext state changed (event-driven) {state: 'running'}
structured-logger.js:186 [INFO] [AudioWorkletManager] AudioWorklet module loaded successfully 
timing-processor.js:41 TimingProcessor[4pj5493l4] initialized {sampleRate: 44100, updateInterval: 0.00267, samplesPerUpdate: 117, theoreticalLatency: '2.90ms'}
structured-logger.js:186 [INFO] [AudioWorkletManager] AudioWorklet initialized successfully {contextState: 'running', sampleRate: 44100, baseLatency: 0.01, outputLatency: 0}
structured-logger.js:186 [INFO] [SampleAccurateClock] Clock initialized with AudioContext {sampleRate: 44100, state: 'running'}
ServiceRegistry.ts:233 [DEBUG-REGISTRY] ✅ unifiedTransport.initialize() completed
logger.ts:325 [service] ⚙️ unifiedTransport initialized successfully 
ServiceRegistry.ts:193 [DEBUG-REGISTRY] Processing service: pluginManager
ServiceRegistry.ts:228 [DEBUG-REGISTRY] 🚀 Calling initialize() on pluginManager...
logger.ts:325 [service] ⚙️ Initializing pluginManager 
PluginManager.ts:131 [PLAYBACK-ENGINE][PluginManager] 🚀 initialize() called {isInitialized: false}
PluginManager.ts:143 [PLAYBACK-ENGINE][PluginManager] Getting AudioContext from AudioEngine...
PluginManager.ts:148 [PLAYBACK-ENGINE][PluginManager] Got AudioContext: {state: 'running', sampleRate: 44100}
PluginManager.ts:163 [PLAYBACK-ENGINE][PluginManager] ✅ Initialization complete - emitting plugin-manager:initialized event
PluginManager.ts:167 [PLAYBACK-ENGINE][PluginManager] Event emitted successfully
ServiceRegistry.ts:233 [DEBUG-REGISTRY] ✅ pluginManager.initialize() completed
logger.ts:325 [service] ⚙️ pluginManager initialized successfully 
ServiceRegistry.ts:193 [DEBUG-REGISTRY] Processing service: audioEventRouter
ServiceRegistry.ts:228 [DEBUG-REGISTRY] 🚀 Calling initialize() on audioEventRouter...
logger.ts:325 [service] ⚙️ Initializing audioEventRouter 
logger.ts:325 [AudioEventRouter] 📝 Initializing AudioEventRouter 
installHook.js:1 [AudioEventRouter] ⚠️ AudioEventRouter initialized without EventBus or AudioEngine - will need to be initialized again with dependencies 
overrideMethod @ installHook.js:1
log @ logger.ts:322
warn @ logger.ts:289
initialize @ AudioEventRouter.ts:79
initialize @ ServiceRegistry.ts:232
await in initialize
initialize @ CoreServices.ts:193
await in initialize
initializeServices @ AudioProvider.tsx:244
await in initializeServices
AudioProvider.useEffect @ AudioProvider.tsx:315
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
performWorkUntilDeadline @ scheduler.development.js:44
ServiceRegistry.ts:233 [DEBUG-REGISTRY] ✅ audioEventRouter.initialize() completed
logger.ts:325 [service] ⚙️ audioEventRouter initialized successfully 
ServiceRegistry.ts:193 [DEBUG-REGISTRY] Processing service: instrumentRegistry
logger.ts:325 [service] ⚙️ instrumentRegistry has no initialize method, marking as initialized 
CoreServices.ts:194 [DEBUG-INIT] ✅ registry.initialize() completed!
structured-logger.js:186 [INFO] [RecoveryEventHandlers] Registering recovery event handlers 
structured-logger.js:186 [INFO] [RecoveryEventHandlers] Recovery event handlers registered {count: 6}
CoreServices.ts:207 [MILESTONE] 🎹 STEP 2.5: WamKeyboardPlugin registered (will load on-demand)
logger.ts:325 [TransportSyncManager] 📝 🔄 TransportSyncManager initialized with UnifiedTransport 
PluginManager.ts:605 [PLAYBACK-ENGINE][Plugin] WamKeyboardPlugin already registered, skipping
logger.ts:325 [PluginManager] 📝 WamKeyboardPlugin already registered, skipping duplicate registration 
installHook.js:1 [PluginManager] ⚠️ Failed to register plugin: {error: PluginError: Plugin bassnotion.bass-processor is already registered
    at PluginManager.register (…, correlationId: 'system'}
overrideMethod @ installHook.js:1
log @ logger.ts:322
warn @ logger.ts:289
registerExistingPlugins @ PluginManager.ts:676
await in registerExistingPlugins
initialize @ CoreServices.ts:223
await in initialize
initializeServices @ AudioProvider.tsx:244
await in initializeServices
AudioProvider.useEffect @ AudioProvider.tsx:315
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
performWorkUntilDeadline @ scheduler.development.js:44
installHook.js:1 [PluginManager] ⚠️ Failed to register plugin: {error: PluginError: Plugin bassnotion.drum-processor is already registered
    at PluginManager.register (…, correlationId: 'system'}
overrideMethod @ installHook.js:1
log @ logger.ts:322
warn @ logger.ts:289
registerExistingPlugins @ PluginManager.ts:676
await in registerExistingPlugins
initialize @ CoreServices.ts:223
await in initialize
initializeServices @ AudioProvider.tsx:244
await in initializeServices
AudioProvider.useEffect @ AudioProvider.tsx:315
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
performWorkUntilDeadline @ scheduler.development.js:44
AudioDebugger.ts:38 [CoreServices] initializing-audio-event-router 
logger.ts:325 [AudioEventRouter] 📝 Initializing AudioEventRouter 
logger.ts:325 [PreloadableInstrumentRegistry] 📝 Registry initialized with EventBus and AudioEngine 
logger.ts:325 [AudioEventRouter] 📝 Initialized PreloadableInstrumentRegistry 
logger.ts:325 [AudioEventRouter] 📝 AudioEventRouter subscribing to EventBus events... 
logger.ts:325 [AudioEventRouter] 📝 AudioEventRouter subscribed to EventBus trigger events {metronomeHandler: true, drumHandler: true, eventBusConnected: true, handlersCount: 8}
logger.ts:325 [AudioEventRouter] 📝 AudioEventRouter initialized with EventBus and AudioEngine 
AudioDebugger.ts:38 [CoreServices] starting-audio-event-router 
logger.ts:325 [AudioEventRouter] 📝 AudioEventRouter started 
AudioDebugger.ts:38 [AudioEventRouter] started {hasMetronome: false, hasDrums: false, hasBass: false, hasHarmony: false, hasInstrumentRegistry: false}
AudioDebugger.ts:38 [CoreServices] audio-event-router-started 
logger.ts:325 [PlaybackEngine] 📝 State transition: idle → loading {instanceId: 'z57sigvms', forced: false}
HarmonySchedulerV2.ts:123 [🏗️ HARMONY-V2 INSTANCE CREATED 🏗️] {instanceId: 'z57sigvms', tracksType: 'Map', isMap: true, tracksSize: 0, timestamp: 1765448517510}
structured-logger.js:186 [INFO] [VelocityLayerSelector] VelocityLayerSelector created {instrument: undefined, hasPerNoteRanges: false, noteCount: 0}
logger.ts:325 [PlaybackEngine] 📝 State transition: loading → ready {instanceId: 'z57sigvms', forced: false}
logger.ts:325 [PlaybackEngine] 📝 PlaybackEngine initialized successfully {instanceId: 'z57sigvms', sampleRate: 44100}
logger.ts:325 [PlaybackEngine] 📝 PluginManager set {instanceId: 'z57sigvms'}
CoreServices.ts:287 [CORESERVICES-BUFFER-INJECTION] Checking condition: {hasRegionProcessor: false, hasPlaybackEngine: true, willInject: true}
CoreServices.ts:294 [CORESERVICES-BUFFER-INJECTION] Starting buffer injection...
CoreServices.ts:303 [CORESERVICES-BUFFER-INJECTION] Got GlobalSampleCache instance
structured-logger.js:186 [INFO] [LocalProvider] LocalProvider initialized with IndexedDB 
GlobalSampleCache.ts:163 [INDEXEDDB-DEBUG] IndexedDB connected: {provider: 'local', database: 'BassNotionAudioSamples'}
timing-processor.js:60 TimingProcessor[4pj5493l4].process() started, isPlaying: false, updateCount: 0
structured-logger.js:186 [INFO] [LocalProvider] LocalProvider initialized with IndexedDB 
GlobalSampleCache.ts:163 [INDEXEDDB-DEBUG] IndexedDB connected: {provider: 'local', database: 'BassNotionAudioSamples'}
AudioDebugger.ts:38 [CoreServices] region-processor-ready 
initSequenceLogger.ts:47 [INIT-SEQ 8] AUDIOCONTEXT-CREATED {timestamp: 1765448517617, contextState: 'running', sampleRate: 44100}
initSequenceLogger.ts:47 [INIT-SEQ 9] SERVICES-INIT-DONE {timestamp: 1765448517617}
structured-logger.js:186 [INFO] [frontend:AudioProvider] AudioProvider: Eager initialization complete (AudioContext suspended, plugins registered) 
initSequenceLogger.ts:47 [INIT-SEQ 10] STATE-UPDATED {timestamp: 1765448517617, isInitialized: true, coreServicesReady: true}
structured-logger.js:186 [INFO] [frontend:AudioProvider] AudioProvider: Context state updated - isInitialized: true 
initSequenceLogger.ts:47 [INIT-SEQ 11] RESUME-EFFECT-MOUNTED {timestamp: 1765448517617, isInitialized: true, hasCoreServices: true}
initSequenceLogger.ts:47 [INIT-SEQ 12] RESUME-EFFECT-READY {timestamp: 1765448517618}
structured-logger.js:186 [INFO] [frontend:AudioProvider] [INIT] Setting up click listener (separate useEffect)... 
initSequenceLogger.ts:47 [INIT-SEQ 13] LISTENER-REGISTERED {timestamp: 1765448517618, events: Array(3)}
structured-logger.js:186 [INFO] [frontend:AudioProvider] [INIT] Gesture listeners registered {events: Array(3)}
tutorials.ts:95 🔍 fetchTutorialExercises - API response: {slug: 'how-to-find-notes-on-the-bass-fretboard', exerciseCount: 2, exercises: Array(2)}
tutorials.ts:122 🔍 fetchTutorialExercises - Tutorial creator data: {hasCreatorName: true, creatorName: 'Bass with Tibo', hasCreatorAvatar: true, creatorAvatar: 'https://yt3.ggpht.com/7oN6vilXZjF_pIa27RKm9hJbNhE0MIcbvv-YEY...'}
exercise.entity.ts:287 🔍 [EXERCISE-DTO] Received DTO from backend: {title: 'JOO', id: '6fd6faa0-6494-4022-85df-a61565f5e366', harmony_instrument: 'wurlitzer', harmonyInstrument: undefined, hasHarmonyMidiUrl: true, …}
exercise.entity.ts:304 🔍 Exercise.fromDTO - Harmony data: {title: 'JOO', hasHarmonyMidiUrl: true, hasHarmonyNotes: true, harmonyNotesCount: 129, hasHarmonyControlChanges: true, …}
exercise.entity.ts:350 🔍 [EXERCISE-ENTITY] Created entity: {title: 'JOO', harmonyInstrument: 'wurlitzer', harmonyInstrumentFromProps: 'wurlitzer', propsKeys: Array(29)}
exercise.entity.ts:287 🔍 [EXERCISE-DTO] Received DTO from backend: {title: 'NEEE', id: '6d7fda56-9fdc-492f-a4f3-1b79ca6db8ca', harmony_instrument: 'wurlitzer', harmonyInstrument: undefined, hasHarmonyMidiUrl: true, …}
exercise.entity.ts:304 🔍 Exercise.fromDTO - Harmony data: {title: 'NEEE', hasHarmonyMidiUrl: true, hasHarmonyNotes: true, harmonyNotesCount: 129, hasHarmonyControlChanges: true, …}
exercise.entity.ts:350 🔍 [EXERCISE-ENTITY] Created entity: {title: 'NEEE', harmonyInstrument: 'wurlitzer', harmonyInstrumentFromProps: 'wurlitzer', propsKeys: Array(29)}
installHook.js:1 🔍 [EXERCISE-DTO] Received DTO from backend: {title: 'JOO', id: '6fd6faa0-6494-4022-85df-a61565f5e366', harmony_instrument: 'wurlitzer', harmonyInstrument: undefined, hasHarmonyMidiUrl: true, …}
installHook.js:1 🔍 Exercise.fromDTO - Harmony data: {title: 'JOO', hasHarmonyMidiUrl: true, hasHarmonyNotes: true, harmonyNotesCount: 129, hasHarmonyControlChanges: true, …}
installHook.js:1 🔍 [EXERCISE-ENTITY] Created entity: {title: 'JOO', harmonyInstrument: 'wurlitzer', harmonyInstrumentFromProps: 'wurlitzer', propsKeys: Array(29)}
installHook.js:1 🔍 [EXERCISE-DTO] Received DTO from backend: {title: 'NEEE', id: '6d7fda56-9fdc-492f-a4f3-1b79ca6db8ca', harmony_instrument: 'wurlitzer', harmonyInstrument: undefined, hasHarmonyMidiUrl: true, …}
installHook.js:1 🔍 Exercise.fromDTO - Harmony data: {title: 'NEEE', hasHarmonyMidiUrl: true, hasHarmonyNotes: true, harmonyNotesCount: 129, hasHarmonyControlChanges: true, …}
installHook.js:1 🔍 [EXERCISE-ENTITY] Created entity: {title: 'NEEE', harmonyInstrument: 'wurlitzer', harmonyInstrumentFromProps: 'wurlitzer', propsKeys: Array(29)}
use-user-profile.ts:32 📡 Fetching profile from API for user: 9b3a93cb-100e-4084-bb06-8b3191b1adae
TransportClock.tsx:38 🔴 [MOUNT DEBUG] TransportClock MOUNTED {timestamp: 1765448517798, selectedExercise: undefined}
TransportClock.tsx:82 📍 [POSITION DEBUG] TransportClock received new position {position: '0:0:0', isPlaying: false, isValid: true, timestamp: 1765448517798}
installHook.js:1 [global-controls] ⚠️ 🎮 GlobalControls: No exercise selected - useEffect returning early  Error Component Stack
    at GlobalControlsComponent (GlobalControls.tsx:274:3)
    at div (<anonymous>)
    at _c8 (card.tsx:59:6)
    at div (<anonymous>)
    at _c (card.tsx:8:6)
    at GlobalControlsCard (GlobalControlsCard.tsx:32:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at YouTubeWidgetPageContent (YouTubeWidgetPage.tsx:54:3)
    at SyncProvider (SyncProvider.tsx:92:3)
    at TransportProvider (TransportContext.tsx:81:3)
    at YouTubeWidgetPage (YouTubeWidgetPage.tsx:879:3)
    at ErrorBoundary (page.tsx:17:5)
    at TutorialPage (page.tsx:65:40)
    at ClientPageRoot (client-page.js:14:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at QueryClientProvider (QueryClientProvider.js:27:11)
    at ReactQueryProvider (react-query.tsx:8:3)
    at AuthProvider (AuthProvider.tsx:20:32)
    at AuthProviderWrapper [Server] (<anonymous>)
    at AudioProvider (AudioProvider.tsx:93:33)
    at ErrorBoundary (ErrorBoundary.tsx:28:5)
    at body (<anonymous>)
    at html (<anonymous>)
    at RootLayout [Server] (<anonymous>)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at DevRootHTTPAccessFallbackBoundary (dev-root-http-access-fallback-boundary.js:33:11)
    at ReactDevOverlay (ReactDevOverlay.js:80:9)
    at HotReload (hot-reloader-client.js:379:11)
    at Router (app-router.js:183:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at AppRouter (app-router.js:563:11)
    at ServerRoot (app-index.js:145:46)
    at Root (app-index.js:165:11)
overrideMethod @ installHook.js:1
log @ logger.ts:322
warn @ logger.ts:289
GlobalControlsComponent.useEffect @ GlobalControls.tsx:1328
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
commitRootImpl @ react-dom-client.development.js:15413
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performSyncWorkOnRoot @ react-dom-client.development.js:15970
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
setTimeout
systemSetTimeoutZero @ timeoutManager.js:69
flush @ notifyManager.js:34
batch @ notifyManager.js:52
#dispatch @ query.js:381
setData @ query.js:63
fetch @ query.js:281
await in fetch
#executeFetch @ queryObserver.js:181
onSubscribe @ queryObserver.js:54
subscribe @ subscribable.js:13
useBaseQuery.useSyncExternalStore.useCallback @ useBaseQuery.js:52
subscribeToStore @ react-dom-client.development.js:5222
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
performWorkUntilDeadline @ scheduler.development.js:44
logger.ts:325 [metronome-widget] 📝 🎵 MetronomeWidget: BPM changed {bpm: 120, transportTempo: 120, hasPlugin: false}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget state changed: {harmonyInstrumentProp: undefined, currentInstrumentState: undefined, isPlaying: false, isVisible: true, hasExercise: false, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Track state changed: {isReady: false, trackId: undefined, trackState: undefined}
HarmonyWidget.tsx:322 🎹 [HARMONY-WIDGET] Exercise prop changed: {hasExercise: false, exerciseId: undefined, exerciseTitle: undefined, hasHarmonyNotes: false, harmonyNotesCount: 0, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Component mounted with initial state: {audioServicesReady: false, wamPluginLoaded: false, pluginClassLoaded: false, trackIsReady: false}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Checking for pre-loaded instrument... 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] ❌ NO pre-loaded harmony instrument found! 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 GlobalSampleCache stats: {samplesCount: 0, instrumentsCount: 0, totalSize: 0}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 Cached instrument names: []
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] ✅ Ready to use WAM plugin singleton 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Phase 2 effect check: {window: true, pluginClassLoaded: false, trackIsReady: false, audioServicesReady: false, wamPluginLoaded: false, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Setting up audio service listeners... 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Audio services already ready 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Audio context state: running
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Retry effect check: {audioServicesReady: false, trackIsReady: false, wamPluginLoaded: false, pluginClassLoaded: false, shouldRetry: false}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered: {timestamp: 1765448517840, isPlaying: false, trackIsReady: false, wamPluginLoaded: false, hasPlugin: false, …}
HarmonyWidget.tsx:2351 ⏳ [HARMONY-WIDGET] Waiting for conditions: track not ready, no harmony notes
YouTubeWidgetPage.tsx:332 🔍 [YOUTUBE-WIDGET] Auto-selection effect triggered: {hasExercises: true, exerciseCount: 2, selectedExerciseId: null, shouldAutoSelect: true}
logger.ts:325 [transport] 🎵 [TransportContext] Got services from CoreServices 
logger.ts:325 [transport] 🎵 [TransportContext] Got initial position from transport {position: '1:1:0'}
logger.ts:325 [transport] 🎵 [TransportContext] Services initialized and ready 
logger.ts:325 [transport] 🎵 [TransportContext] Setting up single EventBus subscription 
logger.ts:325 [transport] 🎵 [TransportContext] EventBus subscriptions established (8 total) 
installHook.js:1 [transport] 🎵 [TransportContext] Cleaning up EventBus subscriptions 
installHook.js:1 🔴 [UNMOUNT DEBUG] TransportClock UNMOUNTING {timestamp: 1765448517846}
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Component unmounting, cleaning up... 
installHook.js:1 🔴 [MOUNT DEBUG] TransportClock MOUNTED {timestamp: 1765448517847, selectedExercise: undefined}
installHook.js:1 📍 [POSITION DEBUG] TransportClock received new position {position: '0:0:0', isPlaying: false, isValid: true, timestamp: 1765448517849}
installHook.js:1 [global-controls] ⚠️ 🎮 GlobalControls: No exercise selected - useEffect returning early '' Error Component Stack
    at GlobalControlsComponent (GlobalControls.tsx:274:3)
    at div (<anonymous>)
    at _c8 (card.tsx:59:6)
    at div (<anonymous>)
    at _c (card.tsx:8:6)
    at GlobalControlsCard (GlobalControlsCard.tsx:32:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at YouTubeWidgetPageContent (YouTubeWidgetPage.tsx:54:3)
    at SyncProvider (SyncProvider.tsx:92:3)
    at TransportProvider (TransportContext.tsx:81:3)
    at YouTubeWidgetPage (YouTubeWidgetPage.tsx:879:3)
    at ErrorBoundary (page.tsx:17:5)
    at TutorialPage (page.tsx:65:40)
    at ClientPageRoot (client-page.js:14:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at QueryClientProvider (QueryClientProvider.js:27:11)
    at ReactQueryProvider (react-query.tsx:8:3)
    at AuthProvider (AuthProvider.tsx:20:32)
    at AuthProviderWrapper [Server] (<anonymous>)
    at AudioProvider (AudioProvider.tsx:93:33)
    at ErrorBoundary (ErrorBoundary.tsx:28:5)
    at body (<anonymous>)
    at html (<anonymous>)
    at RootLayout [Server] (<anonymous>)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at DevRootHTTPAccessFallbackBoundary (dev-root-http-access-fallback-boundary.js:33:11)
    at ReactDevOverlay (ReactDevOverlay.js:80:9)
    at HotReload (hot-reloader-client.js:379:11)
    at Router (app-router.js:183:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at AppRouter (app-router.js:563:11)
    at ServerRoot (app-index.js:145:46)
    at Root (app-index.js:165:11)
overrideMethod @ installHook.js:1
log @ logger.ts:322
warn @ logger.ts:289
GlobalControlsComponent.useEffect @ GlobalControls.tsx:1328
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
reconnectPassiveEffects @ react-dom-client.development.js:12818
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12865
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12865
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12811
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12865
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12811
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12811
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12865
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12865
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12865
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12811
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12865
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12811
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12865
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12811
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12811
recursivelyTraverseReconnectPassiveEffects @ react-dom-client.development.js:12790
reconnectPassiveEffects @ react-dom-client.development.js:12865
doubleInvokeEffectsOnFiber @ react-dom-client.development.js:15719
runWithFiberInDEV @ react-dom-client.development.js:544
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15679
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15686
commitDoubleInvokeEffectsInDEV @ react-dom-client.development.js:15728
flushPassiveEffects @ react-dom-client.development.js:15493
commitRootImpl @ react-dom-client.development.js:15413
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performSyncWorkOnRoot @ react-dom-client.development.js:15970
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
processRootScheduleInMicrotask @ react-dom-client.development.js:15864
eval @ react-dom-client.development.js:15986
setTimeout
systemSetTimeoutZero @ timeoutManager.js:69
flush @ notifyManager.js:34
batch @ notifyManager.js:52
#dispatch @ query.js:381
setData @ query.js:63
fetch @ query.js:281
await in fetch
#executeFetch @ queryObserver.js:181
onSubscribe @ queryObserver.js:54
subscribe @ subscribable.js:13
useBaseQuery.useSyncExternalStore.useCallback @ useBaseQuery.js:52
subscribeToStore @ react-dom-client.development.js:5222
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
performWorkUntilDeadline @ scheduler.development.js:44
installHook.js:1 [metronome-widget] 📝 🎵 MetronomeWidget: BPM changed {bpm: 120, transportTempo: 120, hasPlugin: false}
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget state changed: {harmonyInstrumentProp: undefined, currentInstrumentState: undefined, isPlaying: false, isVisible: true, hasExercise: false, …}
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Track state changed: {isReady: false, trackId: undefined, trackState: undefined}
installHook.js:1 🎹 [HARMONY-WIDGET] Exercise prop changed: {hasExercise: false, exerciseId: undefined, exerciseTitle: undefined, hasHarmonyNotes: false, harmonyNotesCount: 0, …}
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Component mounted with initial state: {audioServicesReady: false, wamPluginLoaded: false, pluginClassLoaded: false, trackIsReady: false}
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Checking for pre-loaded instrument... 
installHook.js:1 [INFO] [frontend:HarmonyWidget] ❌ NO pre-loaded harmony instrument found! 
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 GlobalSampleCache stats: {samplesCount: 0, instrumentsCount: 0, totalSize: 0}
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 Cached instrument names: []
installHook.js:1 [INFO] [frontend:HarmonyWidget] ✅ Ready to use WAM plugin singleton 
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Phase 2 effect check: {window: true, pluginClassLoaded: false, trackIsReady: false, audioServicesReady: false, wamPluginLoaded: false, …}
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Setting up audio service listeners... 
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Audio services already ready 
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Audio context state: running
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Retry effect check: {audioServicesReady: false, trackIsReady: false, wamPluginLoaded: false, pluginClassLoaded: false, shouldRetry: false}
installHook.js:1 [INFO] [frontend:HarmonyWidget] 🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered: {timestamp: 1765448517874, isPlaying: false, trackIsReady: false, wamPluginLoaded: false, hasPlugin: false, …}
installHook.js:1 ⏳ [HARMONY-WIDGET] Waiting for conditions: track not ready, no harmony notes
installHook.js:1 🔍 [YOUTUBE-WIDGET] Auto-selection effect triggered: {hasExercises: true, exerciseCount: 2, selectedExerciseId: null, shouldAutoSelect: true}
installHook.js:1 [transport] 🎵 [TransportContext] Setting up single EventBus subscription 
installHook.js:1 [transport] 🎵 [TransportContext] EventBus subscriptions established (8 total) 
react-dom-client.development.js:15983 [Violation] 'setTimeout' handler took 131ms
logger.ts:325 [global-controls] 📝 🔍 GlobalControls arePropsEqual check: {allEqual: true, selectedExerciseChanged: true, prevExerciseId: undefined, nextExerciseId: undefined, renderCount: 2}
logger.ts:325 [transport] 🎵 [TransportContext] Cleaning up EventBus subscriptions 
TransportClock.tsx:82 📍 [POSITION DEBUG] TransportClock received new position {position: '1:1:0', isPlaying: false, isValid: true, timestamp: 1765448517897}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Track state changed: {isReady: true, trackId: 'harmony-widget-track', trackState: 'READY'}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Phase 2 effect check: {window: true, pluginClassLoaded: true, trackIsReady: true, audioServicesReady: true, wamPluginLoaded: false, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Attempting to create audio node... {trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Got context: AudioContext {baseLatency: 0.01, outputLatency: 0.04, onerror: null, sinkId: '', onsinkchange: null, …}
installHook.js:1 [WARN] [frontend:HarmonyWidget] 🎹 HarmonyWidget: No harmonyInstrument specified, waiting for exercise to load  Error Component Stack
    at HarmonyWidgetComponent (HarmonyWidget.tsx:94:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at _c8 (card.tsx:59:6)
    at div (<anonymous>)
    at _c (card.tsx:8:6)
    at FourWidgetsCard (FourWidgetsCard.tsx:18:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at YouTubeWidgetPageContent (YouTubeWidgetPage.tsx:54:3)
    at SyncProvider (SyncProvider.tsx:92:3)
    at TransportProvider (TransportContext.tsx:81:3)
    at YouTubeWidgetPage (YouTubeWidgetPage.tsx:879:3)
    at ErrorBoundary (page.tsx:17:5)
    at TutorialPage (page.tsx:65:40)
    at ClientPageRoot (client-page.js:14:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at QueryClientProvider (QueryClientProvider.js:27:11)
    at ReactQueryProvider (react-query.tsx:8:3)
    at AuthProvider (AuthProvider.tsx:20:32)
    at AuthProviderWrapper [Server] (<anonymous>)
    at AudioProvider (AudioProvider.tsx:93:33)
    at ErrorBoundary (ErrorBoundary.tsx:28:5)
    at body (<anonymous>)
    at html (<anonymous>)
    at RootLayout [Server] (<anonymous>)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at DevRootHTTPAccessFallbackBoundary (dev-root-http-access-fallback-boundary.js:33:11)
    at ReactDevOverlay (ReactDevOverlay.js:80:9)
    at HotReload (hot-reloader-client.js:379:11)
    at Router (app-router.js:183:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at AppRouter (app-router.js:563:11)
    at ServerRoot (app-index.js:145:46)
    at Root (app-index.js:165:11)
overrideMethod @ installHook.js:1
log @ structured-logger.js:183
warn @ structured-logger.js:220
HarmonyWidgetComponent.useCallback[createAudioNodeAttempt] @ HarmonyWidget.tsx:606
HarmonyWidgetComponent.useEffect @ HarmonyWidget.tsx:948
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
processRootScheduleInMicrotask @ react-dom-client.development.js:15864
eval @ react-dom-client.development.js:15986
setTimeout
systemSetTimeoutZero @ timeoutManager.js:69
flush @ notifyManager.js:34
batch @ notifyManager.js:52
#dispatch @ query.js:381
setData @ query.js:63
fetch @ query.js:281
await in fetch
#executeFetch @ queryObserver.js:181
onSubscribe @ queryObserver.js:54
subscribe @ subscribable.js:13
useBaseQuery.useSyncExternalStore.useCallback @ useBaseQuery.js:52
subscribeToStore @ react-dom-client.development.js:5222
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
commitRootImpl @ react-dom-client.development.js:15413
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
setTimeout
systemSetTimeoutZero @ timeoutManager.js:69
flush @ notifyManager.js:34
batch @ notifyManager.js:52
#dispatch @ query.js:381
setData @ query.js:63
fetch @ query.js:281
await in fetch
#executeFetch @ queryObserver.js:181
onSubscribe @ queryObserver.js:54
subscribe @ subscribable.js:13
useBaseQuery.useSyncExternalStore.useCallback @ useBaseQuery.js:52
subscribeToStore @ react-dom-client.development.js:5222
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
performWorkUntilDeadline @ scheduler.development.js:44
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Retry effect check: {audioServicesReady: true, trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true, shouldRetry: true}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Audio services ready, retrying plugin load... {audioServicesReady: true, trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true, hasPlugin: false}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Attempting to create audio node... {trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Got context: AudioContext {baseLatency: 0.01, outputLatency: 0.032, onerror: null, sinkId: '', onsinkchange: null, …}
installHook.js:1 [WARN] [frontend:HarmonyWidget] 🎹 HarmonyWidget: No harmonyInstrument specified, waiting for exercise to load  Error Component Stack
    at HarmonyWidgetComponent (HarmonyWidget.tsx:94:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at _c8 (card.tsx:59:6)
    at div (<anonymous>)
    at _c (card.tsx:8:6)
    at FourWidgetsCard (FourWidgetsCard.tsx:18:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at YouTubeWidgetPageContent (YouTubeWidgetPage.tsx:54:3)
    at SyncProvider (SyncProvider.tsx:92:3)
    at TransportProvider (TransportContext.tsx:81:3)
    at YouTubeWidgetPage (YouTubeWidgetPage.tsx:879:3)
    at ErrorBoundary (page.tsx:17:5)
    at TutorialPage (page.tsx:65:40)
    at ClientPageRoot (client-page.js:14:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at QueryClientProvider (QueryClientProvider.js:27:11)
    at ReactQueryProvider (react-query.tsx:8:3)
    at AuthProvider (AuthProvider.tsx:20:32)
    at AuthProviderWrapper [Server] (<anonymous>)
    at AudioProvider (AudioProvider.tsx:93:33)
    at ErrorBoundary (ErrorBoundary.tsx:28:5)
    at body (<anonymous>)
    at html (<anonymous>)
    at RootLayout [Server] (<anonymous>)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at DevRootHTTPAccessFallbackBoundary (dev-root-http-access-fallback-boundary.js:33:11)
    at ReactDevOverlay (ReactDevOverlay.js:80:9)
    at HotReload (hot-reloader-client.js:379:11)
    at Router (app-router.js:183:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at AppRouter (app-router.js:563:11)
    at ServerRoot (app-index.js:145:46)
    at Root (app-index.js:165:11)
overrideMethod @ installHook.js:1
log @ structured-logger.js:183
warn @ structured-logger.js:220
HarmonyWidgetComponent.useCallback[createAudioNodeAttempt] @ HarmonyWidget.tsx:606
HarmonyWidgetComponent.useEffect @ HarmonyWidget.tsx:1241
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
processRootScheduleInMicrotask @ react-dom-client.development.js:15864
eval @ react-dom-client.development.js:15986
setTimeout
systemSetTimeoutZero @ timeoutManager.js:69
flush @ notifyManager.js:34
batch @ notifyManager.js:52
#dispatch @ query.js:381
setData @ query.js:63
fetch @ query.js:281
await in fetch
#executeFetch @ queryObserver.js:181
onSubscribe @ queryObserver.js:54
subscribe @ subscribable.js:13
useBaseQuery.useSyncExternalStore.useCallback @ useBaseQuery.js:52
subscribeToStore @ react-dom-client.development.js:5222
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
commitRootImpl @ react-dom-client.development.js:15413
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
setTimeout
systemSetTimeoutZero @ timeoutManager.js:69
flush @ notifyManager.js:34
batch @ notifyManager.js:52
#dispatch @ query.js:381
setData @ query.js:63
fetch @ query.js:281
await in fetch
#executeFetch @ queryObserver.js:181
onSubscribe @ queryObserver.js:54
subscribe @ subscribable.js:13
useBaseQuery.useSyncExternalStore.useCallback @ useBaseQuery.js:52
subscribeToStore @ react-dom-client.development.js:5222
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
performWorkUntilDeadline @ scheduler.development.js:44
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered: {timestamp: 1765448517980, isPlaying: false, trackIsReady: true, wamPluginLoaded: false, hasPlugin: false, …}
HarmonyWidget.tsx:2351 ⏳ [HARMONY-WIDGET] Waiting for conditions: no harmony notes
logger.ts:325 [transport] 🎵 [TransportContext] Setting up single EventBus subscription 
logger.ts:325 [transport] 🎵 [TransportContext] EventBus subscriptions established (8 total) 
react-dom-client.development.js:15983 [Violation] 'setTimeout' handler took 88ms
logger.ts:325 [exercise-selector] 📝 🎯 ExerciseSelector visible - loading samples for ALL exercises (silent background) {exerciseCount: 2, exerciseTitles: Array(2)}
logger.ts:325 [exercise-selector] 📝 📥 Preloading exercise 1/2: JOO {exerciseId: ExerciseId, harmonyInstrument: 'wurlitzer', hasHarmonyNotes: true}
logger.ts:325 [InitialSamplePreloader] 📝 🚀 Phase 3: FAANG MIDI-based smart sample loading... {exerciseId: ExerciseId, exerciseTitle: 'JOO', hasHarmonyMidi: true, hasDrummerMidi: false, hasBasslineMidi: true, …}
InitialSamplePreloader.ts:402 🎵 [LOADING-START] Starting sample load for: {instrument: 'wurlitzer', exerciseId: ExerciseId, loadingKey: 'harmony-wurlitzer', hasHarmonyNotes: true, harmonyNotesCount: 129, …}
use-user-profile.ts:40 🔑 Session check: {hasSession: true, hasAccessToken: true, sessionError: undefined}
structured-logger.js:186 [INFO] [WamMetronomeNode] 🎵 WamMetronomeNode: Using shared AudioContext, not switching Tone.js 
structured-logger.js:186 [INFO] [WamMetronomeNode] ⚠️ Preloaded samples not in memory, checking IndexedDB... 
structured-logger.js:186 [INFO] [WamBass] 🎸 Bass plugin ready - waiting for samples to be uploaded to Supabase 
logger.ts:325 [HarmonyPreloadStrategy] 📝 🎹 Optimized harmony sample loading from pre-converted data... {exerciseId: ExerciseId, exerciseTitle: 'JOO', hasHarmonyNotes: true, harmonyInstrument: 'wurlitzer'}
logger.ts:325 [HarmonyPreloadStrategy] 📝 ✅ Loaded instrument configuration {instrument: 'wurlitzer', hasPerNoteRanges: true, hasGlobalRanges: true}
logger.ts:325 [HarmonyPreloadStrategy] 📝 [PRELOAD OCTAVE SHIFT] wurlitzer: MIDI 46 → 34 (shift: -12) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 [PRELOAD NOTE CONVERT] wurlitzer: A#1 / As1 (layer: v2), original: As2 
logger.ts:325 [HarmonyPreloadStrategy] 📝 [PRELOAD OCTAVE SHIFT] wurlitzer: MIDI 61 → 49 (shift: -12) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 [PRELOAD NOTE CONVERT] wurlitzer: C#3 / Cs3 (layer: v4), original: Cs4 
logger.ts:325 [HarmonyPreloadStrategy] 📝 [PRELOAD OCTAVE SHIFT] wurlitzer: MIDI 56 → 44 (shift: -12) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 [PRELOAD NOTE CONVERT] wurlitzer: G#2 / Gs2 (layer: v3), original: Gs3 
logger.ts:325 [HarmonyPreloadStrategy] 📝 🧠 Built smart sample map {uniqueNotes: 26, totalSamples: 36, hasSampleMapping: true, availableSampleNotes: 64, samples: Array(26)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 📊 Exercise data analysis complete - loading optimized samples with per-note config {uniqueNotes: 26, pitchRange: '43 to 77', velocityRange: '60 to 118', instrument: 'wurlitzer', totalSamplesToLoad: 36, …}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🎹 Using buffer caching with OfflineAudioContext (no user interaction required) {instrument: 'wurlitzer', totalSamplesToLoad: 36}
HarmonyPreloadStrategy.ts:712 🎹 [SAMPLES] Downloading harmony samples as AudioBuffers {timestamp: '2025-12-11T10:21:58.015Z', uniqueNotes: 26, instrument: 'wurlitzer', totalSamplesToLoad: 36, sampleMap: Array(26)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🎹 Pre-downloading harmony samples as AudioBuffers using smart sample map {uniqueNotes: 26, instrument: 'wurlitzer', totalSamplesToLoad: 36}
structured-logger.js:186 [INFO] [WamMetronomeNode] ⚠️ Samples not in IndexedDB, loading from Supabase... 
structured-logger.js:186 [INFO] [WamMetronomeNode] 🎵 Loading metronome samples from Supabase: 
structured-logger.js:186 [INFO] [WamMetronomeNode]   Regular click: metronome/Click_low2_fixed.mp3 
structured-logger.js:186 [INFO] [WamMetronomeNode]   Accent click: metronome/Click_high2_fixed.mp3 
structured-logger.js:186 [INFO] [WamMetronomeNode] 📥 Loading regular click from: https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/metronome/Click_low2_fixed.mp3 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/As1... 
structured-logger.js:186 [INFO] [WamDrummer] 📥 Loading sample from URL for pad 1 
structured-logger.js:186 [INFO] [WamMetronomeNode] 🎵 Regular click loaded: 0.23510204081632652s 
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store metronome-low to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for metronome-low: {success: false, error: DataCloneError: Failed to execute 'put' on 'IDBObjectStore': An ArrayBuffer is detached and could n…}
structured-logger.js:186 [INFO] [WamMetronomeNode] 📥 Loading accent click from: https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/metronome/Click_high2_fixed.mp3 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v2-As1: 76627 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/As1_v2.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-As1', instrument: 'wurlitzer', layer: 'v2', noteName: 'As1', bufferSizeKB: 75}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-As1 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-As1: {success: true, path: 'wurlitzer-v2-As1', size: 76627, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-As1
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - As1 v2: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v2-As1 {progress: '1/36', bufferSizeKB: 75, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-As1 cached (1/36) 
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/colombo-acoustic/kick-v1.wav to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/colombo-acoustic/kick-v1.wav: {success: false, error: DataCloneError: Failed to execute 'put' on 'IDBObjectStore': An ArrayBuffer is detached and could n…}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store drum-pad-1 to IndexedDB...
YouTubeWidgetPage.tsx:345 🎯 [YOUTUBE-WIDGET] Auto-selecting first exercise in parent (deferred 150ms): {exerciseId: ExerciseId, exerciseTitle: 'JOO', hasHarmonyNotes: true}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for drum-pad-1: {success: false, error: DataCloneError: Failed to execute 'put' on 'IDBObjectStore': An ArrayBuffer is detached and could n…}
structured-logger.js:186 [INFO] [WamDrummer] ✅ WamDrummer: Loaded sample for pad 1 
logger.ts:325 [global-controls] 📝 🔍 GlobalControls arePropsEqual check: {allEqual: true, selectedExerciseChanged: true, prevExerciseId: undefined, nextExerciseId: undefined, renderCount: 6}
structured-logger.js:186 [INFO] [WamMetronomeNode] 🎵 Accent click loaded: 0.23510204081632652s 
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store metronome-high to IndexedDB...
YouTubeWidgetPage.tsx:366 ✅ [YOUTUBE-WIDGET] Exercise set in widgetState
YouTubeWidgetPage.tsx:332 🔍 [YOUTUBE-WIDGET] Auto-selection effect triggered: {hasExercises: true, exerciseCount: 2, selectedExerciseId: ExerciseId, shouldAutoSelect: false}
logger.ts:325 [global-controls] 📝 🔍 GlobalControls arePropsEqual check: {allEqual: false, selectedExerciseChanged: true, prevExerciseId: undefined, nextExerciseId: ExerciseId, renderCount: 6}
useNotePositionMap.ts:108 [SHEETMUSIC] useNotePositionMap effect: {isReady: false, notesKeyChanged: true, hasPositionMap: false}
useNotePositionMap.ts:116 [SHEETMUSIC] OSMD not ready, clearing map
logger.ts:325 [global-controls] 📝 🎮 GlobalControls RENDER #8: {changedProps: Array(3), selectedExerciseId: ExerciseId, exerciseNotesLength: 19, timestamp: 1765448518086}
logger.ts:325 [global-controls] 📝 🎵 exerciseNotes reference changed {prevLength: 0, newLength: 19, sameContent: false, timestamp: 1765448518087}
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Exercise found, will proceed to load {exerciseId: ExerciseId, hasDrumPattern: true, drumPatternLength: 0, hasDrummerMidiUrl: false}
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Ready to load exercise: {selectedExerciseId: ExerciseId, lastLoadedId: null, isFirstLoad: true}
DrummerWidget.tsx:169 🥁 DrummerWidget received exercise: {id: ExerciseId, title: 'JOO', drummerMidiUrl: null, hasDrummerMidi: false, fullExercise: Exercise}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget state changed: {harmonyInstrumentProp: 'wurlitzer', currentInstrumentState: undefined, isPlaying: false, isVisible: true, hasExercise: true, …}
HarmonyWidget.tsx:322 🎹 [HARMONY-WIDGET] Exercise prop changed: {hasExercise: true, exerciseId: '6fd6faa0-6494-4022-85df-a61565f5e366', exerciseTitle: 'JOO', hasHarmonyNotes: true, harmonyNotesCount: 129, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Phase 2 effect check: {window: true, pluginClassLoaded: true, trackIsReady: true, audioServicesReady: true, wamPluginLoaded: false, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Attempting to create audio node... {trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Got context: AudioContext {baseLatency: 0.01, outputLatency: 0.04, onerror: null, sinkId: '', onsinkchange: null, …}
installHook.js:1 [WARN] [frontend:HarmonyWidget] 🎹 HarmonyWidget: No harmonyInstrument specified, waiting for exercise to load  Error Component Stack
    at HarmonyWidgetComponent (HarmonyWidget.tsx:94:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at _c8 (card.tsx:59:6)
    at div (<anonymous>)
    at _c (card.tsx:8:6)
    at FourWidgetsCard (FourWidgetsCard.tsx:18:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at YouTubeWidgetPageContent (YouTubeWidgetPage.tsx:54:3)
    at SyncProvider (SyncProvider.tsx:92:3)
    at TransportProvider (TransportContext.tsx:81:3)
    at YouTubeWidgetPage (YouTubeWidgetPage.tsx:879:3)
    at ErrorBoundary (page.tsx:17:5)
    at TutorialPage (page.tsx:65:40)
    at ClientPageRoot (client-page.js:14:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at QueryClientProvider (QueryClientProvider.js:27:11)
    at ReactQueryProvider (react-query.tsx:8:3)
    at AuthProvider (AuthProvider.tsx:20:32)
    at AuthProviderWrapper [Server] (<anonymous>)
    at AudioProvider (AudioProvider.tsx:93:33)
    at ErrorBoundary (ErrorBoundary.tsx:28:5)
    at body (<anonymous>)
    at html (<anonymous>)
    at RootLayout [Server] (<anonymous>)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at DevRootHTTPAccessFallbackBoundary (dev-root-http-access-fallback-boundary.js:33:11)
    at ReactDevOverlay (ReactDevOverlay.js:80:9)
    at HotReload (hot-reloader-client.js:379:11)
    at Router (app-router.js:183:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at AppRouter (app-router.js:563:11)
    at ServerRoot (app-index.js:145:46)
    at Root (app-index.js:165:11)
overrideMethod @ installHook.js:1
log @ structured-logger.js:183
warn @ structured-logger.js:220
HarmonyWidgetComponent.useCallback[createAudioNodeAttempt] @ HarmonyWidget.tsx:606
HarmonyWidgetComponent.useEffect @ HarmonyWidget.tsx:948
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Retry effect check: {audioServicesReady: true, trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true, shouldRetry: true}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Audio services ready, retrying plugin load... {audioServicesReady: true, trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true, hasPlugin: false}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Attempting to create audio node... {trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Got context: AudioContext {baseLatency: 0.01, outputLatency: 0.032, onerror: null, sinkId: '', onsinkchange: null, …}
installHook.js:1 [WARN] [frontend:HarmonyWidget] 🎹 HarmonyWidget: No harmonyInstrument specified, waiting for exercise to load  Error Component Stack
    at HarmonyWidgetComponent (HarmonyWidget.tsx:94:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at _c8 (card.tsx:59:6)
    at div (<anonymous>)
    at _c (card.tsx:8:6)
    at FourWidgetsCard (FourWidgetsCard.tsx:18:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at YouTubeWidgetPageContent (YouTubeWidgetPage.tsx:54:3)
    at SyncProvider (SyncProvider.tsx:92:3)
    at TransportProvider (TransportContext.tsx:81:3)
    at YouTubeWidgetPage (YouTubeWidgetPage.tsx:879:3)
    at ErrorBoundary (page.tsx:17:5)
    at TutorialPage (page.tsx:65:40)
    at ClientPageRoot (client-page.js:14:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at QueryClientProvider (QueryClientProvider.js:27:11)
    at ReactQueryProvider (react-query.tsx:8:3)
    at AuthProvider (AuthProvider.tsx:20:32)
    at AuthProviderWrapper [Server] (<anonymous>)
    at AudioProvider (AudioProvider.tsx:93:33)
    at ErrorBoundary (ErrorBoundary.tsx:28:5)
    at body (<anonymous>)
    at html (<anonymous>)
    at RootLayout [Server] (<anonymous>)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at DevRootHTTPAccessFallbackBoundary (dev-root-http-access-fallback-boundary.js:33:11)
    at ReactDevOverlay (ReactDevOverlay.js:80:9)
    at HotReload (hot-reloader-client.js:379:11)
    at Router (app-router.js:183:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at AppRouter (app-router.js:563:11)
    at ServerRoot (app-index.js:145:46)
    at Root (app-index.js:165:11)
overrideMethod @ installHook.js:1
log @ structured-logger.js:183
warn @ structured-logger.js:220
HarmonyWidgetComponent.useCallback[createAudioNodeAttempt] @ HarmonyWidget.tsx:606
HarmonyWidgetComponent.useEffect @ HarmonyWidget.tsx:1241
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered: {timestamp: 1765448518135, isPlaying: false, trackIsReady: true, wamPluginLoaded: false, hasPlugin: false, …}
HarmonyWidget.tsx:2325 🔥🔥🔥 [HARMONY-WIDGET] ALL CONDITIONS MET - Registering harmony buffers! {timestamp: 1765448518135, exerciseId: ExerciseId, harmonyNotesCount: 129, isPlaying: false, reason: 'exercise changed'}
HarmonyWidget.tsx:1478 🎹🎹🎹 [HARMONY-WIDGET] registerHarmonyWithPlaybackEngine CALLED {timestamp: '2025-12-11T10:21:58.136Z', callStack: Array(3)}
installHook.js:1 ⚠️ [HARMONY-WIDGET] No WAM plugin available - using Scheduler-only mode (buffers + PlaybackEngine) {hasPlugin: false, hasAudioNode: false, usingNewPlaybackEngine: true} Error Component Stack
    at HarmonyWidgetComponent (HarmonyWidget.tsx:94:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at _c8 (card.tsx:59:6)
    at div (<anonymous>)
    at _c (card.tsx:8:6)
    at FourWidgetsCard (FourWidgetsCard.tsx:18:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at YouTubeWidgetPageContent (YouTubeWidgetPage.tsx:54:3)
    at SyncProvider (SyncProvider.tsx:92:3)
    at TransportProvider (TransportContext.tsx:81:3)
    at YouTubeWidgetPage (YouTubeWidgetPage.tsx:879:3)
    at ErrorBoundary (page.tsx:17:5)
    at TutorialPage (page.tsx:65:40)
    at ClientPageRoot (client-page.js:14:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at QueryClientProvider (QueryClientProvider.js:27:11)
    at ReactQueryProvider (react-query.tsx:8:3)
    at AuthProvider (AuthProvider.tsx:20:32)
    at AuthProviderWrapper [Server] (<anonymous>)
    at AudioProvider (AudioProvider.tsx:93:33)
    at ErrorBoundary (ErrorBoundary.tsx:28:5)
    at body (<anonymous>)
    at html (<anonymous>)
    at RootLayout [Server] (<anonymous>)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at DevRootHTTPAccessFallbackBoundary (dev-root-http-access-fallback-boundary.js:33:11)
    at ReactDevOverlay (ReactDevOverlay.js:80:9)
    at HotReload (hot-reloader-client.js:379:11)
    at Router (app-router.js:183:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at AppRouter (app-router.js:563:11)
    at ServerRoot (app-index.js:145:46)
    at Root (app-index.js:165:11)
overrideMethod @ installHook.js:1
HarmonyWidgetComponent.useCallback[registerHarmonyWithPlaybackEngine] @ HarmonyWidget.tsx:1505
HarmonyWidgetComponent.useEffect @ HarmonyWidget.tsx:2339
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
HarmonyWidget.tsx:1525 ✅ [HARMONY-WIDGET] Exercise has harmony notes: 129
HarmonyWidget.tsx:1530 🎹 [HARMONY-WIDGET] Registering harmony with PlaybackEngine
HarmonyWidget.tsx:1539 ✅ [HARMONY-WIDGET] Core services available
HarmonyWidget.tsx:1546 ✅ [HARMONY-WIDGET] PlaybackEngine available
HarmonyWidget.tsx:1550 🔧 [HARMONY-WIDGET] Starting buffer injection...
installHook.js:1 [SHEETMUSIC] useNotePositionMap effect: {isReady: false, notesKeyChanged: true, hasPositionMap: false}
installHook.js:1 [SHEETMUSIC] OSMD not ready, clearing map
logger.ts:325 [global-controls] 📝 🔍 GlobalControls arePropsEqual check: {allEqual: true, selectedExerciseChanged: true, prevExerciseId: ExerciseId, nextExerciseId: ExerciseId, renderCount: 8}
installHook.js:1 [global-controls] 📝 🎯 GlobalControls RENDER #10 {selectedExerciseId: ExerciseId, duration: 500, is3DMode: false, coreServicesReady: true, timestamp: 1765448518180}
logger.ts:325 [global-controls] 📝 🎮 GlobalControls RENDER #10: {changedProps: Array(0), selectedExerciseId: ExerciseId, exerciseNotesLength: 19, timestamp: 1765448518184}
logger.ts:325 [global-controls] 📝 🎵 exerciseNotes reference changed {prevLength: 19, newLength: 19, sameContent: true, timestamp: 1765448518184}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget state changed: {harmonyInstrumentProp: 'wurlitzer', currentInstrumentState: 'wurlitzer', isPlaying: false, isVisible: true, hasExercise: true, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Phase 2 effect check: {window: true, pluginClassLoaded: true, trackIsReady: true, audioServicesReady: true, wamPluginLoaded: false, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Attempting to create audio node... {trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Got context: AudioContext {baseLatency: 0.01, outputLatency: 0.032, onerror: null, sinkId: '', onsinkchange: null, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Requesting WamKeyboard from PluginManager with instrument: wurlitzer
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] Loading WamKeyboardPlugin... 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Plugin creation already in progress or completed, skipping... 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Retry effect check: {audioServicesReady: true, trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true, shouldRetry: true}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Audio services ready, retrying plugin load... {audioServicesReady: true, trackIsReady: true, wamPluginLoaded: false, pluginClassLoaded: true, hasPlugin: false}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Plugin creation already in progress or completed, skipping... 
scheduler.development.js:14 [Violation] 'message' handler took 151ms
WamKeyboardPlugin.ts:146 [PLAYBACK-ENGINE][WamKeyboardPlugin] 🎹 Starting initialization...
WamKeyboardPlugin.ts:152 [PLAYBACK-ENGINE][WamKeyboardPlugin] AudioContext received: {state: 'running', sampleRate: 44100}
WamKeyboardPlugin.ts:161 [PLAYBACK-ENGINE][WamKeyboardPlugin] Creating WamKeyboard instance...
WamKeyboardPlugin.ts:165 [PLAYBACK-ENGINE][WamKeyboardPlugin] WamKeyboard instance created
WamKeyboardPlugin.ts:170 [PLAYBACK-ENGINE][WamKeyboardPlugin] Calling wamKeyboard.initialize()...
WamKeyboard.ts:1403 🔍🔍🔍 [CREATE-AUDIO-NODE] WamKeyboard.createAudioNode called with state: {hasState: true, instrument: undefined, skipInstrumentLoad: true, stateKeys: Array(1)}
WamKeyboard.ts:164 🔍🔍🔍 [CONSTRUCTOR] WamKeyboardNode constructor called {hasOptions: true, instrument: undefined, initialInstrument: undefined, optionsKeys: Array(1)}
WamKeyboard.ts:210 🔍🔍🔍 [INITIALIZE] WamKeyboardNode.initialize called {hasWindow: true, hasContext: true, initialInstrument: undefined, skipInstrumentLoad: true, willLoadInstrument: false}
HarmonyWidget.tsx:1555 ✅ [HARMONY-WIDGET] Got GlobalSampleCache instance
HarmonyWidget.tsx:1562 🎹 [HARMONY-WIDGET] Exercise instrument detection: {exerciseId: ExerciseId, exerciseTitle: 'JOO', harmonyInstrument: 'wurlitzer', harmonyInstrumentType: 'string', harmonyInstrumentIsDefined: true, …}
HarmonyWidget.tsx:1571 🎹 [HARMONY-WIDGET] Looking for instrument-specific buffers: wurlitzer
installHook.js:1 ⚠️ [HARMONY-WIDGET] Insufficient samples for exercise, skipping registration {exerciseId: ExerciseId, exerciseTitle: 'JOO', requiredNotes: 26, cachedNotes: 1, coveragePercentage: '3.8%', …}
overrideMethod @ installHook.js:1
HarmonyWidgetComponent.useCallback[registerHarmonyWithPlaybackEngine] @ HarmonyWidget.tsx:1650
await in HarmonyWidgetComponent.useCallback[registerHarmonyWithPlaybackEngine]
HarmonyWidgetComponent.useEffect @ HarmonyWidget.tsx:2339
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
performWorkUntilDeadline @ scheduler.development.js:44
TransportAdapter.ts:256 🎯 [COUNTDOWN FIX] TransportAdapter.setCountdownBeats() called {beats: 0, timestamp: 1765448518259, stack: '    at GlobalControlsComponent.useEffect.loadExerc…WidgetPage/components/GlobalControls.tsx:1200:50)'}
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Reset countdown beats to 0 for new exercise 
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Reset transport position to 0:0:0 for new exercise 
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Exercise MIDI data availability: {exerciseId: ExerciseId, title: 'JOO', has_midi_file_path: false, midi_file_path: 'none', has_midiFileUrl: false, …}
logger.ts:325 [global-controls] 📝 ✅ [loadExercise] Musical truth established: {bpm: 69, timeSignature: {…}, durationBars: 8, countdownBars: 1, totalBars: 9}
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Loading per-widget MIDI files from Supabase URLs 
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Bassline MIDI detected but bass track not yet implemented 
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Harmony MIDI detected but harmony track not yet implemented 
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: No MIDI data, using structured patterns 
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Creating metronome pattern: {timeSignature: {…}, totalBars: 8, beatsPerBar: 4, totalBeats: 32, exerciseBpm: 69}
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Added metronome pattern with 32
logger.ts:325 [global-controls] 📝 🎮 GlobalControls: Checking drum pattern conditions: {drumInitialized: true, hasTrack: true, drumPatternEnabled: undefined, willLoadDrums: undefined}
installHook.js:1 🔍 DRUM REGIONS CHECK: {midiLoaded: false, hasDrumPattern: false, willSkip: false, message: '⚠️ NO MIDI - will add pattern-based fallback'}
overrideMethod @ installHook.js:1
error @ intercept-console-error.js:51
GlobalControlsComponent.useEffect.loadExercise @ GlobalControls.tsx:2032
await in GlobalControlsComponent.useEffect.loadExercise
GlobalControlsComponent.useEffect @ GlobalControls.tsx:2240
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
performSyncWorkOnRoot @ react-dom-client.development.js:15967
flushSyncWorkAcrossRoots_impl @ react-dom-client.development.js:15830
commitRootImpl @ react-dom-client.development.js:15422
commitRoot @ react-dom-client.development.js:15273
commitRootWhenReady @ react-dom-client.development.js:14584
performWorkOnRoot @ react-dom-client.development.js:14505
performWorkOnRootViaSchedulerTask @ react-dom-client.development.js:15955
performWorkUntilDeadline @ scheduler.development.js:44
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for metronome-high: {success: false, error: DataCloneError: Failed to execute 'put' on 'IDBObjectStore': An ArrayBuffer is detached and could n…}
structured-logger.js:186 [INFO] [WamMetronomeNode] ✅ Metronome ready with Supabase sample 
structured-logger.js:186 [INFO] [WamMetronomeNode] 🎵 WamMetronomeNode: Using shared AudioContext, not switching Tone.js 
structured-logger.js:186 [INFO] [WamMetronomeNode] ✅ Using preloaded metronome samples from memory cache! 
logger.ts:325 [InstrumentRegistry] 📝 Registered active metronome instrument 
logger.ts:325 [AudioEventRouter] 📝 Instrument registered: metronome 
logger.ts:325 [AudioEventRouter] 📝 Updated metronome instrument from registry 
structured-logger.js:186 [INFO] [WamMetronomeNode] ✅ Using preloaded metronome samples from memory cache! 
logger.ts:325 [PlaybackEngine] 📝 Track registered: metronome-track {instrumentType: 'metronome', regionsCount: 1}
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/As1... 
logger.ts:325 [global-controls] 📝 🔍 GlobalControls arePropsEqual check: {allEqual: true, selectedExerciseChanged: true, prevExerciseId: ExerciseId, nextExerciseId: ExerciseId, renderCount: 10}
useNotePositionMap.ts:108 [SHEETMUSIC] useNotePositionMap effect: {isReady: true, notesKeyChanged: true, hasPositionMap: false}
useNotePositionMap.ts:124 [SHEETMUSIC] Scheduling map rebuild in 100ms
logger.ts:325 [global-controls] 📝 🎵 exerciseNotes reference changed {prevLength: 19, newLength: 19, sameContent: true, timestamp: 1765448518289}
logger.ts:325 [metronome-widget] 📝 🎵 MetronomeWidget: BPM changed {bpm: 69, transportTempo: 69, hasPlugin: true}
logger.ts:325 [metronome-widget] 📝 🎵 MetronomeWidget: Called plugin.setTempo {bpm: 69}
structured-logger.js:186 [INFO] [InstrumentDependencyManager] 🎵 Loading Tone.js for first time... 
structured-logger.js:186 [INFO] [InstrumentDependencyManager] 🎵 Found Tone.js at window.__globalTone 
structured-logger.js:186 [INFO] [InstrumentDependencyManager] ✅ Tone.js loaded successfully in 0.10ms 
WamKeyboard.ts:275 🔍🔍🔍 [INITIALIZE] Skipping instrument load - will use cached buffers later
WamKeyboardPlugin.ts:174 [PLAYBACK-ENGINE][WamKeyboardPlugin] wamKeyboard.initialize() completed
WamKeyboardPlugin.ts:182 [PLAYBACK-ENGINE][WamKeyboardPlugin] ✅ Initialization complete {hasWamKeyboard: true, hasAudioNode: true, contextState: 'running', state: 'inactive'}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] Activating WamKeyboardPlugin... 
WamKeyboard.ts:337 🎹 [LOAD-INSTRUMENT] Loading grandpiano {hasSampler: false, currentInstrument: null, totalSamplers: 0, samplerNames: Array(0)}
WamKeyboard.ts:601 🔌 [DISCONNECT-ALL] Starting disconnection {totalSamplers: 0, samplerNames: Array(0), currentInstrument: null, activeSampler: 'null'}
WamKeyboard.ts:662 🔌 [DISCONNECT-ALL] Disconnection complete
WamKeyboard.ts:318 [tryBuildFromCache] Skipping cache build, will use VelocitySampler initialize path
WamKeyboard.ts:382 ⚠️ [LOAD-INSTRUMENT] No cached buffers for grandpiano, fetching from network...
WamKeyboard.ts:512 🎹 [LOAD-INSTRUMENT] Creating Grand Piano sampler
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 GrandPianoVelocitySampler: Preferred AudioContext set 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Loaded Grand Piano configuration {name: 'Grand Piano', version: '1.0.0', velocityLayers: 7, samples: 30}
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Initializing Grand Piano {smartLoading: false, notesCount: 'all', layers: 'default', preloadedSamples: 0, expectedSamples: 90}
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 GrandPiano: Loading Tone.js independently... 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 GrandPiano: Tone.js loaded successfully 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ EQ configured (flat) {low: 0, mid: 0, high: 0}
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Loading initial velocity layers {layers: Array(3), smartLoading: false, notesToLoad: 'all'}
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Loading Grand Piano layer v3 {requiredNotes: 'all'}
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Loading 30 samples for layer v3 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🔍 Sample URLs for layer (first 3): {layer: 'v3', urls: Array(3)}
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Loading Grand Piano layer v4 {requiredNotes: 'all'}
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Loading 30 samples for layer v4 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🔍 Sample URLs for layer (first 3): {layer: 'v4', urls: Array(3)}
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Loading Grand Piano layer v5 {requiredNotes: 'all'}
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Loading 30 samples for layer v5 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🔍 Sample URLs for layer (first 3): {layer: 'v5', urls: Array(3)}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered: {timestamp: 1765448518353, isPlaying: false, trackIsReady: true, wamPluginLoaded: false, hasPlugin: false, …}
HarmonyWidget.tsx:2325 🔥🔥🔥 [HARMONY-WIDGET] ALL CONDITIONS MET - Registering harmony buffers! {timestamp: 1765448518353, exerciseId: ExerciseId, harmonyNotesCount: 129, isPlaying: false, reason: 'exercise changed'}
HarmonyWidget.tsx:1478 🎹🎹🎹 [HARMONY-WIDGET] registerHarmonyWithPlaybackEngine CALLED {timestamp: '2025-12-11T10:21:58.354Z', callStack: Array(3)}
installHook.js:1 ⚠️ [HARMONY-WIDGET] No WAM plugin available - using Scheduler-only mode (buffers + PlaybackEngine) {hasPlugin: false, hasAudioNode: false, usingNewPlaybackEngine: true} Error Component Stack
    at HarmonyWidgetComponent (HarmonyWidget.tsx:94:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at _c8 (card.tsx:59:6)
    at div (<anonymous>)
    at _c (card.tsx:8:6)
    at FourWidgetsCard (FourWidgetsCard.tsx:18:3)
    at div (<anonymous>)
    at div (<anonymous>)
    at div (<anonymous>)
    at YouTubeWidgetPageContent (YouTubeWidgetPage.tsx:54:3)
    at SyncProvider (SyncProvider.tsx:92:3)
    at TransportProvider (TransportContext.tsx:81:3)
    at YouTubeWidgetPage (YouTubeWidgetPage.tsx:879:3)
    at ErrorBoundary (page.tsx:17:5)
    at TutorialPage (page.tsx:65:40)
    at ClientPageRoot (client-page.js:14:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at InnerLayoutRouter (layout-router.js:231:11)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at LoadingBoundary (layout-router.js:328:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at InnerScrollAndFocusHandler (layout-router.js:139:9)
    at ScrollAndFocusHandler (layout-router.js:216:11)
    at RenderFromTemplateContext (render-from-template-context.js:16:44)
    at OuterLayoutRouter (layout-router.js:365:11)
    at QueryClientProvider (QueryClientProvider.js:27:11)
    at ReactQueryProvider (react-query.tsx:8:3)
    at AuthProvider (AuthProvider.tsx:20:32)
    at AuthProviderWrapper [Server] (<anonymous>)
    at AudioProvider (AudioProvider.tsx:93:33)
    at ErrorBoundary (ErrorBoundary.tsx:28:5)
    at body (<anonymous>)
    at html (<anonymous>)
    at RootLayout [Server] (<anonymous>)
    at RedirectErrorBoundary (redirect-boundary.js:75:9)
    at RedirectBoundary (redirect-boundary.js:83:11)
    at HTTPAccessFallbackErrorBoundary (error-boundary.js:90:9)
    at HTTPAccessFallbackBoundary (error-boundary.js:98:11)
    at DevRootHTTPAccessFallbackBoundary (dev-root-http-access-fallback-boundary.js:33:11)
    at ReactDevOverlay (ReactDevOverlay.js:80:9)
    at HotReload (hot-reloader-client.js:379:11)
    at Router (app-router.js:183:11)
    at ErrorBoundaryHandler (error-boundary.js:120:9)
    at ErrorBoundary (error-boundary.js:166:11)
    at AppRouter (app-router.js:563:11)
    at ServerRoot (app-index.js:145:46)
    at Root (app-index.js:165:11)
overrideMethod @ installHook.js:1
HarmonyWidgetComponent.useCallback[registerHarmonyWithPlaybackEngine] @ HarmonyWidget.tsx:1505
HarmonyWidgetComponent.useEffect @ HarmonyWidget.tsx:2339
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
eval @ react-dom-client.development.js:15347
performWorkUntilDeadline @ scheduler.development.js:44
HarmonyWidget.tsx:1525 ✅ [HARMONY-WIDGET] Exercise has harmony notes: 129
HarmonyWidget.tsx:1530 🎹 [HARMONY-WIDGET] Registering harmony with PlaybackEngine
HarmonyWidget.tsx:1539 ✅ [HARMONY-WIDGET] Core services available
HarmonyWidget.tsx:1546 ✅ [HARMONY-WIDGET] PlaybackEngine available
HarmonyWidget.tsx:1550 🔧 [HARMONY-WIDGET] Starting buffer injection...
HarmonyWidget.tsx:1555 ✅ [HARMONY-WIDGET] Got GlobalSampleCache instance
HarmonyWidget.tsx:1562 🎹 [HARMONY-WIDGET] Exercise instrument detection: {exerciseId: ExerciseId, exerciseTitle: 'JOO', harmonyInstrument: 'wurlitzer', harmonyInstrumentType: 'string', harmonyInstrumentIsDefined: true, …}
HarmonyWidget.tsx:1571 🎹 [HARMONY-WIDGET] Looking for instrument-specific buffers: wurlitzer
installHook.js:1 ⚠️ [HARMONY-WIDGET] Insufficient samples for exercise, skipping registration {exerciseId: ExerciseId, exerciseTitle: 'JOO', requiredNotes: 26, cachedNotes: 1, coveragePercentage: '3.8%', …}
overrideMethod @ installHook.js:1
HarmonyWidgetComponent.useCallback[registerHarmonyWithPlaybackEngine] @ HarmonyWidget.tsx:1650
await in HarmonyWidgetComponent.useCallback[registerHarmonyWithPlaybackEngine]
HarmonyWidgetComponent.useEffect @ HarmonyWidget.tsx:2339
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
eval @ react-dom-client.development.js:15347
performWorkUntilDeadline @ scheduler.development.js:44
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-As1: 84035 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/As1_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-As1', instrument: 'wurlitzer', layer: 'v3', noteName: 'As1', bufferSizeKB: 82}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-As1 to IndexedDB...
useNotePositionMap.ts:72 [SHEETMUSIC] rebuildMap called, osmdRef.current: true
positionMapBuilder.ts:79 [SHEETMUSIC] buildPositionMapFromOSMD: {hasGraphic: true, hasMeasureList: true, measureListLength: 8}
useNotePositionMap.ts:86 [SHEETMUSIC] Position map built: {isValid: true, totalWidth: 119.82248687999997, measureCount: 8, measures: Array(8)}
structured-logger.js:186 [INFO] [WamDrummer] 📥 Loading sample from URL for pad 3 
useNotePositionMap.ts:108 [SHEETMUSIC] useNotePositionMap effect: {isReady: true, notesKeyChanged: false, hasPositionMap: true}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-As1: {success: true, path: 'wurlitzer-v3-As1', size: 84035, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-As1
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - As1 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-As1 {progress: '2/36', bufferSizeKB: 82, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-As1 cached (2/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v4/Cs3... 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Sampler loaded successfully 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Loaded Grand Piano layer v3 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Sampler loaded successfully 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Loaded Grand Piano layer v4 
use-user-profile.ts:60 📥 Profile API response: {success: true, hasData: true, message: 'Profile fetched successfully', profileStringCount: 5}
logger.ts:325 [global-controls] 📝 🔍 GlobalControls arePropsEqual check: {allEqual: true, selectedExerciseChanged: true, prevExerciseId: ExerciseId, nextExerciseId: ExerciseId, renderCount: 12}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/colombo-acoustic/snare-v1.wav to IndexedDB...
logger.ts:325 [global-controls] 📝 🔍 GlobalControls arePropsEqual check: {allEqual: true, selectedExerciseChanged: true, prevExerciseId: ExerciseId, nextExerciseId: ExerciseId, renderCount: 12}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/colombo-acoustic/snare-v1.wav: {success: false, error: DataCloneError: Failed to execute 'put' on 'IDBObjectStore': An ArrayBuffer is detached and could n…}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store drum-pad-3 to IndexedDB...
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Sampler loaded successfully 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Loaded Grand Piano layer v5 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Layer v3 loaded 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Layer v4 loaded 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Layer v5 loaded 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] ✅ Grand Piano ready! {loadedLayers: Array(3), destination: true, eq: true}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for drum-pad-3: {success: false, error: DataCloneError: Failed to execute 'put' on 'IDBObjectStore': An ArrayBuffer is detached and could n…}
structured-logger.js:186 [INFO] [WamDrummer] ✅ WamDrummer: Loaded sample for pad 3 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v4-Cs3: 68579 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v4/Cs3_v4.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v4-Cs3', instrument: 'wurlitzer', layer: 'v4', noteName: 'Cs3', bufferSizeKB: 67}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v4-Cs3 to IndexedDB...
structured-logger.js:186 [INFO] [WamDrummer] 📥 Loading sample from URL for pad 5 
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v4-Cs3: {success: true, path: 'wurlitzer-v4-Cs3', size: 68579, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v4-Cs3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - Cs3 v4: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v4-Cs3 {progress: '3/36', bufferSizeKB: 67, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Cs3 cached (3/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/Gs2... 
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/colombo-acoustic/hihat-v1.wav to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/colombo-acoustic/hihat-v1.wav: {success: false, error: DataCloneError: Failed to execute 'put' on 'IDBObjectStore': An ArrayBuffer is detached and could n…}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store drum-pad-5 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for drum-pad-5: {success: false, error: DataCloneError: Failed to execute 'put' on 'IDBObjectStore': An ArrayBuffer is detached and could n…}
structured-logger.js:186 [INFO] [WamDrummer] ✅ WamDrummer: Loaded sample for pad 5 
structured-logger.js:186 [INFO] [WamDrummer] ✅ WamDrummer: Default kit loaded 
logger.ts:325 [InstrumentRegistry] 📝 Registered active drums instrument 
logger.ts:325 [AudioEventRouter] 📝 Instrument registered: drums 
logger.ts:325 [AudioEventRouter] 📝 Updated drums instrument from registry 
logger.ts:325 [PlaybackEngine] 📝 Track registered: drummer-widget-track {instrumentType: 'drums', regionsCount: 1}
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-Gs2: 68177 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/Gs2_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-Gs2', instrument: 'wurlitzer', layer: 'v3', noteName: 'Gs2', bufferSizeKB: 67}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-Gs2 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-Gs2: {success: true, path: 'wurlitzer-v3-Gs2', size: 68177, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-Gs2
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - Gs2 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-Gs2 {progress: '4/36', bufferSizeKB: 67, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Gs2 cached (4/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v4/Gs2... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v4-Gs2: 71043 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v4/Gs2_v4.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v4-Gs2', instrument: 'wurlitzer', layer: 'v4', noteName: 'Gs2', bufferSizeKB: 69}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v4-Gs2 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v4-Gs2: {success: true, path: 'wurlitzer-v4-Gs2', size: 71043, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v4-Gs2
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - Gs2 v4: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v4-Gs2 {progress: '5/36', bufferSizeKB: 69, aliases: Array(2)}
HarmonyPreloadStrategy.ts:971 [SAMPLES][Progress] 5/36 samples loaded (14%)
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Gs2 cached (5/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/C3... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v2-C3: 58483 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/C3_v2.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-C3', instrument: 'wurlitzer', layer: 'v2', noteName: 'C3', bufferSizeKB: 57}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-C3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-C3: {success: true, path: 'wurlitzer-v2-C3', size: 58483, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-C3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - C3 v2: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v2-C3 {progress: '6/36', bufferSizeKB: 57, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-C3 cached (6/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/C3... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-C3: 63083 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/C3_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-C3', instrument: 'wurlitzer', layer: 'v3', noteName: 'C3', bufferSizeKB: 62}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-C3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-C3: {success: true, path: 'wurlitzer-v3-C3', size: 63083, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-C3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - C3 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-C3 {progress: '7/36', bufferSizeKB: 62, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-C3 cached (7/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/Gs3... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-Gs3: 53021 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/Gs3_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-Gs3', instrument: 'wurlitzer', layer: 'v3', noteName: 'Gs3', bufferSizeKB: 52}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-Gs3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-Gs3: {success: true, path: 'wurlitzer-v3-Gs3', size: 53021, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-Gs3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - Gs3 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-Gs3 {progress: '8/36', bufferSizeKB: 52, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Gs3 cached (8/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v4/Gs3... 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Ensuring all samplers are ready... 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Layer v3 ready 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Layer v4 ready 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 Layer v5 ready 
structured-logger.js:186 [INFO] [GrandPianoVelocitySampler] 🎹 All samplers checked and ready! 
WamKeyboard.ts:520 ✅ [LOAD-INSTRUMENT] Grand Piano initialized
WamKeyboard.ts:523 ✅ [LOAD-INSTRUMENT] Grand Piano connected to gain node (after init)
WamKeyboard.ts:669 🔄 [SWITCH-INSTRUMENT] switchToInstrument called {requestedInstrument: 'grandpiano', currentInstrument: null, hasCurrentSampler: false, isAlreadyActive: false, hasGainNode: true, …}
WamKeyboard.ts:601 🔌 [DISCONNECT-ALL] Starting disconnection {totalSamplers: 1, samplerNames: Array(1), currentInstrument: null, activeSampler: 'null'}
WamKeyboard.ts:614 🔌 [DISCONNECT-ALL] Attempting to disconnect grandpiano {hasDisconnect: true, hasOutput: false, hasReleaseAll: true}
WamKeyboard.ts:629 🔇 [DISCONNECT-ALL] Released all notes for grandpiano
WamKeyboard.ts:637 ✅ [DISCONNECT-ALL] Successfully disconnected grandpiano
WamKeyboard.ts:662 🔌 [DISCONNECT-ALL] Disconnection complete
WamKeyboard.ts:707 🔗 [SWITCH-INSTRUMENT] Connecting sampler to gain node {instrument: 'grandpiano', samplerType: 'GrandPianoVelocitySampler', hasConnect: true, hasOutput: false}
WamKeyboard.ts:726 ✅ [SWITCH-INSTRUMENT] Connected grandpiano sampler to gain node (direct connect)
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Got WamKeyboard from PluginManager: WamKeyboard {initialized: true, moduleId: 'com.bassnotion.keyboard', descriptor: {…}, audioContext: AudioContext, instanceId: 'com.bassnotion.keyboard-1765448518257', …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Got audio node from plugin: WamKeyboardNode {module: WamKeyboard, gainNode: GainNode, currentInstrument: 'grandpiano', samplers: Map(1), activeSampler: GrandPianoVelocitySampler, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Connected to audio destination 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Gain node value: 0.800000011920929
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Checking loaded instrument vs desired {loadedInstrument: 'grandpiano', desiredInstrument: 'wurlitzer', currentInstrumentState: 'wurlitzer', harmonyInstrumentProp: 'wurlitzer', needsReload: true}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Loading desired instrument (mismatch detected)... {from: 'grandpiano', to: 'wurlitzer'}
WamKeyboard.ts:337 🎹 [LOAD-INSTRUMENT] Loading wurlitzer {hasSampler: false, currentInstrument: 'grandpiano', totalSamplers: 1, samplerNames: Array(1)}
WamKeyboard.ts:601 🔌 [DISCONNECT-ALL] Starting disconnection {totalSamplers: 1, samplerNames: Array(1), currentInstrument: 'grandpiano', activeSampler: 'exists'}
WamKeyboard.ts:614 🔌 [DISCONNECT-ALL] Attempting to disconnect grandpiano {hasDisconnect: true, hasOutput: false, hasReleaseAll: true}
WamKeyboard.ts:629 🔇 [DISCONNECT-ALL] Released all notes for grandpiano
WamKeyboard.ts:637 ✅ [DISCONNECT-ALL] Successfully disconnected grandpiano
WamKeyboard.ts:662 🔌 [DISCONNECT-ALL] Disconnection complete
WamKeyboard.ts:318 [tryBuildFromCache] Skipping cache build, will use VelocitySampler initialize path
WamKeyboard.ts:382 ⚠️ [LOAD-INSTRUMENT] No cached buffers for wurlitzer, fetching from network...
WamKeyboard.ts:550 🎹 [LOAD-INSTRUMENT] Creating Wurlitzer sampler
WurlitzerVelocitySampler.ts:88 [WURLITZER CONSTRUCTOR] {instanceId: 'WV1765448518888-8pv9n'}
WurlitzerVelocitySampler.ts:98 [WURLITZER SET-CONTEXT] {instanceId: 'WV1765448518888-8pv9n', hasContext: true, contextSampleRate: 44100, contextState: 'running'}
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 WurlitzerVelocitySampler: Preferred AudioContext set 
structured-logger.js:186 [INFO] [SampleMappingLoader] Loaded instrument config: Wurlitzer Electric Piano v2.0.0 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Loaded Wurlitzer configuration {name: 'Wurlitzer Electric Piano', version: '2.0.0', velocityRanges: 5, samples: 64}
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Initializing Wurlitzer {smartLoading: false, notesCount: 'all', layers: 'default', preloadedSamples: 0, expectedSamples: 128}
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎵 Wurlitzer: Loading Tone.js independently... 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎵 Wurlitzer: Tone.js loaded successfully 
WurlitzerVelocitySampler.ts:171 [WURLITZER CONTEXT DIAGNOSTIC] {instanceId: 'WV1765448518888-8pv9n', hasPreferredContext: true, preferredContextState: 'running', preferredContextSampleRate: 44100, hasPersistentContext: false, …}
WurlitzerVelocitySampler.ts:187 [WURLITZER CONTEXT SELECTED] {selectedContextSampleRate: 44100, sameAsPreferred: true, sameAsPersistent: false, sameAsTone: false}
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Loading initial velocity layers {layers: Array(2), smartLoading: false, notesToLoad: 'all'}
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Loading Wurlitzer layer v2 {requiredNotes: 'all'}
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Loading 64 samples for layer v2 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🔍 Sample URLs for layer (first 3): {layer: 'v2', urls: Array(3)}
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Loading Wurlitzer layer v3 {requiredNotes: 'all'}
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Loading 64 samples for layer v3 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🔍 Sample URLs for layer (first 3): {layer: 'v3', urls: Array(3)}
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] ✅ Sampler loaded successfully 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] ✅ Loaded Wurlitzer layer v2 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v4-Gs3: 49477 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v4/Gs3_v4.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v4-Gs3', instrument: 'wurlitzer', layer: 'v4', noteName: 'Gs3', bufferSizeKB: 48}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v4-Gs3 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v4-Gs3: {success: true, path: 'wurlitzer-v4-Gs3', size: 49477, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v4-Gs3
 [DEBUG][NoAlias] wurlitzer - Gs3 v4: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v4-Gs3 {progress: '9/36', bufferSizeKB: 48, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Gs3 cached (9/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/Gs3... 
 🔍 [DOWNLOAD] wurlitzer-v2-Gs3: 51442 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/Gs3_v2.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-Gs3', instrument: 'wurlitzer', layer: 'v2', noteName: 'Gs3', bufferSizeKB: 50}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-Gs3 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-Gs3: {success: true, path: 'wurlitzer-v2-Gs3', size: 51442, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-Gs3
 [DEBUG][NoAlias] wurlitzer - Gs3 v2: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v2-Gs3 {progress: '10/36', bufferSizeKB: 50, aliases: Array(2)}
 [SAMPLES][Progress] 10/36 samples loaded (28%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Gs3 cached (10/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/Ds3... 
 🔍 [DOWNLOAD] wurlitzer-v3-Ds3: 61530 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/Ds3_v3.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-Ds3', instrument: 'wurlitzer', layer: 'v3', noteName: 'Ds3', bufferSizeKB: 60}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-Ds3 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-Ds3: {success: true, path: 'wurlitzer-v3-Ds3', size: 61530, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-Ds3
 [DEBUG][NoAlias] wurlitzer - Ds3 v3: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v3-Ds3 {progress: '11/36', bufferSizeKB: 60, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Ds3 cached (11/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/Ds3... 
 🔍 [DOWNLOAD] wurlitzer-v2-Ds3: 56118 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/Ds3_v2.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-Ds3', instrument: 'wurlitzer', layer: 'v2', noteName: 'Ds3', bufferSizeKB: 55}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-Ds3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-Ds3: {success: true, path: 'wurlitzer-v2-Ds3', size: 56118, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-Ds3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - Ds3 v2: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v2-Ds3 {progress: '12/36', bufferSizeKB: 55, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Ds3 cached (12/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/F2... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-F2: 78833 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/F2_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-F2', instrument: 'wurlitzer', layer: 'v3', noteName: 'F2', bufferSizeKB: 77}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-F2 to IndexedDB...
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] ✅ Sampler loaded successfully 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] ✅ Loaded Wurlitzer layer v3 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] ✅ Layer v2 loaded 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] ✅ Layer v3 loaded 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] ✅ Wurlitzer ready! {loadedLayers: Array(2), destination: true, tremolo: false}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-F2: {success: true, path: 'wurlitzer-v3-F2', size: 78833, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-F2
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - F2 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-F2 {progress: '13/36', bufferSizeKB: 77, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-F2 cached (13/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/G3... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-G3: 50420 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/G3_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-G3', instrument: 'wurlitzer', layer: 'v3', noteName: 'G3', bufferSizeKB: 49}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-G3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-G3: {success: true, path: 'wurlitzer-v3-G3', size: 50420, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-G3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - G3 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-G3 {progress: '14/36', bufferSizeKB: 49, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-G3 cached (14/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v4/G3... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v4-G3: 46269 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v4/G3_v4.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v4-G3', instrument: 'wurlitzer', layer: 'v4', noteName: 'G3', bufferSizeKB: 45}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v4-G3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v4-G3: {success: true, path: 'wurlitzer-v4-G3', size: 46269, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v4-G3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - G3 v4: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v4-G3 {progress: '15/36', bufferSizeKB: 45, aliases: Array(2)}
HarmonyPreloadStrategy.ts:971 [SAMPLES][Progress] 15/36 samples loaded (42%)
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-G3 cached (15/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/As3... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-As3: 51259 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/As3_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-As3', instrument: 'wurlitzer', layer: 'v3', noteName: 'As3', bufferSizeKB: 50}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-As3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-As3: {success: true, path: 'wurlitzer-v3-As3', size: 51259, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-As3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - As3 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-As3 {progress: '16/36', bufferSizeKB: 50, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-As3 cached (16/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/Fs2... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v2-Fs2: 71410 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/Fs2_v2.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-Fs2', instrument: 'wurlitzer', layer: 'v2', noteName: 'Fs2', bufferSizeKB: 70}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-Fs2 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-Fs2: {success: true, path: 'wurlitzer-v2-Fs2', size: 71410, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-Fs2
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - Fs2 v2: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v2-Fs2 {progress: '17/36', bufferSizeKB: 70, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Fs2 cached (17/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/F3... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-F3: 51104 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/F3_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-F3', instrument: 'wurlitzer', layer: 'v3', noteName: 'F3', bufferSizeKB: 50}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-F3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-F3: {success: true, path: 'wurlitzer-v3-F3', size: 51104, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-F3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - F3 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-F3 {progress: '18/36', bufferSizeKB: 50, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-F3 cached (18/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/D2... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-D2: 72093 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/D2_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-D2', instrument: 'wurlitzer', layer: 'v3', noteName: 'D2', bufferSizeKB: 70}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-D2 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-D2: {success: true, path: 'wurlitzer-v3-D2', size: 72093, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-D2
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - D2 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-D2 {progress: '19/36', bufferSizeKB: 70, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-D2 cached (19/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/Ds2... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v2-Ds2: 68661 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/Ds2_v2.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-Ds2', instrument: 'wurlitzer', layer: 'v2', noteName: 'Ds2', bufferSizeKB: 67}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-Ds2 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-Ds2: {success: true, path: 'wurlitzer-v2-Ds2', size: 68661, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-Ds2
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - Ds2 v2: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v2-Ds2 {progress: '20/36', bufferSizeKB: 67, aliases: Array(2)}
HarmonyPreloadStrategy.ts:971 [SAMPLES][Progress] 20/36 samples loaded (56%)
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Ds2 cached (20/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/As2... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-As2: 67629 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/As2_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-As2', instrument: 'wurlitzer', layer: 'v3', noteName: 'As2', bufferSizeKB: 66}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-As2 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-As2: {success: true, path: 'wurlitzer-v3-As2', size: 67629, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-As2
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - As2 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-As2 {progress: '21/36', bufferSizeKB: 66, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-As2 cached (21/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/C4... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-C4: 55563 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/C4_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-C4', instrument: 'wurlitzer', layer: 'v3', noteName: 'C4', bufferSizeKB: 54}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-C4 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-C4: {success: true, path: 'wurlitzer-v3-C4', size: 55563, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-C4
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - C4 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-C4 {progress: '22/36', bufferSizeKB: 54, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-C4 cached (22/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/E2... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v2-E2: 69084 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/E2_v2.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-E2', instrument: 'wurlitzer', layer: 'v2', noteName: 'E2', bufferSizeKB: 67}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-E2 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-E2: {success: true, path: 'wurlitzer-v2-E2', size: 69084, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-E2
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - E2 v2: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v2-E2 {progress: '23/36', bufferSizeKB: 67, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-E2 cached (23/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/E2... 
 🔍 [DOWNLOAD] wurlitzer-v3-E2: 72248 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/E2_v3.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-E2', instrument: 'wurlitzer', layer: 'v3', noteName: 'E2', bufferSizeKB: 71}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-E2 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-E2: {success: true, path: 'wurlitzer-v3-E2', size: 72248, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-E2
 [DEBUG][NoAlias] wurlitzer - E2 v3: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v3-E2 {progress: '24/36', bufferSizeKB: 71, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-E2 cached (24/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/E3... 
 🔍 [DOWNLOAD] wurlitzer-v3-E3: 62566 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/E3_v3.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-E3', instrument: 'wurlitzer', layer: 'v3', noteName: 'E3', bufferSizeKB: 61}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-E3 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-E3: {success: true, path: 'wurlitzer-v3-E3', size: 62566, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-E3
 [DEBUG][NoAlias] wurlitzer - E3 v3: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v3-E3 {progress: '25/36', bufferSizeKB: 61, aliases: Array(2)}
 [SAMPLES][Progress] 25/36 samples loaded (69%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-E3 cached (25/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/G2... 
 🔍 [DOWNLOAD] wurlitzer-v3-G2: 73640 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/G2_v3.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-G2', instrument: 'wurlitzer', layer: 'v3', noteName: 'G2', bufferSizeKB: 72}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-G2 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-G2: {success: true, path: 'wurlitzer-v3-G2', size: 73640, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-G2
 [DEBUG][NoAlias] wurlitzer - G2 v3: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v3-G2 {progress: '26/36', bufferSizeKB: 72, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-G2 cached (26/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/Cs2... 
 🔍 [DOWNLOAD] wurlitzer-v2-Cs2: 68415 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/Cs2_v2.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-Cs2', instrument: 'wurlitzer', layer: 'v2', noteName: 'Cs2', bufferSizeKB: 67}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-Cs2 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-Cs2: {success: true, path: 'wurlitzer-v2-Cs2', size: 68415, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-Cs2
 [DEBUG][NoAlias] wurlitzer - Cs2 v2: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v2-Cs2 {progress: '27/36', bufferSizeKB: 67, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Cs2 cached (27/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/C2... 
 🔍 [DOWNLOAD] wurlitzer-v3-C2: 74301 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/C2_v3.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-C2', instrument: 'wurlitzer', layer: 'v3', noteName: 'C2', bufferSizeKB: 73}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-C2 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-C2: {success: true, path: 'wurlitzer-v3-C2', size: 74301, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-C2
 [DEBUG][NoAlias] wurlitzer - C2 v3: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v3-C2 {progress: '28/36', bufferSizeKB: 73, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-C2 cached (28/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/G1... 
 🔍 [DOWNLOAD] wurlitzer-v3-G1: 99143 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/G1_v3.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-G1', instrument: 'wurlitzer', layer: 'v3', noteName: 'G1', bufferSizeKB: 97}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-G1 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-G1: {success: true, path: 'wurlitzer-v3-G1', size: 99143, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-G1
 [DEBUG][NoAlias] wurlitzer - G1 v3: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v3-G1 {progress: '29/36', bufferSizeKB: 97, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-G1 cached (29/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v4/Gs1... 
 🔍 [DOWNLOAD] wurlitzer-v4-Gs1: 104265 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v4/Gs1_v4.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v4-Gs1', instrument: 'wurlitzer', layer: 'v4', noteName: 'Gs1', bufferSizeKB: 102}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v4-Gs1 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v4-Gs1: {success: true, path: 'wurlitzer-v4-Gs1', size: 104265, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v4-Gs1
 [DEBUG][NoAlias] wurlitzer - Gs1 v4: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v4-Gs1 {progress: '30/36', bufferSizeKB: 102, aliases: Array(2)}
 [SAMPLES][Progress] 30/36 samples loaded (83%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Gs1 cached (30/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/Gs1... 
 🔍 [DOWNLOAD] wurlitzer-v3-Gs1: 100329 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/Gs1_v3.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-Gs1', instrument: 'wurlitzer', layer: 'v3', noteName: 'Gs1', bufferSizeKB: 98}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-Gs1 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-Gs1: {success: true, path: 'wurlitzer-v3-Gs1', size: 100329, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-Gs1
 [DEBUG][NoAlias] wurlitzer - Gs1 v3: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v3-Gs1 {progress: '31/36', bufferSizeKB: 98, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Gs1 cached (31/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v5/Ds4... 
 🔍 [DOWNLOAD] wurlitzer-v5-Ds4: 58002 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v5/Ds4_v5.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v5-Ds4', instrument: 'wurlitzer', layer: 'v5', noteName: 'Ds4', bufferSizeKB: 57}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v5-Ds4 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v5-Ds4: {success: true, path: 'wurlitzer-v5-Ds4', size: 58002, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v5-Ds4
 [DEBUG][NoAlias] wurlitzer - Ds4 v5: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v5-Ds4 {progress: '32/36', bufferSizeKB: 57, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v5-Ds4 cached (32/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v4/Ds4... 
 🔍 [DOWNLOAD] wurlitzer-v4-Ds4: 54420 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v4/Ds4_v4.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v4-Ds4', instrument: 'wurlitzer', layer: 'v4', noteName: 'Ds4', bufferSizeKB: 53}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v4-Ds4 to IndexedDB...
 [INDEXEDDB-DEBUG] Store result for wurlitzer-v4-Ds4: {success: true, path: 'wurlitzer-v4-Ds4', size: 54420, metadata: {…}}
 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v4-Ds4
 [DEBUG][NoAlias] wurlitzer - Ds4 v4: No aliasing for instruments with per-note samples
 [SAMPLES] Cached: wurlitzer-v4-Ds4 {progress: '33/36', bufferSizeKB: 53, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Ds4 cached (33/36) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/Cs4... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-Cs4: 53066 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/Cs4_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-Cs4', instrument: 'wurlitzer', layer: 'v3', noteName: 'Cs4', bufferSizeKB: 52}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-Cs4 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-Cs4: {success: true, path: 'wurlitzer-v3-Cs4', size: 53066, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-Cs4
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - Cs4 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-Cs4 {progress: '34/36', bufferSizeKB: 52, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Cs4 cached (34/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v3/F4... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v3-F4: 67994 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/F4_v3.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v3-F4', instrument: 'wurlitzer', layer: 'v3', noteName: 'F4', bufferSizeKB: 66}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v3-F4 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v3-F4: {success: true, path: 'wurlitzer-v3-F4', size: 67994, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v3-F4
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - F4 v3: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-F4 {progress: '35/36', bufferSizeKB: 66, aliases: Array(2)}
HarmonyPreloadStrategy.ts:971 [SAMPLES][Progress] 35/36 samples loaded (97%)
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-F4 cached (35/36) 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v5/D3... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v5-D3: 71583 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v5/D3_v5.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v5-D3', instrument: 'wurlitzer', layer: 'v5', noteName: 'D3', bufferSizeKB: 70}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v5-D3 to IndexedDB...
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Ensuring all samplers are ready... 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Layer v2 ready 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 Layer v3 ready 
structured-logger.js:186 [INFO] [WurlitzerVelocitySampler] 🎹 All samplers checked and ready! 
WamKeyboard.ts:557 ✅ [LOAD-INSTRUMENT] Wurlitzer initialized
WamKeyboard.ts:560 ✅ [LOAD-INSTRUMENT] Wurlitzer connected to gain node (after init)
WamKeyboard.ts:669 🔄 [SWITCH-INSTRUMENT] switchToInstrument called {requestedInstrument: 'wurlitzer', currentInstrument: 'grandpiano', hasCurrentSampler: true, isAlreadyActive: false, hasGainNode: true, …}
WamKeyboard.ts:601 🔌 [DISCONNECT-ALL] Starting disconnection {totalSamplers: 2, samplerNames: Array(2), currentInstrument: 'grandpiano', activeSampler: 'exists'}
WamKeyboard.ts:614 🔌 [DISCONNECT-ALL] Attempting to disconnect grandpiano {hasDisconnect: true, hasOutput: false, hasReleaseAll: true}
WamKeyboard.ts:629 🔇 [DISCONNECT-ALL] Released all notes for grandpiano
WamKeyboard.ts:637 ✅ [DISCONNECT-ALL] Successfully disconnected grandpiano
WamKeyboard.ts:614 🔌 [DISCONNECT-ALL] Attempting to disconnect wurlitzer {hasDisconnect: true, hasOutput: false, hasReleaseAll: true}
WamKeyboard.ts:629 🔇 [DISCONNECT-ALL] Released all notes for wurlitzer
WamKeyboard.ts:637 ✅ [DISCONNECT-ALL] Successfully disconnected wurlitzer
WamKeyboard.ts:662 🔌 [DISCONNECT-ALL] Disconnection complete
WamKeyboard.ts:707 🔗 [SWITCH-INSTRUMENT] Connecting sampler to gain node {instrument: 'wurlitzer', samplerType: 'WurlitzerVelocitySampler', hasConnect: true, hasOutput: false}
WamKeyboard.ts:726 ✅ [SWITCH-INSTRUMENT] Connected wurlitzer sampler to gain node (direct connect)
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] ✅ HarmonyWidget: Desired instrument loaded! {instrument: 'wurlitzer'}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] ✅ WAM Keyboard plugin loaded and connected for HarmonyWidget 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Set gain node to: 0.8
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v5-D3: {success: true, path: 'wurlitzer-v5-D3', size: 71583, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v5-D3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - D3 v5: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v5-D3 {progress: '36/36', bufferSizeKB: 70, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v5-D3 cached (36/36) 
HarmonyPreloadStrategy.ts:992 ✅ [SAMPLES] Harmony samples preloaded {timestamp: '2025-12-11T10:21:59.506Z', durationMs: '1490.50', samplesLoaded: 36, totalSamples: 36, successRate: '100%', …}
logger.ts:325 [HarmonyPreloadStrategy] 📝 ✅ Exercise-specific harmony samples preloaded as AudioBuffers {duration: '1490.50ms', samplesLoaded: 36, totalSamples: 36, successRate: '100%'}
InitialSamplePreloader.ts:425 🎵 [AFTER-HARMONY-LOAD] Harmony loading completed: {success: true, loaded: 36, total: 36}
logger.ts:325 [InitialSamplePreloader] 📝 ✅ Harmony FAANG smart loading complete {samplesLoaded: 36, savingsVsFullLoad: '70%'}
InitialSamplePreloader.ts:440 🔧 [BEFORE-PLAYBACK-ENGINE] About to inject buffers into PlaybackEngine
InitialSamplePreloader.ts:481 🔍 [BUFFER-INJECTION] Found 36 cached buffers for wurlitzer: (5) ['wurlitzer-v2-As1', 'wurlitzer-v3-As1', 'wurlitzer-v4-Cs3', 'wurlitzer-v3-Gs2', 'wurlitzer-v4-Gs2']
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Phase 2 effect check: {window: true, pluginClassLoaded: true, trackIsReady: true, audioServicesReady: true, wamPluginLoaded: true, …}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Setting up audio service listeners... 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Audio services already ready 
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Audio context state: running
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 HarmonyWidget: Retry effect check: {audioServicesReady: true, trackIsReady: true, wamPluginLoaded: true, pluginClassLoaded: true, shouldRetry: false}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered: {timestamp: 1765448519509, isPlaying: false, trackIsReady: true, wamPluginLoaded: true, hasPlugin: true, …}
HarmonyWidget.tsx:2325 🔥🔥🔥 [HARMONY-WIDGET] ALL CONDITIONS MET - Registering harmony buffers! {timestamp: 1765448519509, exerciseId: ExerciseId, harmonyNotesCount: 129, isPlaying: false, reason: 'exercise changed'}
HarmonyWidget.tsx:1478 🎹🎹🎹 [HARMONY-WIDGET] registerHarmonyWithPlaybackEngine CALLED {timestamp: '2025-12-11T10:21:59.510Z', callStack: Array(3)}
HarmonyWidget.tsx:1514 ✅ [HARMONY-WIDGET] Plugin and audioNode available
HarmonyWidget.tsx:1525 ✅ [HARMONY-WIDGET] Exercise has harmony notes: 129
HarmonyWidget.tsx:1530 🎹 [HARMONY-WIDGET] Registering harmony with PlaybackEngine
HarmonyWidget.tsx:1539 ✅ [HARMONY-WIDGET] Core services available
HarmonyWidget.tsx:1546 ✅ [HARMONY-WIDGET] PlaybackEngine available
HarmonyWidget.tsx:1550 🔧 [HARMONY-WIDGET] Starting buffer injection...
HarmonyWidget.tsx:1555 ✅ [HARMONY-WIDGET] Got GlobalSampleCache instance
HarmonyWidget.tsx:1562 🎹 [HARMONY-WIDGET] Exercise instrument detection: {exerciseId: ExerciseId, exerciseTitle: 'JOO', harmonyInstrument: 'wurlitzer', harmonyInstrumentType: 'string', harmonyInstrumentIsDefined: true, …}
HarmonyWidget.tsx:1571 🎹 [HARMONY-WIDGET] Looking for instrument-specific buffers: wurlitzer
HarmonyWidget.tsx:1679 ✅ [HARMONY-WIDGET] All required samples cached, proceeding with registration {requiredNotes: Array(26), cachedKeys: 36}
logger.ts:325 [Scheduler] 📝 ✅ Scheduler buffers injected {bufferKeys: Array(0), bufferCount: 0, hasDestination: true, instanceId: 'z57sigvms'}
structured-logger.js:186 [INFO] [VelocityLayerSelector] Instrument changed {from: 'wurlitzer', to: 'wurlitzer'}
logger.ts:325 [Scheduler] 📝 Harmony instrument updated {instrument: 'wurlitzer', octaveShift: 12, hasPerNoteRanges: false}
logger.ts:325 [PlaybackEngine] 📝 Harmony instrument set {instrument: 'wurlitzer', bufferCount: 0}
structured-logger.js:186 [INFO] [VelocityLayerSelector] Instrument changed {from: undefined, to: 'wurlitzer'}
structured-logger.js:186 [INFO] [HarmonySchedulerV2] Harmony buffers injected {layerCount: 0, layers: Array(0), instrument: 'wurlitzer', instanceId: 'z57sigvms'}
HarmonySchedulerV2.ts:183 [HARMONY] BUFFER MAP INJECTED for wurlitzer:
logger.ts:325 [PlaybackEngine] 📝 HarmonySchedulerV2 buffers set {layerCount: 0, instrument: 'wurlitzer'}
logger.ts:325 [PlaybackEngine] 📝 Harmony buffers set {bufferCount: 0, instanceId: 'z57sigvms'}
installHook.js:1 ⚠️ [HARMONY-WIDGET] No harmony buffers found in cache - cleared old buffers to prevent wrong instrument playing
overrideMethod @ installHook.js:1
HarmonyWidgetComponent.useCallback[registerHarmonyWithPlaybackEngine] @ HarmonyWidget.tsx:1836
await in HarmonyWidgetComponent.useCallback[registerHarmonyWithPlaybackEngine]
HarmonyWidgetComponent.useEffect @ HarmonyWidget.tsx:2339
react-stack-bottom-frame @ react-dom-client.development.js:23696
runWithFiberInDEV @ react-dom-client.development.js:544
commitHookEffectListMount @ react-dom-client.development.js:10764
commitHookPassiveMountEffects @ react-dom-client.development.js:10884
commitPassiveMountOnFiber @ react-dom-client.development.js:12669
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12662
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12771
recursivelyTraversePassiveMountEffects @ react-dom-client.development.js:12643
commitPassiveMountOnFiber @ react-dom-client.development.js:12673
flushPassiveEffects @ react-dom-client.development.js:15483
eval @ react-dom-client.development.js:15347
performWorkUntilDeadline @ scheduler.development.js:44
HarmonyWidget.tsx:1891 🎼 [HARMONY-WIDGET] Normalizing MIDI to start at measure 0 (bar 1): {firstEventOriginal: {…}, offsets: {…}, totalNotes: 129, totalCCEvents: 38, result: 'MIDI file start → measure 0 (bar 1 of exercise), all events shifted by offset'}
HarmonyWidget.tsx:1904 [HARMONY-FLOW] STEP 1 - Supabase notes: (10) ['1: A#2 (MIDI 46) ticks=0', '2: C#4 (MIDI 61) ticks=0', '3: G#3 (MIDI 56) ticks=2', '4: C4 (MIDI 60) ticks=2', '5: G#4 (MIDI 68) ticks=2', '6: D#4 (MIDI 63) ticks=4', '7: F3 (MIDI 53) ticks=12', '8: G4 (MIDI 67) ticks=372', '9: A#4 (MIDI 70) ticks=717', '10: F#3 (MIDI 54) ticks=719']
HarmonyWidget.tsx:1920 [HARMONY DURATION DIAGNOSTIC] Note 1: {durationTicks: 202, bpm: 69, calculation: '(202 / 480) * (60 / 69)', durationSeconds: 0.36594202898550726, expectedAt69BPM: 0.36594202898550726}
HarmonyWidget.tsx:1931 [PPQ DIAGNOSTIC] Note 1: {positionTick: 0, durationTicks: 202, tickRatio: '0.00', expectedPPQ: 480, suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ', …}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 1 RAW DATA from database: {id: 'harmony-note-1', ticks: 0, ticksType: 'number', ticksUndefined: false, pitch: 46, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 1 EVENT OBJECT created: {noteName: 'A#2', absoluteTicksVariable: 0, eventDataTicks: 0, areEqual: true}
HarmonyWidget.tsx:1920 [HARMONY DURATION DIAGNOSTIC] Note 2: {durationTicks: 179, bpm: 69, calculation: '(179 / 480) * (60 / 69)', durationSeconds: 0.3242753623188406, expectedAt69BPM: 0.3242753623188406}
HarmonyWidget.tsx:1931 [PPQ DIAGNOSTIC] Note 2: {positionTick: 0, durationTicks: 179, tickRatio: '0.00', expectedPPQ: 480, suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ', …}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 2 RAW DATA from database: {id: 'harmony-note-2', ticks: 0, ticksType: 'number', ticksUndefined: false, pitch: 61, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 2 EVENT OBJECT created: {noteName: 'C#4', absoluteTicksVariable: 0, eventDataTicks: 0, areEqual: true}
HarmonyWidget.tsx:1920 [HARMONY DURATION DIAGNOSTIC] Note 3: {durationTicks: 200, bpm: 69, calculation: '(200 / 480) * (60 / 69)', durationSeconds: 0.36231884057971014, expectedAt69BPM: 0.36231884057971014}
HarmonyWidget.tsx:1931 [PPQ DIAGNOSTIC] Note 3: {positionTick: 2, durationTicks: 200, tickRatio: '0.01', expectedPPQ: 480, suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ', …}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 3 RAW DATA from database: {id: 'harmony-note-3', ticks: 2, ticksType: 'number', ticksUndefined: false, pitch: 56, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 3 EVENT OBJECT created: {noteName: 'G#3', absoluteTicksVariable: 2, eventDataTicks: 2, areEqual: true}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 4 RAW DATA from database: {id: 'harmony-note-4', ticks: 2, ticksType: 'number', ticksUndefined: false, pitch: 60, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 4 EVENT OBJECT created: {noteName: 'C4', absoluteTicksVariable: 2, eventDataTicks: 2, areEqual: true}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 5 RAW DATA from database: {id: 'harmony-note-5', ticks: 2, ticksType: 'number', ticksUndefined: false, pitch: 68, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 5 EVENT OBJECT created: {noteName: 'G#4', absoluteTicksVariable: 2, eventDataTicks: 2, areEqual: true}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 9 RAW DATA from database: {id: 'harmony-note-9', ticks: 717, ticksType: 'number', ticksUndefined: false, pitch: 70, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 9 EVENT OBJECT created: {noteName: 'A#4', absoluteTicksVariable: 717, eventDataTicks: 717, areEqual: true}
HarmonyWidget.tsx:2011 [HARMONY WIDGET] CC64 event 1 from database: {cc: 64, value: 0, absoluteTicks: 0, position: {…}}
HarmonyWidget.tsx:2011 [HARMONY WIDGET] CC64 event 2 from database: {cc: 64, value: 127, absoluteTicks: 66, position: {…}}
HarmonyWidget.tsx:2011 [HARMONY WIDGET] CC64 event 3 from database: {cc: 64, value: 0, absoluteTicks: 748, position: {…}}
HarmonyWidget.tsx:2088 [HARMONY WIDGET] allHarmonyEvents - first 3 notes after combining: (3) [{…}, {…}, {…}]
HarmonyWidget.tsx:2100 🎛️ [HARMONY-WIDGET] Control changes and durations: {noteCount: 129, controlChangeCount: 38, totalEvents: 167, sustainEvents: 38, cc64Timeline: Array(38), …}
HarmonyWidget.tsx:2158 🚨🚨🚨 [TIMING-DIAGNOSTIC] About to register harmony track! {timestamp: '2025-12-11T10:21:59.516Z', isRunning: false, method: 'registerTracks', trackId: 'harmony-widget-track', regionsCount: 1, …}
HarmonyWidget.tsx:2176 📝 [HARMONY-WIDGET] PlaybackEngine not running yet - using registerTracks()
logger.ts:325 [PlaybackEngine] 📝 Track registered: harmony-widget-track {instrumentType: 'harmony', regionsCount: 1}
HarmonyWidget.tsx:2185 ✅✅✅ [TIMING-DIAGNOSTIC] Harmony track registration completed! {timestamp: '2025-12-11T10:21:59.516Z'}
HarmonyWidget.tsx:2192 ✅ [HARMONY-WIDGET] Harmony registered with PlaybackEngine {eventsCount: 129, duration: 27.82608695652174, bpm: 69, method: 'registerTracks'}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 Harmony registered with PlaybackEngine {noteCount: 129, exerciseId: '6fd6faa0-6494-4022-85df-a61565f5e366', bpm: 69, isRunning: false}
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-As1
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-As1
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v4-Cs3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-Gs2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v4-Gs2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-C3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-C3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-Gs3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v4-Gs3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-Gs3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-Ds3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-Ds3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-F2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-G3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v4-G3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-As3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-Fs2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-F3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-D2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-Ds2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-As2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-C4
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-E2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-E2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-E3
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-G2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-Cs2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-C2
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-G1
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v4-Gs1
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-Gs1
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v5-Ds4
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v4-Ds4
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-Cs4
 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v3-F4
 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v5-D3
 ✅ [BUFFER-INJECTION] Collected 36 buffers for PlaybackEngine
 [Scheduler] 📝 ✅ Scheduler buffers injected {bufferKeys: Array(36), bufferCount: 36, hasDestination: true, instanceId: 'z57sigvms'}
 🔍 [BUFFER-PARSE] key="v2-As1" → layer="v2", note="As1", duration=9.75s
 🔍 [BUFFER-PARSE] key="v3-As1" → layer="v3", note="As1", duration=10.74s
 🔍 [BUFFER-PARSE] key="v4-Cs3" → layer="v4", note="Cs3", duration=9.04s
 🔍 [BUFFER-PARSE] key="v3-Gs2" → layer="v3", note="Gs2", duration=8.62s
 🔍 [BUFFER-PARSE] key="v4-Gs2" → layer="v4", note="Gs2", duration=8.95s
 🔍 [BUFFER-PARSE] key="v2-C3" → layer="v2", note="C3", duration=7.70s
 🔍 [BUFFER-PARSE] key="v3-C3" → layer="v3", note="C3", duration=8.21s
 🔍 [BUFFER-PARSE] key="v3-Gs3" → layer="v3", note="Gs3", duration=6.89s
 🔍 [BUFFER-PARSE] key="v4-Gs3" → layer="v4", note="Gs3", duration=6.35s
 🔍 [BUFFER-PARSE] key="v2-Gs3" → layer="v2", note="Gs3", duration=6.73s
 🔍 [BUFFER-PARSE] key="v3-Ds3" → layer="v3", note="Ds3", duration=8.27s
 🔍 [BUFFER-PARSE] key="v2-Ds3" → layer="v2", note="Ds3", duration=7.44s
 🔍 [BUFFER-PARSE] key="v3-F2" → layer="v3", note="F2", duration=10.16s
 🔍 [BUFFER-PARSE] key="v3-G3" → layer="v3", note="G3", duration=6.58s
 🔍 [BUFFER-PARSE] key="v4-G3" → layer="v4", note="G3", duration=5.90s
 🔍 [BUFFER-PARSE] key="v3-As3" → layer="v3", note="As3", duration=6.57s
 🔍 [BUFFER-PARSE] key="v2-Fs2" → layer="v2", note="Fs2", duration=9.43s
 🔍 [BUFFER-PARSE] key="v3-F3" → layer="v3", note="F3", duration=6.64s
 🔍 [BUFFER-PARSE] key="v3-D2" → layer="v3", note="D2", duration=9.17s
 🔍 [BUFFER-PARSE] key="v2-Ds2" → layer="v2", note="Ds2", duration=8.72s
 🔍 [BUFFER-PARSE] key="v3-As2" → layer="v3", note="As2", duration=8.79s
 🔍 [BUFFER-PARSE] key="v3-C4" → layer="v3", note="C4", duration=7.47s
 🔍 [BUFFER-PARSE] key="v2-E2" → layer="v2", note="E2", duration=8.88s
 🔍 [BUFFER-PARSE] key="v3-E2" → layer="v3", note="E2", duration=9.13s
 🔍 [BUFFER-PARSE] key="v3-E3" → layer="v3", note="E3", duration=8.33s
 🔍 [BUFFER-PARSE] key="v3-G2" → layer="v3", note="G2", duration=9.46s
 🔍 [BUFFER-PARSE] key="v2-Cs2" → layer="v2", note="Cs2", duration=8.91s
 🔍 [BUFFER-PARSE] key="v3-C2" → layer="v3", note="C2", duration=9.36s
 🔍 [BUFFER-PARSE] key="v3-G1" → layer="v3", note="G1", duration=12.69s
 🔍 [BUFFER-PARSE] key="v4-Gs1" → layer="v4", note="Gs1", duration=13.45s
 🔍 [BUFFER-PARSE] key="v3-Gs1" → layer="v3", note="Gs1", duration=12.94s
 🔍 [BUFFER-PARSE] key="v5-Ds4" → layer="v5", note="Ds4", duration=7.73s
 🔍 [BUFFER-PARSE] key="v4-Ds4" → layer="v4", note="Ds4", duration=7.28s
 🔍 [BUFFER-PARSE] key="v3-Cs4" → layer="v3", note="Cs4", duration=7.05s
 🔍 [BUFFER-PARSE] key="v3-F4" → layer="v3", note="F4", duration=9.58s
 🔍 [BUFFER-PARSE] key="v5-D3" → layer="v5", note="D3", duration=9.46s
 [INFO] [VelocityLayerSelector] Instrument changed {from: 'wurlitzer', to: 'wurlitzer'}
 [INFO] [HarmonySchedulerV2] Harmony buffers injected {layerCount: 4, layers: Array(4), instrument: 'wurlitzer', instanceId: 'z57sigvms'}
 [HARMONY] BUFFER MAP INJECTED for wurlitzer:
   v3: F2:10.16s, F3:6.64s, F4:9.58s
 [PlaybackEngine] 📝 HarmonySchedulerV2 buffers set {layerCount: 4, instrument: 'wurlitzer'}
 [PlaybackEngine] 📝 Harmony buffers set {bufferCount: 36, instanceId: 'z57sigvms'}
 [InitialSamplePreloader] 📝 ✅ Harmony buffers injected into PlaybackEngine {instrument: 'wurlitzer', buffersInjected: 36, cachedKeys: 36}
 ✅ [AFTER-PLAYBACK-ENGINE] PlaybackEngine injection attempt completed
 [InitialSamplePreloader] ⚠️ ⚠️ No voice cue buffers available for injection 
overrideMethod @ installHook.js:1
log @ webpack-internal:///…utils/logger.ts:268
warn @ webpack-internal:///…utils/logger.ts:246
executeLoadFullSamples @ webpack-internal:///…plePreloader.ts:433
await in executeLoadFullSamples
loadFullSamples @ webpack-internal:///…plePreloader.ts:140
ExerciseSelector.useEffect.loadFullSamplesWhenVisible @ webpack-internal:///…ciseSelector.tsx:60
 🔍 [BEFORE-BASS-CHECK] Checking if bass loading needed: {hasBasslineMidiUrl: true, basslineMidiUrl: 'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v…4022-85df-a61565f5e366/1765063339352_bassline.mid'}
 [BassPreloadStrategy] 📝 🎸 FAANG MIDI-based bass sample loading... {exerciseId: ExerciseId, exerciseTitle: 'JOO', hasBasslineMidi: true}
 [BasslineNoteExtractor] 📝 📥 Fetching bassline MIDI file... {midiUrl: 'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v…4022-85df-a61565f5e366/1765063339352_bassline.mid'}
 [BasslineNoteExtractor] 📝 ✅ Bassline MIDI note extraction complete {totalTracks: 1, uniqueNotes: 11, durationMs: '3.20', lowestNote: 'F1', highestNote: 'F2', …}
 [BassPreloadStrategy] 📝 📊 Bassline MIDI analysis complete - loading exercise-specific samples {uniqueNotes: 11, noteRange: 'F1 to F2', totalSamplesToLoad: 11, savedSamples: 13, savingsPercentage: '54%'}
 [BassPreloadStrategy] ⚠️ CoreServices not available - bass samples will load on widget initialization 
overrideMethod @ installHook.js:1
log @ webpack-internal:///…utils/logger.ts:268
warn @ webpack-internal:///…utils/logger.ts:246
loadFullSamples @ webpack-internal:///…eloadStrategy.ts:82
await in loadFullSamples
executeLoadFullSamples @ webpack-internal:///…plePreloader.ts:466
await in executeLoadFullSamples
loadFullSamples @ webpack-internal:///…plePreloader.ts:140
ExerciseSelector.useEffect.loadFullSamplesWhenVisible @ webpack-internal:///…ciseSelector.tsx:60
 [InitialSamplePreloader] 📝 ✅ Bass FAANG smart loading complete {samplesLoaded: 0, savingsVsFullLoad: 'N/A'}
 [InitialSamplePreloader] 📝 📊 Final GlobalSampleCache stats: {instruments: 2, samples: 48, totalCached: 50}
 ✅ [LOADING-COMPLETE] Sample load completed for: {instrument: 'wurlitzer', loadingKey: 'harmony-wurlitzer', harmonyResult: {…}}
 🎧 [HARMONY-WIDGET] Received harmony-samples-loaded event (window): {exerciseId: ExerciseId, instrument: 'wurlitzer', samplesLoaded: 36, exerciseTitle: 'JOO'}
 📢 [EXERCISE-SELECTOR] Emitted harmony-samples-loaded event {exerciseId: ExerciseId, instrument: 'wurlitzer', samplesLoaded: 36}
 [INFO] [frontend:HarmonyWidget] 🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered: {timestamp: 1765448520403, isPlaying: false, trackIsReady: true, wamPluginLoaded: true, hasPlugin: true, …}
 🔥🔥🔥 [HARMONY-WIDGET] ALL CONDITIONS MET - Registering harmony buffers! {timestamp: 1765448520403, exerciseId: ExerciseId, harmonyNotesCount: 129, isPlaying: false, reason: 'exercise changed'}
 🎹🎹🎹 [HARMONY-WIDGET] registerHarmonyWithPlaybackEngine CALLED {timestamp: '2025-12-11T10:22:00.404Z', callStack: Array(3)}
 ✅ [HARMONY-WIDGET] Plugin and audioNode available
 ✅ [HARMONY-WIDGET] Exercise has harmony notes: 129
 🎹 [HARMONY-WIDGET] Registering harmony with PlaybackEngine
 ✅ [HARMONY-WIDGET] Core services available
 ✅ [HARMONY-WIDGET] PlaybackEngine available
 🔧 [HARMONY-WIDGET] Starting buffer injection...
 ✅ [HARMONY-WIDGET] Got GlobalSampleCache instance
HarmonyWidget.tsx:1562 🎹 [HARMONY-WIDGET] Exercise instrument detection: {exerciseId: ExerciseId, exerciseTitle: 'JOO', harmonyInstrument: 'wurlitzer', harmonyInstrumentType: 'string', harmonyInstrumentIsDefined: true, …}
HarmonyWidget.tsx:1571 🎹 [HARMONY-WIDGET] Looking for instrument-specific buffers: wurlitzer
HarmonyWidget.tsx:1679 ✅ [HARMONY-WIDGET] All required samples cached, proceeding with registration {requiredNotes: Array(26), cachedKeys: 36}
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-As1 → v2-As1
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-As1 → v3-As1
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Cs3 → v4-Cs3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Gs2 → v3-Gs2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Gs2 → v4-Gs2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-C3 → v2-C3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-C3 → v3-C3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Gs3 → v3-Gs3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Gs3 → v4-Gs3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Gs3 → v2-Gs3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Ds3 → v3-Ds3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Ds3 → v2-Ds3
HarmonyWidget.tsx:1703 🔍 [F-NOTE-WIDGET] wurlitzer-v3-F2 → v3-F2: length=447967, duration=10.16s, sampleRate=44100
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-F2 → v3-F2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-G3 → v3-G3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-G3 → v4-G3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-As3 → v3-As3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Fs2 → v2-Fs2
HarmonyWidget.tsx:1703 🔍 [F-NOTE-WIDGET] wurlitzer-v3-F3 → v3-F3: length=292735, duration=6.64s, sampleRate=44100
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-F3 → v3-F3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-D2 → v3-D2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Ds2 → v2-Ds2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-As2 → v3-As2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-C4 → v3-C4
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-E2 → v2-E2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-E2 → v3-E2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-E3 → v3-E3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-G2 → v3-G2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Cs2 → v2-Cs2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-C2 → v3-C2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-G1 → v3-G1
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Gs1 → v4-Gs1
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Gs1 → v3-Gs1
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v5-Ds4 → v5-Ds4
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Ds4 → v4-Ds4
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Cs4 → v3-Cs4
HarmonyWidget.tsx:1703 🔍 [F-NOTE-WIDGET] wurlitzer-v3-F4 → v3-F4: length=422566, duration=9.58s, sampleRate=44100
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-F4 → v3-F4
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v5-D3 → v5-D3
HarmonyWidget.tsx:1718 🎧 [HARMONY-WIDGET] AudioContext info: {hasAudioEngine: true, hasAudioContext: true, hasDestination: true, destinationType: 'AudioDestinationNode', state: 'running'}
HarmonyWidget.tsx:1730 📖 [HARMONY-WIDGET] Loading instrument config: wurlitzer
HarmonyWidget.tsx:1754 ✅ [HARMONY-WIDGET] Loaded per-note velocity ranges {instrument: 'wurlitzer', hasRanges: true, noteCount: 64}
logger.ts:325 [Scheduler] 📝 ✅ Scheduler buffers injected {bufferKeys: Array(36), bufferCount: 36, hasDestination: true, instanceId: 'z57sigvms'}
structured-logger.js:186 [INFO] [VelocityLayerSelector] Instrument changed {from: 'wurlitzer', to: 'wurlitzer'}
structured-logger.js:186 [INFO] [VelocityLayerSelector] Per-note velocity ranges updated {hasRanges: true, noteCount: 64}
logger.ts:325 [Scheduler] 📝 Harmony instrument updated {instrument: 'wurlitzer', octaveShift: 12, hasPerNoteRanges: true}
logger.ts:325 [PlaybackEngine] 📝 Harmony instrument set {instrument: 'wurlitzer', bufferCount: 36}
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-As1" → layer="v2", note="As1", duration=9.75s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-As1" → layer="v3", note="As1", duration=10.74s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Cs3" → layer="v4", note="Cs3", duration=9.04s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Gs2" → layer="v3", note="Gs2", duration=8.62s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Gs2" → layer="v4", note="Gs2", duration=8.95s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-C3" → layer="v2", note="C3", duration=7.70s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-C3" → layer="v3", note="C3", duration=8.21s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Gs3" → layer="v3", note="Gs3", duration=6.89s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Gs3" → layer="v4", note="Gs3", duration=6.35s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Gs3" → layer="v2", note="Gs3", duration=6.73s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Ds3" → layer="v3", note="Ds3", duration=8.27s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Ds3" → layer="v2", note="Ds3", duration=7.44s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-F2" → layer="v3", note="F2", duration=10.16s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-G3" → layer="v3", note="G3", duration=6.58s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-G3" → layer="v4", note="G3", duration=5.90s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-As3" → layer="v3", note="As3", duration=6.57s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Fs2" → layer="v2", note="Fs2", duration=9.43s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-F3" → layer="v3", note="F3", duration=6.64s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-D2" → layer="v3", note="D2", duration=9.17s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Ds2" → layer="v2", note="Ds2", duration=8.72s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-As2" → layer="v3", note="As2", duration=8.79s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-C4" → layer="v3", note="C4", duration=7.47s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-E2" → layer="v2", note="E2", duration=8.88s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-E2" → layer="v3", note="E2", duration=9.13s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-E3" → layer="v3", note="E3", duration=8.33s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-G2" → layer="v3", note="G2", duration=9.46s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Cs2" → layer="v2", note="Cs2", duration=8.91s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-C2" → layer="v3", note="C2", duration=9.36s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-G1" → layer="v3", note="G1", duration=12.69s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Gs1" → layer="v4", note="Gs1", duration=13.45s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Gs1" → layer="v3", note="Gs1", duration=12.94s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v5-Ds4" → layer="v5", note="Ds4", duration=7.73s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Ds4" → layer="v4", note="Ds4", duration=7.28s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Cs4" → layer="v3", note="Cs4", duration=7.05s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-F4" → layer="v3", note="F4", duration=9.58s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v5-D3" → layer="v5", note="D3", duration=9.46s
structured-logger.js:186 [INFO] [VelocityLayerSelector] Instrument changed {from: 'wurlitzer', to: 'wurlitzer'}
structured-logger.js:186 [INFO] [VelocityLayerSelector] Per-note velocity ranges updated {hasRanges: true, noteCount: 64}
structured-logger.js:186 [INFO] [HarmonySchedulerV2] Harmony buffers injected {layerCount: 4, layers: Array(4), instrument: 'wurlitzer', instanceId: 'z57sigvms'}
HarmonySchedulerV2.ts:183 [HARMONY] BUFFER MAP INJECTED for wurlitzer:
HarmonySchedulerV2.ts:189   v3: F2:10.16s, F3:6.64s, F4:9.58s
logger.ts:325 [PlaybackEngine] 📝 HarmonySchedulerV2 buffers set {layerCount: 4, instrument: 'wurlitzer'}
logger.ts:325 [PlaybackEngine] 📝 Harmony buffers set {bufferCount: 36, instanceId: 'z57sigvms'}
HarmonyWidget.tsx:1774 ✅ [HARMONY-WIDGET] Harmony buffers injected into PlaybackEngine {instrument: 'wurlitzer', buffersInjected: 36, audioContextState: 'running', hasVelocityRanges: true}
HarmonyWidget.tsx:1891 🎼 [HARMONY-WIDGET] Normalizing MIDI to start at measure 0 (bar 1): {firstEventOriginal: {…}, offsets: {…}, totalNotes: 129, totalCCEvents: 38, result: 'MIDI file start → measure 0 (bar 1 of exercise), all events shifted by offset'}
HarmonyWidget.tsx:1904 [HARMONY-FLOW] STEP 1 - Supabase notes: (10) ['1: A#2 (MIDI 46) ticks=0', '2: C#4 (MIDI 61) ticks=0', '3: G#3 (MIDI 56) ticks=2', '4: C4 (MIDI 60) ticks=2', '5: G#4 (MIDI 68) ticks=2', '6: D#4 (MIDI 63) ticks=4', '7: F3 (MIDI 53) ticks=12', '8: G4 (MIDI 67) ticks=372', '9: A#4 (MIDI 70) ticks=717', '10: F#3 (MIDI 54) ticks=719']
HarmonyWidget.tsx:1920 [HARMONY DURATION DIAGNOSTIC] Note 1: {durationTicks: 202, bpm: 69, calculation: '(202 / 480) * (60 / 69)', durationSeconds: 0.36594202898550726, expectedAt69BPM: 0.36594202898550726}
HarmonyWidget.tsx:1931 [PPQ DIAGNOSTIC] Note 1: {positionTick: 0, durationTicks: 202, tickRatio: '0.00', expectedPPQ: 480, suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ', …}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 1 RAW DATA from database: {id: 'harmony-note-1', ticks: 0, ticksType: 'number', ticksUndefined: false, pitch: 46, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 1 EVENT OBJECT created: {noteName: 'A#2', absoluteTicksVariable: 0, eventDataTicks: 0, areEqual: true}
HarmonyWidget.tsx:1920 [HARMONY DURATION DIAGNOSTIC] Note 2: {durationTicks: 179, bpm: 69, calculation: '(179 / 480) * (60 / 69)', durationSeconds: 0.3242753623188406, expectedAt69BPM: 0.3242753623188406}
HarmonyWidget.tsx:1931 [PPQ DIAGNOSTIC] Note 2: {positionTick: 0, durationTicks: 179, tickRatio: '0.00', expectedPPQ: 480, suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ', …}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 2 RAW DATA from database: {id: 'harmony-note-2', ticks: 0, ticksType: 'number', ticksUndefined: false, pitch: 61, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 2 EVENT OBJECT created: {noteName: 'C#4', absoluteTicksVariable: 0, eventDataTicks: 0, areEqual: true}
HarmonyWidget.tsx:1920 [HARMONY DURATION DIAGNOSTIC] Note 3: {durationTicks: 200, bpm: 69, calculation: '(200 / 480) * (60 / 69)', durationSeconds: 0.36231884057971014, expectedAt69BPM: 0.36231884057971014}
HarmonyWidget.tsx:1931 [PPQ DIAGNOSTIC] Note 3: {positionTick: 2, durationTicks: 200, tickRatio: '0.01', expectedPPQ: 480, suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ', …}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 3 RAW DATA from database: {id: 'harmony-note-3', ticks: 2, ticksType: 'number', ticksUndefined: false, pitch: 56, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 3 EVENT OBJECT created: {noteName: 'G#3', absoluteTicksVariable: 2, eventDataTicks: 2, areEqual: true}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 4 RAW DATA from database: {id: 'harmony-note-4', ticks: 2, ticksType: 'number', ticksUndefined: false, pitch: 60, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 4 EVENT OBJECT created: {noteName: 'C4', absoluteTicksVariable: 2, eventDataTicks: 2, areEqual: true}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 5 RAW DATA from database: {id: 'harmony-note-5', ticks: 2, ticksType: 'number', ticksUndefined: false, pitch: 68, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 5 EVENT OBJECT created: {noteName: 'G#4', absoluteTicksVariable: 2, eventDataTicks: 2, areEqual: true}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 9 RAW DATA from database: {id: 'harmony-note-9', ticks: 717, ticksType: 'number', ticksUndefined: false, pitch: 70, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 9 EVENT OBJECT created: {noteName: 'A#4', absoluteTicksVariable: 717, eventDataTicks: 717, areEqual: true}
HarmonyWidget.tsx:2011 [HARMONY WIDGET] CC64 event 1 from database: {cc: 64, value: 0, absoluteTicks: 0, position: {…}}
HarmonyWidget.tsx:2011 [HARMONY WIDGET] CC64 event 2 from database: {cc: 64, value: 127, absoluteTicks: 66, position: {…}}
HarmonyWidget.tsx:2011 [HARMONY WIDGET] CC64 event 3 from database: {cc: 64, value: 0, absoluteTicks: 748, position: {…}}
HarmonyWidget.tsx:2088 [HARMONY WIDGET] allHarmonyEvents - first 3 notes after combining: (3) [{…}, {…}, {…}]
HarmonyWidget.tsx:2100 🎛️ [HARMONY-WIDGET] Control changes and durations: {noteCount: 129, controlChangeCount: 38, totalEvents: 167, sustainEvents: 38, cc64Timeline: Array(38), …}
HarmonyWidget.tsx:2158 🚨🚨🚨 [TIMING-DIAGNOSTIC] About to register harmony track! {timestamp: '2025-12-11T10:22:00.411Z', isRunning: false, method: 'registerTracks', trackId: 'harmony-widget-track', regionsCount: 1, …}
HarmonyWidget.tsx:2176 📝 [HARMONY-WIDGET] PlaybackEngine not running yet - using registerTracks()
logger.ts:325 [PlaybackEngine] 📝 Track registered: harmony-widget-track {instrumentType: 'harmony', regionsCount: 1}
HarmonyWidget.tsx:2185 ✅✅✅ [TIMING-DIAGNOSTIC] Harmony track registration completed! {timestamp: '2025-12-11T10:22:00.411Z'}
HarmonyWidget.tsx:2192 ✅ [HARMONY-WIDGET] Harmony registered with PlaybackEngine {eventsCount: 129, duration: 27.82608695652174, bpm: 69, method: 'registerTracks'}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 Harmony registered with PlaybackEngine {noteCount: 129, exerciseId: '6fd6faa0-6494-4022-85df-a61565f5e366', bpm: 69, isRunning: false}
logger.ts:325 [exercise-selector] 📝 📥 Preloading exercise 2/2: NEEE {exerciseId: ExerciseId, harmonyInstrument: 'wurlitzer', hasHarmonyNotes: true}
logger.ts:325 [InitialSamplePreloader] 📝 🚀 Phase 3: FAANG MIDI-based smart sample loading... {exerciseId: ExerciseId, exerciseTitle: 'NEEE', hasHarmonyMidi: true, hasDrummerMidi: false, hasBasslineMidi: true, …}
InitialSamplePreloader.ts:402 🎵 [LOADING-START] Starting sample load for: {instrument: 'wurlitzer', exerciseId: ExerciseId, loadingKey: 'harmony-wurlitzer', hasHarmonyNotes: true, harmonyNotesCount: 129, …}
 [HarmonyPreloadStrategy] 📝 🎹 Optimized harmony sample loading from pre-converted data... {exerciseId: ExerciseId, exerciseTitle: 'NEEE', hasHarmonyNotes: true, harmonyInstrument: 'wurlitzer'}
 [HarmonyPreloadStrategy] 📝 ✅ Loaded instrument configuration {instrument: 'wurlitzer', hasPerNoteRanges: true, hasGlobalRanges: true}
 [HarmonyPreloadStrategy] 📝 [PRELOAD OCTAVE SHIFT] wurlitzer: MIDI 46 → 34 (shift: -12) 
 [HarmonyPreloadStrategy] 📝 [PRELOAD NOTE CONVERT] wurlitzer: A#1 / As1 (layer: v2), original: As2 
 [HarmonyPreloadStrategy] 📝 [PRELOAD OCTAVE SHIFT] wurlitzer: MIDI 61 → 49 (shift: -12) 
 [HarmonyPreloadStrategy] 📝 [PRELOAD NOTE CONVERT] wurlitzer: C#3 / Cs3 (layer: v4), original: Cs4 
 [HarmonyPreloadStrategy] 📝 [PRELOAD OCTAVE SHIFT] wurlitzer: MIDI 56 → 44 (shift: -12) 
 [HarmonyPreloadStrategy] 📝 [PRELOAD NOTE CONVERT] wurlitzer: G#2 / Gs2 (layer: v3), original: Gs3 
 [HarmonyPreloadStrategy] 📝 🧠 Built smart sample map {uniqueNotes: 26, totalSamples: 36, hasSampleMapping: true, availableSampleNotes: 64, samples: Array(26)}
 [HarmonyPreloadStrategy] 📝 📊 Exercise data analysis complete - loading optimized samples with per-note config {uniqueNotes: 26, pitchRange: '43 to 77', velocityRange: '60 to 118', instrument: 'wurlitzer', totalSamplesToLoad: 36, …}
 [HarmonyPreloadStrategy] 📝 🎹 Using buffer caching with OfflineAudioContext (no user interaction required) {instrument: 'wurlitzer', totalSamplesToLoad: 36}
 🎹 [SAMPLES] Downloading harmony samples as AudioBuffers {timestamp: '2025-12-11T10:22:00.704Z', uniqueNotes: 26, instrument: 'wurlitzer', totalSamplesToLoad: 36, sampleMap: Array(26)}
 [HarmonyPreloadStrategy] 📝 🎹 Pre-downloading harmony samples as AudioBuffers using smart sample map {uniqueNotes: 26, instrument: 'wurlitzer', totalSamplesToLoad: 36}
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-As1
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-As1 
 🔍 [CACHE-HIT] wurlitzer-v2-As1: 76627 bytes
 [SAMPLES] Cached: wurlitzer-v2-As1 {progress: '1/36', bufferSizeKB: 75, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-As1 cached (1/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-As1
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-As1 
 🔍 [CACHE-HIT] wurlitzer-v3-As1: 84035 bytes
 [SAMPLES] Cached: wurlitzer-v3-As1 {progress: '2/36', bufferSizeKB: 82, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-As1 cached (2/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-Cs3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-Cs3 
 🔍 [CACHE-HIT] wurlitzer-v4-Cs3: 68579 bytes
 [SAMPLES] Cached: wurlitzer-v4-Cs3 {progress: '3/36', bufferSizeKB: 67, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Cs3 cached (3/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-Gs2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-Gs2 
 🔍 [CACHE-HIT] wurlitzer-v3-Gs2: 68177 bytes
 [SAMPLES] Cached: wurlitzer-v3-Gs2 {progress: '4/36', bufferSizeKB: 67, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Gs2 cached (4/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-Gs2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-Gs2 
 🔍 [CACHE-HIT] wurlitzer-v4-Gs2: 71043 bytes
 [SAMPLES] Cached: wurlitzer-v4-Gs2 {progress: '5/36', bufferSizeKB: 69, aliases: Array(2)}
 [SAMPLES][Progress] 5/36 samples loaded (14%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Gs2 cached (5/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-C3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-C3 
 🔍 [CACHE-HIT] wurlitzer-v2-C3: 58483 bytes
 [SAMPLES] Cached: wurlitzer-v2-C3 {progress: '6/36', bufferSizeKB: 57, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-C3 cached (6/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-C3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-C3 
 🔍 [CACHE-HIT] wurlitzer-v3-C3: 63083 bytes
 [SAMPLES] Cached: wurlitzer-v3-C3 {progress: '7/36', bufferSizeKB: 62, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-C3 cached (7/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-Gs3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-Gs3 
 🔍 [CACHE-HIT] wurlitzer-v3-Gs3: 53021 bytes
 [SAMPLES] Cached: wurlitzer-v3-Gs3 {progress: '8/36', bufferSizeKB: 52, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Gs3 cached (8/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-Gs3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-Gs3 
 🔍 [CACHE-HIT] wurlitzer-v4-Gs3: 49477 bytes
 [SAMPLES] Cached: wurlitzer-v4-Gs3 {progress: '9/36', bufferSizeKB: 48, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Gs3 cached (9/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-Gs3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-Gs3 
 🔍 [CACHE-HIT] wurlitzer-v2-Gs3: 51442 bytes
 [SAMPLES] Cached: wurlitzer-v2-Gs3 {progress: '10/36', bufferSizeKB: 50, aliases: Array(2)}
 [SAMPLES][Progress] 10/36 samples loaded (28%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Gs3 cached (10/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-Ds3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-Ds3 
 🔍 [CACHE-HIT] wurlitzer-v3-Ds3: 61530 bytes
 [SAMPLES] Cached: wurlitzer-v3-Ds3 {progress: '11/36', bufferSizeKB: 60, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Ds3 cached (11/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-Ds3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-Ds3 
 🔍 [CACHE-HIT] wurlitzer-v2-Ds3: 56118 bytes
 [SAMPLES] Cached: wurlitzer-v2-Ds3 {progress: '12/36', bufferSizeKB: 55, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Ds3 cached (12/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-F2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-F2 
 🔍 [CACHE-HIT] wurlitzer-v3-F2: 78833 bytes
 [SAMPLES] Cached: wurlitzer-v3-F2 {progress: '13/36', bufferSizeKB: 77, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-F2 cached (13/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-G3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-G3 
 🔍 [CACHE-HIT] wurlitzer-v3-G3: 50420 bytes
 [SAMPLES] Cached: wurlitzer-v3-G3 {progress: '14/36', bufferSizeKB: 49, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-G3 cached (14/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-G3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-G3 
 🔍 [CACHE-HIT] wurlitzer-v4-G3: 46269 bytes
 [SAMPLES] Cached: wurlitzer-v4-G3 {progress: '15/36', bufferSizeKB: 45, aliases: Array(2)}
 [SAMPLES][Progress] 15/36 samples loaded (42%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-G3 cached (15/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-As3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-As3 
 🔍 [CACHE-HIT] wurlitzer-v3-As3: 51259 bytes
 [SAMPLES] Cached: wurlitzer-v3-As3 {progress: '16/36', bufferSizeKB: 50, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-As3 cached (16/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-Fs2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-Fs2 
 🔍 [CACHE-HIT] wurlitzer-v2-Fs2: 71410 bytes
 [SAMPLES] Cached: wurlitzer-v2-Fs2 {progress: '17/36', bufferSizeKB: 70, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Fs2 cached (17/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-F3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-F3 
 🔍 [CACHE-HIT] wurlitzer-v3-F3: 51104 bytes
 [SAMPLES] Cached: wurlitzer-v3-F3 {progress: '18/36', bufferSizeKB: 50, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-F3 cached (18/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-D2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-D2 
 🔍 [CACHE-HIT] wurlitzer-v3-D2: 72093 bytes
 [SAMPLES] Cached: wurlitzer-v3-D2 {progress: '19/36', bufferSizeKB: 70, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-D2 cached (19/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-Ds2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-Ds2 
 🔍 [CACHE-HIT] wurlitzer-v2-Ds2: 68661 bytes
 [SAMPLES] Cached: wurlitzer-v2-Ds2 {progress: '20/36', bufferSizeKB: 67, aliases: Array(2)}
 [SAMPLES][Progress] 20/36 samples loaded (56%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Ds2 cached (20/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-As2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-As2 
 🔍 [CACHE-HIT] wurlitzer-v3-As2: 67629 bytes
 [SAMPLES] Cached: wurlitzer-v3-As2 {progress: '21/36', bufferSizeKB: 66, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-As2 cached (21/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-C4
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-C4 
 🔍 [CACHE-HIT] wurlitzer-v3-C4: 55563 bytes
 [SAMPLES] Cached: wurlitzer-v3-C4 {progress: '22/36', bufferSizeKB: 54, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-C4 cached (22/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-E2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-E2 
 🔍 [CACHE-HIT] wurlitzer-v2-E2: 69084 bytes
 [SAMPLES] Cached: wurlitzer-v2-E2 {progress: '23/36', bufferSizeKB: 67, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-E2 cached (23/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-E2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-E2 
 🔍 [CACHE-HIT] wurlitzer-v3-E2: 72248 bytes
 [SAMPLES] Cached: wurlitzer-v3-E2 {progress: '24/36', bufferSizeKB: 71, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-E2 cached (24/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-E3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-E3 
 🔍 [CACHE-HIT] wurlitzer-v3-E3: 62566 bytes
 [SAMPLES] Cached: wurlitzer-v3-E3 {progress: '25/36', bufferSizeKB: 61, aliases: Array(2)}
 [SAMPLES][Progress] 25/36 samples loaded (69%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-E3 cached (25/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-G2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-G2 
 🔍 [CACHE-HIT] wurlitzer-v3-G2: 73640 bytes
 [SAMPLES] Cached: wurlitzer-v3-G2 {progress: '26/36', bufferSizeKB: 72, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-G2 cached (26/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-Cs2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-Cs2 
 🔍 [CACHE-HIT] wurlitzer-v2-Cs2: 68415 bytes
 [SAMPLES] Cached: wurlitzer-v2-Cs2 {progress: '27/36', bufferSizeKB: 67, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Cs2 cached (27/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-C2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-C2 
 🔍 [CACHE-HIT] wurlitzer-v3-C2: 74301 bytes
 [SAMPLES] Cached: wurlitzer-v3-C2 {progress: '28/36', bufferSizeKB: 73, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-C2 cached (28/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-G1
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-G1 
 🔍 [CACHE-HIT] wurlitzer-v3-G1: 99143 bytes
 [SAMPLES] Cached: wurlitzer-v3-G1 {progress: '29/36', bufferSizeKB: 97, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-G1 cached (29/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-Gs1
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-Gs1 
 🔍 [CACHE-HIT] wurlitzer-v4-Gs1: 104265 bytes
 [SAMPLES] Cached: wurlitzer-v4-Gs1 {progress: '30/36', bufferSizeKB: 102, aliases: Array(2)}
 [SAMPLES][Progress] 30/36 samples loaded (83%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Gs1 cached (30/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-Gs1
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-Gs1 
 🔍 [CACHE-HIT] wurlitzer-v3-Gs1: 100329 bytes
 [SAMPLES] Cached: wurlitzer-v3-Gs1 {progress: '31/36', bufferSizeKB: 98, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Gs1 cached (31/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v5-Ds4
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v5-Ds4 
 🔍 [CACHE-HIT] wurlitzer-v5-Ds4: 58002 bytes
 [SAMPLES] Cached: wurlitzer-v5-Ds4 {progress: '32/36', bufferSizeKB: 57, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v5-Ds4 cached (32/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-Ds4
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-Ds4 
 🔍 [CACHE-HIT] wurlitzer-v4-Ds4: 54420 bytes
 [SAMPLES] Cached: wurlitzer-v4-Ds4 {progress: '33/36', bufferSizeKB: 53, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Ds4 cached (33/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-Cs4
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-Cs4 
 🔍 [CACHE-HIT] wurlitzer-v3-Cs4: 53066 bytes
 [SAMPLES] Cached: wurlitzer-v3-Cs4 {progress: '34/36', bufferSizeKB: 52, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Cs4 cached (34/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-F4
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-F4 
 🔍 [CACHE-HIT] wurlitzer-v3-F4: 67994 bytes
 [SAMPLES] Cached: wurlitzer-v3-F4 {progress: '35/36', bufferSizeKB: 66, aliases: Array(2)}
 [SAMPLES][Progress] 35/36 samples loaded (97%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-F4 cached (35/36) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v5-D3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v5-D3 
 🔍 [CACHE-HIT] wurlitzer-v5-D3: 71583 bytes
 [SAMPLES] Cached: wurlitzer-v5-D3 {progress: '36/36', bufferSizeKB: 70, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v5-D3 cached (36/36) 
 ✅ [SAMPLES] Harmony samples preloaded {timestamp: '2025-12-11T10:22:00.711Z', durationMs: '6.70', samplesLoaded: 36, totalSamples: 36, successRate: '100%', …}
 [HarmonyPreloadStrategy] 📝 ✅ Exercise-specific harmony samples preloaded as AudioBuffers {duration: '6.70ms', samplesLoaded: 36, totalSamples: 36, successRate: '100%'}
 🎵 [AFTER-HARMONY-LOAD] Harmony loading completed: {success: true, loaded: 36, total: 36}
 [InitialSamplePreloader] 📝 ✅ Harmony FAANG smart loading complete {samplesLoaded: 36, savingsVsFullLoad: '70%'}
 🔧 [BEFORE-PLAYBACK-ENGINE] About to inject buffers into PlaybackEngine
 🔍 [BUFFER-INJECTION] Found 36 cached buffers for wurlitzer: (5) ['wurlitzer-v2-As1', 'wurlitzer-v3-As1', 'wurlitzer-v4-Cs3', 'wurlitzer-v3-Gs2', 'wurlitzer-v4-Gs2']
 ✅ [BUFFER-INJECTION] Collected 36 buffers for PlaybackEngine
 [Scheduler] 📝 ✅ Scheduler buffers injected {bufferKeys: Array(36), bufferCount: 36, hasDestination: true, instanceId: 'z57sigvms'}
 🔍 [BUFFER-PARSE] key="v2-As1" → layer="v2", note="As1", duration=9.75s
 🔍 [BUFFER-PARSE] key="v3-As1" → layer="v3", note="As1", duration=10.74s
 🔍 [BUFFER-PARSE] key="v4-Cs3" → layer="v4", note="Cs3", duration=9.04s
 🔍 [BUFFER-PARSE] key="v3-Gs2" → layer="v3", note="Gs2", duration=8.62s
 🔍 [BUFFER-PARSE] key="v4-Gs2" → layer="v4", note="Gs2", duration=8.95s
 🔍 [BUFFER-PARSE] key="v2-C3" → layer="v2", note="C3", duration=7.70s
 🔍 [BUFFER-PARSE] key="v3-C3" → layer="v3", note="C3", duration=8.21s
 🔍 [BUFFER-PARSE] key="v3-Gs3" → layer="v3", note="Gs3", duration=6.89s
 🔍 [BUFFER-PARSE] key="v4-Gs3" → layer="v4", note="Gs3", duration=6.35s
 🔍 [BUFFER-PARSE] key="v2-Gs3" → layer="v2", note="Gs3", duration=6.73s
 🔍 [BUFFER-PARSE] key="v3-Ds3" → layer="v3", note="Ds3", duration=8.27s
 🔍 [BUFFER-PARSE] key="v2-Ds3" → layer="v2", note="Ds3", duration=7.44s
 🔍 [BUFFER-PARSE] key="v3-F2" → layer="v3", note="F2", duration=10.16s
 🔍 [BUFFER-PARSE] key="v3-G3" → layer="v3", note="G3", duration=6.58s
 🔍 [BUFFER-PARSE] key="v4-G3" → layer="v4", note="G3", duration=5.90s
 🔍 [BUFFER-PARSE] key="v3-As3" → layer="v3", note="As3", duration=6.57s
 🔍 [BUFFER-PARSE] key="v2-Fs2" → layer="v2", note="Fs2", duration=9.43s
 🔍 [BUFFER-PARSE] key="v3-F3" → layer="v3", note="F3", duration=6.64s
 🔍 [BUFFER-PARSE] key="v3-D2" → layer="v3", note="D2", duration=9.17s
 🔍 [BUFFER-PARSE] key="v2-Ds2" → layer="v2", note="Ds2", duration=8.72s
 🔍 [BUFFER-PARSE] key="v3-As2" → layer="v3", note="As2", duration=8.79s
 🔍 [BUFFER-PARSE] key="v3-C4" → layer="v3", note="C4", duration=7.47s
 🔍 [BUFFER-PARSE] key="v2-E2" → layer="v2", note="E2", duration=8.88s
 🔍 [BUFFER-PARSE] key="v3-E2" → layer="v3", note="E2", duration=9.13s
 🔍 [BUFFER-PARSE] key="v3-E3" → layer="v3", note="E3", duration=8.33s
 🔍 [BUFFER-PARSE] key="v3-G2" → layer="v3", note="G2", duration=9.46s
 🔍 [BUFFER-PARSE] key="v2-Cs2" → layer="v2", note="Cs2", duration=8.91s
 🔍 [BUFFER-PARSE] key="v3-C2" → layer="v3", note="C2", duration=9.36s
 🔍 [BUFFER-PARSE] key="v3-G1" → layer="v3", note="G1", duration=12.69s
 🔍 [BUFFER-PARSE] key="v4-Gs1" → layer="v4", note="Gs1", duration=13.45s
 🔍 [BUFFER-PARSE] key="v3-Gs1" → layer="v3", note="Gs1", duration=12.94s
 🔍 [BUFFER-PARSE] key="v5-Ds4" → layer="v5", note="Ds4", duration=7.73s
 🔍 [BUFFER-PARSE] key="v4-Ds4" → layer="v4", note="Ds4", duration=7.28s
 🔍 [BUFFER-PARSE] key="v3-Cs4" → layer="v3", note="Cs4", duration=7.05s
 🔍 [BUFFER-PARSE] key="v3-F4" → layer="v3", note="F4", duration=9.58s
 🔍 [BUFFER-PARSE] key="v5-D3" → layer="v5", note="D3", duration=9.46s
 [INFO] [VelocityLayerSelector] Instrument changed {from: 'wurlitzer', to: 'wurlitzer'}
 [INFO] [HarmonySchedulerV2] Harmony buffers injected {layerCount: 4, layers: Array(4), instrument: 'wurlitzer', instanceId: 'z57sigvms'}
 [HARMONY] BUFFER MAP INJECTED for wurlitzer:
   v3: F2:10.16s, F3:6.64s, F4:9.58s
 [PlaybackEngine] 📝 HarmonySchedulerV2 buffers set {layerCount: 4, instrument: 'wurlitzer'}
 [PlaybackEngine] 📝 Harmony buffers set {bufferCount: 36, instanceId: 'z57sigvms'}
 [InitialSamplePreloader] 📝 ✅ Harmony buffers injected into PlaybackEngine {instrument: 'wurlitzer', buffersInjected: 36, cachedKeys: 36}
 ✅ [AFTER-PLAYBACK-ENGINE] PlaybackEngine injection attempt completed
 [InitialSamplePreloader] ⚠️ ⚠️ No voice cue buffers available for injection 
overrideMethod @ installHook.js:1
log @ webpack-internal:///…utils/logger.ts:268
warn @ webpack-internal:///…utils/logger.ts:246
executeLoadFullSamples @ webpack-internal:///…plePreloader.ts:433
await in executeLoadFullSamples
loadFullSamples @ webpack-internal:///…plePreloader.ts:140
ExerciseSelector.useEffect.loadFullSamplesWhenVisible @ webpack-internal:///…ciseSelector.tsx:60
 🔍 [BEFORE-BASS-CHECK] Checking if bass loading needed: {hasBasslineMidiUrl: true, basslineMidiUrl: 'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v…492f-a4f3-1b79ca6db8ca/1765405898801_bassline.mid'}
 [BassPreloadStrategy] 📝 🎸 FAANG MIDI-based bass sample loading... {exerciseId: ExerciseId, exerciseTitle: 'NEEE', hasBasslineMidi: true}
 [BasslineNoteExtractor] 📝 📥 Fetching bassline MIDI file... {midiUrl: 'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v…492f-a4f3-1b79ca6db8ca/1765405898801_bassline.mid'}
 [BasslineNoteExtractor] 📝 ✅ Bassline MIDI note extraction complete {totalTracks: 1, uniqueNotes: 11, durationMs: '3.50', lowestNote: 'F1', highestNote: 'F2', …}
 [BassPreloadStrategy] 📝 📊 Bassline MIDI analysis complete - loading exercise-specific samples {uniqueNotes: 11, noteRange: 'F1 to F2', totalSamplesToLoad: 11, savedSamples: 13, savingsPercentage: '54%'}
 [BassPreloadStrategy] ⚠️ CoreServices not available - bass samples will load on widget initialization 
overrideMethod @ installHook.js:1
log @ webpack-internal:///…utils/logger.ts:268
warn @ webpack-internal:///…utils/logger.ts:246
loadFullSamples @ webpack-internal:///…eloadStrategy.ts:82
await in loadFullSamples
executeLoadFullSamples @ webpack-internal:///…plePreloader.ts:466
await in executeLoadFullSamples
loadFullSamples @ webpack-internal:///…plePreloader.ts:140
ExerciseSelector.useEffect.loadFullSamplesWhenVisible @ webpack-internal:///…ciseSelector.tsx:60
 [InitialSamplePreloader] 📝 ✅ Bass FAANG smart loading complete {samplesLoaded: 0, savingsVsFullLoad: 'N/A'}
 [InitialSamplePreloader] 📝 📊 Final GlobalSampleCache stats: {instruments: 2, samples: 48, totalCached: 50}
 ✅ [LOADING-COMPLETE] Sample load completed for: {instrument: 'wurlitzer', loadingKey: 'harmony-wurlitzer', harmonyResult: {…}}
 🎧 [HARMONY-WIDGET] Received harmony-samples-loaded event (window): {exerciseId: ExerciseId, instrument: 'wurlitzer', samplesLoaded: 36, exerciseTitle: 'NEEE'}
 📢 [EXERCISE-SELECTOR] Emitted harmony-samples-loaded event {exerciseId: ExerciseId, instrument: 'wurlitzer', samplesLoaded: 36}
 [INFO] [frontend:HarmonyWidget] 🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered: {timestamp: 1765448520719, isPlaying: false, trackIsReady: true, wamPluginLoaded: true, hasPlugin: true, …}
 🔥🔥🔥 [HARMONY-WIDGET] ALL CONDITIONS MET - Registering harmony buffers! {timestamp: 1765448520719, exerciseId: ExerciseId, harmonyNotesCount: 129, isPlaying: false, reason: 'exercise changed'}
 🎹🎹🎹 [HARMONY-WIDGET] registerHarmonyWithPlaybackEngine CALLED {timestamp: '2025-12-11T10:22:00.720Z', callStack: Array(3)}
 ✅ [HARMONY-WIDGET] Plugin and audioNode available
 ✅ [HARMONY-WIDGET] Exercise has harmony notes: 129
 🎹 [HARMONY-WIDGET] Registering harmony with PlaybackEngine
 ✅ [HARMONY-WIDGET] Core services available
 ✅ [HARMONY-WIDGET] PlaybackEngine available
 🔧 [HARMONY-WIDGET] Starting buffer injection...
 ✅ [HARMONY-WIDGET] Got GlobalSampleCache instance
 🎹 [HARMONY-WIDGET] Exercise instrument detection: {exerciseId: ExerciseId, exerciseTitle: 'JOO', harmonyInstrument: 'wurlitzer', harmonyInstrumentType: 'string', harmonyInstrumentIsDefined: true, …}
 🎹 [HARMONY-WIDGET] Looking for instrument-specific buffers: wurlitzer
 ✅ [HARMONY-WIDGET] All required samples cached, proceeding with registration {requiredNotes: Array(26), cachedKeys: 36}
 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-As1 → v2-As1
 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-As1 → v3-As1
 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Cs3 → v4-Cs3
 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Gs2 → v3-Gs2
 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Gs2 → v4-Gs2
 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-C3 → v2-C3
 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-C3 → v3-C3
 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Gs3 → v3-Gs3
 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Gs3 → v4-Gs3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Gs3 → v2-Gs3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Ds3 → v3-Ds3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Ds3 → v2-Ds3
HarmonyWidget.tsx:1703 🔍 [F-NOTE-WIDGET] wurlitzer-v3-F2 → v3-F2: length=447967, duration=10.16s, sampleRate=44100
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-F2 → v3-F2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-G3 → v3-G3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-G3 → v4-G3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-As3 → v3-As3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Fs2 → v2-Fs2
HarmonyWidget.tsx:1703 🔍 [F-NOTE-WIDGET] wurlitzer-v3-F3 → v3-F3: length=292735, duration=6.64s, sampleRate=44100
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-F3 → v3-F3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-D2 → v3-D2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Ds2 → v2-Ds2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-As2 → v3-As2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-C4 → v3-C4
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-E2 → v2-E2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-E2 → v3-E2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-E3 → v3-E3
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-G2 → v3-G2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v2-Cs2 → v2-Cs2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-C2 → v3-C2
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-G1 → v3-G1
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Gs1 → v4-Gs1
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Gs1 → v3-Gs1
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v5-Ds4 → v5-Ds4
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v4-Ds4 → v4-Ds4
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-Cs4 → v3-Cs4
HarmonyWidget.tsx:1703 🔍 [F-NOTE-WIDGET] wurlitzer-v3-F4 → v3-F4: length=422566, duration=9.58s, sampleRate=44100
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v3-F4 → v3-F4
HarmonyWidget.tsx:1706 ✅ [HARMONY-WIDGET] Found buffer: wurlitzer-v5-D3 → v5-D3
HarmonyWidget.tsx:1718 🎧 [HARMONY-WIDGET] AudioContext info: {hasAudioEngine: true, hasAudioContext: true, hasDestination: true, destinationType: 'AudioDestinationNode', state: 'running'}
HarmonyWidget.tsx:1730 📖 [HARMONY-WIDGET] Loading instrument config: wurlitzer
HarmonyWidget.tsx:1754 ✅ [HARMONY-WIDGET] Loaded per-note velocity ranges {instrument: 'wurlitzer', hasRanges: true, noteCount: 64}
logger.ts:325 [Scheduler] 📝 ✅ Scheduler buffers injected {bufferKeys: Array(36), bufferCount: 36, hasDestination: true, instanceId: 'z57sigvms'}
structured-logger.js:186 [INFO] [VelocityLayerSelector] Instrument changed {from: 'wurlitzer', to: 'wurlitzer'}
structured-logger.js:186 [INFO] [VelocityLayerSelector] Per-note velocity ranges updated {hasRanges: true, noteCount: 64}
logger.ts:325 [Scheduler] 📝 Harmony instrument updated {instrument: 'wurlitzer', octaveShift: 12, hasPerNoteRanges: true}
logger.ts:325 [PlaybackEngine] 📝 Harmony instrument set {instrument: 'wurlitzer', bufferCount: 36}
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-As1" → layer="v2", note="As1", duration=9.75s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-As1" → layer="v3", note="As1", duration=10.74s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Cs3" → layer="v4", note="Cs3", duration=9.04s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Gs2" → layer="v3", note="Gs2", duration=8.62s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Gs2" → layer="v4", note="Gs2", duration=8.95s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-C3" → layer="v2", note="C3", duration=7.70s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-C3" → layer="v3", note="C3", duration=8.21s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Gs3" → layer="v3", note="Gs3", duration=6.89s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Gs3" → layer="v4", note="Gs3", duration=6.35s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Gs3" → layer="v2", note="Gs3", duration=6.73s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Ds3" → layer="v3", note="Ds3", duration=8.27s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Ds3" → layer="v2", note="Ds3", duration=7.44s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-F2" → layer="v3", note="F2", duration=10.16s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-G3" → layer="v3", note="G3", duration=6.58s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-G3" → layer="v4", note="G3", duration=5.90s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-As3" → layer="v3", note="As3", duration=6.57s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Fs2" → layer="v2", note="Fs2", duration=9.43s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-F3" → layer="v3", note="F3", duration=6.64s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-D2" → layer="v3", note="D2", duration=9.17s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Ds2" → layer="v2", note="Ds2", duration=8.72s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-As2" → layer="v3", note="As2", duration=8.79s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-C4" → layer="v3", note="C4", duration=7.47s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-E2" → layer="v2", note="E2", duration=8.88s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-E2" → layer="v3", note="E2", duration=9.13s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-E3" → layer="v3", note="E3", duration=8.33s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-G2" → layer="v3", note="G2", duration=9.46s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Cs2" → layer="v2", note="Cs2", duration=8.91s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-C2" → layer="v3", note="C2", duration=9.36s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-G1" → layer="v3", note="G1", duration=12.69s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Gs1" → layer="v4", note="Gs1", duration=13.45s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Gs1" → layer="v3", note="Gs1", duration=12.94s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v5-Ds4" → layer="v5", note="Ds4", duration=7.73s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Ds4" → layer="v4", note="Ds4", duration=7.28s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Cs4" → layer="v3", note="Cs4", duration=7.05s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-F4" → layer="v3", note="F4", duration=9.58s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v5-D3" → layer="v5", note="D3", duration=9.46s
structured-logger.js:186 [INFO] [VelocityLayerSelector] Instrument changed {from: 'wurlitzer', to: 'wurlitzer'}
structured-logger.js:186 [INFO] [VelocityLayerSelector] Per-note velocity ranges updated {hasRanges: true, noteCount: 64}
structured-logger.js:186 [INFO] [HarmonySchedulerV2] Harmony buffers injected {layerCount: 4, layers: Array(4), instrument: 'wurlitzer', instanceId: 'z57sigvms'}
HarmonySchedulerV2.ts:183 [HARMONY] BUFFER MAP INJECTED for wurlitzer:
HarmonySchedulerV2.ts:189   v3: F2:10.16s, F3:6.64s, F4:9.58s
logger.ts:325 [PlaybackEngine] 📝 HarmonySchedulerV2 buffers set {layerCount: 4, instrument: 'wurlitzer'}
logger.ts:325 [PlaybackEngine] 📝 Harmony buffers set {bufferCount: 36, instanceId: 'z57sigvms'}
HarmonyWidget.tsx:1774 ✅ [HARMONY-WIDGET] Harmony buffers injected into PlaybackEngine {instrument: 'wurlitzer', buffersInjected: 36, audioContextState: 'running', hasVelocityRanges: true}
HarmonyWidget.tsx:1891 🎼 [HARMONY-WIDGET] Normalizing MIDI to start at measure 0 (bar 1): {firstEventOriginal: {…}, offsets: {…}, totalNotes: 129, totalCCEvents: 38, result: 'MIDI file start → measure 0 (bar 1 of exercise), all events shifted by offset'}
HarmonyWidget.tsx:1904 [HARMONY-FLOW] STEP 1 - Supabase notes: (10) ['1: A#2 (MIDI 46) ticks=0', '2: C#4 (MIDI 61) ticks=0', '3: G#3 (MIDI 56) ticks=2', '4: C4 (MIDI 60) ticks=2', '5: G#4 (MIDI 68) ticks=2', '6: D#4 (MIDI 63) ticks=4', '7: F3 (MIDI 53) ticks=12', '8: G4 (MIDI 67) ticks=372', '9: A#4 (MIDI 70) ticks=717', '10: F#3 (MIDI 54) ticks=719']
HarmonyWidget.tsx:1920 [HARMONY DURATION DIAGNOSTIC] Note 1: {durationTicks: 202, bpm: 69, calculation: '(202 / 480) * (60 / 69)', durationSeconds: 0.36594202898550726, expectedAt69BPM: 0.36594202898550726}
HarmonyWidget.tsx:1931 [PPQ DIAGNOSTIC] Note 1: {positionTick: 0, durationTicks: 202, tickRatio: '0.00', expectedPPQ: 480, suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ', …}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 1 RAW DATA from database: {id: 'harmony-note-1', ticks: 0, ticksType: 'number', ticksUndefined: false, pitch: 46, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 1 EVENT OBJECT created: {noteName: 'A#2', absoluteTicksVariable: 0, eventDataTicks: 0, areEqual: true}
HarmonyWidget.tsx:1920 [HARMONY DURATION DIAGNOSTIC] Note 2: {durationTicks: 179, bpm: 69, calculation: '(179 / 480) * (60 / 69)', durationSeconds: 0.3242753623188406, expectedAt69BPM: 0.3242753623188406}
HarmonyWidget.tsx:1931 [PPQ DIAGNOSTIC] Note 2: {positionTick: 0, durationTicks: 179, tickRatio: '0.00', expectedPPQ: 480, suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ', …}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 2 RAW DATA from database: {id: 'harmony-note-2', ticks: 0, ticksType: 'number', ticksUndefined: false, pitch: 61, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 2 EVENT OBJECT created: {noteName: 'C#4', absoluteTicksVariable: 0, eventDataTicks: 0, areEqual: true}
HarmonyWidget.tsx:1920 [HARMONY DURATION DIAGNOSTIC] Note 3: {durationTicks: 200, bpm: 69, calculation: '(200 / 480) * (60 / 69)', durationSeconds: 0.36231884057971014, expectedAt69BPM: 0.36231884057971014}
HarmonyWidget.tsx:1931 [PPQ DIAGNOSTIC] Note 3: {positionTick: 2, durationTicks: 200, tickRatio: '0.01', expectedPPQ: 480, suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ', …}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 3 RAW DATA from database: {id: 'harmony-note-3', ticks: 2, ticksType: 'number', ticksUndefined: false, pitch: 56, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 3 EVENT OBJECT created: {noteName: 'G#3', absoluteTicksVariable: 2, eventDataTicks: 2, areEqual: true}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 4 RAW DATA from database: {id: 'harmony-note-4', ticks: 2, ticksType: 'number', ticksUndefined: false, pitch: 60, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 4 EVENT OBJECT created: {noteName: 'C4', absoluteTicksVariable: 2, eventDataTicks: 2, areEqual: true}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 5 RAW DATA from database: {id: 'harmony-note-5', ticks: 2, ticksType: 'number', ticksUndefined: false, pitch: 68, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 5 EVENT OBJECT created: {noteName: 'G#4', absoluteTicksVariable: 2, eventDataTicks: 2, areEqual: true}
HarmonyWidget.tsx:1952 [HARMONY WIDGET] Note 9 RAW DATA from database: {id: 'harmony-note-9', ticks: 717, ticksType: 'number', ticksUndefined: false, pitch: 70, …}
HarmonyWidget.tsx:1991 [HARMONY WIDGET] Note 9 EVENT OBJECT created: {noteName: 'A#4', absoluteTicksVariable: 717, eventDataTicks: 717, areEqual: true}
HarmonyWidget.tsx:2011 [HARMONY WIDGET] CC64 event 1 from database: {cc: 64, value: 0, absoluteTicks: 0, position: {…}}
HarmonyWidget.tsx:2011 [HARMONY WIDGET] CC64 event 2 from database: {cc: 64, value: 127, absoluteTicks: 66, position: {…}}
HarmonyWidget.tsx:2011 [HARMONY WIDGET] CC64 event 3 from database: {cc: 64, value: 0, absoluteTicks: 748, position: {…}}
HarmonyWidget.tsx:2088 [HARMONY WIDGET] allHarmonyEvents - first 3 notes after combining: (3) [{…}, {…}, {…}]
HarmonyWidget.tsx:2100 🎛️ [HARMONY-WIDGET] Control changes and durations: {noteCount: 129, controlChangeCount: 38, totalEvents: 167, sustainEvents: 38, cc64Timeline: Array(38), …}
HarmonyWidget.tsx:2158 🚨🚨🚨 [TIMING-DIAGNOSTIC] About to register harmony track! {timestamp: '2025-12-11T10:22:00.728Z', isRunning: false, method: 'registerTracks', trackId: 'harmony-widget-track', regionsCount: 1, …}
HarmonyWidget.tsx:2176 📝 [HARMONY-WIDGET] PlaybackEngine not running yet - using registerTracks()
logger.ts:325 [PlaybackEngine] 📝 Track registered: harmony-widget-track {instrumentType: 'harmony', regionsCount: 1}
HarmonyWidget.tsx:2185 ✅✅✅ [TIMING-DIAGNOSTIC] Harmony track registration completed! {timestamp: '2025-12-11T10:22:00.729Z'}
HarmonyWidget.tsx:2192 ✅ [HARMONY-WIDGET] Harmony registered with PlaybackEngine {eventsCount: 129, duration: 27.82608695652174, bpm: 69, method: 'registerTracks'}
structured-logger.js:186 [INFO] [frontend:HarmonyWidget] 🎹 Harmony registered with PlaybackEngine {noteCount: 129, exerciseId: '6fd6faa0-6494-4022-85df-a61565f5e366', bpm: 69, isRunning: false}
logger.ts:325 [exercise-selector] 📝 ✅ All exercise samples preloaded successfully {totalExercises: 2}
logger.ts:325 [scroll-trigger-loader] 📝 🚀 First user interaction detected - starting initialization sequence 
logger.ts:325 [scroll-trigger-loader] 📝 [1/3] Ensuring CoreServices is pre-initialized... 
logger.ts:325 [scroll-trigger-loader] 📝 ✅ CoreServices already exists 
 [scroll-trigger-loader] 📝 [2/3] Loading samples for all 2 exercises in tutorial... 
 [InitialSamplePreloader] 📝 🎯 Tutorial-level sample loading started {tutorialId: '5baf5c62-07fb-4356-bfa2-d6c97b3b7bf9', exerciseCount: 2}
 [InitialSamplePreloader] 📝 📊 Tutorial sample analysis complete {tutorialId: '5baf5c62-07fb-4356-bfa2-d6c97b3b7bf9', uniqueInstruments: 1, totalHarmonyNotes: 26, hasBass: false, hasDrums: true}
 [InitialSamplePreloader] 📝 Loading harmony samples for wurlitzer {noteCount: 26, notes: Array(10)}
 🎵 [LOADING-START] Starting sample load for: {instrument: 'wurlitzer', exerciseId: undefined, loadingKey: 'tutorial-wurlitzer', hasHarmonyNotes: true, harmonyNotesCount: 26, …}
 [InitialSamplePreloader] 📝 🚀 Phase 2: Registering instrument configurations (no AudioContext required)... 
 [InitialSamplePreloader] 📝 🗣️ Registering voice cue instrument configuration... 
 [PreloadableInstrumentRegistry] 📝 Registered instrument config: voice-cue-default (voice-cue) 
 [InitialSamplePreloader] 📝 ✅ Voice cue config registered 
 [InitialSamplePreloader] 📝 🎹 Registering harmony instrument configuration... 
 [PreloadableInstrumentRegistry] 📝 Registered instrument config: harmony-default (harmony) 
 [InitialSamplePreloader] 📝 ✅ Harmony config registered 
 [InitialSamplePreloader] 📝 🥁 Registering drum instrument configuration... 
 [PreloadableInstrumentRegistry] 📝 Registered instrument config: drums-default (drums) 
 [InitialSamplePreloader] 📝 ✅ Drums config registered 
 [InitialSamplePreloader] 📝 🔔 Registering metronome instrument configuration... 
 [PreloadableInstrumentRegistry] 📝 Registered instrument config: metronome-default (metronome) 
 [InitialSamplePreloader] 📝 ✅ Metronome config registered 
 [HarmonyPreloadStrategy] 📝 🎹 Optimized harmony sample loading from pre-converted data... {exerciseId: undefined, exerciseTitle: undefined, hasHarmonyNotes: true, harmonyInstrument: 'wurlitzer'}
 [HarmonyPreloadStrategy] 📝 ✅ Loaded instrument configuration {instrument: 'wurlitzer', hasPerNoteRanges: true, hasGlobalRanges: true}
 [HarmonyPreloadStrategy] 📝 [PRELOAD OCTAVE SHIFT] wurlitzer: MIDI 46 → 34 (shift: -12) 
 [HarmonyPreloadStrategy] 📝 [PRELOAD NOTE CONVERT] wurlitzer: A#1 / As1 (layer: v3), original: As2 
 [HarmonyPreloadStrategy] 📝 [PRELOAD OCTAVE SHIFT] wurlitzer: MIDI 61 → 49 (shift: -12) 
 [HarmonyPreloadStrategy] 📝 [PRELOAD NOTE CONVERT] wurlitzer: C#3 / Cs3 (layer: v4), original: Cs4 
 [HarmonyPreloadStrategy] 📝 [PRELOAD OCTAVE SHIFT] wurlitzer: MIDI 56 → 44 (shift: -12) 
 [HarmonyPreloadStrategy] 📝 [PRELOAD NOTE CONVERT] wurlitzer: G#2 / Gs2 (layer: v4), original: Gs3 
 [HarmonyPreloadStrategy] 📝 🧠 Built smart sample map {uniqueNotes: 26, totalSamples: 26, hasSampleMapping: true, availableSampleNotes: 64, samples: Array(26)}
 [InitialSamplePreloader] 📝 AudioContext is running, attempting to create instruments... 
 [InitialSamplePreloader] 📝 🎹 Creating harmony instrument with essential samples... 
 [InitialSamplePreloader] 📝 🥁 Creating drum instrument with essential samples... 
 [InitialSamplePreloader] 📝 🔔 Creating metronome instrument with essential samples... 
 [HarmonyPreloadStrategy] 📝 📊 Exercise data analysis complete - loading optimized samples with per-note config {uniqueNotes: 26, pitchRange: '43 to 77', velocityRange: '80 to 80', instrument: 'wurlitzer', totalSamplesToLoad: 26, …}
 [HarmonyPreloadStrategy] 📝 🎹 Using buffer caching with OfflineAudioContext (no user interaction required) {instrument: 'wurlitzer', totalSamplesToLoad: 26}
 🎹 [SAMPLES] Downloading harmony samples as AudioBuffers {timestamp: '2025-12-11T10:22:02.246Z', uniqueNotes: 26, instrument: 'wurlitzer', totalSamplesToLoad: 26, sampleMap: Array(26)}
 [HarmonyPreloadStrategy] 📝 🎹 Pre-downloading harmony samples as AudioBuffers using smart sample map {uniqueNotes: 26, instrument: 'wurlitzer', totalSamplesToLoad: 26}
 [InitialSamplePreloader] 📝 🎹 Phase 2 - AudioContext check: {hasContext: true, contextState: 'running', contextType: 'AudioContext', isOffline: false}
 [InitialSamplePreloader] 📝 AudioContext is running! Creating WamKeyboard instance for preloading... 
 🔍 [CHECKPOINT-7] getOrCreateKeyboardPlugin called: {requestedInstrument: undefined, hasInstrument: false, instrumentType: 'undefined', instrumentValue: undefined, contextState: 'running', …}
 🔍🔍🔍 [SINGLETON-ENTRY] getOrCreateKeyboardPlugin called {requestedInstrument: undefined, hasInstrument: false, contextState: 'running'}
 🔍🔍🔍 [SINGLETON-PRELOAD-CHECK] Checking preloaded plugin {found: false, hasAudioNode: false, requestedInstrument: undefined}
 [wam-plugin-singleton] 📝 🔍 Checking for pre-loaded harmony instrument... {found: false, type: 'undefined', hasAudioNode: false, keys: Array(0)}
 🔍🔍🔍 [SINGLETON-CACHE-CHECK] Checking cached plugin {found: false, hasAudioNode: false}
 🔍🔍🔍 [SINGLETON] Creating new WamKeyboard plugin instance {requestedInstrument: undefined, hasInstrument: false, instrumentType: 'undefined', passedState: {…}}
 🔍 [CHECKPOINT-7-CREATE-NEW] No cached plugin found, creating new: {instrument: undefined, contextState: 'running', willPassInstrument: false}
 [wam-plugin-singleton] 📝 🔨 Creating new WamKeyboard plugin instance {requestedInstrument: 'grandpiano (default)'}
 🔍🔍🔍 [SINGLETON] Calling WamKeyboard.createInstance WITHOUT instrument (deferred loading)
 🔍 [CHECKPOINT-7-BEFORE-CREATE] About to call WamKeyboard.createInstance: {willLoadInstrumentLater: false, hasContext: true}
 🔍🔍🔍 [CREATE-AUDIO-NODE] WamKeyboard.createAudioNode called with state: {hasState: true, instrument: undefined, skipInstrumentLoad: true, stateKeys: Array(0)}
 🔍🔍🔍 [CONSTRUCTOR] WamKeyboardNode constructor called {hasOptions: true, instrument: undefined, initialInstrument: undefined, optionsKeys: Array(0)}
 🔍🔍🔍 [INITIALIZE] WamKeyboardNode.initialize called {hasWindow: true, hasContext: true, initialInstrument: undefined, skipInstrumentLoad: true, willLoadInstrument: false}
 [InitialSamplePreloader] 📝 AudioContext is running! Creating drum samplers... 
 [InitialSamplePreloader] 📝 AudioContext is running! Creating WamMetronome instance... 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-As1
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-As1 
 🔍 [CACHE-HIT] wurlitzer-v3-As1: 84035 bytes
 [SAMPLES] Cached: wurlitzer-v3-As1 {progress: '1/26', bufferSizeKB: 82, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-As1 cached (1/26) 
 [InitialSamplePreloader] 📝 Loading drum pad 1 (kick): https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/colombo-acoustic/kick-v1.wav 
 [InitialSamplePreloader] 📝 Loading drum pad 3 (snare): https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/colombo-acoustic/snare-v1.wav 
 [InitialSamplePreloader] 📝 Loading drum pad 5 (hihat): https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/colombo-acoustic/hihat-v1.wav 
 [INFO] [WamMetronomeNode] 🎵 WamMetronomeNode: Using shared AudioContext, not switching Tone.js 
 [INFO] [WamMetronomeNode] ✅ Using preloaded metronome samples from memory cache! 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-Cs3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-Cs3 
 🔍 [CACHE-HIT] wurlitzer-v4-Cs3: 68579 bytes
 [SAMPLES] Cached: wurlitzer-v4-Cs3 {progress: '2/26', bufferSizeKB: 67, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Cs3 cached (2/26) 
 🔍🔍🔍 [INITIALIZE] Skipping instrument load - will use cached buffers later
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-Gs2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-Gs2 
 🔍 [CACHE-HIT] wurlitzer-v4-Gs2: 71043 bytes
 [SAMPLES] Cached: wurlitzer-v4-Gs2 {progress: '3/26', bufferSizeKB: 69, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Gs2 cached (3/26) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-C3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-C3 
 🔍 [CACHE-HIT] wurlitzer-v2-C3: 58483 bytes
 [SAMPLES] Cached: wurlitzer-v2-C3 {progress: '4/26', bufferSizeKB: 57, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-C3 cached (4/26) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-Gs3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-Gs3 
 🔍 [CACHE-HIT] wurlitzer-v3-Gs3: 53021 bytes
 [SAMPLES] Cached: wurlitzer-v3-Gs3 {progress: '5/26', bufferSizeKB: 52, aliases: Array(2)}
 [SAMPLES][Progress] 5/26 samples loaded (19%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Gs3 cached (5/26) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-Ds3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-Ds3 
 🔍 [CACHE-HIT] wurlitzer-v3-Ds3: 61530 bytes
 [SAMPLES] Cached: wurlitzer-v3-Ds3 {progress: '6/26', bufferSizeKB: 60, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Ds3 cached (6/26) 
 🔍🔍🔍 [SINGLETON] WamKeyboard.createInstance returned (instant!): {hasPlugin: true, hasAudioNode: true, currentInstrument: null}
 🔍 [CHECKPOINT-7-AFTER-CREATE] WamKeyboard.createInstance completed: {success: true, hasAudioNode: true, loadedInstrument: null, requestedInstrument: undefined}
 🔍🔍🔍 [SINGLETON-CACHE-STORED] Stored plugin in GlobalSampleCache: {key: 'wam-keyboard-singleton', hasPlugin: true, hasAudioNode: true, currentInstrument: null}
 🔍🔍🔍 [SINGLETON-CACHE-VERIFY] Immediately verified cache: {found: true, hasAudioNode: true}
 [wam-plugin-singleton] 📝 ✅ Created and cached new WamKeyboard plugin (locally and globally) 
 [INFO] [WamMetronomeNode] 🎵 WamMetronomeNode: Using shared AudioContext, not switching Tone.js 
 [INFO] [WamMetronomeNode] ✅ Using preloaded metronome samples from memory cache! 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-F2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-F2 
 🔍 [CACHE-HIT] wurlitzer-v3-F2: 78833 bytes
 [SAMPLES] Cached: wurlitzer-v3-F2 {progress: '7/26', bufferSizeKB: 77, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-F2 cached (7/26) 
 [InitialSamplePreloader] 📝 Connected harmony instrument to destination 
 [InitialSamplePreloader] 📝 🎹 Harmony instrument created, samples downloading in background... 
 [InitialSamplePreloader] 📝 ✅ Instrument cached in GlobalSampleCache as "harmony-preloaded" 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-G3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-G3 
 🔍 [CACHE-HIT] wurlitzer-v3-G3: 50420 bytes
 [SAMPLES] Cached: wurlitzer-v3-G3 {progress: '8/26', bufferSizeKB: 49, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-G3 cached (8/26) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-As3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-As3 
 🔍 [CACHE-HIT] wurlitzer-v3-As3: 51259 bytes
 [SAMPLES] Cached: wurlitzer-v3-As3 {progress: '9/26', bufferSizeKB: 50, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-As3 cached (9/26) 
 [InitialSamplePreloader] 📝 Connected metronome to destination 
 [InitialSamplePreloader] 📝 ✅ Metronome instrument created with samples 
 [InitialSamplePreloader] 📝 ✅ Metronome cached in GlobalSampleCache as "metronome-preloaded" 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-Fs2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-Fs2 
 🔍 [CACHE-HIT] wurlitzer-v2-Fs2: 71410 bytes
 [SAMPLES] Cached: wurlitzer-v2-Fs2 {progress: '10/26', bufferSizeKB: 70, aliases: Array(2)}
 [SAMPLES][Progress] 10/26 samples loaded (38%)
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Fs2 cached (10/26) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-F3
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-F3 
 🔍 [CACHE-HIT] wurlitzer-v3-F3: 51104 bytes
 [SAMPLES] Cached: wurlitzer-v3-F3 {progress: '11/26', bufferSizeKB: 50, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-F3 cached (11/26) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-D2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-D2 
 🔍 [CACHE-HIT] wurlitzer-v3-D2: 72093 bytes
 [SAMPLES] Cached: wurlitzer-v3-D2 {progress: '12/26', bufferSizeKB: 70, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-D2 cached (12/26) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-Ds2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-Ds2 
 🔍 [CACHE-HIT] wurlitzer-v2-Ds2: 68661 bytes
 [SAMPLES] Cached: wurlitzer-v2-Ds2 {progress: '13/26', bufferSizeKB: 67, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Ds2 cached (13/26) 
 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-As2
 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-As2 
 🔍 [CACHE-HIT] wurlitzer-v3-As2: 67629 bytes
 [SAMPLES] Cached: wurlitzer-v3-As2 {progress: '14/26', bufferSizeKB: 66, aliases: Array(2)}
 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-As2 cached (14/26) 
 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/C4... 
 🔍 [DOWNLOAD] wurlitzer-v2-C4: 51407 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/C4_v2.ogg
 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-C4', instrument: 'wurlitzer', layer: 'v2', noteName: 'C4', bufferSizeKB: 50}
 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-C4 to IndexedDB...
 [InitialSamplePreloader] 📝 ✅ Drum pad 1 (kick) loaded 
 [InitialSamplePreloader] 📝 ✅ Drum pad 3 (snare) loaded 
 [InitialSamplePreloader] 📝 ✅ Drum pad 5 (hihat) loaded 
 [InitialSamplePreloader] 📝 ✅ All drum samples loaded successfully 
 [InitialSamplePreloader] 📝 ✅ Drums cached in GlobalSampleCache as "drums-preloaded" 
 [InitialSamplePreloader] 📝 ✅ Instrument configurations registered! 
 [InitialSamplePreloader] 📝 🎯 Setting up PlaybackEngine for instant playback... 
 [InitialSamplePreloader] 📝 ✅ Using PlaybackEngine for buffer preloading (Phase 3.1 refactor) 
logger.ts:325 [InitialSamplePreloader] 📝 📥 Pre-downloading sample files... 
logger.ts:325 [InitialSamplePreloader] 📝 📥 Pre-downloading sample files... 
InitialSamplePreloader.ts:1759 💾 [INDEXEDDB-HIT] Using cached sample: metronome-low
logger.ts:325 [InitialSamplePreloader] 📝 💾 IndexedDB cache HIT: metronome/Click_low2_fixed.mp3 
InitialSamplePreloader.ts:1759 💾 [INDEXEDDB-HIT] Using cached sample: metronome-high
logger.ts:325 [InitialSamplePreloader] 📝 💾 IndexedDB cache HIT: metronome/Click_high2_fixed.mp3 
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-C4: {success: true, path: 'wurlitzer-v2-C4', size: 51407, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-C4
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - C4 v2: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v2-C4 {progress: '15/26', bufferSizeKB: 50, aliases: Array(2)}
HarmonyPreloadStrategy.ts:971 [SAMPLES][Progress] 15/26 samples loaded (58%)
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-C4 cached (15/26) 
HarmonyPreloadStrategy.ts:807 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-E2
logger.ts:325 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-E2 
HarmonyPreloadStrategy.ts:814 🔍 [CACHE-HIT] wurlitzer-v3-E2: 72248 bytes
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-E2 {progress: '16/26', bufferSizeKB: 71, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-E2 cached (16/26) 
HarmonyPreloadStrategy.ts:807 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-E3
logger.ts:325 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-E3 
HarmonyPreloadStrategy.ts:814 🔍 [CACHE-HIT] wurlitzer-v3-E3: 62566 bytes
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-E3 {progress: '17/26', bufferSizeKB: 61, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-E3 cached (17/26) 
HarmonyPreloadStrategy.ts:807 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-G2
logger.ts:325 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-G2 
HarmonyPreloadStrategy.ts:814 🔍 [CACHE-HIT] wurlitzer-v3-G2: 73640 bytes
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-G2 {progress: '18/26', bufferSizeKB: 72, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-G2 cached (18/26) 
HarmonyPreloadStrategy.ts:807 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v2-Cs2
logger.ts:325 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v2-Cs2 
HarmonyPreloadStrategy.ts:814 🔍 [CACHE-HIT] wurlitzer-v2-Cs2: 68415 bytes
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v2-Cs2 {progress: '19/26', bufferSizeKB: 67, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-Cs2 cached (19/26) 
HarmonyPreloadStrategy.ts:807 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-C2
logger.ts:325 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-C2 
HarmonyPreloadStrategy.ts:814 🔍 [CACHE-HIT] wurlitzer-v3-C2: 74301 bytes
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-C2 {progress: '20/26', bufferSizeKB: 73, aliases: Array(2)}
HarmonyPreloadStrategy.ts:971 [SAMPLES][Progress] 20/26 samples loaded (77%)
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-C2 cached (20/26) 
HarmonyPreloadStrategy.ts:807 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-G1
logger.ts:325 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-G1 
HarmonyPreloadStrategy.ts:814 🔍 [CACHE-HIT] wurlitzer-v3-G1: 99143 bytes
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-G1 {progress: '21/26', bufferSizeKB: 97, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-G1 cached (21/26) 
HarmonyPreloadStrategy.ts:807 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-Gs1
logger.ts:325 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-Gs1 
HarmonyPreloadStrategy.ts:814 🔍 [CACHE-HIT] wurlitzer-v4-Gs1: 104265 bytes
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v4-Gs1 {progress: '22/26', bufferSizeKB: 102, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Gs1 cached (22/26) 
HarmonyPreloadStrategy.ts:807 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v4-Ds4
logger.ts:325 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v4-Ds4 
HarmonyPreloadStrategy.ts:814 🔍 [CACHE-HIT] wurlitzer-v4-Ds4: 54420 bytes
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v4-Ds4 {progress: '23/26', bufferSizeKB: 53, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-Ds4 cached (23/26) 
HarmonyPreloadStrategy.ts:807 💾 [SAMPLES][IndexedDB-HIT] Using cached sample: wurlitzer-v3-Cs4
logger.ts:325 [HarmonyPreloadStrategy] 📝 💾 IndexedDB cache HIT: wurlitzer-v3-Cs4 
HarmonyPreloadStrategy.ts:814 🔍 [CACHE-HIT] wurlitzer-v3-Cs4: 53066 bytes
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v3-Cs4 {progress: '24/26', bufferSizeKB: 52, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v3-Cs4 cached (24/26) 
logger.ts:325 [InitialSamplePreloader] 📝 📥 Fetching metronome/Cues/one.ogg... 
logger.ts:325 [InitialSamplePreloader] 📝 📥 Fetching metronome/Cues/two.ogg... 
logger.ts:325 [InitialSamplePreloader] 📝 📥 Fetching metronome/Cues/three.ogg... 
logger.ts:325 [InitialSamplePreloader] 📝 📥 Fetching metronome/Cues/four.ogg... 
logger.ts:325 [InitialSamplePreloader] 📝 📥 Fetching drums/hydrogen-kits/colombo-acoustic/kick-v1.wav... 
logger.ts:325 [InitialSamplePreloader] 📝 📥 Fetching drums/hydrogen-kits/colombo-acoustic/snare-v1.wav... 
logger.ts:325 [InitialSamplePreloader] 📝 📥 Fetching drums/hydrogen-kits/colombo-acoustic/hihat-v1.wav... 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v2/F4... 
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store voice-cue-one to IndexedDB...
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store voice-cue-three to IndexedDB...
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store voice-cue-two to IndexedDB...
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store voice-cue-four to IndexedDB...
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store drum-kick to IndexedDB...
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store drum-snare to IndexedDB...
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store drum-hihat to IndexedDB...
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v2-F4: 64001 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v2/F4_v2.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v2-F4', instrument: 'wurlitzer', layer: 'v2', noteName: 'F4', bufferSizeKB: 63}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v2-F4 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for voice-cue-one: {success: true, path: 'voice-cue-one', size: 11679, metadata: {…}}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for voice-cue-three: {success: true, path: 'voice-cue-three', size: 11297, metadata: {…}}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for voice-cue-two: {success: true, path: 'voice-cue-two', size: 11470, metadata: {…}}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for voice-cue-four: {success: true, path: 'voice-cue-four', size: 10789, metadata: {…}}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for drum-kick: {success: true, path: 'drum-kick', size: 125746, metadata: {…}}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store drum-pad-1 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for drum-snare: {success: true, path: 'drum-snare', size: 227378, metadata: {…}}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store drum-pad-3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for drum-hihat: {success: true, path: 'drum-hihat', size: 137350, metadata: {…}}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store drum-pad-5 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v2-F4: {success: true, path: 'wurlitzer-v2-F4', size: 64001, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v2-F4
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - F4 v2: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v2-F4 {progress: '25/26', bufferSizeKB: 63, aliases: Array(2)}
HarmonyPreloadStrategy.ts:971 [SAMPLES][Progress] 25/26 samples loaded (96%)
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v2-F4 cached (25/26) 
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for drum-pad-1: {success: true, path: 'drum-pad-1', size: 125746, metadata: {…}}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for drum-pad-3: {success: true, path: 'drum-pad-3', size: 227378, metadata: {…}}
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for drum-pad-5: {success: true, path: 'drum-pad-5', size: 137350, metadata: {…}}
logger.ts:325 [InitialSamplePreloader] 📝 ✅ Sample file downloading completed {duration: '25.30ms', samplesLoaded: 9, samplesTotal: 9, averagePerSample: '2.81ms'}
logger.ts:325 [InitialSamplePreloader] 📝 📊 PreloadableInstrumentRegistry status: {voice-cue-default: {…}, harmony-default: {…}, drums-default: {…}, metronome-default: {…}}
logger.ts:325 [InitialSamplePreloader] 📝 ✅ Dispatched samplesReady and essentialSamplesReady events 
logger.ts:325 [HarmonyPreloadStrategy] 📝 📥 Fetching wurlitzer/v4/D3... 
HarmonyPreloadStrategy.ts:836 🔍 [DOWNLOAD] wurlitzer-v4-D3: 70218 bytes from https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v4/D3_v4.ogg
HarmonyPreloadStrategy.ts:846 [SAMPLES] Caching buffer: {cacheKey: 'wurlitzer-v4-D3', instrument: 'wurlitzer', layer: 'v4', noteName: 'D3', bufferSizeKB: 69}
GlobalSampleCache.ts:291 [INDEXEDDB-DEBUG] Attempting to store wurlitzer-v4-D3 to IndexedDB...
GlobalSampleCache.ts:311 [INDEXEDDB-DEBUG] Store result for wurlitzer-v4-D3: {success: true, path: 'wurlitzer-v4-D3', size: 70218, metadata: {…}}
HarmonyPreloadStrategy.ts:862 [SAMPLES] Buffer cached successfully (memory + IndexedDB): wurlitzer-v4-D3
HarmonyPreloadStrategy.ts:945 [DEBUG][NoAlias] wurlitzer - D3 v4: No aliasing for instruments with per-note samples
HarmonyPreloadStrategy.ts:960 [SAMPLES] Cached: wurlitzer-v4-D3 {progress: '26/26', bufferSizeKB: 69, aliases: Array(2)}
logger.ts:325 [HarmonyPreloadStrategy] 📝 🔊 CACHE BUFFER: wurlitzer-v4-D3 cached (26/26) 
HarmonyPreloadStrategy.ts:992 ✅ [SAMPLES] Harmony samples preloaded {timestamp: '2025-12-11T10:22:02.292Z', durationMs: '45.60', samplesLoaded: 26, totalSamples: 26, successRate: '100%', …}
logger.ts:325 [HarmonyPreloadStrategy] 📝 ✅ Exercise-specific harmony samples preloaded as AudioBuffers {duration: '45.60ms', samplesLoaded: 26, totalSamples: 26, successRate: '100%'}
InitialSamplePreloader.ts:425 🎵 [AFTER-HARMONY-LOAD] Harmony loading completed: {success: true, loaded: 26, total: 26}
logger.ts:325 [InitialSamplePreloader] 📝 ✅ Harmony FAANG smart loading complete {samplesLoaded: 26, savingsVsFullLoad: '78%'}
InitialSamplePreloader.ts:440 🔧 [BEFORE-PLAYBACK-ENGINE] About to inject buffers into PlaybackEngine
InitialSamplePreloader.ts:481 🔍 [BUFFER-INJECTION] Found 39 cached buffers for wurlitzer: (5) ['wurlitzer-v2-As1', 'wurlitzer-v3-As1', 'wurlitzer-v4-Cs3', 'wurlitzer-v3-Gs2', 'wurlitzer-v4-Gs2']
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-C4
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v2-F4
InitialSamplePreloader.ts:510 🔄 [BUFFER-INJECTION] Decoded raw buffer on-demand: wurlitzer-v4-D3
InitialSamplePreloader.ts:531 ✅ [BUFFER-INJECTION] Collected 39 buffers for PlaybackEngine
logger.ts:325 [Scheduler] 📝 ✅ Scheduler buffers injected {bufferKeys: Array(39), bufferCount: 39, hasDestination: true, instanceId: 'z57sigvms'}
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-As1" → layer="v2", note="As1", duration=9.75s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-As1" → layer="v3", note="As1", duration=10.74s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Cs3" → layer="v4", note="Cs3", duration=9.04s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Gs2" → layer="v3", note="Gs2", duration=8.62s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Gs2" → layer="v4", note="Gs2", duration=8.95s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-C3" → layer="v2", note="C3", duration=7.70s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-C3" → layer="v3", note="C3", duration=8.21s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Gs3" → layer="v3", note="Gs3", duration=6.89s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Gs3" → layer="v4", note="Gs3", duration=6.35s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Gs3" → layer="v2", note="Gs3", duration=6.73s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Ds3" → layer="v3", note="Ds3", duration=8.27s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Ds3" → layer="v2", note="Ds3", duration=7.44s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-F2" → layer="v3", note="F2", duration=10.16s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-G3" → layer="v3", note="G3", duration=6.58s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-G3" → layer="v4", note="G3", duration=5.90s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-As3" → layer="v3", note="As3", duration=6.57s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Fs2" → layer="v2", note="Fs2", duration=9.43s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-F3" → layer="v3", note="F3", duration=6.64s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-D2" → layer="v3", note="D2", duration=9.17s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Ds2" → layer="v2", note="Ds2", duration=8.72s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-As2" → layer="v3", note="As2", duration=8.79s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-C4" → layer="v3", note="C4", duration=7.47s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-E2" → layer="v2", note="E2", duration=8.88s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-E2" → layer="v3", note="E2", duration=9.13s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-E3" → layer="v3", note="E3", duration=8.33s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-G2" → layer="v3", note="G2", duration=9.46s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-Cs2" → layer="v2", note="Cs2", duration=8.91s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-C2" → layer="v3", note="C2", duration=9.36s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-G1" → layer="v3", note="G1", duration=12.69s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Gs1" → layer="v4", note="Gs1", duration=13.45s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Gs1" → layer="v3", note="Gs1", duration=12.94s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v5-Ds4" → layer="v5", note="Ds4", duration=7.73s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-Ds4" → layer="v4", note="Ds4", duration=7.28s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-Cs4" → layer="v3", note="Cs4", duration=7.05s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v3-F4" → layer="v3", note="F4", duration=9.58s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v5-D3" → layer="v5", note="D3", duration=9.46s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-C4" → layer="v2", note="C4", duration=6.77s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v2-F4" → layer="v2", note="F4", duration=8.85s
PlaybackEngine.ts:1377 🔍 [BUFFER-PARSE] key="v4-D3" → layer="v4", note="D3", duration=9.07s
structured-logger.js:186 [INFO] [VelocityLayerSelector] Instrument changed {from: 'wurlitzer', to: 'wurlitzer'}
structured-logger.js:186 [INFO] [HarmonySchedulerV2] Harmony buffers injected {layerCount: 4, layers: Array(4), instrument: 'wurlitzer', instanceId: 'z57sigvms'}
HarmonySchedulerV2.ts:183 [HARMONY] BUFFER MAP INJECTED for wurlitzer:
HarmonySchedulerV2.ts:189   v2: F4:8.85s
HarmonySchedulerV2.ts:189   v3: F2:10.16s, F3:6.64s, F4:9.58s
logger.ts:325 [PlaybackEngine] 📝 HarmonySchedulerV2 buffers set {layerCount: 4, instrument: 'wurlitzer'}
logger.ts:325 [PlaybackEngine] 📝 Harmony buffers set {bufferCount: 39, instanceId: 'z57sigvms'}
logger.ts:325 [InitialSamplePreloader] 📝 ✅ Harmony buffers injected into PlaybackEngine {instrument: 'wurlitzer', buffersInjected: 39, cachedKeys: 39}
InitialSamplePreloader.ts:565 ✅ [AFTER-PLAYBACK-ENGINE] PlaybackEngine injection attempt completed
InitialSamplePreloader.ts:606 🔄 [VOICE-CUE-INJECTION] Decoded raw buffer on-demand: voice-cue-one
InitialSamplePreloader.ts:606 🔄 [VOICE-CUE-INJECTION] Decoded raw buffer on-demand: voice-cue-two
InitialSamplePreloader.ts:606 🔄 [VOICE-CUE-INJECTION] Decoded raw buffer on-demand: voice-cue-three
InitialSamplePreloader.ts:606 🔄 [VOICE-CUE-INJECTION] Decoded raw buffer on-demand: voice-cue-four
logger.ts:325 [VoiceCueScheduler] 📝 ✅ VoiceCueScheduler buffers injected {bufferKeys: Array(4), hasDestination: true, instanceId: 'z57sigvms'}
logger.ts:325 [PlaybackEngine] 📝 Voice cue buffers set {bufferCount: 4, hasDestination: true, instanceId: 'z57sigvms'}
logger.ts:325 [InitialSamplePreloader] 📝 ✅ Voice cue buffers injected into PlaybackEngine {buffersInjected: 4, bufferKeys: Array(4)}
InitialSamplePreloader.ts:644 ✅ [VOICE-CUE-INJECTION] Injected 4 voice cue buffers: (4) ['one', 'two', 'three', 'four']
InitialSamplePreloader.ts:669 🔍 [BEFORE-BASS-CHECK] Checking if bass loading needed: {hasBasslineMidiUrl: false, basslineMidiUrl: undefined}
InitialSamplePreloader.ts:677 ⏭️ [SKIP-BASS] No bassline MIDI, returning harmony result only
InitialSamplePreloader.ts:681 ✅ [LOADING-COMPLETE] Sample load completed for: {instrument: 'wurlitzer', loadingKey: 'tutorial-wurlitzer', harmonyResult: {…}}
logger.ts:325 [InitialSamplePreloader] 📝 ✅ Tutorial samples loaded successfully {tutorialId: '5baf5c62-07fb-4356-bfa2-d6c97b3b7bf9', exerciseCount: 2}
logger.ts:325 [scroll-trigger-loader] 📝 ✅ All tutorial samples loaded 
logger.ts:325 [scroll-trigger-loader] 📝 [3/3] Emitting samples-ready event... 
logger.ts:325 [scroll-trigger-loader] 📝 ✅ Initialization sequence complete! 
initSequenceLogger.ts:47 [INIT-SEQ 14] USER-GESTURE-DETECTED {timestamp: 1765448529229, eventType: 'click'}
initSequenceLogger.ts:47 [INIT-SEQ 15] RESUME-CALLED {timestamp: 1765448529230, alreadyRunning: true, contextState: 'running'}
