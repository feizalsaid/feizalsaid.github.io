---
title: "Bike — Hack The Box Walkthrough"
description: "Achieving RCE on Bike through Server-Side Template Injection in Node.js Handlebars."
date: 2026-09-01
category: offensive
readTime: "4 min read"
mitre:
  - "T1190"
tags:
  - "Hack The Box"
  - "SSTI"
  - "Node.js"
  - "Handlebars"
  - "Web Exploitation"
  - "Linux"
  - "CTF"
summary: "Achieving RCE on Bike through Server-Side Template Injection in Node.js Handlebars."
---

**Machine:** Bike
**Difficulty:** Easy
**Key Techniques:** Server-Side Template Injection (SSTI), Node.js, Handlebars, remote code execution

---

## Enumeration

### Port Scanning

```bash
rustscan -a 10.129.97.64 -- -sVC
```

| Port | Service | Version |
|------|---------|---------|
| 22 | ssh | OpenSSH 8.2p1 Ubuntu |
| 80 | http | Node.js (Express middleware) |

The web application is titled **"Bike"** — a Node.js Express app.

---

## Exploitation

### Identifying the Template Engine

The site has a form with an email input field. The response is rendered server-side using the **Handlebars** templating engine.

Test for SSTI with a mathematical expression:

```
{{7*7}}
```

If the response reflects `49`, the application is evaluating user input as a Handlebars template — SSTI confirmed.

### Achieving RCE

Leverage Handlebars' `{{lookup}}` and `{{#with}}` payloads to break out of the template context and execute system commands:

```
{{#with "s" as |stringlist|}}
  {{#with "e"}}
    {{#with split as |conslist|}}
      {{#with filter.system.name as |c|}}
        ...
```

Craft a payload that spawns a reverse shell, then catch it:

```bash
nc -lvnp 4444
```

### User Flag

After gaining a shell:

```
user.txt: <flag>
```

### Privilege Escalation

Enumerate for the privesc vector and escalate to root:

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Never render user input as a template.** SSTI leads directly to RCE when the templating engine is Handlebars or similar.
2. **Use proper output encoding** and avoid functions like `Handlebars.compile()` on untrusted data.
3. **Run the application with least privilege** — a non-root shell limits the blast radius of SSTI exploits.
