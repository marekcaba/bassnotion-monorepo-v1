# EPIC 2: Core Playback Engine

## 1. Epic Title & Summary

**Title:** Core Playback Engine

**Summary:** This epic focuses on developing the foundational, client-side Core Playback Engine for the BassNotion Platform. It will provide low-latency, precise audio control for all interactive practice widgets. The engine will be **fully MIDI-driven**, supporting dynamic playback of metronome, user-selectable drum patterns, AI-extracted basslines, and harmony tracks (chords), along with ambient sounds and audio effects like reverb. All musical content (MIDI files and audio samples) will be efficiently managed and delivered via Supabase Storage and a CDN.

## 2. Goals & Objectives

* **Provide accurate and low-latency audio playback:** Ensure a seamless and responsive "play-along" experience for users.
* **Support dynamic manipulation of playback:** Enable real-time adjustment of tempo, pitch, and individual track volumes.
* **Deliver a rich and immersive sonic environment:** Incorporate customizable metronome, varied drum loops, basslines, chords, and ambient effects.
* **Ensure efficient asset loading and management:** Optimize the delivery and caching of all necessary MIDI files and audio samples.
* **Establish a robust and scalable audio architecture:** Lay the groundwork for future audio features and integrations.

## 3. Supported Functional Requirements (FRs)

This epic directly supports the following Functional Requirements from `4.1. Functional Requirements.md`:

* **FR-PP-01: The system shall allow users to adjust the playback speed (tempo).** (Unified for all MIDI-driven elements)
* **FR-PP-02: The system shall allow users to adjust the pitch of the audio.** (Applies universally to all synthesized MIDI elements)
* **FR-PP-03: The system shall provide a customizable metronome.** (MIDI-driven with selectable sounds/patterns)
* **FR-PP-04: The system shall include various drum loops for practice.** (Predefined MIDI drum patterns, user selectable)
* **FR-PP-05: The system shall allow users to mix audio levels of different tracks.** (Individual gain nodes for each MIDI instrument and ambient tracks)
* **FR-PP-06: The system shall allow users to loop sections of audio/video.** (Supported by engine's timing capabilities for MIDI sequences)
* **FR-PP-07: The system shall provide an interactive MIDI player for exercises.** (Core functionality of the engine)
* **(Implicit New FR): The system shall allow the addition of ambient sounds and audio effects to enhance the play-along experience.**

## 4. Addressed Non-Functional Requirements (NFRs)

This epic is critical for addressing key Non-Functional Requirements from `4.2. Non-Functional Requirements.md`:

* **NFR-PF-04: The playback engine shall respond to user controls (play, pause, tempo change) within 200ms.** (Performance - Enhanced by all-MIDI architecture)
* **NFR-PO-15: Audio latency shall be less than 50ms on mobile devices for real-time practice.** (Mobile Performance - Primary driver for Web Audio API, aided by all-MIDI approach)
* **NFR-PO-16: The application shall consume less than 5% battery per hour during active practice sessions.** (Mobile Performance - Efficiency of Web Audio API, MIDI synthesis, and effects)
* **NFR-PO-12: The system shall use appropriate CDN services for media delivery.** (Media Optimization - For MIDI files and small instrument/ambience samples)

## 5. Architectural Components & Technologies

### 5.1. Core Audio Processing (Web Audio API)

* **Technology:** Native Web Audio API (`AudioContext`, `GainNode`, `AnalyserNode`, `AudioBufferSourceNode`, `OscillatorNode`).
* **Rationale:** Provides the lowest latency and most granular control over audio streams in the browser, essential for real-time musical applications and precise synchronization of synthesized elements.
* **Libraries (Recommended):**
    * **Tone.js:** A robust framework built on Web Audio API that significantly simplifies sequencing, scheduling, synthesis, and effects. It is ideally suited for orchestrating all MIDI-driven musical elements (metronome, drums, bass, chords) and for applying audio effects.
* **Best Practices:**
    * Minimize `AudioContext` creation (one per session).
    * Efficiently manage and reuse `AudioBuffer` objects for sampled drum/bass/ambience sounds.

### 5.2. MIDI Playback & Synthesis (Unified for all musical elements)

* **MIDI Parsing:**
    * **Technology:** JavaScript MIDI parser library (e.g., `midi-parser-js`, `midimessage`, or a custom lightweight parser).
    * **Functionality:** Convert raw MIDI binary data (from `.mid` files stored in Supabase) into a structured sequence of actionable events (note on/off, velocity, pitch bend, control changes, tempo changes).
* **Software Synthesizer & Sampler (via Tone.js):**
    * **Technology:** Primarily `Tone.js` instruments and samplers.
    * **Functionality for Metronome:** `Tone.js` can generate clicks or trigger sampled metronome sounds based on MIDI events.
    * **Functionality for Drum Beats:**
        * **MIDI Drum Patterns:** Store simple drum patterns as MIDI files (e.g., common rock beats, specific fills). These can be either *predefined library patterns* (user selectable) or *tutorial-specific patterns* derived by AI.
        * **Sample-Based Drums:** Use `Tone.js.Sampler` to load individual drum sounds (kick, snare, hi-hat, clap) from small audio files stored in Supabase. MIDI notes from the drum patterns will trigger these samples. This provides more realistic percussion than pure synthesis.
        * **Dynamic Control:** MIDI velocity will control drum hit dynamics.
    * **Functionality for Basslines:**
        * **MIDI Basslines:** Primarily from *tutorial-specific* MIDI files generated by AI analysis.
        * **Sample-Based Playback:** A `Tone.js.Sampler` loading pre-recorded/pre-processed bass note audio files from Supabase Storage for high fidelity. Responds to MIDI note on/off and velocity for dynamics.
        * **Expression:** Accurately responds to MIDI velocity, pitch bend messages (for slides/bends), and potentially other MIDI Control Change (CC) messages (e.g., modulation, expression) to achieve realistic "feel."
    * **Functionality for Chords (Pads, Rhodes):**
        * **MIDI Chords:** Can be from *tutorial-specific* MIDI files (AI generated) or *predefined library patterns* (for common progressions).
        * **Synthesizer:** `Tone.js` `PolySynth` or other synths configured to produce pad or Rhodes-like sounds.
        * **Polyphony:** Must support playing multiple notes simultaneously for chords.
    * **Unified Implementation:** The MIDI parser will drive all these `Tone.js` instruments, ensuring precise synchronization and global tempo/pitch manipulation.
* **Best Practices:**
    * Efficiently load and manage small audio samples for drums and bass instrument.
    * Tune synthesizer parameters for desired pad/Rhodes sounds.
    * Prioritize efficient MIDI event scheduling (`Tone.js.Transport`) to maintain low latency.

### 5.3. Asset Management & Delivery

* **Technology:** **Supabase Storage Buckets** for storing:
    * **MIDI Files (`.mid`):**
        * **Tutorial-Specific:** Generated by n8n's AI orchestration (e.g., basslines, unique chord progressions from a YouTube video).
        * **Predefined Library:** Curated, reusable MIDI patterns (e.g., common drum beats, metronome clicks, standard chord progressions) that users can select and manipulate.
    * **Audio Samples (`.mp3`, `.ogg`, `.wav`):**
        * Individual drum hits (kick, snare, hi-hat, clap).
        * Individual bass notes (sampled from various bass instruments).
        * Ambience tracks (vinyl crackle, room tone).
        * Metronome click sounds.
* **Delivery:**
    * Direct access via Supabase public URLs.
    * **Highly Recommended:** Integrate a Content Delivery Network (CDN) like Cloudflare.
    * **Rationale:** CDNs cache assets globally, reducing latency and improving loading times for users worldwide, critical for media-rich applications (`NFR-PO-12`).
* **Best Practices:**
    * Optimize audio sample file formats and compression.
    * Implement lazy loading for larger sets of samples/MIDI patterns where appropriate (e.g., loading only the specific drum samples needed for the current drum kit).

### 5.4. Timing & Synchronization

* **Technology:** `AudioContext.currentTime` and `Tone.js.Transport` for precise scheduling of all MIDI and audio events.
* **Functionality:**
    * Serve as the master clock for synchronizing metronome clicks, drum patterns, basslines, chords, ambience tracks, and all visualizers (Sheet Player, Fretboard Visualizer).
    * Accurate tracking of musical time (beats, bars, subdivisions) based on the current tempo.
    * Implementation of "swing/feel" by slight, musically aware offsets in scheduled MIDI events.
* **Best Practices:**
    * Rely entirely on `AudioContext.currentTime` / `Tone.js.Transport` for all musical timing.
    * Implement a look-ahead buffer for scheduling events to ensure continuous playback without glitches.

### 5.5. Audio Effects & Ambience

* **Requirement:** Enhance the sonic experience by adding ambient sounds (e.g., vinyl crackle, room tone) and applying effects (e.g., reverb) to specific tracks.
* **Technology:** `Tone.js` effects (`Tone.Reverb`, `Tone.Filter`, `Tone.Gain`, `Tone.Player`).
* **Implementation:**
    * **Reverb for Drums:** A `Tone.Reverb` instance can be created and the drum sampler's output routed through it before it reaches the master mixer. Parameters (decay, wet/dry mix) will be configurable.
    * **Ambient Tracks:** Small, looping audio files (e.g., vinyl crackle, room noise) can be loaded into `Tone.Player` instances. These players will be routed to a `Tone.Gain` node for volume control and mixed into the main audio output.
    * **Effect Chains:** The Web Audio API allows for flexible routing, enabling multiple effects to be chained on individual instruments or on a master bus.
* **Best Practices:**
    * Keep effects performant to maintain low latency.
    * Ensure ambient tracks loop seamlessly to avoid audible clicks.
    * Provide clear UI controls for users to adjust ambience/effect levels.

## 6. High-Level Data Flow Diagram (All MIDI-driven MVP with Ambience)

```mermaid
graph TD
    A[User Controls: Play, Tempo, Pitch, Volume, Instrument/Effect Selection] --> B{Playback Engine Service (Tone.js Orchestration)}
    B -- Controls & Events --> C[Web Audio API Context]

    subgraph Inputs from Supabase Storage (via CDN)
        D[Metronome Click Samples (Audio)]
        E[Drum Hit Samples (Audio: Kick, Snare, Hi-Hat, Clap)]
        F[MIDI Files (.mid) - Tutorial-Specific & Library]
        G[Bass Note Samples (Audio Files)]
        H[Ambience Samples (e.g., Vinyl Crackle, Room Tone)]
    end

    F -- References: Tutorial-Specific MIDI & Library MIDI --> I[MIDI Parser]
    I -- MIDI Events (Note On/Off, Velocity, CC) --> J[Unified Software Synthesizer & Sampler (Tone.js)]

    J -- To Metronome Synth/Sampler --> K[Metronome Sound Generator (from D)]
    J -- To Drum Sampler --> L[Drum Sampler (from E)]
    L -- Route via Effect --> P[Drum Reverb (Tone.Reverb)]
    P --> C

    J -- To Bass Sampler --> M[Bass Sampler (from G)]
    J -- To Chord Synthesizer --> N[Chord Synth (Pads/Rhodes)]

    H --> Q[Ambience Player (Tone.Player)]
    Q --> C

    K --> C
    M --> C
    N --> C

    C --> R[Gain Nodes (Volume Mixing)]
    R --> S[Master Gain Node]
    S --> T[AudioContext.destination]

    B -- Sync Events (Notes, Beats, Bars) --> U[Sheet Player (Visualizer)]
    B -- Sync Events (Notes, Beats, Bars) --> V[Fretboard Visualizer (Visualizer)]
```

## 7. Workflow from n8n Payload to Playback

1.  **n8n AI Agent's JSON Payload:** The n8n AI agent, after processing a YouTube link, generates a comprehensive JSON payload. This payload contains URLs for:
    * Tutorial-specific MIDI files (e.g., bassline, unique chords).
    * References (e.g., IDs or URLs) to predefined library MIDI drum loops (or a default).
    * URLs for all necessary audio samples (e.g., bass notes, drum hits, ambience).
    * All other widget settings and synchronization metadata.
2.  **Frontend Receives JSON Payload:** The frontend client (React/Next.js) receives this JSON, which configures the Bass Drills Widget.
3.  **Core Playback Engine Initialization & Asset Loading:**
    * The singleton Core Playback Engine service identifies all required MIDI files and audio samples from the JSON.
    * It fetches these assets from Supabase Storage (via CDN).
    * All loaded audio samples are decoded into `AudioBuffer`s and cached in the browser's `AudioContext` memory (managed by `Tone.js`). MIDI files are parsed into event arrays in memory.
4.  **MIDI Parsing & Instrument Setup:**
    * The MIDI Parser converts binary MIDI data into structured event lists.
    * `Tone.js` Samplers are set up for bass and drums, pre-loaded with their respective audio samples. `Tone.js` PolySynths are configured for chords. A `Tone.Player` is set up for ambiance.
5.  **Playback via `Tone.js.Transport`:**
    * Upon user "Play," the `Tone.js.Transport` (master clock) starts scheduling all MIDI events (for bass, drums, chords, metronome) and ambient tracks precisely.
    * Real-time user controls (tempo, pitch, volume) dynamically update the `Transport` and instrument parameters, ensuring seamless adjustments during playback.

## 8. Open Questions & Future Considerations

* **MIDI Instrument Sounds:** What specific set of drum samples (kick, snare, hi-hat, clap) will be provided for the MVP? Will they be single hits or short loops?
* **Synthesizer Sound Design:** Detailed sound design and tuning for the pad and Rhodes sounds will be crucial for a pleasant accompaniment experience.
* **MIDI File Content Strategy:** Define the initial set of predefined MIDI drum patterns and chord progressions for the library. Who will create and curate these?
* **Ambience Content:** What specific ambient audio samples (e.g., types of vinyl crackle, room tones) will be sourced or created? Will their levels be user-adjustable?
* **Performance Tuning:** Continuously monitor and optimize performance to ensure the 50ms latency NFR is met across various devices, especially for simultaneous MIDI playback of multiple instruments and effect processing.
* **Scalability of Sample Loading:** As the number of exercises and unique drum/bass/ambience samples grows, efficient sample loading and caching strategies will become even more important.
* **Offline Mode (`NFR-PO-18`):** How will MIDI files and associated audio samples be cached for offline use? This will require Service Worker implementation.
* **Performance Monitoring:** Implement detailed performance metrics (e.g., audio dropouts, latency) within the engine to ensure NFRs are met.

---