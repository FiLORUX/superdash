# Endpoint Inventory

## HTTP (Express)

| Method | Path | Auth | Purpose | Notes |
|--------|------|------|---------|-------|
| GET | `/health` | None | Operational health + device status | Returns JSON status, protocol info, memory usage |
| GET | `/*` | None | Static UI assets | Served from `public/` directory |

### `/health` Response Shape (from `server/server.js`)

- `status`: `healthy` if any device connected; otherwise `degraded`.
- `uptime`: `process.uptime()`.
- `timestamp`: `Date.now()`.
- `version`: `package.json` version.
- `devices`: `{ total, connected, list[] }` (id, name, type, connected, state).
- `protocols`: `websocket`, `emberPlus`, `tslUmd` status.
- `memory`: heap usage in MB.

## WebSocket

- **Endpoint:** `ws://<host>:<webSocketPort>` (default `3050`, from config).
- **Auth:** None.
- **Origin checks:** None.

### Server → Client Messages

| Type | Payload | Description |
|------|---------|-------------|
| `playoutStates` | `{ type, timestamp, data, protocols }` | Broadcast device states and protocol status |

`data` includes `DeviceState` objects:
`{ id, name, type, ip, port, state, timecode, filename, framerate, updated, connected }`.

### Client → Server Messages

| Type | Payload | Behaviour |
|------|---------|-----------|
| `getConfig` | none | Returns `{ type: 'config', data: { settings, servers } }` |
| `updateSettings` | (future) | Logs request only, no effect |

## Protocol Interfaces (Non-HTTP)

| Direction | Protocol | Port | Purpose |
|-----------|----------|------|---------|
| **Incoming** | CasparCG OSC (UDP) | 6250 (default) | Receive playout state via OSC bundles |
| **Incoming** | Ember+ (TCP) | 9000 (default) | Expose device states to control systems |
| **Outgoing** | HyperDeck (TCP) | 9993 (default) | Poll/subscribe to HyperDeck status |
| **Outgoing** | vMix (HTTP) | 8088 (default) | Poll `/api` for state |
| **Outgoing** | TSL UMD (UDP) | 4003 (default dest) | Send tally state to displays |

---
## Attestation

```yaml
# Identity
agent_id: audit-mapper
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T13:12:58Z
duration_seconds: 660

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: ENDPOINTS.md
phase: 1
status: COMPLETE

# Confidence assessment
confidence: HIGH
confidence_notes: "Endpoints extracted from server/server.js and configuration defaults."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb
    lines_read: 300-470
  - path: config.example.json
    hash: sha256:84d7cd97ca20377c204fa04038ff90b5bc08eb1855cdee0ded54f061677cb49a
  - path: config.json
    hash: sha256:ec3b968fd89aa8d66a27b8d4f53980e27b2fc28bfe479f8d726b1c5b162216e0

# Commands executed
commands_executed:
  - seq: 1
    cmd: "rg -n \"app\\.(get|post|put|delete|use)\" server"
    exit_code: 0
    purpose: "Locate HTTP routes and middleware"
    output_summary: "Found static middleware and /health"
  - seq: 2
    cmd: "sed -n '240,480p' server/server.js"
    exit_code: 0
    purpose: "Inspect /health endpoint and WebSocket setup"
    output_summary: "Captured health response and WS broadcast"
  - seq: 3
    cmd: "sed -n '480,720p' server/server.js"
    exit_code: 0
    purpose: "Inspect startup and protocol initialization"
    output_summary: "Confirmed Ember+ and TSL UMD bindings"
  - seq: 4
    cmd: "cat config.json"
    exit_code: 0
    purpose: "Confirm configured ports and destinations"
    output_summary: "webSocketPort=3050, emberPlusPort=9000, tslUmdDestinations configured"

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
    - security-analyst
    - reliability-analyst
    - configuration-auditor
    - api-contract-validator
  dependencies_satisfied:
    ENDPOINTS.md: COMPLETE
  context_for_next: |
    HTTP exposes only /health plus static assets. WebSocket broadcasts playoutStates and accepts getConfig/updateSettings (no auth). Protocol surfaces include Ember+ TCP 9000 and OSC UDP 6250.
```
