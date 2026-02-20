# Remediation Roadmap

## Immediate (before production exposure)

1. Add access control or network restrictions for `/health` and WebSocket endpoints.
2. Fix TSL UMD sender startup state to handle bind failures cleanly.
3. Document CasparCG shared listener limitation or update to support multiple channels per IP.

## Short-Term (next sprint)

4. Add schema validation for `config.json` (types, ranges, required fields).
5. Add unit tests for HyperDeck, vMix, and CasparCG client parsing.
6. Introduce WebSocket rate limiting or connection caps.

## Medium-Term

7. Publish JSON schema for `/health` and WebSocket payloads.
8. Add accessibility improvements (ARIA live region, contrast checks).
9. Add optional SIGTERM handler for graceful shutdown under systemd.

---
## Attestation

```yaml
# Identity
agent_id: audit-report-writer
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:11:26Z
duration_seconds: 180

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: REMEDIATION_ROADMAP.md
phase: 7
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Roadmap is derived from audit findings, not validated against product priorities."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: docs/audit/SECURITY.md
    type: file
  - path: docs/audit/RELIABILITY.md
    type: file
  - path: docs/audit/CONFIGURATION.md
    type: file
  - path: docs/audit/TEST_QUALITY.md
    type: file
  - path: docs/audit/ACCESSIBILITY.md
    type: file

# Commands executed
commands_executed:
  - seq: 1
    cmd: "ls docs/audit"
    exit_code: 0
    purpose: "Enumerate audit artefacts"
    output_summary: "Used as input for roadmap"

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

# Handoff
handoff:
  ready: true
  next_agents:
    - orchestrator
  dependencies_satisfied:
    REMEDIATION_ROADMAP.md: COMPLETE
  context_for_next: |
    Roadmap prioritizes access control, TSL sender bind handling, CasparCG multiplexing, and test coverage.
```
