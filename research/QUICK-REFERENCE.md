# Ember+ and TSL UMD Quick Reference

> TL;DR version of war stories — the critical stuff you need to know NOW

---

## The Five Things That Will Break Your Tally System

### 1. UDP Packet Loss (The #1 Killer)
- **Symptom:** Tally freezes every 30-40 switches, random disconnects
- **Cause:** UDP is intolerant to packet loss, wireless drops packets
- **Fix:** Enterprise WiFi (Ubiquiti UniFi UAP-LR), NOT consumer routers
- **Critical:** 0.1% packet loss = catastrophic failures in production

### 2. Protocol Version Confusion
- **TSL v3.1:** UDP port 40001, basic tally
- **TSL v4:** UDP port 40001, enhanced features, backward compatible
- **TSL v5:** UDP port 4003, Ethernet-native, NOT backward compatible
- **Gotcha:** Devices say "TSL support" but don't specify version
- **Fix:** Always specify protocol version in configuration

### 3. Multi-State Tally (Preview + Program)
- **Problem:** Camera on preview while on program → red tally goes dark
- **Why:** Protocol sends absolute state, not cumulative
- **Impact:** Camera operator thinks they're off-air, disaster ensues
- **Fix:** Use TSL 3.1 "TSL Clients" mode or implement state arbitration

### 4. Ember+ Connection Limits
- **Limit:** 5 connections (old firmware) or 10 connections (new firmware)
- **Problem:** Silent failure when limit exceeded
- **Symptom:** Control surfaces freeze, no error message
- **Fix:** Monitor connection count, close connections properly

### 5. Checksum/Padding Errors
- **Problem:** TSL v3.1 requires null bytes (0x00), not spaces (0x20)
- **Symptom:** Devices silently ignore packets, looks like network problem
- **Fix:** Byte-level validation with Wireshark
- **Gotcha:** V4 packets with bad checksums are silently dropped

---

## Critical Latency Requirements

| Application | Max Latency | What Happens If Exceeded |
|-------------|-------------|--------------------------|
| In-ear monitoring | 10ms | Broadcast engineers notice 5ms+ |
| Interactive/real-time | 200ms | Operators complain |
| Live production | 500ms | System trust destroyed |
| Broadcast parity | 3-7s | Acceptable for viewer-facing only |

**Rule:** If tally latency exceeds 100ms, operators will notice. Over 200ms, they'll complain. Over 500ms, they'll stop trusting the system.

---

## Network Configuration Checklist

**Ports to Open:**
- Ember+: TCP 9000 (fixed, non-configurable)
- TSL v3.1/v4: UDP 40001
- TSL v5: UDP 4003

**Multicast Settings:**
- Place source in same subnet as Rendezvous Point
- Configure IGMP snooping properly (don't disable it)
- Verify multicast routing for TSL v5 discovery

**WiFi Requirements:**
- ✅ Enterprise-grade (Ubiquiti UniFi recommended)
- ✅ Multiple antennas
- ✅ Proper RF channel selection (avoid 2.4GHz crowding)
- ✅ Physical separation from ATEM hardware
- ❌ Consumer routers (TP-LINK, D-Link) = disaster

---

## Testing Before Go-Live

**Must Test:**
- [ ] 0.1% packet loss injection (simulate WiFi)
- [ ] Preview + Program simultaneously on same camera
- [ ] Rapid switching (100+ changes in 60 seconds)
- [ ] Connection pool exhaustion (open 11+ connections)
- [ ] Network disconnect/reconnect cycle
- [ ] Ember+ tree larger than 1MB
- [ ] 8-hour continuous operation

**If You Skip These Tests:**
You'll discover the problems during your first live show. Guaranteed.

---

## The "Oh Shit" Troubleshooting Guide

### Symptom: Tally freezes every 30-40 camera changes
**Cause:** UDP packet loss, WiFi interference  
**Fix:** Check WiFi router quality, reduce interference, consider wired connection

### Symptom: All cameras light up when selecting last input
**Cause:** TSL index field blank/zero, defaulting to index 1  
**Fix:** Validate index fields, reject blank values

### Symptom: Preview clears program tally (red goes dark)
**Cause:** State replacement instead of accumulation  
**Fix:** Implement state arbitration or use TSL 3.1 Clients mode

### Symptom: Control surface won't connect
**Cause:** Ember+ connection limit exceeded  
**Fix:** Check connection count (5 or 10 max), close unused connections

### Symptom: Packets ignored, looks like network problem
**Cause:** Checksum error from incorrect padding (spaces vs nulls)  
**Fix:** Wireshark capture, validate byte-level correctness

### Symptom: Tally works in lab, fails in production
**Cause:** Didn't test with wireless, large trees, or multi-device scale  
**Fix:** Test in production-like environment before go-live

---

## Hardware Quick Reference

### Tally Connectors
- Use DB25 breakout boards (screw terminals), don't cut cables
- SDI carries tally, HDMI does NOT
- Camera ID must match physical input jack number

### WiFi for Wireless Tally
- **Proven:** Ubiquiti UniFi UAP-LR
- **Avoid:** TP-LINK TL-WR740N/940N (30-40 second freezes)
- **Avoid:** D-Link DIR-615 (community consensus: bad)

### Connection Limits by Device
- DHD Firmware 8.2.x or lower: 5 connections
- DHD Firmware 9.0.6 or higher: 10 connections
- Ember+ providers: varies, check documentation

---

## Protocol Version Feature Matrix

| Feature | TSL v3.1 | TSL v4 | TSL v5 |
|---------|----------|--------|--------|
| Transport | UDP/Serial | UDP | UDP |
| Port | 40001 | 40001 | 4003 |
| Character limit | 16 | Extended | Extended |
| Tally outputs | 2 | Full colour control | Full colour control |
| Checksum | Yes | Yes (invalid = drop) | Unknown |
| Backward compat | N/A | With v3.1 | NO |
| Multicast discovery | No | No | Yes |
| Primary use case | Basic tally | Enhanced tally | Ethernet/IP workflows |

---

## What Broadcast Engineers Actually Want

1. **Protocol-agnostic integration** — works with everything I already own
2. **Tallies that follow routing** — camera routed upstream = green tally automatically
3. **Save/recall presets** — Monday=news, Tuesday=sports, instant switchover
4. **Automatic reconnection** — network glitch shouldn't require manual intervention
5. **Clear error messages** — "TSL checksum mismatch" not "connection failed"
6. **One system for everything** — routing + tally + UMD + GPIO in one place

**Translation:** Make it reliable, make it obvious, make it work with my existing gear.

---

## The Golden Rules

1. UDP is fast but unreliable. Plan accordingly.
2. Test with real hardware, not documentation.
3. Enterprise WiFi is not optional for wireless tally.
4. Connection limits are real. Monitor them.
5. Checksum errors are not always network problems.
6. Protocol versions matter. A lot.
7. Multi-state tally is harder than you think.
8. Silent failures are the worst failures.
9. Broadcast engineers want reliability over features.
10. **You get one chance in live production. Don't fail.**

---

## Essential Reading

Full war stories: `EMBER-TSL-WAR-STORIES.md`

Key sections:
- Section 1.1: UDP Packet Loss (read this first)
- Section 1.2: Protocol Version Incompatibility
- Section 2: War Stories and Live Show Failures
- Section 4: Things That WILL Break If You Get Them Wrong
- Section 5: Workarounds That Actually Work

---

**Remember:** In broadcast, you don't get a second take. Build systems that don't fail.

**Last Updated:** 2026-01-17
