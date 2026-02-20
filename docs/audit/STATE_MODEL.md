# State Model

## Core Entities

### DeviceState (server-side)
Stored in `deviceStates` map keyed by device ID:

```
{
  id, name, type, ip, port,
  state: 'play' | 'rec' | 'stop' | 'offline',
  timecode: string,      // HH:MM:SS:FF
  filename: string,
  framerate: number,
  updated: number,       // performance.timeOrigin + performance.now()
  connected: boolean
}
```

Initial state is **offline**, `connected=false`, `timecode='00:00:00:00'`, `filename=''`.

### Protocol Status
`getProtocolStatus()` derives:

- **emberPlus**: `{ enabled, running, port }`
- **tslUmd**: `{ enabled, running, destinations, deviceCount }`

### WebSocket Clients
A `Set<WebSocket>` tracks connected dashboard clients for broadcast.

## State Transitions

### High-Level Device State Machine

```
┌───────────────┐        state/connected event         ┌─────────────────────┐
│   OFFLINE     │ ───────────────────────────────────▶ │ CONNECTED + STATE   │
│ connected=F  │                                      │ (play/rec/stop)     │
└───────┬───────┘ ◀─────────────────────────────────── └──────────┬──────────┘
        │            disconnect/stale/transport loss              │
        └─────────────────────────────────────────────────────────┘
```

- **Connected + state update**: `client.on('state')` sets `connected=true`, updates state/timecode/filename.
- **Disconnected**: `client.on('disconnected')` sets `state='offline'`, `connected=false` (timecode/filename retained).

### Device-Type Specific Inputs

- **HyperDeck**: TCP client emits `state` on transport/slot updates; reconnection with exponential backoff.
- **vMix**: HTTP polling every `pollIntervalMs`; emits cached last good state on transient failures; marks disconnected after 3 failures.
- **CasparCG**: OSC listener updates internal cache; a stale timer marks disconnected after `staleTimeoutMs` without updates.

### Broadcast Cycle

1. Device client emits `state` → server updates `deviceStates`.
2. Ember+ and TSL UMD are updated immediately on state changes.
3. `broadcastState()` sends current snapshot to all WebSocket clients on a drift-free schedule (`updateIntervalMs`).

## Timing Model

- Monotonic timestamps are used for device updates (`performance.timeOrigin + performance.now()`).
- WebSocket clients detect stale device data via `updated` timestamp on the UI.

---
## Attestation

```yaml
# Identity
agent_id: audit-mapper
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T13:13:28Z
duration_seconds: 720

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: STATE_MODEL.md
phase: 1
status: COMPLETE

# Confidence assessment
confidence: HIGH
confidence_notes: "State transitions and data model derived from server.js and protocol client implementations."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb
  - path: server/hyperdeck-client.js
    hash: sha256:825d1a4c5e0f3089fb824f6b0d2adef0d7f85342dd46585d6b8007996d1d3ba9
  - path: server/vmix-client.js
    hash: sha256:50a668d504066f9bedfc576890529b2b28e898479ac33e7c7325f7a950f58416
  - path: server/osc-casparcg.js
    hash: sha256:7a22ec8e254ca6d55c5026ebd62068c866ce13f26d62760bfe73b56f116c5a9e

# Commands executed
commands_executed:
  - seq: 1
    cmd: "sed -n '1,240p' server/server.js"
    exit_code: 0
    purpose: "Read config load and device state initialization"
    output_summary: "DeviceState fields and initialization"
  - seq: 2
    cmd: "sed -n '240,480p' server/server.js"
    exit_code: 0
    purpose: "Read state update handlers and /health response"
    output_summary: "Connected/disconnected/state event handling"
  - seq: 3
    cmd: "sed -n '1,240p' server/hyperdeck-client.js"
    exit_code: 0
    purpose: "Review HyperDeck state emission"
    output_summary: "Transport/slot parsing and emit('state')"
  - seq: 4
    cmd: "sed -n '1,240p' server/vmix-client.js"
    exit_code: 0
    purpose: "Review vMix polling model"
    output_summary: "Polling + cached state"
  - seq: 5
    cmd: "sed -n '240,720p' server/osc-casparcg.js"
    exit_code: 0
    purpose: "Review CasparCG OSC cache and stale detection"
    output_summary: "OSC bundle handling and stale timer"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 0
  low: 0
  info: 0

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - reliability-analyst
    - concurrency-analyst
    - performance-analyst
  dependencies_satisfied:
    STATE_MODEL.md: COMPLETE
  context_for_next: |
    DeviceState tracks playback state + connection status. Updates flow from protocol clients to server and then to WebSocket/Ember+/TSL UMD. Stale detection exists for CasparCG; VMix uses failure threshold.
```
