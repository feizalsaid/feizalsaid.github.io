---
title: "Preignition — Hack The Box Walkthrough"
description: "Pwning Preignition through directory brute-forcing and default web credentials."
date: 2026-09-01
category: offensive
readTime: "3 min read"
mitre:
  - "T1110"
  - "T1190"
tags:
  - "Hack The Box"
  - "Gobuster"
  - "Directory Brute-Force"
  - "Default Credentials"
  - "nginx"
  - "CTF"
summary: "Pwning Preignition through directory brute-forcing and default web credentials."
---

**Machine:** Preignition
**Difficulty:** Very Easy
**Key Techniques:** Directory brute-forcing (gobuster), default credentials, admin.php

---

## Enumeration

### Port Scanning

```bash
nmap -sV -p 80 10.129.70.110
```

Only one service exposed:

| Port | Service | Version |
|------|---------|---------|
| 80 | http | nginx 1.14.2 |

The default nginx welcome page is served. No other services, so directory enumeration is the next step.

---

## Exploitation

### Directory Brute-Force

Use `gobuster` to discover hidden paths, filtering for PHP files:

```bash
gobuster dir -u http://10.129.70.110 \
  -w /usr/share/wordlists/dirbuster/directory-list-2.3-small.txt \
  -x php
```

**Result:** `admin.php` (HTTP 200).

### Default Credentials

Visiting `/admin.php` in a browser shows a login form. Classic first attempt:

```
admin:admin
```

Logged in immediately. The flag is displayed on the page.

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Obscurity is not security.** A hidden admin page is trivially found by directory brute-forcing.
2. **Default credentials should be changed on deployment.** `admin:admin` is the first pair anyone tries.
3. **Rate limiting and WAF rules** would slow down directory scanners and brute-force tools, and high-volume 404 traffic should be monitored.
