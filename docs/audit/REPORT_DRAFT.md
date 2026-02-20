# Audit Report (Draft)

## Executive Summary

SuperDash is a compact Node.js monitoring service for broadcast playout devices. The primary risks are network exposure of operational data via unauthenticated `/health` and WebSocket endpoints, and reliability issues in protocol handling (TSL UMD sender bind state and CasparCG shared listener multiplexing). Test coverage is minimal and not hermetic.

Overall risk: **MEDIUM**.

## Key Findings (Draft)

1. **Unauthenticated `/health` and WebSocket** expose device states and config to any network client.
2. **TSL UMD sender** marks running before bind success, leading to silent failure.
3. **CasparCG shared listener** keyed by IP only; multiple devices on same host collide.
4. **Config validation** is minimal; invalid fields can lead to undefined ports or NaN scheduling.
5. **Test suite** relies on real sockets and omits core protocol clients.

---
## Attestation

```yaml
# Identity
agent_id: audit-report-writer
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:11:50Z
duration_seconds: 180

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: REPORT_DRAFT.md
phase: 7
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Draft synthesized from audit artefacts; full report follows."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: docs/audit/EXECUTIVE_SUMMARY.md
    type: file
  - path: docs/audit/REMEDIATION_ROADMAP.md
    type: file

# Commands executed
commands_executed:
  - seq: 1
    cmd: "ls docs/audit"
    exit_code: 0
    purpose: "Enumerate audit artefacts"
    output_summary: "Draft synthesized from artefacts"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 9
  low: 9
  info: 8

# Blocking issues
blocking_issues:
  - "CVE audit incomplete due to network restrictions"
  - "Baseline tests failed due to watchman/socket permission errors"

# Handoff
handoff:
  ready: true
  next_agents:
    - orchestrator
  dependencies_satisfied:
    REPORT_DRAFT.md: COMPLETE
  context_for_next: |
    Draft report summarizes top findings; finalize in REPORT.md with full tables.
```
