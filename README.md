# SuperDash

Real-time playout monitoring for broadcast environments.

---

## Overview

SuperDash is a unified monitoring system for professional broadcast facilities. It aggregates state from multiple playout devices (CasparCG, vMix, HyperDeck) and distributes normalised status information via WebSocket, Ember+, and TSL UMD protocols.

Designed for live television production where reliability and timing precision are non-negotiable.

---

## Features

- **Multi-source aggregation** — CasparCG (OSC), vMix (HTTP XML), HyperDeck (TCP)
- **Broadcast protocol output** — Ember+ provider (TCP 9000), TSL UMD v5.0 sender (UDP)
- **Real-time dashboard** — Responsive grid layout for up to 12 devices
- **Frame-accurate timing** — Drift-free scheduling with monotonic timestamps
- **Health endpoint** — `/health` for operational monitoring
- **Single-process deployment** — HTTP, WebSocket, and protocols from one server

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SuperDash Server                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  CasparCG   │  │    vMix     │  │  HyperDeck  │  ← Inputs   │
│  │  OSC/UDP    │  │  HTTP/XML   │  │    TCP      │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│                 ┌─────────────────┐                             │
│                 │  State Manager  │                             │
│                 └────────┬────────┘                             │
│                          │                                      │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  WebSocket  │  │   Ember+    │  │  TSL UMD    │  ← Outputs  │
│  │    :3050    │  │  TCP :9000  │  │  UDP :4003  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/FiLORUX/superdash.git
cd superdash
npm install

# Configure devices
cp config.example.json config.json
# Edit config.json with your device IPs

# Start server
npm start
```

Open `http://localhost:3050/dashboard.html` in a browser.

---

## Configuration

Copy `config.example.json` to `config.json` and adjust for your environment:

```json
{
  "settings": {
    "defaultFramerate": 50,
    "updateIntervalMs": 100,
    "webSocketPort": 3050,
    "defaultPorts": {
      "hyperdeck": 9993,
      "vmix": 8088,
      "casparcg": 6250
    },
    "emberPlusPort": 9000,
    "tslUmdDestinations": [
      { "host": "192.168.1.100", "port": 4003 }
    ],
    "tslUmdScreen": 0
  },
  "servers": [
    {
      "id": 1,
      "name": "CasparCG 1",
      "type": "casparcg",
      "ip": "192.168.1.10"
    }
  ]
}
```

### Device Types

| Type | Protocol | Default Port | Notes |
|------|----------|--------------|-------|
| `casparcg` | OSC over UDP | 6250 | Requires OSC output enabled in CasparCG |
| `vmix` | HTTP XML API | 8088 | Polls `/api` endpoint |
| `hyperdeck` | TCP (Telnet-style) | 9993 | Persistent connection with keepalive |

---

## Output Modes

### Dashboard (`/dashboard.html`)

Responsive grid displaying all configured devices with live state, timecode, and filename. Scales automatically from 1 to 12 devices.

### Overlay (`/overlay.html`)

Transparent overlay for multiviewer integration. Shows single-device status with timecode bar and state indicator.

### GUI (`/gui.html`)

Fullscreen countdown view for operator displays or prompters.

### Control Panel (`/control.html`)

Configuration interface for adding and managing devices.

---

## Broadcast Protocol Integration

### Ember+ Provider

Exposes device state via Ember+ tree structure on TCP port 9000. Compatible with VSM, Lawo, and other broadcast control systems.

**Tree Structure:**
```
SuperDash
├── Info
│   └── Version: "1.0.0"
└── Devices
    ├── Device_1
    │   ├── State: "play"
    │   ├── Timecode: "01:23:45:12"
    │   ├── Filename: "clip.mov"
    │   ├── Connected: true
    │   └── Type: "casparcg"
    └── Device_2
        └── ...
```

### TSL UMD v5.0 Sender

Sends tally state to TSL UMD displays over UDP. State mapping:

| Device State | TSL Tally |
|--------------|-----------|
| `play` | Red (Brightness 3) |
| `rec` | Amber (Brightness 3) |
| `stop` | Off |
| `offline` | Off (Dimmed) |

---

## Health Monitoring

The `/health` endpoint provides operational status:

```bash
curl http://localhost:3050/health
```

```json
{
  "status": "healthy",
  "uptime": 3600.5,
  "version": "1.0.0",
  "devices": {
    "total": 5,
    "connected": 4,
    "list": [...]
  },
  "protocols": {
    "websocket": { "clients": 2 },
    "emberPlus": { "enabled": true, "running": true },
    "tslUmd": { "enabled": true, "running": true }
  },
  "memory": { "heapUsed": 12, "heapTotal": 14, "unit": "MB" }
}
```

Status values:
- `healthy` — At least one device connected
- `degraded` — No devices connected

---

## Development

```bash
# Development mode with auto-reload
npm run dev

# Run tests
npm test

# Format code
npx prettier --write .
```

### Project Structure

```
superdash/
├── server/
│   ├── server.js              # Main entry point
│   ├── hyperdeck-client.js    # HyperDeck TCP client
│   ├── vmix-client.js         # vMix HTTP poller
│   ├── osc-casparcg.js        # CasparCG OSC listener
│   ├── emberplus-provider.js  # Ember+ tree provider
│   ├── tsl-umd-sender.js      # TSL UMD v5.0 sender
│   └── __tests__/             # Jest test suites
├── public/
│   ├── dashboard.html         # Multi-device grid
│   ├── overlay.html           # Transparent overlay
│   ├── gui.html               # Fullscreen countdown
│   └── control.html           # Configuration panel
├── research/                  # Protocol documentation
├── config.example.json        # Configuration template
└── package.json
```

---

## Requirements

- Node.js 18 LTS or later
- Network access to playout devices
- UDP port 6250 open for CasparCG OSC (if used)
- TCP port 9000 available for Ember+ provider

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

Built for broadcast environments where downtime is not an option.

Protocol documentation sourced from Lawo (Ember+) and TSL Products (UMD).
