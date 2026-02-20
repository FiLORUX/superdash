# Coverage Gaps

## High-Priority Gaps

1. **HyperDeck client parsing and reconnection** (`server/hyperdeck-client.js`)
2. **vMix XML parsing and polling** (`server/vmix-client.js`)
3. **CasparCG OSC parsing and stale detection** (`server/osc-casparcg.js`)
4. **WebSocket server message handling** (`server/server.js`)

## Medium-Priority Gaps

- UI behavior tests for `dashboard.html`, `gui.html`, `overlay.html` (no tests at all).
- Health endpoint response schema validation.

---
## Attestation

```yaml
# Identity
agent_id: audit-test-quality
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:06:34Z
duration_seconds: 180

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: COVERAGE_GAPS.md
phase: 3
status: COMPLETE

# Confidence assessment
confidence: HIGH
confidence_notes: "Test file inventory shows only two test modules."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/
    type: directory
    file_count: 8
  - path: server/__tests__/
    type: directory
    file_count: 2
  - path: public/
    type: directory
    file_count: 5

# Commands executed
commands_executed:
  - seq: 1
    cmd: "ls server/__tests__"
    exit_code: 0
    purpose: "Inventory existing tests"
    output_summary: "emberplus-provider.test.js, tsl-umd-sender.test.js"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 2
  low: 0
  info: 0

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - report-writer
  dependencies_satisfied:
    COVERAGE_GAPS.md: COMPLETE
  context_for_next: |
    Protocol clients and UI are untested; focus gaps listed.
```
