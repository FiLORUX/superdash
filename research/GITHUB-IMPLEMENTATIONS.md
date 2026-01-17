# GitHub Implementation Analysis

> Ember+ and TSL UMD Open Source Landscape

Generated: 2026-01-17
Source: GitHub repository analysis, NPM package inspection, issue tracker review

---

## Summary

Three tiers of quality exist in broadcast protocol implementations:

1. **Production-grade:** sofie-emberplus-connection (NRK TV automation)
2. **Widely-deployed but with issues:** node-emberplus (EVS)
3. **Reference implementations:** Various TSL UMD libraries

---

## Ember+ Implementations

### 1. sofie-emberplus-connection ⭐ RECOMMENDED

| Property | Value |
|----------|-------|
| Repository | [github.com/nrkno/sofie-emberplus-connection](https://github.com/nrkno/sofie-emberplus-connection) |
| Language | TypeScript |
| NPM | `emberplus-connection` (v0.3.0) |
| Tested With | Lawo Ruby, R3lay, MxGUI |
| Status | Production use in NRK Sofie TV Automation |

**Strengths:**
- Complete TypeScript rewrite with strong typing
- Comprehensive Jest test coverage
- Dual client/server architecture
- Battle-tested in live television production
- Multiple path addressing modes (numeric, description, hybrid)
- Proper handling of empty directory nodes

**Architecture:**
```
Socket → S101 Codec → Ember Client/Server
```

**Key Fix (Issue #21):**
Changed response expectation from `ExpectResponse.HasChildren` to `CanHaveChildren`, properly handling spec-compliant nodes without children.

---

### 2. node-emberplus (evs-broadcast)

| Property | Value |
|----------|-------|
| Repository | [github.com/evs-broadcast/node-emberplus](https://github.com/evs-broadcast/node-emberplus) |
| Language | JavaScript (ES6+) |
| NPM | `node-emberplus` (v3.0.8) |
| Tested With | EVS XT4k, Embrionix IP |
| Status | Maintained |

**Strengths:**
- Promise-based API (v2.0+)
- Server support (v1.6.0+)
- Path-based navigation
- Offline `.ember` file decoder
- Matrix operations support

**CRITICAL LIMITATIONS:**
- ❌ No support for trees >8MB
- ❌ No StreamCollection support
- ❌ No UDP support
- ❌ No packet statistics

**Known Bug (#8):**
Duplicate identifier infinite loop with Lawo consoles. Fixed in v2.5.6.

---

### 3. DeutscheSoft/ember-plus

| Property | Value |
|----------|-------|
| Repository | [github.com/DeutscheSoft/ember-plus](https://github.com/DeutscheSoft/ember-plus) |
| Language | JavaScript |
| License | GPL v2 |
| Status | Stable reference |

**Pattern:** Observer-based rather than Promise-based

```javascript
device.observeProperty(node, 'value', (value) => {
  console.log(`${node.identifierPath.join('/')}: ${value}`);
});
```

---

### 4. Bitfocus Companion Ember+ Module

| Property | Value |
|----------|-------|
| Repository | [github.com/bitfocus/companion-module-generic-emberplus](https://github.com/bitfocus/companion-module-generic-emberplus) |
| Language | TypeScript (99.6%) |
| Purpose | Companion control surface integration |

**Best Practices Demonstrated:**
- Isolated child process execution (crash protection)
- TypeScript-first with strict compilation
- Husky Git hooks for code quality
- Hot-reload development mode

---

## TSL UMD Implementations

### 1. NoahCallaway/tsl-umd-v5

| Property | Value |
|----------|-------|
| Repository | [github.com/NoahCallaway/tsl-umd-v5](https://github.com/NoahCallaway/tsl-umd-v5) |
| NPM | `tsl-umd-v5` |
| Protocol | TSL UMD v5.0 only |
| Status | Maintained (last update 1 year ago) |

**Features:**
- UDP and TCP send/receive
- DLE/STX handling
- Port 8900 UDP, 9000 TCP

**CRITICAL BUGS FOUND:**

```javascript
// Bug 1: Wrong field read
tally.flags = buf.readInt8(this._VER);  // Should be this._FLAGS

// Bug 2: Bitwise vs logical OR
if (!ip | !port | !tally)  // Should be: || not |

// Bug 3: DLE-stuffing starts at wrong index
for (let i = 4; i < packet.length; i++)  // Should start at 0
```

---

### 2. willosof/tsl-umd

| Property | Value |
|----------|-------|
| Repository | [github.com/willosof/tsl-umd](https://github.com/willosof/tsl-umd) |
| NPM | `tsl-umd` (v1.1.2) |
| Protocol | v3.1 only |
| Status | Inactive (7 years old) |

**Production Use:**
- Ross Carbonite mixers
- Axon Cerebrum

**Limitation:** Receive-only, minimal documentation.

---

### 3. Bitfocus Companion TSL Modules

**Sender:** [companion-module-tslproducts-umd](https://github.com/bitfocus/companion-module-tslproducts-umd)
- Sends TSL UMD to displays
- v3.1 support
- MIT licensed

**Listener:** [companion-module-tslproducts-umdlistener](https://github.com/bitfocus/companion-module-tslproducts-umdlistener)
- Listens for incoming TSL UMD
- Sets tally states on Companion buttons

---

## Code Quality Assessment

### ✅ Good Error Handling
- **sofie-emberplus-connection:** Comprehensive error events, typed errors
- **Companion modules:** Isolated process execution

### ✅ Comprehensive Testing
- **sofie-emberplus-connection:** Jest test suite, ESLint + Prettier

### ✅ Production Evidence
- **sofie-emberplus-connection:** NRK TV automation (mission-critical)
- **Companion modules:** Broadcast control rooms worldwide

### ❌ Weak Error Handling
- **tsl-umd-v5:** Multiple bugs in validation logic

---

## BER Encoding Gotchas

### Issue 1: Real Number Encoding
- Fixed encoding treating mantissa as signed
- Fixed unsigned long leading zero issue
- Use well-tested libraries, don't roll your own

### Issue 2: Indefinite Length Forms
- C library: Indefinite length only
- .NET library: Both forms supported
- C++ library: Never uses indefinite length
- **Ensure compatibility with both forms**

### Issue 3: ASN.1 Complexity
> "ASN.1 encoding formats are vulnerability magnets"

**Validate all incoming data at boundaries.**

---

## Anti-Patterns to Avoid

### ❌ Silent Failures
```javascript
// BAD
if (!ip | !port | !tally)

// GOOD
if (!ip || !port || !tally) {
  throw new Error('Missing required parameters');
}
```

### ❌ Magic Numbers
```javascript
// BAD
buf.readInt8(2);

// GOOD
const OFFSET_VERSION = 2;
buf.readInt8(OFFSET_VERSION);
```

### ❌ Callback Hell
```javascript
// BAD (v1.x style)
client.connect((err) => {
  client.getDirectory((err, tree) => { ... });
});

// GOOD (Promise-based)
await client.connect();
const tree = await client.getDirectory();
```

### ❌ No Timeout Handling
All network operations MUST have timeouts.

### ❌ Assuming Tree Structure
Never assume:
- Identifiers are unique
- All nodes have children
- Tree depth is limited
- Parameters exist at expected paths

---

## Recommended Architecture

```
┌─────────────────────────┐
│   Application Layer     │  Actions, feedbacks, variables
├─────────────────────────┤
│   Protocol Layer        │  Ember+/TSL UMD encoding
├─────────────────────────┤
│   Transport Layer       │  TCP/UDP socket management
├─────────────────────────┤
│   Error Handling        │  Logging, retry, timeouts
└─────────────────────────┘
```

**Key principles:**
- **Isolation:** Protocol handlers in separate processes
- **State management:** Subscribe/unsubscribe flows
- **Discovery:** Bonjour/mDNS for automatic detection

---

## Sources

- [sofie-emberplus-connection](https://github.com/nrkno/sofie-emberplus-connection)
- [node-emberplus](https://github.com/evs-broadcast/node-emberplus)
- [DeutscheSoft/ember-plus](https://github.com/DeutscheSoft/ember-plus)
- [NoahCallaway/tsl-umd-v5](https://github.com/NoahCallaway/tsl-umd-v5)
- [Bitfocus Companion Modules](https://github.com/bitfocus)
