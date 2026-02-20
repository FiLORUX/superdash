# Repository Map

## Overview

- **Project type:** Node.js service with embedded static web UI.
- **Primary entry point:** `server/server.js` (HTTP + WebSocket + protocol bridges).
- **Frontend:** Static HTML/CSS/JS files served by Express from `public/`.
- **Tests:** Jest unit tests in `server/__tests__/`.
- **Deployment:** systemd unit in `deploy/`.

## Top-Level Structure

```
superdash/
├── server/                 # Node.js backend + protocol clients
│   ├── server.js            # Main entry: config load, HTTP/WS, protocol startup
│   ├── hyperdeck-client.js  # TCP client for HyperDeck
│   ├── vmix-client.js       # HTTP XML poller for vMix
│   ├── osc-casparcg.js      # OSC listener for CasparCG (shared UDP)
│   ├── emberplus-provider.js# Ember+ server (TCP)
│   ├── tsl-umd-sender.js    # TSL UMD v5 sender (UDP)
│   └── __tests__/           # Jest unit tests
├── public/                 # Static UI pages (inline JS/CSS)
│   ├── index.html           # Navigation + health snippet
│   ├── dashboard.html       # Multi-device grid UI
│   ├── gui.html             # Single-device fullscreen UI
│   ├── overlay.html         # SDI overlay UI
│   └── control.html         # Client-side config generator
├── deploy/                 # Production deployment assets
│   ├── README.md            # systemd setup guide
│   └── superdash.service    # systemd unit
├── research/               # Protocol reference notes
├── config.example.json      # Sample configuration
├── config.json              # Local config (gitignored)
├── package.json             # Dependencies and scripts
├── package-lock.json        # Lockfile
└── README.md                # Product overview and usage
```

## Entrypoints & Runtime Boundaries

- **Runtime entry:** `npm start` → `node server/server.js`.
- **HTTP/WS:** Express HTTP server + WebSocket server on `settings.webSocketPort` (default 3050).
- **Protocol listeners/clients:**
  - **CasparCG** OSC UDP listener (incoming) on `settings.defaultPorts.casparcg` (default 6250).
  - **HyperDeck** TCP client (outgoing) to port 9993 (default).
  - **vMix** HTTP client (outgoing) to `http://<ip>:8088/api` (default).
  - **Ember+** TCP server (incoming) on `settings.emberPlusPort` (default 9000).
  - **TSL UMD** UDP sender (outgoing) to configured destinations.

## Ignored/Generated

- `node_modules/` and `tmp/` are gitignored.
- `config.json` is gitignored (local environment config).

---
## Attestation

```yaml
# Identity
agent_id: audit-mapper
agent_version: "1.0"
protocol_version: "2.0"

# Timing
timestamp: 2026-01-31T13:11:47Z
duration_seconds: 780

# Context
git_ref: e4bb0098264f90d3afc7b5d0f3b5e425d1825761
git_branch: main
working_directory: /Users/david/Documents/GitHub/superdash

# Artefact metadata
artefact: REPO_MAP.md
phase: 1
status: COMPLETE

# Confidence assessment
confidence: HIGH
confidence_notes: "Directory structure and entrypoints confirmed via file listing and source inspection."

# Inputs consumed (with integrity hashes)
inputs_consumed:
  - path: .gitignore
    hash: sha256:d1d8285362a61f1b05bd83616e8901c8f524e35c14d8c10f8779243bae595052
  - path: server/
    type: directory
    file_count: 8
  - path: public/
    type: directory
    file_count: 5
  - path: deploy/
    type: directory
    file_count: 2
  - path: config.example.json
    hash: sha256:84d7cd97ca20377c204fa04038ff90b5bc08eb1855cdee0ded54f061677cb49a
  - path: config.json
    hash: sha256:ec3b968fd89aa8d66a27b8d4f53980e27b2fc28bfe479f8d726b1c5b162216e0

# Commands executed
commands_executed:
  - seq: 1
    cmd: "ls -a"
    exit_code: 0
    purpose: "Inventory root files including ignored entries"
    output_summary: "Observed .gitignore, config.json, server/, public/, deploy/, research/"
  - seq: 2
    cmd: "find . -maxdepth 2 -type d -not -path './node_modules*' -not -path './.git*'"
    exit_code: 0
    purpose: "Directory map"
    output_summary: "Mapped key directories"
  - seq: 3
    cmd: "rg --files -g '!*node_modules*'"
    exit_code: 0
    purpose: "File inventory (gitignored respected)"
    output_summary: "Enumerated tracked files"
  - seq: 4
    cmd: "cat .gitignore"
    exit_code: 0
    purpose: "Identify ignored/generated files"
    output_summary: "config.json and node_modules ignored"
  - seq: 5
    cmd: "shasum -a 256 .gitignore server/server.js server/hyperdeck-client.js server/vmix-client.js server/osc-casparcg.js server/emberplus-provider.js server/tsl-umd-sender.js public/index.html public/dashboard.html public/gui.html public/overlay.html public/control.html deploy/README.md deploy/superdash.service config.example.json config.json"
    exit_code: 0
    purpose: "Hash key inputs"
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
    - documentation-auditor
    - security-analyst
    - reliability-analyst
    - performance-analyst
    - configuration-auditor
  dependencies_satisfied:
    REPO_MAP.md: COMPLETE
  context_for_next: |
    Project is a single Node.js server with static UI and broadcast protocol integrations. Key runtime entrypoint is server/server.js; protocol clients in server/*.js; UIs in public/*.html; deployment via systemd.
```
