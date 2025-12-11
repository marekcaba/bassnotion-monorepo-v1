# UnifiedTransport Data Flow Diagrams

## 1. System Initialization Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant CS as CoreServices
    participant SR as ServiceRegistry
    participant EB as EventBus
    participant AE as AudioEngine
    participant UT as UnifiedTransport
    participant TSM as TransportSyncManager
    participant AW as AudioWorklet

    App->>CS: createCoreServices(config)
    CS->>SR: new ServiceRegistry()
    CS->>EB: new EventBus()
    CS->>AE: new AudioEngine(eventBus)
    CS->>UT: UnifiedTransport.getInstance()
    CS->>TSM: TransportSyncManager.getInstance()

    CS->>SR: register(all services)
    CS->>CS: initialize()

    CS->>SR: initialize()
    SR->>AE: initialize()
    AE->>AE: Create AudioContext
    AE->>AE: Load Tone.js
    AE->>EB: emit('audio:initialized')

    SR->>UT: initialize()
    UT->>AW: Load AudioWorklet
    UT->>UT: Setup Kalman Filter
    UT->>UT: Initialize Buffers
    UT->>EB: emit('transport:initialized')

    CS->>TSM: initialize(unifiedTransport, eventBus)
    TSM->>EB: Subscribe to transport events
    TSM->>TSM: Start heartbeat timer
```

## 2. Play Command Flow

```mermaid
flowchart TD
    A[User Clicks Play] --> B[React Component]
    B --> C{useTransport Hook}
    C --> D[TransportCommands.play()]
    D --> E[UnifiedTransport.start()]

    E --> F[Validate State]
    F --> G[Resume AudioContext]
    G --> H[Reset Position]
    H --> I[Start Timing Sources]

    I --> J[AudioWorklet.start()]
    I --> K[WebWorker.start()]
    I --> L[RAF Timer.start()]

    J --> M[Emit transport:play]
    K --> M
    L --> M

    M --> N[EventBus]
    N --> O[TransportSyncManager]
    O --> P[Broadcast to Widgets]

    P --> Q[Widget A]
    P --> R[Widget B]
    P --> S[Widget C]

    style A fill:#4CAF50
    style E fill:#2196F3
    style J fill:#FF9800
    style N fill:#9C27B0
```

## 3. Timing Update Pipeline (Every 2.67ms)

```mermaid
flowchart LR
    subgraph AudioWorklet
        A[process()] --> B[128 samples]
        B --> C[postMessage]
    end

    subgraph MainThread
        C --> D[UnifiedTransport]
        D --> E[Measure Drift]
        E --> F[Kalman Filter]
        F --> G[Predict Next]
        G --> H[Schedule Events]
    end

    subgraph Scheduling
        H --> I{Buffer Check}
        I -->|Active| J[Execute Now]
        I -->|Future| K[Queue Event]
        K --> L[Triple Buffer]
    end

    subgraph Execution
        J --> M[Trigger Callbacks]
        M --> N[Update Metrics]
        N --> O{Drift > 1ms?}
        O -->|Yes| P[Compensate]
        O -->|No| Q[Continue]
    end

    style A fill:#FF5722
    style F fill:#03A9F4
    style L fill:#8BC34A
```

## 4. Widget Synchronization Flow

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Playing: start()
    Playing --> Paused: pause()
    Paused --> Playing: resume()
    Playing --> Stopped: stop()
    Paused --> Stopped: stop()
    Stopped --> Playing: start()

    state Playing {
        [*] --> Scheduling
        Scheduling --> Processing
        Processing --> Broadcasting
        Broadcasting --> Scheduling

        state Processing {
            TimingUpdate --> DriftCheck
            DriftCheck --> EventTrigger
            EventTrigger --> MetricsUpdate
        }

        state Broadcasting {
            StateChange --> EventBus
            EventBus --> TransportSync
            TransportSync --> AllWidgets
        }
    }
```

## 5. Error Recovery Flow

```mermaid
flowchart TD
    A[Timing Error Detected] --> B{Error Type}

    B -->|AudioContext Suspended| C[User Gesture Required]
    C --> D[Show UI Prompt]
    D --> E[User Interaction]
    E --> F[Resume Context]

    B -->|High Drift| G[Drift > 5ms]
    G --> H[Resync Transport]
    H --> I[Reset Buffers]
    I --> J[Recalibrate]

    B -->|AudioWorklet Crash| K[Worklet Failed]
    K --> L[Fallback to WebWorker]
    L --> M[Reduce Precision]
    M --> N[Continue Playing]

    B -->|CPU Overload| O[CPU > 80%]
    O --> P[Increase Buffer]
    P --> Q[Reduce Update Rate]
    Q --> R[Throttle Events]

    F --> S[Normal Operation]
    J --> S
    N --> S
    R --> S

    style A fill:#F44336
    style S fill:#4CAF50
```

## 6. Performance Optimization Flow

```mermaid
graph TD
    A[Performance Monitor] --> B[Collect Metrics]
    B --> C{CPU Load}

    C -->|< 40%| D[Low Load]
    D --> E[Reduce Buffers]
    E --> F[Increase Update Rate]
    F --> G[Lower Latency Mode]

    C -->|40-70%| H[Normal Load]
    H --> I[Maintain Settings]

    C -->|> 70%| J[High Load]
    J --> K[Increase Buffers]
    K --> L[Reduce Update Rate]
    L --> M[Adaptive Mode]

    G --> N[Apply Settings]
    I --> N
    M --> N

    N --> O[Measure Impact]
    O --> B

    style A fill:#9E9E9E
    style N fill:#00BCD4
```

## 7. Event Priority Queue

```
┌─────────────────────────────────────────┐
│          Event Priority Queue           │
├─────────────────────────────────────────┤
│ CRITICAL (0-10ms)                       │
│ • Beat triggers                         │
│ • Note on/off events                    │
│ • Loop boundaries                       │
├─────────────────────────────────────────┤
│ HIGH (10-50ms)                          │
│ • Tempo changes                         │
│ • Time signature changes                │
│ • Section markers                       │
├─────────────────────────────────────────┤
│ NORMAL (50-200ms)                       │
│ • UI updates                            │
│ • Visual feedback                       │
│ • Progress indicators                   │
├─────────────────────────────────────────┤
│ LOW (200ms+)                            │
│ • Analytics events                      │
│ • Debug logging                         │
│ • Performance metrics                   │
└─────────────────────────────────────────┘
```

## 8. Memory Management

```
┌──────────────────────────────────────────────┐
│            Triple Buffer System              │
├──────────────────────────────────────────────┤
│                                              │
│  Active Buffer     Scheduling     Standby    │
│  ┌──────────┐     ┌──────────┐  ┌─────────┐│
│  │▓▓▓▓▓▓▓▓▓▓│     │░░░░░░    │  │         ││
│  │▓▓▓▓▓▓▓▓▓▓│     │░░░░░░░░  │  │         ││
│  │▓▓▓▓▓▓▓▓  │ --> │░░░░░░░░░░│  │         ││
│  │          │     │░░░░░░░░░░│  │         ││
│  └──────────┘     └──────────┘  └─────────┘│
│   Playing Now      Filling Up    Ready Next │
│                                              │
│  Rotation: Active → Standby → Scheduling    │
└──────────────────────────────────────────────┘
```

## Key Insights

1. **Separation of Concerns**: Each service has a single responsibility
2. **Event-Driven**: Loose coupling through EventBus
3. **Fault Tolerant**: Multiple fallback mechanisms
4. **Performance Adaptive**: Dynamic optimization based on load
5. **Professional Grade**: Comparable to desktop DAW architectures
