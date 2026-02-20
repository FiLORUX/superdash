# Threat Model

## Assets

- **Operational device state:** play/rec/stop, timecode, filenames.
- **Network topology data:** device IPs and ports from config and health output.
- **Protocol outputs:** Ember+ and TSL UMD states consumed by control systems.

## Actors

- **Authorized operators:** control room staff and engineering.
- **Internal network adversary:** any host on the same LAN/VLAN.
- **Misconfigured clients:** dashboards or automation with malformed input.

## Entry Points

- HTTP: `/health`, static pages
- WebSocket: state broadcast + `getConfig` request
- Ember+ TCP server
- OSC UDP listener

## Trust Boundaries

- **Device network vs. UI clients:** device protocols are trusted to send correct data; UI clients are unauthenticated.
- **Control systems:** Ember+ consumers can connect to provider (read-only) but are not authenticated.

## Key Threats

- **Information disclosure:** unauthenticated `/health` and WebSocket reveal device state and IPs.
- **State spoofing (OSC):** OSC packets accepted by IP only; spoofing possible on shared networks.
- **Denial of service:** unbounded WebSocket connections or large message payloads.

## Existing Mitigations

- Minimal parsing on WebSocket input (JSON parse with error handling).
- OSC routing limited to registered device IPs.
- Ember+ is read-only; write attempts rejected.

## Recommended Controls

- Network segmentation and firewall rules for all protocol ports.
- Optional authentication/token for `/health` and WebSocket.
- Origin/IP allowlist for WebSocket connections.
- Rate limiting for WebSocket message processing.

---
## Attestation

```yaml
# Identity
agent_id: audit-security
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T16:59:36Z
duration_seconds: 300

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: THREAT_MODEL.md
phase: 3
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Threats inferred from code and deployment docs; no network topology details."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb
  - path: server/osc-casparcg.js
    hash: sha256:7a22ec8e254ca6d55c5026ebd62068c866ce13f26d62760bfe73b56f116c5a9e
  - path: server/emberplus-provider.js
    hash: sha256:22598556a1ea38dedf554f054584a07485f04644bf824a2c3622aa68b723697c
  - path: README.md
    hash: sha256:789f12ded488dcd86fe2c6868edd796a14ae561632a0ce6e974b861b9a4c93d8

# Commands executed
commands_executed:
  - seq: 1
    cmd: "sed -n '1,200p' README.md"
    exit_code: 0
    purpose: "Review documented architecture and deployment context"
    output_summary: "Broadcast monitoring context"
  - seq: 2
    cmd: "nl -ba server/server.js | sed -n '300,520p'"
    exit_code: 0
    purpose: "Identify entry points"
    output_summary: "HTTP/WS surfaces"
  - seq: 3
    cmd: "nl -ba server/osc-casparcg.js | sed -n '40,220p'"
    exit_code: 0
    purpose: "OSC listener boundary"
    output_summary: "Shared listener and routing"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 0
  low: 0
  info: 3

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - report-writer
  dependencies_satisfied:
    THREAT_MODEL.md: COMPLETE
  context_for_next: |
    Threats focus on network exposure and information disclosure; mitigations are primarily network ACLs and optional auth.
```
