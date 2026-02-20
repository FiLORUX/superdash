# Security Analysis

## Attack Surface Summary

- **HTTP:** `GET /health` and static assets under `/`.
- **WebSocket:** `ws://<host>:<port>`; accepts `getConfig` messages.
- **Ember+:** TCP server (default 9000) bound to 0.0.0.0.
- **OSC:** UDP listener (default 6250) bound to 0.0.0.0.
- **Outbound clients:** HyperDeck TCP, vMix HTTP, TSL UMD UDP.

## Findings

### S-001: Unauthenticated health + WebSocket expose operational data
- **Severity:** MEDIUM
- **Evidence:** `server/server.js:323-366` exposes `/health`; `server/server.js:372-422` accepts WebSocket connections and serves `getConfig` with full settings/servers.
- **Impact:** Any network client can retrieve device names, states, and configuration (including IPs/ports). This is sensitive operational data in broadcast environments.
- **Recommendation:** Restrict these endpoints to trusted networks, add an auth token, and/or enforce an origin/IP allowlist. Consider removing `getConfig` from production builds or returning a redacted view.

### S-002: Ember+ provider binds to all interfaces by default
- **Severity:** LOW
- **Evidence:** Default address is `0.0.0.0` in `server/emberplus-provider.js:101-110`, and server starts without overriding in `server/server.js:541-543`.
- **Impact:** Ember+ control surface is exposed to the entire network unless firewalled.
- **Recommendation:** Bind to a specific management interface or make binding explicit in config; document firewall requirements.

### S-003: OSC listener accepts packets from any sender
- **Severity:** LOW
- **Evidence:** OSC UDP port bound to `0.0.0.0` in `server/osc-casparcg.js:116-120`; packets routed by source IP in `server/osc-casparcg.js:189-196`.
- **Impact:** If the UDP port is exposed, a malicious host could spoof OSC packets to inject state (source-IP checks are not strong security).
- **Recommendation:** Restrict UDP port exposure (network ACLs) and consider verifying expected source IPs at the socket layer.

---
## Attestation

```yaml
# Identity
agent_id: audit-security
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T16:59:02Z
duration_seconds: 900

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: SECURITY.md
phase: 3
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Network exposure risks assessed from code; no runtime network topology available."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb
  - path: server/emberplus-provider.js
    hash: sha256:22598556a1ea38dedf554f054584a07485f04644bf824a2c3622aa68b723697c
  - path: server/osc-casparcg.js
    hash: sha256:7a22ec8e254ca6d55c5026ebd62068c866ce13f26d62760bfe73b56f116c5a9e

# Commands executed
commands_executed:
  - seq: 1
    cmd: "nl -ba server/server.js | sed -n '300,520p'"
    exit_code: 0
    purpose: "Inspect HTTP and WebSocket surfaces"
    output_summary: "Located /health and WS handlers"
  - seq: 2
    cmd: "nl -ba server/emberplus-provider.js | sed -n '90,170p'"
    exit_code: 0
    purpose: "Confirm Ember+ bind address defaults"
    output_summary: "Default 0.0.0.0 binding"
  - seq: 3
    cmd: "nl -ba server/osc-casparcg.js | sed -n '40,220p'"
    exit_code: 0
    purpose: "Confirm OSC listener binding and routing"
    output_summary: "UDP bound to 0.0.0.0; IP-based routing"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 1
  low: 2
  info: 0

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - report-writer
  dependencies_satisfied:
    SECURITY.md: COMPLETE
  context_for_next: |
    Main security concern is unauthenticated access to /health and WebSocket with getConfig. Ember+ and OSC bind to all interfaces by default.
```
