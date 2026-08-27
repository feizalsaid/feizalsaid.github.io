---
title: "Forward lookup"
description: "Foundational walkthrough of Active Directory concepts and attack surfaces."
date: 2026-08-26
category: offensive
readTime: "12 min read"
mitre:
  - "T1078"
  - "T1558"
  - "T1482"
tags:
  - "Active Directory"
  - "Kerberos"
  - "LDAP"
  - "HTB Academy"
  - "CPTS"
summary: "Foundational walkthrough of Active Directory concepts and attack surfaces."
---

## Module Overview

| Field | Detail |
|-------|--------|
| **Module** | Introduction to Active Directory |
| **Platform** | HTB Academy |
| **Author** | mrb3n (Co-Author: TreyCraf7\_1) |
| **Difficulty** | Fundamental |
| **Rating** | 4.66 / 5 |
| **Sections** | 16 |
| **Path** | CPTS (Module 07) |

This module is the foundational AD module in the HTB Certified Penetration Testing Specialist (CPTS) path. It covers AD architecture, terminology, protocols, and the attack surface that Active Directory presents. It assumes basic Windows command line knowledge and familiarity with information security principles.

**Prerequisites**: Getting Started, Introduction to Networking, Windows Fundamentals.

---

## Why Active Directory?

Active Directory is present in the majority of corporate environments. It manages users, computers, groups, network devices, file shares, group policies, and trusts. AD provides authentication and authorization within Windows domain environments.

It has come under increasing attack because:

- Designed to be **backward-compatible** — many features are not secure by default
- **Easily misconfigured** — misconfigs are common and exploitable
- **Vast attack surface** — complexity creates opportunities for attackers
- **High-value target** — compromising AD often means full domain compromise

As penetration testers, understanding AD fundamentals is non-negotiable.

---

## AD Structure

AD is arranged in a **hierarchical tree structure**:

```
Forest (Security Boundary)
└── Root Domain: INLANEFREIGHT.LOCAL
    ├── Child Domain: ADMIN.INLANEFREIGHT.LOCAL
    ├── Child Domain: CORP.INLANEFREIGHT.LOCAL
    └── Child Domain: DEV.INLANEFREIGHT.LOCAL
```

Key structural concepts:

| Component | Description |
|-----------|-------------|
| **Forest** | Topmost container. Security boundary. Contains all AD objects. Can hold multiple domains. |
| **Domain** | Logical group of objects (users, computers, OUs). Each domain has its own database and policies. |
| **Tree** | Collection of domains sharing a common namespace. Parent-child trust relationships. |
| **OU** | Organizational Unit. Container for grouping similar objects. Used for administrative delegation and GPO application. |
| **Container** | Holds other objects. Has a defined place in the directory subtree hierarchy. |
| **Leaf** | Does not contain other objects. Found at the end of the subtree hierarchy (e.g., users, printers). |

**Multi-forest scenarios** are common in organizations that perform acquisitions — it's often faster to create a trust relationship than recreate all users.

---

## Key Terminology

| Term | Description |
|------|-------------|
| **Object** | ANY resource in AD — OUs, printers, users, domain controllers, etc. |
| **Attributes** | Characteristics that define an object (e.g., `displayName`, `givenName`, `sAMAccountName`). Every attribute has an LDAP name. |
| **Schema** | Blueprint of the AD database. Defines what object types can exist and their associated attributes. |
| **GUID** | 128-bit unique identifier assigned to every AD object. Unique across the enterprise. Stored in `ObjectGUID` attribute. |
| **SID** | Security Identifier. Unique per security principal. Issued by the domain controller. Never reused, even after deletion. |
| **DN** | Distinguished Name. Full path to an object (e.g., `cn=bjones,ou=IT,ou=Employees,dc=inlanefreight,dc=local`). |
| **RDN** | Relative Distinguished Name. Single component of the DN that identifies the object at its current level. |
| **sAMAccountName** | User's logon name (e.g., `bjones`). Must be unique and 20 or fewer characters. |
| **userPrincipalName** | Format: `username@domain.local`. Not mandatory but commonly used. |
| **FQDN** | Fully Qualified Domain Name. Complete hostname + domain (e.g., `DC01.INLANEFREIGHT.LOCAL`). |

---

## AD Objects

### Users

- **Leaf objects** — cannot contain other objects
- **Security principals** — have SID and GUID
- Many attributes: display name, last login, password change date, email, manager, etc.
- **Prime targets** for attackers — compromised user credentials can lead to domain compromise

### Computers

- **Leaf objects** but **security principals** (have SID + GUID)
- Full administrative access to a computer (`NT AUTHORITY\SYSTEM`) grants similar rights to a standard domain user
- Can be used for most enumeration tasks a user can perform

### Groups

- **Container objects** — can contain users, computers, and other groups
- **Security principals** — have SID + GUID
- Used for managing permissions at scale
- **Nested groups** (group within a group) can lead to unintended privilege escalation

### Organizational Units (OUs)

- Containers for grouping similar objects
- Used for **administrative delegation** without granting full admin rights
- GPOs can be applied at the OU level

### Domain Controllers

- The "brains" of AD
- Handle authentication, enforce security policies, store all object information
- Replicate changes between DCs via the KCC service

---

## FSMO Roles

Microsoft separated DC responsibilities into five **Flexible Single Master Operation** roles:

| Role | Scope | Description |
|------|-------|-------------|
| **Schema Master** | Forest | Manages read/write copy of the AD schema |
| **Domain Naming Master** | Forest | Prevents duplicate domain names in the forest |
| **RID Master** | Domain | Assigns RID blocks to DCs for new object SID creation |
| **PDC Emulator** | Domain | Authoritative DC. Handles auth, password changes, GPOs, time sync |
| **Infrastructure Master** | Domain | Translates GUIDs, SIDs, DNs between domains |

All five roles are assigned to the first DC in the forest root. Each new domain gets RID, PDC, and Infrastructure roles.

**Attack relevance**: Compromising the PDC Emulator gives an attacker the ability to modify Group Policies, reset passwords for any user, and perform Golden Ticket attacks.

---

## Trusts

Trusts establish authentication between domains/forests, allowing users to access resources outside their home domain.

| Trust Type | Description |
|------------|-------------|
| **Parent-child** | Within same forest. Two-way transitive trust. |
| **Cross-link** | Between child domains. Speeds up authentication. |
| **External** | Non-transitive. Between separate forests not joined by forest trust. Uses SID filtering. |
| **Tree-root** | Two-way transitive. Between forest root and new tree root domain. |
| **Forest** | Transitive trust between two forest root domains. |

**Attack relevance**: Trust relationships are a common escalation path. Compromising a child domain can sometimes lead to compromise of the parent domain through trust abuse.

---

## Core Protocols

### Kerberos (Port 88 TCP/UDP)

Default authentication protocol for domain accounts since Windows 2000. Uses tickets instead of transmitting passwords over the network.

**Authentication Flow:**

```
1. User logs on → password converted to NTLM hash
   ↓
2. AS-REQ → KDC verifies user info → creates TGT
   ↓
3. TGT delivered to user (encrypted with user's hash)
   ↓
4. TGS-REQ → User presents TGT, requests service ticket
   ↓
5. TGS-REP → TGS encrypted with service account's NTLM hash
   ↓
6. AP-REQ → User presents TGS to service → access granted
```

**Attack relevance**:
- **Kerberoasting** — Request TGS tickets for service accounts, crack them offline
- **AS-REP Roasting** — Target accounts with `DONT_REQUIRE_PREAUTH`
- **Golden Ticket** — Forge TGTs using the KRBTGT hash
- **Silver Ticket** — Forge TGS tickets for specific services

### DNS

AD DS uses DNS for:
- Locating Domain Controllers
- DC-to-DC communication
- Service record (SRV) lookups

```powershell
# Forward lookup
nslookup INLANEFREIGHT.LOCAL

# Reverse lookup
nslookup 172.16.6.5

# Find host by FQDN
nslookup ACADEMY-EA-DC01
```

### LDAP (Ports 389 / 636 over SSL)

LDAP is the language applications use to communicate with AD. It's how systems "speak" to the directory.

**Two authentication types:**

| Type | Description |
|------|-------------|
| **Simple** | Username/password BIND request. Can be anonymous, unauthenticated, or credentialed. |
| **SASL** | Uses other services (e.g., Kerberos) to bind. More secure due to separation of auth from application protocols. |

### MSRPC

Microsoft's implementation of RPC. Four key interfaces for AD interaction:

| Interface | Purpose |
|-----------|---------|
| `lsarpc` | Local Security Authority operations |
| `netlogon` | Domain authentication |
| `samr` | Security Account Manager operations |
| `drsuapi` | Directory Replication (used for DCSync) |

**Attack relevance**: The `drsuapi` interface is abused in **DCSync attacks** — replicating password hashes from a DC without being a DC.

---

## GPO & Security Descriptors

### Group Policy Objects (GPOs)

- Virtual collections of policy settings, each with a unique GUID
- Can contain local file system or AD settings
- Applied to users and computers at the domain or OU level
- Commonly targeted by attackers to push malicious scripts or configurations

### Access Control

| Component | Description |
|-----------|-------------|
| **ACL** | Ordered collection of ACEs on an object |
| **ACE** | Identifies a trustee and their allowed/denied/audited access rights |
| **DACL** | Defines who is granted or denied access. If no DACL, everyone gets full access. |
| **SACL** | Logs access attempts to secured objects |

### AdminSDHolder & SDProp

- **AdminSDHolder** holds the Security Descriptor applied to privileged groups
- **SDProp** runs hourly, checking protected groups and reverting unauthorized ACL changes
- If an attacker modifies ACLs on a Domain Admin, SDProp will clean it up — unless `dsHeuristics` is modified

---

## Security-Sensitive Attributes

| Attribute | Description | Attack Value |
|-----------|-------------|--------------|
| **adminCount** | `1` = protected by SDProp | Attackers look for accounts with `adminCount=1` — often privileged |
| **sIDHistory** | Stores previous SIDs (used in migrations) | Can be abused to gain prior elevated access if SID Filtering isn't enabled |
| **dsHeuristics** | Forest-wide config string | Can exclude groups from Protected Groups list |
| **NTDS.DIT** | AD database on DC at `C:\Windows\NTDS\` | Contains all password hashes. Extracting it = full domain compromise |

---

## Key Takeaways for Pentesters

1. **Enumeration is everything** — AD has a massive attack surface. Understanding the structure tells you where to look.

2. **Kerberos is the primary target** — Most AD attacks revolve around Kerberos abuse (Kerberoasting, AS-REP Roasting, Golden/Silver Tickets).

3. **Trust relationships matter** — A child domain compromise can escalate to the parent forest through trust abuse.

4. **Group Policies are powerful** — Misconfigured GPOs are a common and high-impact finding.

5. **Protected groups aren't always protected** — `dsHeuristics` and `sIDHistory` can weaken SDProp protections.

6. **NTDS.DIT is the crown jewels** — Full AD compromise means extracting all domain hashes.

7. **LDAP queries reveal everything** — BloodHound, PowerView, and similar tools abuse LDAP to map the entire AD environment.

8. **Service accounts are low-hanging fruit** — Often have SPNs, weak passwords, and are rarely rotated.

---

## Skills Assessment

The module ends with a practical skills assessment covering:

- Identifying AD objects and their attributes
- Understanding Kerberos authentication flow
- Recognizing FSMO roles and their functions
- Mapping trust relationships
- Identifying common AD misconfigurations

The assessment reinforces the theoretical concepts with hands-on exercises in the provided Pwnbox instance.

---

## References

- [HTB Academy — Introduction to Active Directory](https://academy.hackthebox.com/course/preview/introduction-to-active-directory)
- [CPTS-Walkthrough — Module 07](https://github.com/pred07/CPTS-Walkthrough/blob/main/HTB-Academy/07.%20Introduction%20to%20Active%20Directory.md)
- [HTB Academy — Active Directory Enumeration & Attacks](https://academy.hackthebox.com/course/preview/active-directory-enumeration--attacks)
- [Microsoft — Active Directory Technical Documentation](https://docs.microsoft.com/en-us/windows/win32/ad/)
