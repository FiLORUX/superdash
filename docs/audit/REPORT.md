# Audit Report

## Attestation (Header)
```yaml
agent_id: audit-orchestrator
timestamp: 2026-01-31T17:13:46Z
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
artefact: REPORT.md
status: COMPLETE
confidence: MEDIUM
contributing_agents:
  - audit-mapper
  - audit-dependencies
  - audit-documentation
  - audit-security
  - audit-reliability
  - audit-performance
  - audit-database
  - audit-configuration
  - audit-compliance
  - audit-accessibility
  - audit-test-quality
  - audit-api-contracts
  - audit-concurrency
  - audit-report-writer
total_findings: 17
```

---

## Executive Summary

SuperDash is a compact Node.js monitoring service for broadcast playout devices with Ember+, TSL UMD, and OSC integrations. The primary risks are unauthenticated exposure of operational data over `/health` and WebSocket endpoints, and reliability issues in protocol handling (TSL UMD sender bind state and CasparCG shared listener multiplexing). Test coverage is limited and not hermetic, which increases regression risk.

**Overall Risk Rating:** MEDIUM

**Immediate Actions Required:**
1. Restrict or authenticate `/health` and WebSocket access.
2. Fix TSL UMD sender startup state handling.
3. Address CasparCG shared listener multiplexing for multi-channel setups.

**Audit Limitations:**
- CVE audit incomplete due to network restrictions.
- Baseline tests failed in this environment due to watchman and socket permission errors.

---

## 1. Architecture Overview

```
CasparCG (OSC UDP) ─┐
HyperDeck (TCP) ────┼─> SuperDash server ──> WebSocket clients
vMix (HTTP XML) ────┘                 └─> Ember+ provider
                                     └─> TSL UMD sender
```

Key components:
- `server/server.js`: HTTP + WebSocket server, state manager, protocol startup.
- `server/*-client.js`: Protocol clients (HyperDeck, vMix, CasparCG).
- `server/emberplus-provider.js`, `server/tsl-umd-sender.js`: Broadcast protocol outputs.
- `public/*.html`: Static dashboards and control UI.

---

## 2. Findings Summary

### By Severity

| Severity | Count | Categories |
|----------|-------|------------|
| CRITICAL | 0 | - |
| HIGH | 0 | - |
| MEDIUM | 8 | Security, Reliability, Concurrency, Performance, Configuration, Testing, Documentation |
| LOW | 9 | Security, Reliability, Performance, Configuration, Accessibility, Documentation, Compliance |
| INFO | 8 | Compliance, Data flows, Test architecture, Baseline limits |

### By Category

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 0 | 0 | 1 | 2 |
| Reliability | 0 | 0 | 1 | 1 |
| Concurrency | 0 | 0 | 1 | 0 |
| Performance | 0 | 0 | 1 | 1 |
| Configuration | 0 | 0 | 1 | 1 |
| Documentation | 0 | 0 | 1 | 1 |
| Testing | 0 | 0 | 2 | 0 |
| Accessibility | 0 | 0 | 0 | 2 |
| Compliance | 0 | 0 | 0 | 1 |

---

## 3. Critical & High Findings

None.

---

## 4. Medium & Low Findings

| ID | Severity | Category | Title | Location |
|----|----------|----------|-------|----------|
| F-001 | MEDIUM | Security | Unauthenticated `/health` + WebSocket expose device state/config | `server/server.js:323` |
| F-002 | MEDIUM | Reliability | TSL UMD sender marks running before bind success | `server/tsl-umd-sender.js:227` |
| F-003 | MEDIUM | Concurrency | CasparCG shared listener keyed by IP only | `server/osc-casparcg.js:49` |
| F-004 | MEDIUM | Performance | Fixed-interval full-state broadcasts | `server/server.js:481` |
| F-005 | MEDIUM | Configuration | Minimal config schema validation | `server/server.js:33` |
| F-006 | MEDIUM | Testing | Tests rely on real socket binding | `server/__tests__/emberplus-provider.test.js:13` |
| F-007 | MEDIUM | Testing | Core protocol clients lack tests | `server/` |
| F-008 | MEDIUM | Documentation | Control panel claims live testing/simulation not implemented | `README.md:157` |
| F-009 | LOW | Security | Ember+ provider binds to all interfaces by default | `server/emberplus-provider.js:101` |
| F-010 | LOW | Security | OSC listener accepts packets from any sender | `server/osc-casparcg.js:116` |
| F-011 | LOW | Reliability | No SIGTERM handler for systemd stop | `server/server.js:584` |
| F-012 | LOW | Performance | vMix polling default 500ms could be heavy at scale | `server/vmix-client.js:108` |
| F-013 | LOW | Configuration | Unknown device types yield undefined ports | `server/server.js:163` |
| F-014 | LOW | Accessibility | No ARIA live regions for dynamic updates | `public/dashboard.html:238` |
| F-015 | LOW | Accessibility | Potential low-contrast text on dark UI | `public/dashboard.html:206` |
| F-016 | LOW | Documentation | "Up to 12 devices" not enforced in UI | `README.md:126` |
| F-017 | LOW | Compliance | Dual-license dependency (`osc` MIT/GPL-2.0) | `node_modules/osc/package.json` |

---

## 5. Test Coverage Matrix

| Area | Unit | Integration | E2E | Coverage | Notes |
|------|------|-------------|-----|----------|-------|
| Ember+ provider | Partial | Partial | No | Low | Tests start real sockets |
| TSL UMD sender | Partial | Partial | No | Low | Tests start real sockets |
| HyperDeck client | No | No | No | None | No tests present |
| vMix client | No | No | No | None | No tests present |
| CasparCG OSC | No | No | No | None | No tests present |
| WebSocket server | No | No | No | None | No tests present |
| UI pages | No | No | No | None | No UI tests present |

---

## 6. Change Proposals (Audit-Only)

### CP-001: Add access control for `/health` and WebSocket

| Attribute | Value |
|-----------|-------|
| Related Findings | F-001 |
| Priority | MEDIUM |
| Effort | Medium |
| Risk | Low |

**Files Affected:** `server/server.js`

**Proposed Diff (conceptual):**
```diff
+const API_TOKEN = process.env.SUPERDASH_TOKEN;
+
+function requireToken(req, res, next) {
+  if (!API_TOKEN) return next();
+  const auth = req.headers.authorization || '';
+  if (auth === `Bearer ${API_TOKEN}`) return next();
+  res.status(401).json({ error: 'unauthorized' });
+}
+
+app.use('/health', requireToken);
+
+wss.on('connection', (socket, request) => {
+  if (API_TOKEN) {
+    const auth = request.headers['authorization'];
+    if (auth !== `Bearer ${API_TOKEN}`) {
+      socket.close();
+      return;
+    }
+  }
+  ...
+});
```

**Test Case:**
- With token set, `/health` returns 401 without header and 200 with valid `Authorization` header.
- WebSocket connection without token is closed; with token receives `playoutStates`.

---

### CP-002: Fix TSL UMD sender startup state

| Attribute | Value |
|-----------|-------|
| Related Findings | F-002 |
| Priority | MEDIUM |
| Effort | Low |
| Risk | Low |

**Files Affected:** `server/tsl-umd-sender.js`

**Proposed Diff (conceptual):**
```diff
- this._socket.bind(() => {
-   if (this._socket) {
-     this._socket.setBroadcast(true);
-   }
- });
-
- this._isRunning = true;
+ this._socket.bind(() => {
+   if (this._socket) {
+     this._socket.setBroadcast(true);
+     this._isRunning = true;
+     this._scheduleRefresh();
+   }
+ });
```

**Test Case:**
- Mock `dgram.createSocket` to emit `error` before `listening`; verify `_isRunning` remains false.

---

### CP-003: Support multiple CasparCG devices per IP

| Attribute | Value |
|-----------|-------|
| Related Findings | F-003 |
| Priority | MEDIUM |
| Effort | Medium |
| Risk | Medium |

**Files Affected:** `server/osc-casparcg.js`

**Proposed Diff (conceptual):**
```diff
- clients: new Map(), // ip -> client
+ clients: new Map(), // ip -> [clients]
...
- this.clients.set(client.ip, client);
+ const list = this.clients.get(client.ip) || [];
+ list.push(client);
+ this.clients.set(client.ip, list);
...
- const client = this.clients.get(sourceIp);
- if (client) client._handleOscMessage(...)
+ const list = this.clients.get(sourceIp) || [];
+ for (const client of list) client._handleOscMessage(...)
```

**Test Case:**
- Register two clients with same IP/different channel; verify both receive relevant OSC updates.

---

## 7. Remaining Work

- Complete CVE audit in an environment with registry access.
- Rerun Jest tests where socket binding is permitted or mocked.
- Add unit tests for HyperDeck/vMix/CasparCG protocol parsing.
- Add basic WebSocket contract tests and JSON schema validation.

---

## 8. Appendices

- `docs/audit/REPO_MAP.md`
- `docs/audit/ENDPOINTS.md`
- `docs/audit/STATE_MODEL.md`
- `docs/audit/SECURITY.md`
- `docs/audit/RELIABILITY.md`
- `docs/audit/PERFORMANCE.md`
- `docs/audit/CONFIGURATION.md`
- `docs/audit/TEST_QUALITY.md`

---
## Attestation

```yaml
# Identity
agent_id: audit-orchestrator
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T17:13:46Z
duration_seconds: 720

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: REPORT.md
phase: 7
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Findings synthesized from audit artefacts; no successful test baseline due to environment constraints."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: docs/audit/EXECUTIVE_SUMMARY.md
    type: file
  - path: docs/audit/REMEDIATION_ROADMAP.md
    type: file
  - path: docs/audit/SECURITY.md
    type: file
  - path: docs/audit/RELIABILITY.md
    type: file
  - path: docs/audit/PERFORMANCE.md
    type: file
  - path: docs/audit/CONFIGURATION.md
    type: file
  - path: docs/audit/TEST_QUALITY.md
    type: file
  - path: docs/audit/DOCUMENTATION_DRIFT.md
    type: file

# Commands executed
commands_executed:
  - seq: 1
    cmd: "ls docs/audit"
    exit_code: 0
    purpose: "Collect artefact inventory"
    output_summary: "Report synthesized from all artefacts"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 8
  low: 9
  info: 8

# Blocking issues
blocking_issues:
  - "CVE audit incomplete due to network restrictions"
  - "Baseline tests failed due to watchman/socket permission errors"

# Handoff
handoff:
  ready: true
  next_agents: []
  dependencies_satisfied:
    REPORT.md: COMPLETE
  context_for_next: |
    Final report produced for audit-only run.
```
