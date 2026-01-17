# TSL UMD Protocol Research Document

> Production Broadcast Tally System Implementation Guide

Generated: 2026-01-17
Source: Official TSL Products documentation, GitHub implementations, broadcast vendor guides

---

## 1. Protocol Overview

The TSL UMD (Under Monitor Display) protocols are the broadcast industry standard for controlling tally indicators and display labels in multiviewers, under-monitor displays, and monitoring equipment.

**Three Protocol Versions:**

| Version | Year | Transport | Max Addresses | Key Features |
|---------|------|-----------|---------------|--------------|
| v3.1 | 1994 | Serial, UDP | 127 | Basic, 16 chars, 2 tallies |
| v4.0 | — | Serial, UDP | 127 | Adds colour control, checksum |
| v5.0 | — | UDP, TCP | 65,535 | IP-native, hierarchical, scalable |

---

## 2. TSL UMD v3.1 Specification

### Transport Options

- **Serial RS-422:** 38400 baud, EVEN parity
- **UDP/IP:** Each UDP packet contains one serial data packet
- **Default port:** UDP 40001

### Packet Structure (18 bytes fixed)

```
Byte 0:     Display Address (0-126) + 0x80
Byte 1:     Control Byte
Bytes 2-17: Display Text (16 ASCII characters)
```

### Control Byte Bit Map (Byte 1)

```
Bit 7: Cleared to 0 (reserved)
Bit 6: Reserved
Bit 5: Brightness bit 1
Bit 4: Brightness bit 0
Bit 3: Tally 4 (1=on, 0=off)
Bit 2: Tally 3 (1=on, 0=off)
Bit 1: Tally 2 (1=on, 0=off) — Typically RED/Program
Bit 0: Tally 1 (1=on, 0=off) — Typically GREEN/Preview
```

### Brightness Control (Bits 4-5)

| Value | Brightness |
|-------|------------|
| 00 | Off |
| 01 | 1/7 (dim) |
| 10 | 1/2 (medium) |
| 11 | Full |

### Example Packet (Hex)

Display address 1, Tally 2 red on, full brightness, text "CAM 1":

```
0x81 0x32 0x43 0x41 0x4D 0x20 0x31 0x20 0x20 0x20 0x20 0x20 0x20 0x20 0x20 0x20 0x20 0x20
```

Breakdown:
- `0x81` = Address 1 (0x01 + 0x80)
- `0x32` = Control: brightness=11 (full), tally2=1 = 0b00110010
- Remaining = "CAM 1" + spaces (0x20)

### Key Characteristics

- **No explicit colour encoding** — Application assigns meaning
- **Fixed 16 characters** — Pad with spaces (0x20), NOT nulls
- **No checksum** in v3.1
- **Display addresses 0-126** (127 total)

---

## 3. TSL UMD v5.0 Specification

### Design Philosophy

Purpose-built for modern IP-based multiviewer systems with cloud and virtualised workflow support.

### Transport

- **UDP:** Maximum packet length 2048 bytes (default)
- **TCP:** Optional, uses DLE/STX framing
- **Default port:** UDP 4003

### Hierarchical Addressing

```
Screen (0-65534) → Display (0-65534) → Tally Indicators
```

**Broadcast address:** 0xFFFF (65535) — sent to all displays

### Packet Structure (Variable Length)

```
Offset  Size  Field
------  ----  -----
0       2     PBC (Packet Byte Count) — 16-bit LE
2       1     VER (Version = 0x80 for v5.0)
3       1     FLAGS
4       2     SCREEN — 16-bit LE
6       2     INDEX — 16-bit LE
8       2     CONTROL — 16-bit LE (tally states, brightness)
10      2     LENGTH — 16-bit LE (text length)
12+     var   TEXT (ASCII/UTF-8)
```

### Control Bits (16-bit field at offset 8)

```
Bits 0-1:   rh_tally (right-hand)
Bits 2-3:   txt_tally (text indicator)
Bits 4-5:   lh_tally (left-hand)
Bits 6-7:   brightness
Bits 8-14:  Reserved
Bit 15:     Control data flag
```

### Tally State Values (2-bit encoding)

| Value | State |
|-------|-------|
| 0 | Off |
| 1 | Red |
| 2 | Green |
| 3 | Amber |

### Brightness Values (2-bit encoding)

| Value | Brightness |
|-------|------------|
| 0 | Off |
| 1 | Dim |
| 2 | Medium |
| 3 | Full |

### DLE/STX Framing (TCP)

```
DLE = 0xFE
STX = 0x02
```

- **Packet start:** DLE STX sequence
- **Byte stuffing:** DLE in payload becomes DLE DLE
- **UDP:** DLE/STX disabled by default
- **TCP:** DLE/STX enabled by default

---

## 4. Version Comparison

| Feature | v3.1 | v5.0 |
|---------|------|------|
| Text length | 16 chars fixed | Variable |
| Tally outputs | 2 (4 bits available) | 3 per display |
| Colour control | Implicit | Explicit RGB/Amber |
| Addressing | 0-126 | 0-65534 hierarchical |
| Transport | RS-422, UDP | UDP, TCP |
| Default port | 40001 | 4003 |
| Checksum | None | N/A (relies on transport) |
| Max packet | 18 bytes | 2048 bytes |

---

## 5. Timing and Refresh Requirements

### Normal Operation

- **Background refresh rate:** 200ms per display address
- **Full cycle (126 addresses):** ~26 seconds
- **Event-driven updates:** Immediate on tally/crosspoint changes

### Implementation Guidance

- Do NOT disable instant updates in production
- Background refresh prevents display dropout on network issues
- Instant updates ensure frame-accurate tally response

---

## 6. Hardware Compatibility

### Devices Supporting TSL UMD

**TSL Products:**
- TallyMan Advanced Control System
- TSL UMD panels and displays

**Ross Video:**
- Carbonite (all variants) — v3.1 and v5.0
- Acuity — v3.1, v4.0, v5.0

**Grass Valley:**
- Karrera, Kayenne, Zodiak, Kahuna, Kula — v3.1, v4.0, v5.0

**Blackmagic Design:**
- ATEM switchers — via middleware (not native TSL)

**Multiviewers:**
- Decimator, Kaleido, Evertz

### Vendor-Specific Quirks

**Ross Carbonite:**
- Tally 1 = Preview/Green
- Tally 2 = Program/Red
- Tally 3 and 4 always off

**Blackmagic ATEM:**
- Does not natively output TSL UMD
- Requires TallyArbiter, Bitfocus Companion, etc.

---

## 7. Node.js Implementation

### v3.1 Message Construction

```javascript
function createV31Packet(address, tally1, tally2, brightness, text) {
  const buffer = Buffer.alloc(18);

  // Byte 0: Display address + 0x80
  buffer.writeUInt8(address + 0x80, 0);

  // Byte 1: Control byte
  let control = 0;
  control |= (tally1 ? 0x01 : 0x00);  // Green/Preview
  control |= (tally2 ? 0x02 : 0x00);  // Red/Program
  control |= ((brightness & 0x03) << 4);
  buffer.writeUInt8(control, 1);

  // Bytes 2-17: Text (16 chars, space-padded)
  const label = text.padEnd(16, ' ').substring(0, 16);
  buffer.write(label, 2, 16, 'ascii');

  return buffer;
}
```

### v3.1 Message Parsing

```javascript
function parseV31Packet(buffer) {
  if (buffer.length !== 18) {
    throw new Error('Invalid packet length');
  }

  const address = buffer.readUInt8(0) & 0x7F;
  const control = buffer.readUInt8(1);

  return {
    address,
    tally1: !!(control & 0x01),  // Preview
    tally2: !!(control & 0x02),  // Program
    tally3: !!(control & 0x04),
    tally4: !!(control & 0x08),
    brightness: (control >> 4) & 0x03,
    label: buffer.toString('ascii', 2, 18).trim()
  };
}
```

### v5.0 Message Construction

```javascript
const DLE = 0xFE;
const STX = 0x02;

function createV50Packet(screen, index, display, useDLESTX = false) {
  const textBuf = Buffer.from(display.text || '', 'ascii');
  const packetLength = 12 + textBuf.length;
  const buffer = Buffer.alloc(packetLength);

  // Header
  buffer.writeUInt16LE(packetLength, 0);      // PBC
  buffer.writeUInt8(0x80, 2);                 // Version 5.0
  buffer.writeUInt8(0x00, 3);                 // Flags
  buffer.writeUInt16LE(screen, 4);            // Screen
  buffer.writeUInt16LE(index, 6);             // Index

  // Control bits
  const control = (
    ((display.rh_tally & 0x03) << 0) |
    ((display.txt_tally & 0x03) << 2) |
    ((display.lh_tally & 0x03) << 4) |
    ((display.brightness & 0x03) << 6)
  );
  buffer.writeUInt16LE(control, 8);

  // Text
  buffer.writeUInt16LE(textBuf.length, 10);
  textBuf.copy(buffer, 12);

  // DLE/STX framing for TCP
  if (useDLESTX) {
    const stuffed = [DLE, STX];
    for (const byte of buffer) {
      stuffed.push(byte);
      if (byte === DLE) stuffed.push(DLE);  // Double DLE
    }
    return Buffer.from(stuffed);
  }

  return buffer;
}
```

---

## 8. Known Bugs in Existing Libraries

### tsl-umd-v5 (NoahCallaway)

**Bug 1:** Reads wrong field
```javascript
// WRONG
tally.flags = buf.readInt8(this._VER);  // Reads version, not flags

// CORRECT
tally.flags = buf.readInt8(this._FLAGS);
```

**Bug 2:** Bitwise OR instead of logical OR
```javascript
// WRONG
if (!ip | !port | !tally)  // Bitwise OR!

// CORRECT
if (!ip || !port || !tally)  // Logical OR
```

**Bug 3:** DLE-stuffing loop starts at wrong index

---

## 9. Production Warnings

### Frame Accuracy

TSL UMD has NO frame-synchronisation mechanism. Tally changes are sent asynchronously over IP.

For frame-accurate tally:
- Use genlock on receiving devices
- Consider GPI/GPO hardware tally for critical applications
- TSL is adequate for operator displays, not camera reds

### Network Reliability

- UDP is lossy by design
- Implement background refresh (200ms/display)
- Monitor for stale data (>5 seconds = fault)

### Security

- No authentication or encryption
- Isolate tally networks (VLANs)
- Any device on network can send updates

---

## 10. Implementation Recommendations

### Phase 1: Core Protocol (v5.0)

1. Message construction and parsing
2. UDP send/receive (primary)
3. Configurable port (default 4003)
4. Basic validation

### Phase 2: Production Features

1. Background refresh (200ms cycle)
2. Event-driven instant updates
3. Error handling and logging
4. Multi-device state tracking

### Phase 3: Legacy Compatibility

1. v3.1 fallback mode (port 40001)
2. Protocol auto-detection
3. Version negotiation

---

## Sources

- [TSL UMD Protocol Specification PDF](https://tslproducts.com/)
- [Ross Video TSL UMD Setup](https://help.rossvideo.com/carbonite-device/Topics/Devices/UMD/TSL.html)
- [tslumd Python Documentation](https://tslumd.readthedocs.io/)
- [GitHub: NoahCallaway/tsl-umd-v5](https://github.com/NoahCallaway/tsl-umd-v5)
- [Bitfocus Companion TSL Module](https://github.com/bitfocus/companion-module-tslproducts-umd)
