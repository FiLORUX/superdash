# Race Conditions

## Summary

- No memory-level races detected due to single-threaded Node.js runtime.
- One logical collision risk in shared OSC listener (see CONCURRENCY CON-001).

## Potential Ordering Hazards

- WebSocket broadcasts may interleave with device updates, producing snapshots that mix state from different moments; this is expected for real-time dashboards.

---
## Attestation

```yaml
# Identity
agent_id: audit-concurrency
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:10:14Z
duration_seconds: 120

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: RACE_CONDITIONS.md
phase: 4
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Analysis limited to event-loop ordering; no parallel threads."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb
  - path: server/osc-casparcg.js
    hash: sha256:7a22ec8e254ca6d55c5026ebd62068c866ce13f26d62760bfe73b56f116c5a9e

# Commands executed
commands_executed:
  - seq: 1
    cmd: "nl -ba server/server.js | sed -n '460,520p'"
    exit_code: 0
    purpose: "Inspect broadcast loop"
    output_summary: "Full-state snapshots broadcast on interval"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 0
  low: 0
  info: 1

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - report-writer
  dependencies_satisfied:
    RACE_CONDITIONS.md: COMPLETE
  context_for_next: |
    No true races; note logical snapshot mixing and OSC IP multiplexing.
```
