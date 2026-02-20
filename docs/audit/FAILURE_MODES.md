# Failure Modes

## Identified Failure Scenarios

| ID | Scenario | Detection | Impact | Notes |
|----|----------|-----------|--------|-------|
| F-REL-01 | TSL UMD UDP bind fails | Socket error event | Tally output silent; sender may remain running | See RELIABILITY R-001 |
| F-REL-02 | CasparCG shared listener IP collision | Missing/incorrect device updates | Incorrect dashboard data | See RELIABILITY R-002 |
| F-REL-03 | vMix HTTP polling failures | Consecutive failure counter | Device marked disconnected | Built-in threshold (3 failures) |
| F-REL-04 | Missing config.json | Process exit | Service down | Fail-fast by design |
| F-REL-05 | WebSocket client overload | Increased latency/CPU | UI lag | No backpressure or throttling |

## Suggested Mitigations

- Add explicit bind success tracking for TSL sender.
- Support multiple CasparCG clients per IP (channel/layer).
- Introduce backpressure or broadcast throttling.
- Document configuration prerequisites and provide validation output.

---
## Attestation

```yaml
# Identity
agent_id: audit-reliability
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:01:14Z
duration_seconds: 240

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: FAILURE_MODES.md
phase: 3
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Failure modes derived from static inspection and baseline test errors."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb
  - path: server/tsl-umd-sender.js
    hash: sha256:85002288bee317b9749e0385e02cb830d790b9ba548d8f496b3963be180689da
  - path: server/osc-casparcg.js
    hash: sha256:7a22ec8e254ca6d55c5026ebd62068c866ce13f26d62760bfe73b56f116c5a9e
  - path: server/vmix-client.js
    hash: sha256:50a668d504066f9bedfc576890529b2b28e898479ac33e7c7325f7a950f58416

# Commands executed
commands_executed:
  - seq: 1
    cmd: "nl -ba server/tsl-umd-sender.js | sed -n '220,300p'"
    exit_code: 0
    purpose: "Inspect TSL sender startup"
    output_summary: "Bind before running state"
  - seq: 2
    cmd: "nl -ba server/osc-casparcg.js | sed -n '40,220p'"
    exit_code: 0
    purpose: "Inspect shared listener routing"
    output_summary: "IP-keyed routing"
  - seq: 3
    cmd: "nl -ba server/vmix-client.js | sed -n '190,240p'"
    exit_code: 0
    purpose: "Inspect vMix failure threshold"
    output_summary: "Disconnect after 3 failures"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 1
  low: 2
  info: 2

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - report-writer
  dependencies_satisfied:
    FAILURE_MODES.md: COMPLETE
  context_for_next: |
    Failure modes mostly relate to protocol binding and listener multiplexing.
```
