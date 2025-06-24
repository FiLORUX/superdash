# SuperDash

**Thåst Media Playout Superimpose & Dashboard Suite**

---

> A modern, highly adaptive, real-time playout monitoring and countdown system for professional broadcast, esports and event control. Designed with obsessive attention to smooth UX, operational clarity, and true grid-based elegance.

---

## 🔧 Overview

**SuperDash** is a hybrid real-time visualisation system tailored for live TV, OB units, and multi-source recording/graphics control environments.
It supports live monitoring from **CasparCG**, **vMix**, and **HyperDeck**, with three distinct output modes:

* **Overlay View** — EVS-style semi-transparent real-time status overlay for multiviewer or PGM overlay
* **GUI View** — Clean fullscreen countdown view for graphics ops or prompters
* **Dashboard View** — Responsive grid-based layout for up to 12 playout/record devices

Every part of the system is built in **pure HTML5/JS/CSS**, driven by a modular **Node.js backend**, and designed to be compiled into a native app via **Tauri** for Mac/Windows/Linux.

---

## 🧰 Key Features

* ✅ Real-time playout data from CasparCG (via OSC), vMix (XML API), HyperDeck (TCP protocol)
* 🔎 Fully dynamic grid layout: responsive to screen size and device count
* 🔄 Adaptive typography and animation using `requestAnimationFrame`
* 🎨 Pixel-free design: grid-based, no fixed units
* 🔏 Tauri-ready: full native packaging for macOS (incl. M1/M2) & Windows
* 📂 Configurable via human-readable `config.json`
* 📊 Modular architecture (can run browser-only, or as a unified app)

---

## 🌐 Output Modes

### 1. Overlay Mode (`/overlay.html`)

> EVS-style transparent overlay: clip name, timecode, bar, state indicator (PLAY/REC/STOP)

* Designed to be layered over SDI or in Multiviewers
* Share Tech Mono font
* Extremely smooth, non-jittery rendering

### 2. GUI Mode (`/gui.html`)

> Clean fullscreen countdown view with visual bar and current filename

* Ideal for playout op / prompter / assist view
* Customisable with themes and display toggles

### 3. Dashboard Mode (`/dashboard.html`)

> Elegant responsive dashboard displaying status of up to 12 devices

* Each card adapts in size and position
* Shows live state, timecode, label, and sync glow

---

## 🛠️ Project Structure

```
superdash/
├── server/                 # Node.js backend (OSC, XML, TCP + WebSocket)
│   ├── server.js           # Main server entrypoint
│   ├── osc-casparcg.js     # OSC listener for CasparCG
│   ├── vmix-client.js      # XML poller for vMix
│   └── hyperdeck-client.js # Telnet handler for HyperDeck
├── public/                 # Frontend (runs in any browser)
│   ├── control.html        # GUI for config, IP setup, mode switching
│   ├── overlay.html        # EVS-style transparent overlay
│   ├── gui.html            # Fullscreen countdown display
│   └── dashboard.html      # Multi-device playout dashboard
├── config.json             # Human-editable configuration (IPs, display, labels)
├── package.json            # Node project config
└── README.md               # You are here
```

---

## ⚙️ Development Flow

1. Clone repo and run: `npm install`
2. Start server: `node server/server.js`
3. Open `control.html` in your browser to configure devices and launch views
4. Test responsiveness by simulating different numbers of HyperDecks
5. Eventually: run `npm run tauri dev` to compile into a native app

---

## 📊 Planned Enhancements

* ⏲ Countdown sync from incoming Timecode / LTC
* 🔔 Audio cue trigger on playout events (rec start / end)
* 🌍 Remote-sync mode for distributed deployments
* 🌊 Custom theming, dark/light style toggles

---

## 👥 Authors & Credits

**David Thåst** — Concept, UX, Broadcast Architecture
**\[YourNameHere]** — Lead Developer
Special thanks to the CasparCG, vMix & HyperDeck communities

---

> "Everything must be smooth, readable, and elegant. Always." — D.T.
