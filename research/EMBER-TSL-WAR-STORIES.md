# Ember+ and TSL UMD Protocol: Real-World Experiences and War Stories

> Empirical knowledge from broadcast engineering communities  
> Research Date: 2026-01-17  
> Sources: GitHub, Reddit, Creative COW, DVinfo, Technical Forums

---

## Executive Summary

This document compiles real-world experiences, pain points, and empirical knowledge about Ember+ and TSL UMD protocols from broadcast engineers. This is the knowledge that documentation doesn't teach you — the problems that only surface during live shows and the workarounds that save productions.

---

## 1. Common Pain Points (Ranked by Frequency)

### 1.1 UDP Packet Loss and Reliability (CRITICAL)

**The Problem:**
> "UDP protocol doesn't have assurance that packages will arrive, and therefore the network gear is allowed to drop them."  
> — ATEM Tally Light ESP8266 project

**What Breaks:**
- Every 30-40 camera changes, control panels freeze for several seconds
- Tally lights randomly disconnect and don't reconnect automatically
- When ATEM doesn't receive acknowledgments before 63 commands are sent, it freezes completely
- Wireless tally systems drop packets when overwhelmed by broadcast traffic (Chromecast, multicast, etc.)
- All tally slots get consumed, requiring a full ATEM reboot

**Root Cause:**
UDP is intolerant to packet loss. TSL protocols (v3.1 and v4 use UDP on port 40001, v5 uses UDP on port 4003). When wireless infrastructure or network switches drop packets under load, tally systems fail catastrophically.

**What Actually Works:**
- **Enterprise-grade WiFi**: Ubiquiti UniFi UAP-LR demonstrated "only a few drops per event" versus 30-40 second freezes with consumer routers (TP-LINK, D-Link)
- **Proper RF channel selection**: Avoid crowded 2.4GHz channels
- **Physical separation**: Keep WiFi routers away from ATEM hardware
- **Multiple antennas**: Critical for enterprise APs
- **Consider TCP fallback**: TallyArbiter supports both TCP and UDP for reliability

**Quote from the Field:**
> "Freezes last a blink instead of seconds with proper enterprise WiFi"  
> — Field testing report, ATEM wireless tally systems

---

### 1.2 Protocol Version Incompatibility

**The Problem:**
TSL has three protocol versions (v3.1, v4, v5) with different packet structures, ports, and capabilities. Systems claiming "TSL support" don't specify which version.

**Technical Differences:**

| Version | Transport | Port | Checksum | Use Case |
|---------|-----------|------|----------|----------|
| TSL v3.1 | UDP/Serial | 40001 | Yes | Basic tally (16 chars, 2 tally outputs) |
| TSL v4 | UDP | 40001 | Yes | Extended (full lamp colour control, backward compatible with v3.1) |
| TSL v5 | UDP | 4003 | Unknown | Ethernet-focused (multicast, device discovery, scalability) |

**What Breaks:**
- V4 packets with bad checksums are silently ignored
- V5 implementations don't support "TSL Clients" continuous broadcast mode yet
- Padding errors: v3.1 requires null bytes (0x00) not space characters (0x20) — this caused actual failures
- TallyArbiter protocol between listener client and server is NOT backward compatible between v2 and v3

**Real-World Quote:**
> "Tally will only follow the Last device I setup and all cameras previously setup light up when the last input is selected"  
> — TSL 5 UDP bug report, TallyArbiter #778

**Root Cause:**
User left TSL Address Index blank, triggering default index 1 for all devices. The action handler logged "No index given. Using index 1 by default" repeatedly, causing all commands to target the same tally light.

**The Fix That Should Have Been Obvious:**
Explicit index validation and rejection of blank index fields rather than silent defaults.

---

### 1.3 Simultaneous Preview/Program State Handling

**The Problem:**
> "Putting a camera source on preview clears the red program tally indicator, even though the source remains on the program bus"  
> — TallyArbiter Discussion #311

**What Engineers Expect:**
Camera on both preview AND program = red + green lights simultaneously

**What Actually Happens:**
TSL 5.0 sends "it is in preview only" message, clearing program state. The protocol doesn't maintain cumulative state — it sends absolute state per message.

**Current Workaround:**
TSL 3.1 "TSL Clients" continuous broadcast mode handles this correctly, but TSL 5.0 implementation is incomplete (issues #16, #211 referenced).

**What Broadcast Engineers Actually Want:**
- Continuous state broadcast to all connected devices
- State accumulation (not replacement) when multiple sources generate tally
- Clear priority rules when conflicting states arrive

---

### 1.4 Ember+ Tree Size and Performance

**The Problem:**
Large broadcast facilities have massive Ember+ parameter trees. Node-emberplus doesn't support trees larger than 8MB.

**What Breaks:**
- Startup scans of entire tree take "a few seconds" (vague, unbounded)
- Auto GetDirectory requests flood matrices with excess queries
- Consumer class can create messages exceeding 1024-byte packet limit
- No support for tree sizes higher than 8M

**Real-World Impact:**
During show startup, control surfaces become unresponsive while scanning multi-megabyte Ember+ trees. No progress indication, no timeout handling.

**Best Practice from mAirList:**
> "The tree should not be too large, for optimal performance. The parameter tree must not be recursive (or infinite)."

**What's Missing:**
- Lazy loading / on-demand tree queries
- Tree size warnings before connection
- Incremental subscription instead of full tree fetch
- Progress indicators for large tree operations

---

### 1.5 Network Configuration and Firewall Issues

**The Problem:**
Ember+ uses TCP port 9000 (fixed, non-configurable in many devices). TSL uses UDP ports 40001/4003. Broadcast networks have VLANs, firewalls, and multicast routing.

**What Engineers Told Us:**

**Ember+ Firewall:**
> "The codec firewall settings need to be adjusted in the Toolbox Web-GUI to open this port for Ember+ to function properly"  
> — Tieline documentation

**Multicast Best Practice:**
> "Place the Multicast Source in the same subnet as the Rendezvous Point to prevent PIM Registers from being sent"  
> — Cisco Meraki multicast guide

**IGMP Snooping:**
Switches run IGMP snooping by default, preventing multicast traffic from reaching hosts not yet joined to the proper group. This breaks TSL v5 multicast discovery.

**Connection Limits:**
- DHD devices with Firmware 8.2.x or lower: 5 connections
- DHD devices with Firmware 9.0.6 or higher: 10 connections
- Exceeding these limits causes silent failures

**What Gets Forgotten:**
Broadcast engineers think about SDI signal flow, not TCP connection pools. When an Ember+ tree scanner doesn't close connections properly, you silently hit the 5-connection limit and suddenly your control surface stops working.

---

### 1.6 Hardware-Specific Tally Failures

**From the Forums:**

**Panasonic AW-HS50 Tally:**
Switchers using open collector connections for tally need power bias to drive the transistor to conduct. Engineers assumed plug-and-play; reality required reading page 68 of the manual.

**Sony BVS-3100 Tally Interface:**
25-pin parallel tally connector to CCU screw terminals. Engineers asked "is it as simple as cutting the cable and using a voltage meter?"

**Solution:** DB25 female breakout board with screw terminals. Avoids manual wire identification and provides labeled connection points.

**Lesson:** Broadcast engineers want to make content, not become electrical engineers. Adapters and breakout boards save shows.

---

### 1.7 Vendor Incompatibility and Protocol Translation

**The Historical Problem:**
> "Before the introduction of TSL, broadcasters faced significant challenges when integrating tally systems from various vendors, with each manufacturer often having its own proprietary method"  
> — TSL Products history

**Modern Reality:**
> "Broadcasters have a wide variety of new and legacy equipment that they need to work together in one cohesive system, utilizing a vast array of different protocols and interfaces, everything from GPIs to XML"  
> — TSL Control system overview

**What This Means:**
Even with TSL as a "standard," real facilities have:
- Grass Valley routers with native protocol
- Ross equipment with Carbonite TSL implementation
- Lawo VSM with Ember+ control trees
- EVS servers with proprietary tally APIs
- Legacy GPI tally via contact closures

**The Integration Nightmare:**
You can't just "support TSL." You need protocol translation layers, because Source A speaks Ember+, Destination B speaks TSL 3.1, and the router in between speaks neither.

---

## 2. War Stories and Live Show Failures

### 2.1 The ATEM Slot Exhaustion Incident

**What Happened:**
> "Slots are not freed up anymore and apps connect to new slots, using up the slots of the ATEM causing it to get overloaded, starting to lose connections on other devices or in worst case the ATEM just locks up requiring a reboot"  
> — Blackmagic Forum, wireless tally discussion

**Root Cause:**
Wireless phone apps drop packets in both directions. ATEM uses UDP with timers/counters to track packets. When apps lose connection but don't close slots, the ATEM runs out of connection slots.

**Impact:**
Complete ATEM lockup during live show. Only fix: reboot. Unacceptable.

**Prevention:**
Proper network infrastructure with low packet loss. Enterprise WiFi instead of consumer routers.

---

### 2.2 The Tricaster Tally Assumption Bug

**From TallyArbiter Issue #623:**

**What Happened:**
Code incorrectly assumed Tricaster status includes both program and preview information combined. Real Tricaster hardware tested differently, causing improper tally status clearing.

**Impact:**
Tally lights cleared when they should have stayed on. Cameras went live without tally indication.

**Lesson:**
Never assume protocol behaviour based on documentation alone. Test with real hardware.

---

### 2.3 The Checksum Padding Disaster

**From GitHub Issue #2:**

**What Happened:**
TSL v3.1 module was sending space characters (0x20) where null bytes (0x00) should be used for padding.

**Packet Comparison:**
- **Correct:** `803043414d20310000000000000000000000`
- **Wrong:** `803043414d2031 [spaces instead of nulls]`

**Impact:**
Tally devices rejected packets due to checksum errors. Intermittent tally failures that looked like network issues.

**How It Was Found:**
Wireshark capture and byte-by-byte comparison with working example.

**Lesson:**
Checksum errors can be caused by incorrect padding, not just network corruption. Always validate byte-level correctness.

---

## 3. What Broadcast Engineers Actually Want

### 3.1 From Direct Quotes

**Protocol-Agnostic Integration:**
> "Flexibility to integrate with new or existing third-party systems, allowing engineers to work with devices that produce or receive tally information in different ways using different protocols and interfaces"  
> — TSL Control system documentation

**Translation:**
Don't make me rip out my existing infrastructure. If I have Grass Valley routers, Ross switchers, and Lawo consoles, your system better speak to all of them.

---

**Tallies That Follow Routing:**
> "Tallies and UMD names that follow along router crosspoints, so a routable monitor will always have proper tally and source naming. Tallies can also track the router upstream, allowing cameras to have a green tally if they are dialled into a particular destination"  
> — Ross Ultricore Tally documentation

**Translation:**
When I route Camera 1 to MultiViewer 3, the UMD should automatically update. When Camera 2 is routed upstream to the preview bus, it should get green tally. I shouldn't have to configure this manually.

---

**One System for Everything:**
> "Graphical control of video and audio routing, MultiViewer layout selection, UMD source naming, tally logic, and GPIO routing from one place"  
> — TallyMan system overview

**Translation:**
I don't want five different control systems. One interface, one source of truth.

---

**Save/Recall Configurations:**
> "The ability to load and save router, UMD, MultiViewer, source name, and tally/GPIO configurations for quick reconfiguration between productions"  
> — Industry wishlist

**Translation:**
We do 3 different shows on the same infrastructure. Monday is news, Tuesday is sports, Wednesday is a talk show. I need instant show presets.

---

### 3.2 Features That Would Make Engineers Say "Finally!"

Based on community feedback and issue trackers:

1. **Automatic Reconnection After Network Failures**
   - Current: Manual intervention required
   - Wanted: Exponential backoff retry with connection health monitoring

2. **Clear Connection Limit Warnings**
   - Current: Silent failures when hitting 5/10 connection limits
   - Wanted: "Warning: 4/5 connections used" before disaster strikes

3. **Tree Size Validation Before Full Scan**
   - Current: Scan starts, UI locks up for unknown duration
   - Wanted: "This tree is 12MB. Estimated load time: 8 seconds. Continue?"

4. **Multi-State Tally as First-Class Concept**
   - Current: Implement it yourself by tracking multiple sources
   - Wanted: Built-in support for preview + program + upstream preview + downstream key

5. **Protocol Version Negotiation**
   - Current: Guess which TSL version the device speaks
   - Wanted: Capability announcement during handshake

6. **Latency Monitoring and Alerting**
   - Current: Tally is late, operators notice, complaints ensue
   - Wanted: "Tally latency exceeded 100ms threshold" alert

7. **Multicast Discovery That Actually Works**
   - Current: Manual IP configuration for every device
   - Wanted: mDNS/Bonjour discovery for _ember._tcp._local (already in Ember+ Viewer)
   - Wanted: TSL v5 multicast device discovery that works through IGMP snooping

8. **Configuration Validation**
   - Current: Blank index field silently defaults to index 1
   - Wanted: "Error: TSL Address Index is required" before you hit Apply

9. **Hybrid UDP/TCP Fallback**
   - Current: UDP or nothing
   - Wanted: Start with UDP for low latency, fall back to TCP when packet loss detected

10. **Native Ember+ Encryption Support**
    - Current: Manual TLS configuration (available since vsmGadgetServer 5.6.3.107)
    - Wanted: Encryption by default with easy certificate management

---

## 4. Things That WILL Break If You Get Them Wrong

### 4.1 Critical Failure Modes

**Latency Requirements:**
- Interactive/real-time: ~200ms maximum
- In-ear monitoring: 10ms maximum (broadcast engineers will notice 5ms)
- Perceived "zero latency": <100ms
- Broadcast parity: 3-7 seconds acceptable for viewer-facing content

**If your tally latency exceeds 200ms, operators will start making mistakes. If it exceeds 500ms, they'll stop trusting the system entirely.**

---

**Checksum Validation:**
If you implement TSL v4 and don't validate checksums correctly:
- Devices silently ignore your packets
- It looks like a network problem
- You waste hours debugging WiFi when it's a padding issue

---

**Connection Pooling:**
Ember+ providers have hard connection limits (5 or 10). If you don't close connections properly:
- New clients can't connect
- No error message
- Control surfaces freeze
- Engineers blame the network

---

**State Machine Correctness:**
If your tally state machine doesn't handle "preview while on program" correctly:
- Red tally goes dark when camera is put in preview while still on air
- Camera operator thinks they're off-air
- They look at the wrong camera
- Live television shows the camera operator picking their nose

**This is not theoretical. This actually happens.**

---

**UDP Packet Loss Tolerance:**
If you use UDP without any resilience:
- WiFi interference from a Chromecast causes tally dropouts
- Every 30-40 camera switches trigger multi-second freezes
- ATEM devices lock up and require reboot during live shows

---

### 4.2 Silent Failure Scenarios

These are the scenarios where the system appears to work in testing but fails in production:

1. **Empty/Small Ember+ Tree Testing**
   - Works: 50-node test tree loads instantly
   - Breaks: 8MB production tree takes 45 seconds, no progress indicator
   - Result: Operators think system crashed, force-reboot during show prep

2. **Single-Device Tally Testing**
   - Works: One camera, one tally, perfect behaviour
   - Breaks: 12 cameras, slot exhaustion, cascading failures
   - Result: "It worked fine in the lab!"

3. **Wired Network Testing**
   - Works: Perfect reliability on gigabit Ethernet
   - Breaks: Wireless deployment drops 0.1% of packets, catastrophic failures
   - Result: "We tested this extensively!"

4. **Protocol Version Assumptions**
   - Works: Your TSL v4 device tested with TSL v4 consumer
   - Breaks: Customer tries to use TSL v3.1 device expecting v4 features
   - Result: "Your software is broken, the tally doesn't work"

---

## 5. Workarounds and Solutions That Actually Work

### 5.1 Network Infrastructure

**WiFi for Tally:**
- ✅ Ubiquiti UniFi UAP-LR (field-proven)
- ✅ Multiple antennas, proper RF channel selection
- ✅ Physical separation from ATEM hardware
- ❌ TP-LINK consumer routers (30-40 second freezes)
- ❌ D-Link consumer routers (community recommendation: avoid)

**Multicast Configuration:**
- Place multicast source in same subnet as Rendezvous Point
- Configure IGMP snooping properly (don't just disable it)
- Keep unwanted multicast traffic at minimum

---

### 5.2 Protocol Implementation

**TSL Implementation:**
- Validate index fields, reject blank/zero values
- Use null bytes (0x00) for padding, not spaces (0x20)
- Test checksum validation with Wireshark
- Support both UDP and TCP transport
- Implement automatic reconnection with exponential backoff

**Ember+ Implementation:**
- Use library encoding methods (`GlowRootElementCollection.encode()`)
- Don't manually construct BER streams unless you really know ASN.1
- Close connections properly to avoid pool exhaustion
- Implement connection limit monitoring
- Provide tree size estimates before full scan
- Support lazy loading for large trees

---

### 5.3 Hardware Interfaces

**Tally Connectors:**
- Use breakout boards (DB25 to screw terminals) instead of cutting cables
- Label every connection
- Provide clear pin documentation
- Include voltage level configuration options

**Camera Integration:**
- SDI tally information may not pass from input to output
- Significant delay from source change to tally update is normal
- HDMI outputs do NOT carry tally (use SDI)
- Camera ID must match physical input jack number

---

### 5.4 State Management

**Multi-Source Tally Arbitration:**
TallyArbiter's approach works well:
- Aggregate data from multiple sources simultaneously
- Apply priority rules (program > preview > upstream)
- Continuously broadcast cumulative state
- Allow custom priority logic per production

**Configuration Management:**
- Save/recall presets for different shows
- Version control for configurations (seriously, use git)
- Dry-run validation before applying changes
- Rollback capability when things go wrong

---

## 6. Implementation Recommendations

### 6.1 Protocol Support Priority

Based on real-world deployment frequency:

**Tier 1 (Must Have):**
- TSL UMD v3.1 (industry standard, everywhere)
- Ember+ TCP (broadcast control standard)
- Contact closure / GPI (legacy systems never die)

**Tier 2 (Should Have):**
- TSL UMD v4 (backward compatible, enhanced features)
- TSL UMD v5 (Ethernet-native, future-facing)
- Multicast discovery (ease of deployment)

**Tier 3 (Nice to Have):**
- Vendor-specific protocols (Ross, Grass Valley, etc.)
- NMOS integration (bleeding edge, limited adoption)

---

### 6.2 Reliability Features

**Non-Negotiable:**
- Automatic reconnection after network failures
- Connection health monitoring
- Packet loss detection and logging
- Latency measurement and alerting
- State persistence across restarts

**Highly Recommended:**
- Hybrid UDP/TCP with automatic fallback
- Tree size validation and progress indication
- Connection pool monitoring and warnings
- Checksum validation with clear error reporting
- Configuration validation before application

---

### 6.3 User Experience

**What Engineers Notice:**
- Latency > 100ms (they will complain)
- Unresponsive UI during tree loading (they will force-quit)
- Silent failures (they will blame the network)
- Unclear error messages (they will call support)

**What Engineers Appreciate:**
- One-click device discovery
- Clear status indicators (connected/disconnected/degraded)
- Meaningful error messages ("TSL checksum mismatch, expected 0x4A, received 0x4C")
- Configuration import/export
- Detailed logging for troubleshooting

---

## 7. Testing Checklist

### 7.1 Network Resilience Testing

- [ ] 0.1% packet loss injection (simulate poor WiFi)
- [ ] 1.0% packet loss injection (simulate terrible WiFi)
- [ ] Random 100ms latency spikes (simulate network congestion)
- [ ] Complete network disconnect/reconnect cycles
- [ ] Firewall port blocking (simulate configuration errors)
- [ ] IGMP snooping enabled (simulate corporate networks)

### 7.2 Scale Testing

- [ ] 1 device (proof of concept)
- [ ] 10 devices (small studio)
- [ ] 50 devices (medium facility)
- [ ] 100+ devices (large broadcast center)
- [ ] Ember+ tree size: 1KB, 100KB, 1MB, 8MB
- [ ] Rapid state changes (100 updates/second)
- [ ] Connection pool exhaustion scenarios

### 7.3 Protocol Compatibility Testing

- [ ] TSL v3.1 devices
- [ ] TSL v4 devices
- [ ] TSL v5 devices
- [ ] Mixed version deployments
- [ ] Invalid checksum handling
- [ ] Malformed packet handling
- [ ] Protocol version negotiation

### 7.4 State Machine Testing

- [ ] Preview only
- [ ] Program only
- [ ] Preview + Program simultaneously
- [ ] Rapid switching (program → preview → program)
- [ ] Multi-source arbitration (2+ switchers)
- [ ] Priority override scenarios
- [ ] State persistence across reconnection

### 7.5 Real-World Scenario Testing

- [ ] Show startup (all systems cold boot)
- [ ] Mid-show device addition (hot plug)
- [ ] Configuration change during operation
- [ ] Router upstream tally tracking
- [ ] MultiViewer layout changes
- [ ] Save/recall presets
- [ ] 8-hour continuous operation
- [ ] Power failure recovery

---

## 8. Sources and References

### Community Forums
- [GitHub - josephdadams/TallyArbiter Issues](https://github.com/josephdadams/TallyArbiter/issues)
- [GitHub - bitfocus/companion-module-tslproducts-umd Issue #2](https://github.com/bitfocus/companion-module-tslproducts-umd/issues/2)
- [GitHub - AronHetLam/ATEM_tally_light_with_ESP8266 Issue #53](https://github.com/AronHetLam/ATEM_tally_light_with_ESP8266/issues/53)
- [Blackmagic Forum - ATEM Tally Issues](https://forum.blackmagicdesign.com/)
- [Ross Video Community - DashBoard Tally](https://rossvideo.community/)
- [DVinfo.net - Sony BVS-3100 Tally Interface](https://www.dvinfo.net/forum/open-dv-discussion/519924-sony-bvs-3100-tally-interface.html)

### Technical Documentation
- [Ross Video - TSL UMD Protocol Setup](https://help.rossvideo.com/carbonite-device/Topics/Devices/UMD/TSL.html)
- [Lawo VSM - Driver Ember+](https://docs.lawo.com/vsm-ip-broadcast-control-system/)
- [TSL Products - Protocol Specifications](https://tslproducts.com/)
- [Protocol Information - tslumd Documentation](https://tslumd.readthedocs.io/en/latest/protocol.html)

### Network and Performance
- [Cisco Meraki - Multicast Overview and Best Practices](https://documentation.meraki.com/Switching/MS_-_Switches/Operate_and_Maintain/How-Tos/Multicast_Overview,_Configurations,_and_Best_Practices)
- [UDP Packet Loss Analysis](https://obkio.com/blog/udp-packet-loss/)
- [Broadcast Audio Latency and Delay Compensation](https://www.thebroadcastbridge.com/content/entry/20120/audio-for-broadcast-latency-delay-compensation)

### Industry Resources
- [TSL Control - Interoperability](https://tslproducts.com/control-solutions/)
- [Ross Video - The Crucial Role of Tally Light Systems](https://www.rossvideo.com/blog/the-crucial-role-of-tally-light-systems-in-live-broadcasting/)
- [TallyEngine Homepage](https://www.tallyengine.com/)

---

## 9. Final Thoughts

**The Unwritten Rules:**

1. **UDP is fast but unreliable. Plan accordingly.**
2. **Checksum errors are not always network problems.**
3. **Protocol versions matter. Version negotiation matters more.**
4. **Connection limits are real. Monitor them.**
5. **State machines are hard. Multi-state tally is harder.**
6. **Enterprise WiFi is not optional for wireless tally.**
7. **Test with real hardware, not documentation.**
8. **Broadcast engineers want reliability over features.**
9. **Silent failures are the worst failures.**
10. **When in doubt, add more logging.**

**The Golden Rule:**

> "In broadcast, you get one chance. If the tally fails during a live show, you can't ask the news anchor to re-read the bulletin. Build systems that don't fail."

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-17  
**Maintained By:** SuperDash Research Team  

*This document will be updated as new war stories emerge from the field.*
