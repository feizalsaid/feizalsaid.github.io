---
title: "Ignition — Hack The Box Walkthrough"
description: "Pwning Ignition through virtual-host resolution and Magento default admin credentials."
date: 2026-09-01
category: offensive
readTime: "3 min read"
mitre:
  - "T1190"
tags:
  - "Hack The Box"
  - "Magento"
  - "Default Credentials"
  - "Virtual Hosting"
  - "Linux"
  - "CTF"
summary: "Pwning Ignition through virtual-host resolution and Magento default admin credentials."
---

**Machine:** Ignition
**Difficulty:** Very Easy
**Key Techniques:** Virtual-host resolution, Magento default admin credentials

---

## Enumeration

### Port Scanning

```
80/tcp  http  nginx 1.14.2 (redirects to http://ignition.htb/)
```

Add the hostname to `/etc/hosts`:

```bash
echo "10.129.72.160 ignition.htb" >> /etc/hosts
```

### Directory Fuzzing

```bash
gobuster dir -u http://ignition.htb -w /usr/share/wordlists/dirb/common.txt
```

Fuzzing reveals the **Magento** admin panel at `/admin`.

---

## Exploitation

Navigate to `/admin` and log in with the **Magento default credentials**:

```
admin:qwerty123
```

Once authenticated, retrieve the flag from the admin interface.

```
flag.txt: <flag>
```

---

## Lessons Learned

1. **Always resolve virtual hosts** (add hostnames to `/etc/hosts`) — directories and vhost apps are otherwise unreachable.
2. **Never keep default admin credentials** on platforms like Magento.
3. **Restrict `/admin`** via IP allow-listing and enforce strong passwords.
