---
title: "Paper — Hack The Box Walkthrough"
description: "Pwning Paper through WordPress virtual-host enumeration, a Rocket.chat CVE, and credential reuse."
date: 2026-09-02
category: offensive
readTime: "6 min read"
mitre:
  - "T1190"
  - "T1068"
tags:
  - "Hack The Box"
  - "WordPress"
  - "Rocket.chat"
  - "Virtual Hosting"
  - "Linux"
  - "CTF"
summary: "Pwning Paper through WordPress virtual-host enumeration, a Rocket.chat CVE, and credential reuse."
---

**Machine:** Paper
**Difficulty:** Easy
**Key Techniques:** Virtual-host enumeration, WordPress, Rocket.chat, credential reuse

---

## Enumeration

### Port Scanning

```
22/tcp  open  ssh             OpenSSH 8.0
80/tcp  open  http            Apache httpd 2.4.37 (centos) OpenSSL/1.1.1k mod_fcgid
443/tcp open  ssl/http        Apache httpd 2.4.37 (centos)
```

CentOS + Apache. Virtual-host enumeration is required.

---

## Exploitation

### Virtual Host Enumeration

```bash
gobuster vhost -u http://10.129.136.31 -w /usr/share/wordlists/subdomains-top1million-5000.txt
```

Discover a hidden host (e.g. `office.paper`) running **WordPress**.

### Rocket.chat

WordPress enumeration (WPScan) reveals an internal note pointing to a **Rocket.chat** instance on a further subdomain (e.g. `chat.office.paper`) with a bot.

Exploring the workspace as the guest/bot user reveals an **admin password** through messages. Use it (via CVE-2023-28329 or the exposed channel) to gain credentials as the `dwight` admin:

```
ssh dwight@10.129.136.31
```

```
user.txt: <flag>
```

---

## Privilege Escalation

Enumerate for the escalation vector and reach root:

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Enumerate virtual hosts thoroughly** — hidden subdomains often host chat/admin apps with weaker controls.
2. **Keep collaboration apps (Rocket.chat) updated** to patch known CVEs.
3. **Never expose internal credentials in chat messages**, and don't reuse passwords across chat and SSH/root.
4. **Restrict `sudo` and SUID binaries** used for escalation.
