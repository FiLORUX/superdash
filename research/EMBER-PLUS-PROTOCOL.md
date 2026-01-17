# Ember+ Protocol Research Document

> Production Broadcast Monitoring System Implementation Guide

Generated: 2026-01-17
Source: Official Lawo Ember+ GitHub Repository, community implementations, broadcast engineering forums

---

## Executive Summary

Ember+ is an **open control protocol** initiated by Lawo Group for device interaction in broadcast environments. The protocol is **feature-complete and in maintenance mode** (as of version 1.8.0, February 2019). It follows a provider-consumer architecture over TCP (typically port 9000) using a hierarchical tree structure encoded with ASN.1 BER and framed with the S101 protocol.

**Critical understanding:** Ember+ does NOT standardise device parameters — it defines communication structures and tree framework only. Each manufacturer implements their own tree content, similar to XML's flexibility.

---

## 1. Official Specification

### Documentation Files

Located at https://github.com/Lawo/ember-plus/tree/master/documentation:

- **Ember+ Documentation.pdf** — Core specification
- **Ember+ Formulas.pdf** — Formula functionality
- **Ember+ Service Discovery.pdf** — Device discovery mechanisms

### Protocol Status

**Version 1.8.0 (2019-02-14)** — Latest feature release:
- Feature-frozen maintenance mode — considered feature-complete
- No extensions planned in foreseeable future
- New features: multiple schema references per node, node templates, parameters with `null` values

**Version 1.8.2 (2019-11-14)** — Latest maintenance release:
- Fixed incorrect assumption about multibyte encoded value lengths
- Fixed missing null pointer checks

---

## 2. Protocol Architecture

### Three-Layer Structure

```
┌─────────────────┐
│      Glow       │  Data schema (DTD) defining types
├─────────────────┤
│      EmBER      │  ASN.1 BER encoding storing Glow instances
├─────────────────┤
│      S101       │  Framing protocol for TCP transmission
└─────────────────┘
```

### Provider-Consumer Model

**Provider** (e.g., mixing console):
- Publishes tree of parameters reflecting system status
- Exposes controllable parameters, matrices, functions

**Consumer** (monitoring/control system):
- Connects to provider's tree
- Subscribes to parameter changes
- Sends parameter updates to modify provider state

### Connection Details

| Property | Value |
|----------|-------|
| TCP Port | 9000 (standard) |
| Framing | S101 protocol |
| Keep-alive | Required |

**S101 Frame Structure:**

```
BOF (0xFE) — Begin of Frame
EOF (0xFF) — End of Frame
CE  (0xFD) — Character escape
XOR (0x20) — XOR value for escaping
```

**Message Format:**
- Byte 1: Slot identifier (usually 0x00)
- Byte 2: Message type
- Byte 3: Command (0x00=EmBER Packet, 0x01=KeepAlive Request, 0x02=KeepAlive Response)
- Byte 4: Version (0x01)

**Glow DTD Version:** 0x0232 (major=2, minor=50)

---

## 3. Wire Protocol Details

### BER-TLV Encoding

Ember+ uses ASN.1 Basic Encoding Rules with Tag-Length-Value structure:

**Tag/Identifier:**
- Bits 1-5: Tag type
- Bit 6: Primitive (0) or Constructed (1)
- Bits 7-8: Tag class

**Glow OID:**
```
{ iso(1) org(3) dod(6) internet(1) private(4) enterprises(1)
  lsb(37411) lsb-mgmt(2) emberPlus(1) glow(1) glowVolatile(100) }
```

**Glow DTD uses EXPLICIT TAGS**

**Primitive Types:**
- EmberString (UTF8String)
- Integer32
- Integer64

---

## 4. Tree Structure

### Element Types

| Type | Value | Description |
|------|-------|-------------|
| Node | 0 | Container for other elements |
| Parameter | 1 | Controllable value with type |
| Matrix | 2 | Routing matrix with sources/targets |
| Function | 3 | Callable operation |
| Template | 4 | Reusable node definitions (v1.8.0+) |

### Qualified vs Relative Paths

**Numbered Path (Qualified):**
```
"0.0.2" — Position-based hierarchy
```

**String Path (Relative):**
```
"path/to/node" — Identifier-based (using '/' delimiter)
"descr1.descr2.descr3" — Description-based
```

**CRITICAL:** Node numbers MAY change — always query levels by identifier for stable addressing.

### Tree Traversal

**GetDirectory Command:**
- Returns ONLY direct children (not recursive)
- Must send one GetDirectory per level to descend tree
- Root query: create GetDirectory for tree root immediately after connection

**Example flow:**
1. Connect to provider (TCP port 9000)
2. Send GetDirectory for root
3. Receive root children
4. Send GetDirectory for each child to explore deeper
5. Build local tree representation

---

## 5. Parameter Types

From `GlowParameterType` enumeration:

| Type | Value | Description |
|------|-------|-------------|
| Integer | 1 | Signed integer value |
| Real | 2 | Floating point (supports NaN encoding) |
| String | 3 | UTF-8 string |
| Boolean | 4 | True/false |
| Trigger | 5 | Momentary action |
| Enum | 6 | Enumerated choice |
| Octets | 7 | Binary data |

### Parameter Properties

**Access Control:**
- `ParameterAccess.ReadWrite` — Consumer can modify
- `ParameterAccess.Read` — Read-only

**Stream vs Static:**
- **Stream parameters** — Continuous updates, require explicit `subscribe()`
- **Static parameters** — Change on events, auto-subscribe via `getDirectory()` callback

---

## 6. Matrix Connections

**Matrix Structure:**
- **Sources** — Inputs (rows)
- **Targets** — Outputs (columns)
- **Crosspoints** — Source-to-target connections

**Operations:**
- `matrixConnect(target, sources)` — Create connection
- `matrixDisconnect(target, sources)` — Break connection
- `matrixSetConnection(target, sources)` — Set complete routing

**Important:** Use numeric IDs for crosspoints.

---

## 7. Node.js Implementations

### A. sofie-emberplus-connection ⭐ RECOMMENDED

**NPM:** `emberplus-connection` (v0.3.0)
**Repo:** https://github.com/nrkno/sofie-emberplus-connection

**Why recommended:**
- Battle-tested in NRK's Sofie TV Automation System (live production)
- Complete TypeScript rewrite with strong typing
- Comprehensive test coverage using Jest
- Dual client/server architecture
- Tested with Lawo Ruby, R3lay, MxGUI

**API Example:**
```typescript
const { EmberClient } = require('emberplus-connection');

const client = new EmberClient('10.9.8.7', 9000);
await client.connect();

// Three ways to address nodes
const node1 = await client.getElementByPath('0.0.2');         // Numeric
const node2 = await client.getElementByPath('path/to/node');  // Hierarchical
const node3 = await client.getElementByPath('descr1.descr2'); // Description

// Stream updates via events
client.on('streamUpdate', (update) => {
  console.log('Parameter changed:', update);
});
```

### B. node-emberplus (evs-broadcast)

**NPM:** `node-emberplus` (v3.0.8)
**Repo:** https://github.com/evs-broadcast/node-emberplus

**Limitations:**
- ❌ No support for trees >8MB in size
- ❌ No StreamCollection support
- ❌ No UDP support
- ❌ No packet stats/rate monitoring

**Known Issues:**
- Duplicate identifier bug (#8) — infinite loop with Lawo consoles
- Fixed in v2.5.6

---

## 8. Known Implementation Pitfalls

### Tree Traversal Problems

**Issue:** GetDirectory completion detection
- Some providers send multiple replies per GetDirectory
- **Solution:** Wait for timeout or end-of-message marker

**Issue:** Node number instability
- Node numbers MAY change between sessions
- **Solution:** ALWAYS query by identifier, never hardcode numeric paths

### Message Size Limitations

**Issue:** Messages exceeding 1024 bytes
- S101 has ~1024 byte practical limit per frame
- **Solution:** Send smaller batches, avoid requesting entire large subtrees

**Issue:** Multiple GetDirectory in one message
- Some weak devices cannot handle simultaneous requests
- **Solution:** Send one GetDirectory per message, queue sequentially

### Timeout and Keep-Alive

**Issue:** Timeout errors on nested levels
- Provider requires keep-alive responses
- **Solution:** Implement proper S101 keep-alive handling

### Subscription Management

**Issue:** Implicit vs explicit subscriptions
- Stream parameters need explicit `subscribe()`
- Static parameters auto-subscribe via `getDirectory()`
- **Solution:** Document clearly which parameters are streams

---

## 9. Implementation Recommendations

### Connection Pattern

```javascript
class EmberPlusProvider {
  constructor(port = 9000) {
    this.port = port;
    this.server = null;
    this.clients = new Map();
  }

  async start() {
    // Use emberplus-connection server mode
    this.server = new EmberServer(this.port);

    this.server.on('clientConnected', (client) => {
      console.log('[ember+] Client connected');
      this.clients.set(client.id, client);
    });

    this.server.on('clientDisconnected', (client) => {
      console.log('[ember+] Client disconnected');
      this.clients.delete(client.id);
    });

    await this.server.listen();
    console.log(`[ember+] Provider listening on port ${this.port}`);
  }

  updateParameter(path, value) {
    // Broadcast to all connected clients
    for (const client of this.clients.values()) {
      client.setValue(path, value);
    }
  }
}
```

### Tree Structure Best Practices

1. **Query root on connect** — Immediate GetDirectory for tree root
2. **Navigate by identifier** — Never hardcode numeric paths
3. **Queue GetDirectory requests** — One level at a time
4. **Cache tree structure** — Build local mirror, update on changes
5. **Keep messages < 1024 bytes** — Fragment large requests

### Error Handling

```javascript
try {
  const result = await client.setValue(param, newValue);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Reconnect or retry
  } else if (error.message.includes('access')) {
    // Parameter read-only
  } else {
    // Log for investigation
  }
}
```

---

## 10. Protocol Gotchas Summary

### DO:
- Implement full spec support (no cherry-picking features)
- Handle both single and multi-part GetDirectory responses
- Query tree hierarchically using identifiers
- Keep message sizes under 1024 bytes
- Respond to S101 keep-alive requests
- Test with real hardware early

### DON'T:
- Rely on node numbers staying constant
- Send multiple GetDirectory in one message to weak devices
- Auto-expand entire tree on connect (especially matrices)
- Assume GetDirectory completes in one response
- Ignore timeout errors
- Skip error handling on promises

---

## 11. Testing Tools

- **EmberPlus Viewer** (official GUI, v2.4.0.35) — Tree exploration
- **Wireshark** — Glow dissector available
- **TinyEmberPlus** — Reference implementation from Lawo

---

## Sources

- [Lawo Ember+ GitHub](https://github.com/Lawo/ember-plus)
- [Ember+ Documentation.pdf](https://github.com/Lawo/ember-plus/blob/master/documentation/Ember+%20Documentation.pdf)
- [sofie-emberplus-connection](https://github.com/nrkno/sofie-emberplus-connection)
- [node-emberplus](https://github.com/evs-broadcast/node-emberplus)
- [Lawo VSM Documentation](https://docs.lawo.com/vsm-ip-broadcast-control-system/)
