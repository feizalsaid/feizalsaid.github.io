---
title: "Splunk Deep Dive: Detecting RDP Lateral Movement"
description: "Production-ready Splunk searches to detect RDP lateral movement."
date: 2025-02-01
category: defensive
readTime: "15 min read"
mitre:
  - "T1021.001"
  - "T1078"
  - "T1110"
tags:
  - "Splunk"
  - "Lateral Movement"
  - "Detection"
  - "SIEM"
  - "RDP"
  - "Blue Team"
summary: "Production-ready Splunk searches to detect RDP lateral movement."
---

This guide covers how to detect RDP-based lateral movement using Splunk, incorporating techniques from real-world detection engineering.

## Why Monitor RDP?

Remote Desktop Protocol (RDP) is the #1 tool for attackers moving laterally after gaining initial access. While RDP is essential for system administration, attackers abuse it to:
- Pivot from compromised workstations to high-value servers
- Maintain persistence through interactive access
- Blend in with legitimate administrative traffic

## Event Logs You MUST Collect

Before detection works, ensure these Windows logs are forwarded to Splunk:

| Log Name | Source | Why It Matters |
|----------|--------|----------------|
| `Microsoft-Windows-TerminalServices-LocalSessionManager/Operational` | Event ID 21 | RDP session logons/logoffs |
| `Microsoft-Windows-TerminalServices-RDPClient/Operational` | Event ID 1024 | RDP connections INITIATED from a host (lateral movement source) |
| `Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational` | Event ID 1149 | Successful incoming RDP connections |
| `Security` | Event ID 4624 (Logon Type 10) | Successful RDP logon authentication |

```
Detection Flow:

  Attacker                  Compromised Host              Target Server
     │                            │                            │
     │──── Initial Access ────────►│                            │
     │                            │                            │
     │                            │─── RDP (Event 1024) ──────►│
     │                            │    (Outgoing detection)     │
     │                            │                            │
     │                            │◄── Event 1149 ─────────────│
     │                            │    (Incoming detection)     │
     │                            │                            │
     │                            │◄── Event 4624 Type 10 ─────│
     │                            │    (Auth detection)         │
                                  │                            │
                         Splunk collects all three event types
```

## Detection 1: Successful RDP Connections (Incoming)

This detects when someone successfully RDPs INTO a system.

```spl
index=windows sourcetype="WinEventLog:Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational" EventCode=1149
| rex "User \"(?<user>[^\"]+)\" logged on from client \"(?<src_host>[^\"]+)\""
| table _time, user, src_host, host
| sort - _time
```

What this catches: Every successful RDP logon, including the source hostname.

## Detection 2: RDP Connections Initiated from a Host (Outgoing)

This detects when a system STARTS an RDP connection to somewhere else — critical for finding the source of lateral movement.

```spl
index=windows sourcetype="WinEventLog:Microsoft-Windows-TerminalServices-RDPClient/Operational" EventCode=1024
| rename host as source_host
| rex "Remote Desktop Connection: (.+)\""
| table _time, source_host, user, _raw
```

This is your lateral movement source identifier.

## Detection 3: RDP Logon Type 10 (Authentication)

Standard Security log detection for RDP authentication events.

```spl
index=windows sourcetype="WinEventLog" EventCode=4624 LogonType=10
| stats count by src_ip, host, user
| sort - count
```

## Detection 4: RDP Brute Force Detection

Attackers often spray passwords against RDP. This identifies multiple failed logons followed by a success.

```spl
index=windows sourcetype="WinEventLog" (EventCode=4625 OR EventCode=4624) LogonType=10
| eval outcome = if(EventCode=4625, "failed", "success")
| stats count(eval(outcome="failed")) as failed_attempts, count(eval(outcome="success")) as success_attempts, values(src_ip) as src_ips by host, user
| where failed_attempts > 5 AND success_attempts > 0
```

Use case: Identify successful brute force attacks.

## Detection 5: RDP from Unusual Source (Peer Group Analysis)

This Splunk Enterprise Security (ES) correlation finds RDP logins from source IPs that a user has never used before.

```spl
| tstats `security_content_summariesonly` min(_time) as firstTime max(_time) as lastTime from datamodel=Authentication.Authentication where Authentication.authentication_type="RDP" by Authentication.src, Authentication.user, Authentication.dest
| `drop_dm_object_name("Authentication")`
| eventstats values(src) as peer_src by user
| where NOT mvmap(peer_src, src) = src
```

Why this works: Attackers almost never RDP from a "normal" workstation for that user.

## RDP Artifacts: Forensic Evidence

Even if attackers clear logs, RDP leaves files. Monitor the Terminal Server Client cache for forensic evidence of RDP usage:

```spl
index=windows sourcetype="WinEventLog" file_path="*\\Terminal Server Client\\Cache\\*.bmc"
| stats count by dest, user, file_path
```

RDP bitmap cache files (*.bmc) are created whenever a user initiates an RDP session.

## MITRE ATT&CK Mapping

| Tactic | Technique ID | Technique Name |
|--------|-------------|----------------|
| Lateral Movement | T1021.001 | Remote Desktop Protocol |
| Lateral Movement | T1563.002 | RDP Hijacking |

## Risk-Based Alerting (RBA)

In Splunk ES, configure this correlation search with:

| Setting | Value |
|---------|-------|
| Risk Object | system |
| Risk Score | 35 |
| Risk Severity | Medium |

## False Positive Tuning

Legitimate RDP activity will trigger these. Reduce noise by:

- **Exclude jump boxes:** Add `NOT src IN ("jump-host-01", "admin-workstation-02")`
- **Baseline normal behavior:** Track average RDP connections per user
- **Time-based filtering:** Alert only on off-hours RDP (e.g., 8 PM - 6 AM)

```spl
| where searchmatch("NOT (src=jump-* OR src=admin-*)")
```
