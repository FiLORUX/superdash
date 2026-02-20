# Reliability Analysis

## Findings

### R-001: TSL UMD sender marks running before bind success
- **Severity:** MEDIUM
- **Evidence:** `server/tsl-umd-sender.js:227-259` sets `_isRunning = true` immediately after `bind()`, with no rollback on socket error.
- **Impact:** If the UDP bind fails, the sender remains "running" and refresh loop continues, leading to noisy errors and no recovery.
- **Recommendation:** Set `_isRunning` only after successful bind or handle `error` event by stopping and resetting state.

### R-002: CasparCG shared listener keyed by IP only
- **Severity:** MEDIUM
- **Evidence:** `server/osc-casparcg.js:49-75` stores clients in a `Map` keyed by IP; `_handleMessage` routes by source IP in `server/osc-casparcg.js:189-196`.
- **Impact:** Multiple CasparCG devices on the same host (different channels/layers) will overwrite each other, causing lost or incorrect state.
- **Recommendation:** Key registrations by `ip+channel+layer` or allow multiple clients per IP.

### R-003: No SIGTERM handler for graceful shutdown
- **Severity:** LOW
- **Evidence:** `server/server.js:584-609` handles `SIGINT` only.
- **Impact:** systemd typically uses SIGTERM; without a handler, protocol clients and sockets may not be closed cleanly.
- **Recommendation:** Add a SIGTERM handler that mirrors SIGINT cleanup.

---
## Attestation

```yaml
# Identity
agent_id: audit-reliability
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:00:26Z
duration_seconds: 780

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: RELIABILITY.md
phase: 3
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Reliability risks derived from static code inspection; not validated in runtime environment."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/tsl-umd-sender.js
    hash: sha256:85002288bee317b9749e0385e02cb830d790b9ba548d8f496b3963be180689da
  - path: server/osc-casparcg.js
    hash: sha256:7a22ec8e254ca6d55c5026ebd62068c866ce13f26d62760bfe73b56f116c5a9e
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb

# Commands executed
commands_executed:
  - seq: 1
    cmd: "nl -ba server/tsl-umd-sender.js | sed -n '220,300p'"
    exit_code: 0
    purpose: "Inspect TSL sender startup sequence"
    output_summary: "_isRunning set before bind confirmation"
  - seq: 2
    cmd: "nl -ba server/osc-casparcg.js | sed -n '40,220p'"
    exit_code: 0
    purpose: "Inspect shared listener registration"
    output_summary: "Map keyed by IP; routing by source IP"
  - seq: 3
    cmd: "nl -ba server/server.js | sed -n '560,620p'"
    exit_code: 0
    purpose: "Inspect shutdown handling"
    output_summary: "SIGINT handler only"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 2
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
    RELIABILITY.md: COMPLETE
  context_for_next: |
    Reliability risks: TSL sender running state not tied to bind success; CasparCG shared listener keyed by IP only; no SIGTERM handler.
```
