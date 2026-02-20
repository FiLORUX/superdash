# Documentation Drift

## Confirmed Matches

- **HTTP/WS architecture** described in README aligns with `server/server.js` (Express + ws).
- **/health endpoint** exists and returns device/protocol status as documented.
- **Device types** (CasparCG OSC, vMix HTTP XML, HyperDeck TCP) match code.
- **Ember+ provider and TSL UMD sender** present in server code with default ports.
- **Deployment instructions** in `deploy/README.md` align with `deploy/superdash.service`.

## Potential Drift / Mismatches

1. **Control Panel capabilities**
   - README: “Add, modify, and test device connections. Simulate states for integration testing.”
   - Implementation: `public/control.html` provides a client-side config generator only. No code present for live connection testing or state simulation.

2. **Maximum device count**
   - README: “Responsive grid layout for up to 12 devices.”
   - Implementation: dashboard grid uses `auto-fit` and does not enforce a 12-device cap. This may be intentional but not enforced.

## Recommendations

- Clarify in README that the Control Panel generates `config.json` offline (no live tests or simulation).
- If 12-device limit is a requirement, enforce it in UI or update docs to remove the cap.

---
## Attestation

```yaml
# Identity
agent_id: audit-documentation
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T13:15:53Z
duration_seconds: 420

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: DOCUMENTATION_DRIFT.md
phase: 1
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Drift assessment based on README and frontend/server inspection; no runtime validation."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: README.md
    hash: sha256:789f12ded488dcd86fe2c6868edd796a14ae561632a0ce6e974b861b9a4c93d8
  - path: public/control.html
    hash: sha256:a4f573149988bef0a29dff31131eb5ae0301f8e45564d6a5db5d9dbf953469ab
  - path: public/dashboard.html
    hash: sha256:694b63684e287faf7f91f8f4de504f246aeef5349232601018f461d2aa05a702
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb

# Commands executed
commands_executed:
  - seq: 1
    cmd: "sed -n '1,260p' README.md"
    exit_code: 0
    purpose: "Review product claims and features"
    output_summary: "Feature list and UI descriptions"
  - seq: 2
    cmd: "sed -n '1,240p' public/control.html"
    exit_code: 0
    purpose: "Inspect control panel implementation"
    output_summary: "Config generator UI only"
  - seq: 3
    cmd: "sed -n '1,240p' public/dashboard.html"
    exit_code: 0
    purpose: "Inspect dashboard layout constraints"
    output_summary: "Grid uses auto-fit; no 12-device limit"
  - seq: 4
    cmd: "sed -n '300,380p' server/server.js"
    exit_code: 0
    purpose: "Confirm /health and static serving"
    output_summary: "Endpoints align with docs"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 1
  low: 1
  info: 1

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - report-writer
  dependencies_satisfied:
    DOCUMENTATION_DRIFT.md: COMPLETE
  context_for_next: |
    Main drift: control panel does not test connections or simulate state; dashboard doesn't enforce 12-device limit.
```
