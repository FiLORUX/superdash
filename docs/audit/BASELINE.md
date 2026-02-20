# Baseline Verification Log

## Environment Notes

- **Node version observed:** v25.3.0 (from test output)
- **README requirement:** Node.js 20 LTS or later

## Test Runs

### Run 1: `npm test`
- **Result:** FAIL
- **Error:** Watchman permission error (`fchmod ... Operation not permitted`) when Jest attempts to use watchman.
- **Impact:** Tests did not execute.

### Run 2: `JEST_DISABLE_WATCHMAN=1 npm test`
- **Result:** FAIL
- **Error:** Same watchman permission error; disabling env var did not prevent watchman usage.
- **Impact:** Tests did not execute.

### Run 3: `npm test -- --watchman=false`
- **Result:** FAIL
- **Error(s):**
  - `EmberPlusProvider` tests failed to bind TCP ports (EPERM on 0.0.0.0:9100+).
  - `TslUmdSender` tests failed to bind UDP socket (EPERM on 0.0.0.0).
  - Jest worker retries exhausted.
- **Impact:** Tests executed but failed due to OS/sandbox network restrictions.

---
## Attestation

```yaml
# Identity
agent_id: audit-verifier
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T16:56:17Z
duration_seconds: 420

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: BASELINE.md
phase: 2
status: PARTIAL

# Confidence assessment
confidence: LOW
confidence_notes: "Tests could not be executed successfully due to watchman and socket permission errors in this environment."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: package.json
    hash: sha256:70e8dd52c247117ffa5ce594476eb72028ef8e3150fa6a1255aab7860d0e48ae
  - path: server/__tests__/emberplus-provider.test.js
    hash: sha256:9de156fc5e2dfd173f01bc2f06c04f86a2ea5fae1f0bc6432265fe1ee46c7ab6
  - path: server/__tests__/tsl-umd-sender.test.js
    hash: sha256:7755f1cf1f0b51678ce71c8101bdcf2076f2cb069f81fd7cc694278e3899240b

# Commands executed
commands_executed:
  - seq: 1
    cmd: "npm test"
    exit_code: 1
    purpose: "Run baseline Jest suite"
    output_summary: "Watchman permission error; tests did not run"
  - seq: 2
    cmd: "JEST_DISABLE_WATCHMAN=1 npm test"
    exit_code: 1
    purpose: "Attempt to bypass watchman"
    output_summary: "Same watchman error"
  - seq: 3
    cmd: "npm test -- --watchman=false"
    exit_code: 1
    purpose: "Force watchman off"
    output_summary: "Socket bind EPERM errors for Ember+ and TSL UMD"
  - seq: 4
    cmd: "shasum -a 256 server/__tests__/emberplus-provider.test.js server/__tests__/tsl-umd-sender.test.js"
    exit_code: 0
    purpose: "Record test file hashes"
    output_summary: "Hashes recorded for baseline inputs"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 1
  low: 0
  info: 1

# Blocking issues
blocking_issues:
  - "Test execution blocked by watchman permission and socket bind EPERM in sandbox environment"

# Handoff
handoff:
  ready: false
  next_agents: []
  dependencies_satisfied:
    BASELINE.md: PARTIAL
  context_for_next: |
    Tests require local socket binding; rerun in environment allowing 0.0.0.0 binds or with mocks. Watchman failure also blocks default Jest runs.
```
