# License Audit

## Summary

- Direct dependency licenses are predominantly **MIT**.
- `osc` is dual-licensed `(MIT OR GPL-2.0)` — ensure distribution complies with chosen license.
- Transitive licenses not exhaustively audited.

## Direct Dependencies

| Package | License | Evidence |
|---------|---------|----------|
| express | MIT | `node_modules/express/package.json` |
| ws | MIT | `node_modules/ws/package.json` |
| osc | (MIT OR GPL-2.0) | `node_modules/osc/package.json` |
| emberplus-connection | MIT | `node_modules/emberplus-connection/package.json` |

## Direct Dev Dependencies

| Package | License | Evidence |
|---------|---------|----------|
| jest | MIT | `node_modules/jest/package.json` |
| nodemon | MIT | `node_modules/nodemon/package.json` |
| prettier | MIT | `node_modules/prettier/package.json` |

## Notes

- A full license scan (including transitive dependencies) requires a dedicated tool (e.g., `license-checker`) in an environment with full access.

---
## Attestation

```yaml
# Identity
agent_id: audit-dependencies
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T13:15:21Z
duration_seconds: 180

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: LICENSE_AUDIT.md
phase: 1
status: COMPLETE

# Confidence assessment
confidence: MEDIUM
confidence_notes: "Direct dependency licenses confirmed from installed package.json files; transitive licenses not scanned."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: node_modules/express/package.json
    type: file
  - path: node_modules/ws/package.json
    type: file
  - path: node_modules/osc/package.json
    type: file
  - path: node_modules/emberplus-connection/package.json
    type: file
  - path: node_modules/jest/package.json
    type: file
  - path: node_modules/nodemon/package.json
    type: file
  - path: node_modules/prettier/package.json
    type: file

# Commands executed
commands_executed:
  - seq: 1
    cmd: "node -e \"const pkgs=['express','ws','osc','emberplus-connection','jest','nodemon','prettier']; for (const p of pkgs) { try { const pkg=require('./node_modules/'+p+'/package.json'); console.log(p, pkg.version, pkg.license || pkg.licenses || 'UNKNOWN'); } catch(e){ console.log(p, 'NOT_FOUND'); } }\""
    exit_code: 0
    purpose: "Extract package licenses"
    output_summary: "All direct deps MIT except osc (MIT OR GPL-2.0)"

# Findings summary
findings:
  critical: 0
  high: 0
  medium: 0
  low: 1
  info: 1

# Blocking issues
blocking_issues: []

# Handoff
handoff:
  ready: true
  next_agents:
    - compliance-analyst
  dependencies_satisfied:
    LICENSE_AUDIT.md: COMPLETE
  context_for_next: |
    Direct deps are MIT except osc which is dual-licensed MIT or GPL-2.0. Transitive licenses not scanned.
```
