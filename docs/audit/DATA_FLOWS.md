# Data Flow Map

## Overview

```
CasparCG (OSC UDP) ─┐
HyperDeck (TCP) ────┼─> SuperDash server (state manager) ──> WebSocket clients
vMix (HTTP XML) ────┘                                   └─> Ember+ provider
                                                      └─> TSL UMD sender
```

## Data Types

- Device identity: id, name, type, ip, port
- Device state: play/rec/stop/offline
- Timing: timecode, update timestamps
- Metadata: filename (from device state)

## Exposed Outputs

- `/health` JSON (device list, states, protocol status)
- WebSocket `playoutStates` messages (full device state list)
- Ember+ tree parameters (state, timecode, filename, connected)
- TSL UMD UDP packets (device name + tally state)

---
## Attestation

```yaml
# Identity
agent_id: audit-compliance
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:03:57Z
duration_seconds: 180

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: DATA_FLOWS.md
phase: 3
status: COMPLETE

# Confidence assessment
confidence: HIGH
confidence_notes: "Data flows derived from server.js and protocol client code."

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
  - path: server/emberplus-provider.js
    hash: sha256:22598556a1ea38dedf554f054584a07485f04644bf824a2c3622aa68b723697c
  - path: server/tsl-umd-sender.js
    hash: sha256:85002288bee317b9749e0385e02cb830d790b9ba548d8f496b3963be180689da

# Commands executed
commands_executed:
  - seq: 1
    cmd: "sed -n '1,240p' server/server.js"
    exit_code: 0
    purpose: "Identify aggregation and broadcast paths"
    output_summary: "State manager and outputs"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 0
  low: 0
  info: 2

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - report-writer
  dependencies_satisfied:
    DATA_FLOWS.md: COMPLETE
  context_for_next: |
    Data flows are device state only; no personal data detected.
```
