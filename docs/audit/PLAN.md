# Audit Plan

## 1. Audit Scope

| Attribute | Value |
|-----------|-------|
| Repository | superdash |
| Git ref | e4bb0098264f90d3afc7b5d0f3b5e425d1825761 |
| Branch | main |
| Date initiated | 2026-01-31T13:09:23Z |
| Mode | AUDIT-ONLY |
| Requested by | User (Codex CLI session) |

## 2. Detected Stack

| Layer | Technology | Version | Detection confidence |
|-------|------------|---------|---------------------|
| Language | JavaScript (Node.js) | N/A | HIGH |
| Runtime | Node.js | 20 LTS (per README) | MEDIUM |
| Framework | Express | 5.2.1 (package.json) | HIGH |
| Realtime | ws (WebSocket) | 8.0.0 | HIGH |
| Protocol libs | emberplus-connection, osc | 0.3.1 / 2.4.5 | HIGH |
| Database | None detected | N/A | HIGH |
| Cache | None detected | N/A | HIGH |
| Queue | None detected | N/A | HIGH |
| Frontend | Static HTML/CSS/JS | N/A | HIGH |
| Build tool | None (static assets) | N/A | HIGH |
| Test framework | Jest | 30.2.0 | HIGH |

## 3. Build & Test Commands

| Purpose | Command | Status | Notes |
|---------|---------|--------|-------|
| Install dependencies | npm install | NOT RUN | In AUDIT-ONLY mode, avoid installs unless required |
| Start server | npm start | NOT RUN | Runs `node server/server.js` |
| Dev server | npm run dev | NOT RUN | Uses nodemon |
| Unit tests | npm test | NOT RUN | Jest |
| Lint | (none) | N/A | No lint script in package.json |
| Type check | (none) | N/A | No TS/typing step |

## 4. Golden Paths (Critical User Journeys)

1. **Device ingestion → WebSocket broadcast**: HyperDeck/vMix/CasparCG state updates flow into server → WebSocket → dashboard clients.
2. **Ember+ broadcast integration**: Device states are reflected in the Ember+ provider tree for control systems.
3. **TSL UMD tally output**: Device state changes map to TSL UMD messages sent over UDP to tally displays.
4. **Operational health**: `/health` endpoint reflects device connectivity and protocol status.

## 5. Risk Paths (Attack & Failure Surface)

1. **Network input parsing**: TCP/UDP/HTTP device inputs are untrusted and must be robust against malformed data.
2. **Unauthenticated WebSocket/HTTP exposure**: Health and WebSocket endpoints have no auth; risk of data exposure or DoS.
3. **OSC shared listener demultiplexing**: Multiple CasparCG devices on the same IP could collide in the shared listener map.
4. **Configuration validation**: Missing/invalid config values can break scheduling, ports, or protocol startup.
5. **High-frequency broadcast loop**: 100ms update interval may create load spikes with many clients/devices.

## 6. Audit Strategy

### 6.1 Approach
- Static analysis of server and client code paths.
- Validate configuration flow and runtime boundaries.
- Review protocol client implementations (HyperDeck/vMix/CasparCG).
- Assess security posture for local-network exposure.
- Evaluate reliability/performance patterns (reconnect, backoff, scheduling).

### 6.2 Priorities
1. Security exposure on HTTP/WebSocket/protocol surfaces.
2. Reliability of device state ingestion and reconnection logic.
3. Concurrency and shared state correctness.
4. Performance hotspots in broadcast loops and polling.
5. Documentation accuracy vs implementation.

### 6.3 Known Constraints
- AUDIT-ONLY mode: no code changes.
- No external network access for CVE lookups.
- No tests run yet; baseline pending.

## 7. Agent Allocation (Single-Agent Mode)

| Phase | Agents | Budget | Priority |
|-------|--------|--------|----------|
| 1 | mapper, dependency-auditor, documentation-auditor | 50k tokens | HIGH |
| 2 | verifier (baseline tests) | 30k tokens | HIGH |
| 3 | security-analyst, reliability-analyst, performance-analyst, database-analyst, configuration-auditor, compliance-analyst, accessibility-auditor, test-quality-analyst, api-contract-validator | 120k tokens | CRITICAL |
| 4 | concurrency-analyst | 40k tokens | HIGH |
| 7 | report-writer, orchestrator | 40k tokens | HIGH |

---
## Attestation

```yaml
# Identity
agent_id: audit-orchestrator
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T13:09:23Z
duration_seconds: 840

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: PLAN.md
phase: 0
status: COMPLETE

# Confidence assessment
confidence: HIGH
confidence_notes: "Stack and scope derived from README, package.json, and repository layout. Runtime versions inferred from docs."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: README.md
    hash: sha256:789f12ded488dcd86fe2c6868edd796a14ae561632a0ce6e974b861b9a4c93d8
    lines_read: 1-260
  - path: package.json
    hash: sha256:70e8dd52c247117ffa5ce594476eb72028ef8e3150fa6a1255aab7860d0e48ae
    lines_read: 1-26

# Commands executed
commands_executed:
  - seq: 1
    cmd: "ls"
    exit_code: 0
    purpose: "Top-level repository inventory"
    output_summary: "Listed root files and directories"
  - seq: 2
    cmd: "sed -n '1,200p' README.md"
    exit_code: 0
    purpose: "Read primary documentation"
    output_summary: "README overview and architecture"
  - seq: 3
    cmd: "sed -n '200,400p' README.md"
    exit_code: 0
    purpose: "Read remaining README sections"
    output_summary: "Development, structure, deployment references"
  - seq: 4
    cmd: "cat package.json"
    exit_code: 0
    purpose: "Detect runtime stack and scripts"
    output_summary: "Node/Express/ws/Jest identified"
  - seq: 5
    cmd: "git rev-parse HEAD"
    exit_code: 0
    purpose: "Record git reference"
    output_summary: "e4bb0098264f90d3afc7b5d0f3b5e425d1825761"
  - seq: 6
    cmd: "git rev-parse --abbrev-ref HEAD"
    exit_code: 0
    purpose: "Record git branch"
    output_summary: "main"
  - seq: 7
    cmd: "find . -maxdepth 2 -type d -not -path './node_modules*' -not -path './.git*'"
    exit_code: 0
    purpose: "Directory map"
    output_summary: "Identified server/, public/, deploy/, research/"
  - seq: 8
    cmd: "shasum -a 256 README.md package.json"
    exit_code: 0
    purpose: "Hash primary inputs"
    output_summary: "SHA256 hashes recorded"

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
    - mapper
    - dependency-auditor
    - documentation-auditor
  dependencies_satisfied: {}
  context_for_next: |
    Mode: AUDIT-ONLY. Repo is Node.js/Express with static frontend pages, WebSocket server, and protocol integrations (Ember+, TSL UMD, OSC). Next: create REPO_MAP, ENDPOINTS, STATE_MODEL, STACK_DETECTION, dependency analysis, and doc drift.
```
