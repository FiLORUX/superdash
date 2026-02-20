# Configuration Review

## Configuration Sources

- `config.json` (local, gitignored) for runtime settings and device list.
- `config.example.json` as template.
- systemd unit sets `NODE_ENV=production`.

## Findings

### C-001: Minimal schema validation for config.json
- **Severity:** MEDIUM
- **Evidence:** Config load only checks `settings` object and `servers` array in `server/server.js:33-47`.
- **Impact:** Invalid or missing fields (e.g., `updateIntervalMs`, `defaultPorts`, device fields) can lead to undefined ports or NaN scheduling without clear errors.
- **Recommendation:** Add schema validation (type/range checks) and explicit errors for missing fields.

### C-002: Device port defaults depend on `server.type` without validation
- **Severity:** LOW
- **Evidence:** Default port uses `config.settings.defaultPorts[server.type]` in `server/server.js:163-165`.
- **Impact:** Unknown or misspelled device types result in `port` being undefined, leading to connection failures later.
- **Recommendation:** Validate `server.type` and fail fast with a clear message.

---
## Attestation

```yaml
# Identity
agent_id: audit-configuration
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:03:00Z
duration_seconds: 360

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: CONFIGURATION.md
phase: 3
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Configuration handling inspected in server.js and config templates."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb
  - path: config.example.json
    hash: sha256:84d7cd97ca20377c204fa04038ff90b5bc08eb1855cdee0ded54f061677cb49a
  - path: config.json
    hash: sha256:ec3b968fd89aa8d66a27b8d4f53980e27b2fc28bfe479f8d726b1c5b162216e0

# Commands executed
commands_executed:
  - seq: 1
    cmd: "nl -ba server/server.js | sed -n '30,220p'"
    exit_code: 0
    purpose: "Inspect config loading and defaults"
    output_summary: "Minimal validation and defaultPorts usage"
  - seq: 2
    cmd: "cat config.example.json"
    exit_code: 0
    purpose: "Review configuration template"
    output_summary: "Settings and device fields"

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
    CONFIGURATION.md: COMPLETE
  context_for_next: |
    Config validation is minimal; unknown device types can produce undefined ports.
```
