# Concurrency Analysis

## Overview

- Runtime is single-threaded Node.js event loop.
- Concurrency concerns are primarily **logical** (event ordering) rather than memory races.

## Findings

### CON-001: CasparCG shared listener multiplexes by IP only
- **Severity:** MEDIUM
- **Evidence:** `server/osc-casparcg.js:49-75` stores clients keyed by IP; routing by source IP (`server/osc-casparcg.js:189-196`).
- **Impact:** If multiple logical devices share an IP (different channels/layers), updates can be misrouted or dropped.
- **Recommendation:** Use composite key (IP+channel+layer) or maintain a list per IP.

## Notes

- Map updates to `deviceStates` are sequential in the event loop; no true data races detected.

---
## Attestation

```yaml
# Identity
agent_id: audit-concurrency
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:09:55Z
duration_seconds: 240

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: CONCURRENCY.md
phase: 4
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "No true parallelism; analysis focuses on event ordering and shared listener logic."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/osc-casparcg.js
    hash: sha256:7a22ec8e254ca6d55c5026ebd62068c866ce13f26d62760bfe73b56f116c5a9e
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb

# Commands executed
commands_executed:
  - seq: 1
    cmd: "nl -ba server/osc-casparcg.js | sed -n '40,220p'"
    exit_code: 0
    purpose: "Inspect shared listener routing"
    output_summary: "IP-keyed client map"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 1
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
    CONCURRENCY.md: COMPLETE
  context_for_next: |
    Concurrency risk is primarily logical multiplexing by IP in shared OSC listener.
```
