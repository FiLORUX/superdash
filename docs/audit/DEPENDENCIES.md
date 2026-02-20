# Dependency Analysis

## Summary

- **Direct dependencies:** 4
- **Direct devDependencies:** 3
- **Total packages (lockfile):** 440 (including root)
- **Package manager:** npm (package-lock.json present)

## Direct Runtime Dependencies

| Package | Version (lock) | Range (package.json) | Notes |
|---------|----------------|----------------------|-------|
| express | 5.2.1 | ^5.2.1 | HTTP server framework |
| ws | 8.18.2 | ^8.0.0 | WebSocket server/client |
| osc | 2.4.5 | ^2.4.5 | OSC protocol parsing |
| emberplus-connection | 0.3.1 | ^0.3.1 | Ember+ protocol server |

## Direct Dev Dependencies

| Package | Version (lock) | Range (package.json) | Purpose |
|---------|----------------|----------------------|---------|
| jest | 30.2.0 | ^30.2.0 | Unit tests |
| nodemon | 3.1.10 | ^3.1.10 | Dev reload |
| prettier | 3.6.0 | ^3.6.0 | Formatting |

## Transitive Footprint

- Total packages in `package-lock.json`: **440**.
- No native addons detected in top-level dependencies (based on direct package list).

## Supply Chain Notes

- The dependency surface is small and focused on protocol and transport libraries.
- Express 5.x indicates a newer major line; verify compatibility with any middleware if added.

---
## Attestation

```yaml
# Identity
agent_id: audit-dependencies
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T13:14:36Z
duration_seconds: 480

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: DEPENDENCIES.md
phase: 1
status: COMPLETE

# Confidence assessment
confidence: HIGH
confidence_notes: "Direct dependencies and versions confirmed via package.json and package-lock.json."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: package.json
    hash: sha256:70e8dd52c247117ffa5ce594476eb72028ef8e3150fa6a1255aab7860d0e48ae
  - path: package-lock.json
    hash: sha256:eed91e3fb91278c5dbc3c76dc9a5d370400c5fc5ce904cdfd96ae74ee5c251fe

# Commands executed
commands_executed:
  - seq: 1
    cmd: "node -e \"const lock=require('./package-lock.json'); console.log(Object.keys(lock.packages||{}).length);\""
    exit_code: 0
    purpose: "Count packages in lockfile"
    output_summary: "440 packages"
  - seq: 2
    cmd: "node -e \"const lock=require('./package-lock.json'); const root=lock.packages['']||{}; const deps=root.dependencies||{}; const dev=root.devDependencies||{}; console.log('deps', deps); console.log('dev', dev);\""
    exit_code: 0
    purpose: "Extract direct dependency ranges"
    output_summary: "Direct deps and dev deps listed"
  - seq: 3
    cmd: "node -e \"const lock=require('./package-lock.json'); const names=['emberplus-connection','express','osc','ws','jest','nodemon','prettier']; for (const name of names){ const key='node_modules/'+name; const info=lock.packages[key]; console.log(name, info?info.version:'?'); }\""
    exit_code: 0
    purpose: "Extract resolved versions from lockfile"
    output_summary: "Resolved versions recorded"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 0
  low: 0
  info: 1

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - security-analyst
    - compliance-analyst
  dependencies_satisfied:
    DEPENDENCIES.md: COMPLETE
  context_for_next: |
    Dependency surface is small: express, ws, osc, emberplus-connection. Total lockfile packages ~440.
```
