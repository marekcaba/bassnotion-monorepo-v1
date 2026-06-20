# Recording-Latency Probe

Standalone tool answering the load-bearing **TEST** from the "Capturing the user's own bass
recording" section of [`docs/PRACTICE_TOOLS_FEASIBILITY.md`](../../PRACTICE_TOOLS_FEASIBILITY.md):

> Before committing to ANY native desktop daemon, measure on a real interface: (a) the actual
> `getUserMedia` round-trip on this machine, (b) whether punch-in alignment lands a recorded take
> sample-accurate against the backing, (c) that hardware direct monitoring makes the *feel* 0ms.
> **If that proves out, the launch capture solution needs no daemon.**

## What it measures

1. **Round-trip latency (loopback click).** The app emits a short click out the output; the input
   picks up its echo; we report the gap. This is the real *monitoring* latency the browser path
   imposes on **this** rig — the molasses/word-of-mouth killer **if heard through the app**.
   - Cleanest read: a **loopback cable** (interface output → input).
   - Or: speaker near the mic / built-in speaker + built-in mic.
   - Thresholds: `<12ms` through-app monitoring feels live (browser fine) · `12–25ms` use hardware
     direct monitoring · `>25ms` through-app monitoring needs the native daemon.

2. **Punch-in alignment.** Plays a metronome backing, records your taps (tap your bass / clap **on
   the beats**), auto-correlates against the known grid, and reports the **residual error after
   applying the measured offset**. `<3ms` (~144 samples @48k) = recorded takes align sample-accurate
   → **record-then-review works browser-only regardless of monitoring latency** → no daemon needed
   for capture.

## How to run

Open `index.html` over `http://localhost` (mic access needs a secure-ish context; `file://` mic is
blocked in some browsers). From the repo root:

```bash
npx serve docs/dev-tools/recording-latency      # or: python3 -m http.server -d docs/dev-tools/recording-latency 8088
# then open the printed http://localhost:PORT
```

Then: **Grant mic → pick your interface → Open input → Measure round-trip → Record vs click.**
The bottom "Verdict" panel tells you whether this rig needs the daemon.

## What a result means for the build

| Round-trip | Punch-in residual | Conclusion |
|---|---|---|
| `<12ms` | `<3ms` | Browser-only, even monitor-through-app. Daemon never needed. |
| `12–25ms` | `<3ms` | Launch on **hardware direct monitoring** (0ms analog) + record-then-review. Daemon = later Pro upgrade for monitor-through-app only. |
| `>25ms` | `<3ms` | Monitor-through-app needs the **daemon**; hardware direct monitoring is the browser-only launch path. |

Everything is on-device. Nothing is uploaded. Constraints are forced raw
(`echoCancellation/autoGainControl/noiseSuppression = false`) — the settings that otherwise
destroy a bass signal.
