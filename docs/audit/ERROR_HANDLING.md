# Error Handling Review

## Observed Patterns

- **Fail fast on config load:** process exits if `config.json` missing/invalid (`server/server.js:33-51`).
- **WebSocket input parsing:** JSON parse wrapped in try/catch; errors logged (`server/server.js:383-389`).
- **Protocol start errors:** Ember+ provider start errors caught and logged, then disabled (`server/server.js:540-556`).
- **vMix polling:** errors logged; connection state toggled after threshold (`server/vmix-client.js:190-236`).
- **HyperDeck and OSC clients:** log errors and emit error events for observers.

## Gaps

- **TSL UMD sender:** socket errors are logged but do not reset running state (see RELIABILITY R-001).
- **SIGTERM handling:** missing graceful shutdown path for systemd (see RELIABILITY R-003).

---
## Attestation

```yaml
# Identity
agent_id: audit-reliability
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:00:53Z
duration_seconds: 300

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: ERROR_HANDLING.md
phase: 3
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Error handling reviewed via static inspection."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb
  - path: server/vmix-client.js
    hash: sha256:50a668d504066f9bedfc576890529b2b28e898479ac33e7c7325f7a950f58416
  - path: server/hyperdeck-client.js
    hash: sha256:825d1a4c5e0f3089fb824f6b0d2adef0d7f85342dd46585d6b8007996d1d3ba9
  - path: server/osc-casparcg.js
    hash: sha256:7a22ec8e254ca6d55c5026ebd62068c866ce13f26d62760bfe73b56f116c5a9e

# Commands executed
commands_executed:
  - seq: 1
    cmd: "nl -ba server/server.js | sed -n '30,120p'"
    exit_code: 0
    purpose: "Inspect config error handling"
    output_summary: "Fail-fast on config load"
  - seq: 2
    cmd: "nl -ba server/server.js | sed -n '372,430p'"
    exit_code: 0
    purpose: "Inspect WebSocket message parsing"
    output_summary: "JSON parse wrapped in try/catch"
  - seq: 3
    cmd: "nl -ba server/vmix-client.js | sed -n '160,240p'"
    exit_code: 0
    purpose: "Inspect vMix polling error handling"
    output_summary: "Failure thresholds and logs"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 0
  low: 1
  info: 2

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - report-writer
  dependencies_satisfied:
    ERROR_HANDLING.md: COMPLETE
  context_for_next: |
    Error handling is generally explicit; key gaps relate to TSL sender error recovery and missing SIGTERM handling.
```
