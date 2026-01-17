# Broadcast Protocol Pitfalls

> Real-world experiences with Ember+ and TSL UMD implementations

---

## Executive Summary

**Top 5 Production Failures:**

1. **UDP packet loss** — WiFi tally systems fail catastrophically
2. **Preview+Program state** — Clears program tally (red goes dark)
3. **Protocol version mismatch** — v3.1/v4/v5 incompatibility
4. **Connection pool exhaustion** — Ember+ 5-10 client limits
5. **Padding errors** — Spaces vs null bytes break checksums

---

## 1. UDP Packet Loss is #1 Problem

### The WiFi Tally Disaster

**Source:** GitHub Issues, Reddit r/VIDEOENGINEERING

> "Every 30-40 camera changes trigger multi-second freezes. ATEM devices lock up completely, requiring reboot during live shows."

**Root Cause:**
- Consumer-grade WiFi (TP-LINK, D-Link) drops UDP packets
- Wireless interference in venue environments
- No QoS prioritisation for tally traffic

**Solution:**
- Enterprise WiFi (Ubiquiti UniFi UAP-LR proven)
- Wired connections for critical tally
- Background refresh every 200ms to recover from drops

### Real Failure Mode

```
Normal:     Tally update → Display updates → Operator sees state
With loss:  Tally update → [DROPPED] → Display shows stale state
Result:     Camera operator thinks they're off-air when LIVE
```

---

## 2. Preview+Program Simultaneous State

### The Tally Bug That Endangers Talent

**Source:** GitHub TallyArbiter Issues, Ross Video Community

**Scenario:**
1. Camera 1 is on PREVIEW (green)
2. Director takes Camera 1 to PROGRAM (red)
3. Camera 1 should show RED only
4. **Bug:** Some systems show NOTHING (both clear)

**Why This Happens:**
- TSL v5.0 sends absolute state, not cumulative
- When Preview=0 and Program=1, some receivers clear both
- "Last write wins" logic instead of "highest priority wins"

**Real Quote:**
> "Camera operators think they're off-air when they're live. This is a safety issue."

**Solution:**
- Program (red) MUST always win over Preview (green)
- Implement priority: Program > Preview > Off
- TSL 3.1 "TSL Clients" mode handles this correctly

---

## 3. Protocol Version Incompatibility

### The Silent Failure

**Source:** Bitfocus Companion Issues, Vendor Documentation

| Version | Port | Checksum | Text Length |
|---------|------|----------|-------------|
| v3.1 | 40001 | None | 16 fixed |
| v4.0 | 40001 | Yes | Extended |
| v5.0 | 4003 | N/A | Variable |

**Real Failure:**
```
Sender:   TSL v4.0 with padding spaces (0x20)
Receiver: Expects null bytes (0x00) for checksum
Result:   Checksum fails silently, tally never updates
```

**The Padding Bug:**
```
Correct:  803043414d20310000000000000000000000  (null bytes)
Wrong:    803043414d2031202020202020202020202020  (space chars)
```

**Solution:**
- Document protocol version explicitly
- Validate checksum handling
- Test against target hardware, not just simulators

---

## 4. Ember+ Tree Size and Performance

### The UI Lockup

**Source:** node-emberplus Issues, DHD Documentation

**Problem:**
- node-emberplus doesn't support trees >8MB
- Startup tree scan locks UI for "a few seconds" (unbounded)
- No progress indicators, no lazy loading

**Real Quote:**
> "Opening a large Lawo console tree freezes the application for 15+ seconds. Users think it crashed."

**Root Cause:**
- GetDirectory returns ALL children
- Client recursively expands everything
- No pagination, no streaming

**Solution:**
- Lazy load tree on demand
- Show loading indicators
- Implement timeout handling (5s max per level)

### Connection Limits

**Source:** DHD Ember+ Documentation

| Firmware | Max Connections |
|----------|-----------------|
| Old | 5 |
| New | 10 |

**Failure Mode:**
- Connection 11 silently fails
- No error message, just timeout
- Debugging nightmare in large facilities

---

## 5. Network Configuration Gotchas

### IGMP Snooping Breaks Multicast

**Source:** Cisco Meraki Documentation, Broadcast Forums

**Scenario:**
1. TSL v5.0 uses multicast for discovery
2. Managed switch has IGMP snooping enabled
3. Multicast packets never reach destination
4. Tally system appears "dead"

**Solution:**
- Configure IGMP querier on network
- Or disable IGMP snooping for tally VLAN
- Or use unicast instead of multicast

### Fixed Ports

**Ember+:** TCP 9000 (non-configurable in many devices)
**TSL v3.1:** UDP 40001 (convention)
**TSL v5.0:** UDP 4003 (specification)

**Problem:** Firewall rules often block these ports by default.

---

## 6. Latency Requirements

### What Engineers Actually Need

| Use Case | Max Latency | Notes |
|----------|-------------|-------|
| In-ear monitoring | 10ms | Engineers notice 5ms+ |
| Interactive/real-time | 200ms | Button feedback |
| Live production usable | 500ms | Tally, status |
| Broadcast parity | 3-7 seconds | Viewer-facing only |

**Real Quote:**
> "Anything over 200ms and operators start complaining. Over 500ms and they stop trusting the system."

---

## 7. Hardware Compatibility Issues

### SDI vs HDMI

**Critical:** SDI carries tally signals. HDMI does NOT.

**Failure Mode:**
- Engineer converts SDI→HDMI for monitors
- Tally information lost in conversion
- Camera operators have no tally indication

### Open Collector Tally

**Source:** Panasonic AW-HS50 Documentation

**Problem:**
- Some devices output open collector tally
- Requires external power/bias resistor
- Without bias, tally reads as "always off"

**Solution:**
- Check device specifications
- Add pull-up resistors if needed
- Use DB25 breakout boards for debugging

---

## 8. What Engineers Actually Want

### Feature Requests from Forums

1. **Auto-discovery** — "Why do I have to manually enter IP addresses?"
2. **Web interface** — "I shouldn't need special software to configure tally"
3. **Logging** — "When something breaks, I need to know what happened"
4. **Redundancy** — "Single point of failure is unacceptable"
5. **Preview of changes** — "Let me see what will happen before I commit"

### The "Finally, Someone Gets It" Features

- **Protocol translation** — Different equipment, different dialects
- **State aggregation** — Multiple sources, single truth
- **Historical logging** — What was the tally state at 14:32:07?
- **Alert on stale data** — Don't just fail silently

---

## 9. Testing Requirements

### What Lab Testing Misses

**Must test with:**
- 0.1% packet loss injection (simulates WiFi)
- Preview+Program simultaneous states
- Connection pool exhaustion (>10 clients)
- Network interruption and recovery
- Large tree traversal (1000+ nodes)

**Real Quote:**
> "It worked perfectly in the lab. First live show, everything broke."

### The Checklist

- [ ] Packet loss tolerance (UDP)
- [ ] Simultaneous tally states
- [ ] Connection limits
- [ ] Timeout handling
- [ ] Reconnection logic
- [ ] Large tree performance
- [ ] Character encoding edge cases
- [ ] Byte order (little-endian!)

---

## 10. Vendor Interoperability

### The Translation Layer Problem

Before TSL standardisation, every manufacturer had proprietary tally:
- Sony used one format
- Grass Valley used another
- Ross had their own
- Blackmagic does something different

**Even with TSL as "standard":**
- Different devices speak different dialects
- Timing assumptions vary
- State interpretation differs

**Solution:**
Real facilities need **protocol translation layers** because no two pieces of equipment work exactly the same way.

---

## Key Takeaways

### For Implementation

1. **UDP packet loss is inevitable** — Design for it
2. **Program tally must always win** — Safety critical
3. **Test with real hardware** — Simulators lie
4. **Log everything** — You'll need it at 2am
5. **Fail loudly** — Silent failures kill trust

### For Architecture

1. **Background refresh** — Recover from packet loss
2. **Priority system** — Program > Preview > Off
3. **Timeout handling** — Don't hang forever
4. **State caching** — Last known good state
5. **Health monitoring** — Detect stale data

---

## Sources

- [GitHub TallyArbiter Issues](https://github.com/josephdadams/TallyArbiter/issues)
- [GitHub ATEM Tally WiFi Issues](https://github.com/AronHetLam/ATEM_tally_light_with_ESP8266/issues)
- [Ross Video Community](https://rossvideo.community/)
- [Reddit r/VIDEOENGINEERING](https://reddit.com/r/VIDEOENGINEERING)
- [Bitfocus Companion Issues](https://github.com/bitfocus/companion/issues)
- [Lawo VSM Documentation](https://docs.lawo.com/)
- [Cisco Meraki Multicast Guide](https://documentation.meraki.com/)
