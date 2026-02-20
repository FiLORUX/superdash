# Stack Detection

## Summary

SuperDash is a Node.js 20+ service using Express and ws for HTTP/WebSocket delivery, with protocol integrations for Ember+ (TCP), OSC (UDP), and TSL UMD (UDP). The frontend is a set of static HTML pages with inline JavaScript and CSS.

## Detected Components

| Layer | Technology | Version | Evidence |
|-------|------------|---------|----------|
| Language | JavaScript (CommonJS) | N/A | `package.json` type=commonjs, server files use `require` |
| Runtime | Node.js | 20 LTS (doc) | README Requirements section |
| HTTP Framework | Express | 5.2.1 | `package.json` dependencies |
| WebSocket | ws | ^8.0.0 (pkg) / 8.18.2 (installed) | `package.json`, `node_modules/ws/package.json` |
| Protocol lib | emberplus-connection | 0.3.1 | `package.json` |
| Protocol lib | osc | 2.4.5 | `package.json` |
| Tests | Jest | 30.2.0 | `package.json` devDependencies |
| Dev tooling | nodemon, prettier | 3.1.10 / 3.6.0 | `package.json` devDependencies |
| Frontend | Static HTML/CSS/JS | N/A | `public/*.html` (inline scripts/styles) |
| Deployment | systemd service | N/A | `deploy/superdash.service` |

## Runtime Topology

- **HTTP/WS server:** Express + ws in `server/server.js`.
- **Protocol services:** Ember+ provider (`server/emberplus-provider.js`), TSL UMD sender (`server/tsl-umd-sender.js`).
- **Protocol clients:** HyperDeck TCP (`server/hyperdeck-client.js`), vMix HTTP poller (`server/vmix-client.js`), CasparCG OSC listener (`server/osc-casparcg.js`).

---
## Attestation

```yaml
# Identity
agent_id: audit-mapper
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T13:12:26Z
duration_seconds: 540

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: STACK_DETECTION.md
phase: 1
status: COMPLETE

# Confidence assessment
confidence: HIGH
confidence_notes: "Dependencies and runtime are explicitly defined in package.json and README."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: README.md
    hash: sha256:789f12ded488dcd86fe2c6868edd796a14ae561632a0ce6e974b861b9a4c93d8
  - path: package.json
    hash: sha256:70e8dd52c247117ffa5ce594476eb72028ef8e3150fa6a1255aab7860d0e48ae
  - path: deploy/superdash.service
    hash: sha256:af30ef2d9211c2ae879fdc9e43da508ce404c06d056b9432fdec962334ca7302
  - path: server/server.js
    hash: sha256:4d09f4acde1032a407f67943d0cd93be1fe10b79a9c07aa3b430cf6dd27b31bb

# Commands executed
commands_executed:
  - seq: 1
    cmd: "cat package.json"
    exit_code: 0
    purpose: "Dependency and script inspection"
    output_summary: "Express/ws/osc/emberplus-connection/Jest detected"
  - seq: 2
    cmd: "sed -n '1,200p' README.md"
    exit_code: 0
    purpose: "Runtime requirements and architecture"
    output_summary: "Node 20 LTS requirement documented"
  - seq: 3
    cmd: "cat deploy/superdash.service"
    exit_code: 0
    purpose: "Deployment stack verification"
    output_summary: "systemd unit uses /usr/bin/node"
  - seq: 4
    cmd: "node -e \"const pkgs=['express','ws','osc','emberplus-connection','jest','nodemon','prettier']; for (const p of pkgs) { try { const pkg=require('./node_modules/'+p+'/package.json'); console.log(p, pkg.version, pkg.license || pkg.licenses || 'UNKNOWN'); } catch(e){ console.log(p, 'NOT_FOUND'); } }\""
    exit_code: 0
    purpose: "Confirm installed versions and licenses"
    output_summary: "Installed ws=8.18.2, osc=2.4.5, express=5.2.1, etc."

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 0
  low: 0
  info: 0

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - security-analyst
    - reliability-analyst
    - performance-analyst
    - configuration-auditor
  dependencies_satisfied:
    STACK_DETECTION.md: COMPLETE
  context_for_next: |
    Stack: Node.js (CommonJS), Express 5.2.1, ws 8.x, emberplus-connection, osc. Static HTML frontend. No DB/cache. systemd deployment.
```
