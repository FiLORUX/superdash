# Performance Analysis

## Findings

### P-001: Fixed-interval full-state broadcasts
- **Severity:** MEDIUM
- **Evidence:** `server/server.js:481-499` constructs and sends full state to all clients; schedule runs every `updateIntervalMs` (`server/server.js:506-520`).
- **Impact:** CPU and bandwidth scale with `clients * devices * updateInterval`. At default 100ms this can be heavy on busy control networks.
- **Recommendation:** Consider delta updates, per-client throttling, or broadcasting only on state changes.

### P-002: vMix polling frequency could be high for large device counts
- **Severity:** LOW
- **Evidence:** `server/vmix-client.js:108-140` sets default poll interval to 500ms.
- **Impact:** Many vMix devices at 2 Hz polling can create load and log noise on slow networks.
- **Recommendation:** Make polling interval configurable per device or implement adaptive backoff on errors.

---
## Attestation

```yaml
# Identity
agent_id: audit-performance
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:01:38Z
duration_seconds: 420

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: PERFORMANCE.md
phase: 3
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Performance risks inferred from scheduling and broadcast logic; no profiling performed."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb
  - path: server/vmix-client.js
    hash: sha256:50a668d504066f9bedfc576890529b2b28e898479ac33e7c7325f7a950f58416

# Commands executed
commands_executed:
  - seq: 1
    cmd: "nl -ba server/server.js | sed -n '470,520p'"
    exit_code: 0
    purpose: "Inspect broadcast and scheduling logic"
    output_summary: "Full-state broadcast every interval"
  - seq: 2
    cmd: "nl -ba server/vmix-client.js | sed -n '100,160p'"
    exit_code: 0
    purpose: "Inspect vMix poll interval defaults"
    output_summary: "Default 500ms polling"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 1
  low: 1
  info: 0

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - report-writer
  dependencies_satisfied:
    PERFORMANCE.md: COMPLETE
  context_for_next: |
    Performance bottleneck is fixed-interval full-state broadcast; vMix polling is per-device at 500ms.
```
