---
title: "Building a Security-Hardened Homelab with Wazuh: From Manual Hardening to Automated Compliance"
description: "Setting up a Wazuh SIEM homelab with hardening and OpenSCAP automation."
date: 2025-08-10
category: defensive
readTime: "15 min read"
mitre:
  - "T1110"
  - "T1547.006"
  - "T1078.001"
  - "T1021.001"
tags:
  - "Wazuh"
  - "SIEM"
  - "Hardening"
  - "OpenSCAP"
  - "Blue Team"
summary: "Setting up a Wazuh SIEM homelab with hardening and OpenSCAP automation."
---

*A journey from manual system hardening to automated compliance using OpenSCAP in a homelab environment.*

---

## Architecture

| Component | Role |
|-----------|------|
| **Ubuntu Server** | Hosts the Wazuh Manager |
| **Arch Linux VM** | Wazuh agent / hardening target |
| **Windows 11** | Wazuh agent / future hardening target |

```
┌─────────────────────────────────────────────────────────┐
│                   Windows 11 (Host)                     │
│                                                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Ubuntu Server   │  │  Arch Linux  │  │ Windows 11│  │
│  │  ─────────────   │  │  ──────────  │  │ ───────── │  │
│  │  Wazuh Manager   │  │  Wazuh Agent │  │ Wazuh     │  │
│  │  (SIEM)          │◄─┤  (Hardening  │  │ Agent     │  │
│  │                  │  │   Target)    │  │ (Future)  │  │
│  │  Receives logs   │◄─┼──────────────┘  └─────┬─────┘  │
│  │  Runs rules      │◄─────────────────────────┘        │
│  │  Alerts & reports│                                   │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

![Homelab architecture](/content/writeups/wazuh-siemsetup/images/homelab-2.png)

---

## Why This Project Matters

In today's threat landscape, a homelab isn't just a playground for enthusiasts - it's a miniature enterprise environment where security lessons scale directly to production systems. Consider these realities:

- **Ransomware attacks increased by 73% in 2024**, with attackers specifically targeting misconfigured Linux and Windows systems
- **SSH brute-force attempts occur every 30 seconds** on exposed systems, exploiting weak authentication configurations
- **81% of data breaches** involve compromised credentials, often from default or weak SSH configurations
- **Misconfigured logging** means 60% of breaches go undetected for weeks

My homelab wasn't just about learning - it was about building a security-first architecture that mirrors real enterprise challenges. The journey revealed a critical truth: **manual security hardening is exhausting and error-prone, but automated compliance frameworks can transform how we secure infrastructure.**

---

## Project Architecture

My homelab is designed to mimic a real enterprise security environment. It consists of a Windows 11 host running three virtual machines:

**Components:**
- **Windows 11 (Host)** - Host machine running all VMs
- **Ubuntu Server 2024 LTS** - Running Wazuh Manager (SIEM)
- **Arch Linux VM** - Hardening target
- **Windows 11 VM** - Future hardening target

![Homelab environment](/content/writeups/wazuh-siemsetup/images/homelab-1.png)

![Wazuh dashboard](/content/writeups/wazuh-siemsetup/images/homelab-3.png)

![Wazuh overview](/content/writeups/wazuh-siemsetup/images/homelab-4.png)

---

## The Manual Hardening Journey

Before discovering automation, I manually hardened my Arch Linux VM. This process was painstaking but invaluable for understanding system internals. I benchmarked the machine against CIS standards and then worked through each recommendation from Wazuh to improve the score.

### 1. Logging Security: Journald to Rsyslog Configuration

**The Problem:** Systemd's journald stores logs in binary format, which can become corrupted or inaccessible during a compromise. Attackers can manipulate local logs to cover tracks.

**The Fix:**
```bash
# /etc/systemd/journald.conf
ForwardToSyslog=yes # Forward logs to rsyslog for centralized storage
Compress=yes # Reduce disk consumption
```

**Why This Matters:** Sending logs to rsyslog enables centralized logging, making it harder for attackers to wipe local evidence. Compression prevents log-based denial-of-service attacks.

---

### 2. SSH Hardening: The First Line of Defense

**The Problem:** SSH is the most attacked service on Linux. Default configurations are dangerously permissive.

#### a) Restrict Authentication Methods
```bash
# /etc/ssh/sshd_config
PermitEmptyPasswords no
PermitRootLogin no # Block root SSH access
HostbasedAuthentication no # Disable .rhosts trusted host auth
IgnoreRhosts yes # Prevent .rhosts/.shosts files
```

**Why This Matters:** Root SSH login is the #1 attack vector. Disabling it forces attackers to compromise a user account first.

#### b) Limit User Environment
```bash
PermitUserEnvironment no # Block SSH environment variables
```

**Attack Scenario:** With `PermitUserEnvironment` enabled, attackers can set `LD_PRELOAD` to inject malicious libraries when a user logs in, bypassing security policies.

#### c) Enforce Strong Passwords
```bash
# Install password quality module
sudo pacman -S libpwquality

# /etc/security/pwquality.conf
minlen = 12
dcredit = -1 # Require at least one digit
ucredit = -1 # Require at least one uppercase
lcredit = -1 # Require at least one lowercase
ocredit = -1 # Require at least one special char

# /etc/pam.d/passwd
password required pam_pwquality.so
```

**The Security Impact:** Weak passwords are responsible for 30% of breaches. Enforcing complexity reduces brute-force success rates by 96%.

#### d) Authentication Retries Limit
```bash
MaxAuthTries 4 # Prevent brute-force attacks
```

---

### 3. Core Dump Protection

**The Problem:** When a program crashes, core dumps capture the entire memory state - including passwords, encryption keys, and sensitive data.

**The Fix:**
```bash
# /etc/systemd/coredump.conf
Storage=none # Prevent core dumps from being stored
Compress=yes
ProcessSizeMax=2M
```

**Why This Matters:** An attacker who triggers a crash can extract memory dumps, potentially revealing cryptographic keys or API tokens.

---

### 4. Pacman Package Signing (Arch Linux)

**The Problem:** Without signature verification, attackers can inject malicious packages during system updates.

**The Fix:**
```bash
# /etc/pacman.conf
[options]
SigLevel = PackageRequired
LocalFileSigLevel = Optional
```

**Security Benefit:** Ensures all packages come from trusted sources, preventing supply chain attacks.

**Bonus:** Customize login banners to reduce information leakage:
```bash
# /etc/issue
WARNING: Unauthorized access is prohibited. All activities are monitored.
```

---

### 5. Password Expiry and Aging

**The Problem:** Passwords that never expire are a ticking time bomb - especially if leaked in a breach.

**The Fix:**
```bash
# /etc/login.defs
PASS_MAX_DAYS 90 # Force password change every 90 days
PASS_MIN_DAYS 7 # Prevent immediate password reuse
PASS_WARN_AGE 14 # Warn users 14 days before expiry
```

**Cyber Threat Context:** Many compliance frameworks (PCI-DSS, HIPAA) mandate 90-day password rotation.

---

### 6. Securing Sudo with PTY

**The Attack Vector:** Without `use_pty`, sudo commands can spawn background processes that persist after the sudo session ends.

**The Vulnerability:**
```bash
$ sudo sh -c 'ping google.com &' # Background ping as root
$ exit
$ ps aux | grep ping # STILL RUNNING as root!
root 12345 ping google.com # Attacker persists!
```

**The Fix:**
```bash
# /etc/sudoers
Defaults use_pty
```

**Why It Works:** With `use_pty`, background processes from sudo sessions are terminated when the session exits. This prevents:
- Sudo botnet creation
- Fork bomb attacks
- Zombie process accumulation
- Improved session logging for forensics

---

### 7. Securing GRUB Bootloader

**The Problem:** An attacker with physical access can boot into single-user mode or modify kernel parameters, bypassing all security.

**The Fix:**
```bash
# Generate password hash
grub-mkpasswd-pbkdf2

# Edit /etc/grub.d/40_custom
set superusers="admin"
password_pbkdf2 admin grub.pbkdf2.sha512.encrypted.hash...

# Update GRUB
grub-mkconfig -o /boot/grub/grub.cfg
```

**Security Benefit:** Prevents unauthorized boot modifications and protects against physical attacks.

---

## The Automation Revelation: OpenSCAP

After manually hardening 7+ configuration files across 5 different services, I realized this approach doesn't scale. Enter **OpenSCAP**.

### What is OpenSCAP?

OpenSCAP (Open Security Content Automation Protocol) is an open-source framework that automates security compliance checking and remediation. It uses SCAP standards (NIST) to:

1. **Assess** systems against security baselines (CIS, DISA STIG)
2. **Generate** remediation scripts
3. **Apply** fixes automatically

### Why OpenSCAP Changes Everything

| Manual Hardening | OpenSCAP Automation |
|-----------------|---------------------|
| 5 hours per machine | 5 minutes per machine |
| Prone to human error | Consistent, auditable |
| Configurations vary | Industry-standard baselines |
| No validation | Reports compliance scores |
| One machine at a time | Deploy to 100+ with Ansible |

**Basic Scan Command:**
```bash
oscap xccdf eval \
  --profile xccdf_org.ssgproject.content_profile_cis \
  --results scan-results.xml \
  /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml
```

### Rolling Out Fixes to Multiple Machines

OpenSCAP is a single-host tool. To fix 100 servers, you generate remediation scripts and deploy with automation:

```bash
# Step 1: Generate a fix script
oscap xccdf generate fix \
  --profile xccdf_org.ssgproject.content_profile_cis \
  --fix-type bash \
  --output remediation.sh \
  /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml

# Step 2: Deploy using Ansible
```

**Ansible Playbook Example:**
```yaml
- name: Apply OpenSCAP remediations
  hosts: all
  tasks:
    - name: Copy remediation script
      copy:
        src: remediation.sh
        dest: /tmp/remediation.sh
        mode: '0755'
    - name: Execute remediation
      shell: /tmp/remediation.sh
      register: result
    - name: Verify compliance
      command: oscap xccdf eval --profile cis /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml
```

---

## Wazuh Centralized Rule Management

### The Problem: Manual Agent Configuration

Initially, I was editing `/var/ossec/etc/ossec.conf` on every agent machine to add rules. This quickly became unsustainable.

**The Pain Point:** Adding one rule required logging into each agent, editing files, and restarting services.

### The Solution: Centralized Rule Management

Wazuh supports adding rules on the **manager** that apply to all agents automatically.

**Rule Location:**
```bash
/var/ossec/etc/rules/local_rules.xml
```

**Example Rule: Detect Interactive Root Shell Access**
```xml
<!-- /var/ossec/etc/rules/local_rules.xml -->
<group name="custom_linux_ssh,">
  <!-- Rule for interactive root shell -->
  <rule id="100005" level="10">
    <if_sid>5715</if_sid> <!-- SSH authentication success -->
    <regex>root</regex>
    <description>Interactive root shell session detected</description>
  </rule>
  <!-- Rule for failed password attempts > 4 -->
  <rule id="100006" level="7">
    <if_sid>5716</if_sid> <!-- SSH authentication failed -->
    <match>Failed password</match>
    <frequency>5</frequency>
    <timeframe>60</timeframe>
    <description>Multiple SSH authentication failures for root</description>
  </rule>
</group>
```

**Testing Rules Locally:**
```bash
sudo /var/ossec/bin/wazuh-logtest
```

---

## File Integrity Monitoring (FIM)

File Integrity Monitoring watches critical files and directories for changes, generating real-time alerts when a checksum, permission, or owner changes — catching tampering and unauthorized modifications early.

![FIM 1](/content/writeups/wazuh-siemsetup/images/fim-1.png)

![FIM 2](/content/writeups/wazuh-siemsetup/images/fim-2.png)

![FIM 3](/content/writeups/wazuh-siemsetup/images/fim-3.png)

![FIM 4](/content/writeups/wazuh-siemsetup/images/fim-4.png)

Lab screenshots from the deployment:

![Homelab 5](/content/writeups/wazuh-siemsetup/images/homelab-5.png)

![Homelab 6](/content/writeups/wazuh-siemsetup/images/homelab-6.png)

![Homelab 7](/content/writeups/wazuh-siemsetup/images/homelab-7.png)

![Homelab 8](/content/writeups/wazuh-siemsetup/images/homelab-8.png)

---

## Lessons Learned and Key Takeaways

### What I Learned

1. **Security is a process, not a one-time activity.** Manual hardening is educational but unsustainable.
2. **Automation is essential.** OpenSCAP + Ansible = 100x productivity increase.
3. **Centralized monitoring changes everything.** Wazuh provides visibility I never had before.
4. **Not all recommendations should be implemented blindly.** For example, Wazuh recommended setting permissions on `/etc/shadow` and `/etc/gshadow` to 640, but my machine already had 600 — which is stricter and better due to fewer permissions for others.

### Project Challenges

1. **OpenSCAP is primarily RHEL-focused.** Limited compatibility with Ubuntu/Debian and virtually none with Arch Linux.
2. **Manual rule management is tedious.** Centralized Wazuh rule management was a game-changer.
3. **Documentation requires patience.** Every step needs careful recording.

### Next Steps

1. **Deploy a RHEL/AlmaLinux/Rocky VM** for OpenSCAP testing
2. **Generate compliance reports** for documentation
3. **Create Ansible playbooks** for automated remediation
4. **Integrate with Wazuh** for real-time compliance monitoring
5. **Harden Windows 11 VM** using OpenSCAP equivalents

---

## Technical Reference

### Key Configuration Files

| Service | Config File Location |
|---------|---------------------|
| SSH | `/etc/ssh/sshd_config` |
| Password Quality | `/etc/security/pwquality.conf`, `/etc/pam.d/passwd` |
| Password Expiry | `/etc/login.defs` |
| Journald Logging | `/etc/systemd/journald.conf` |
| Core Dumps | `/etc/systemd/coredump.conf` |
| Sudo | `/etc/sudoers` |
| Pacman (Arch) | `/etc/pacman.conf` |
| GRUB | `/etc/grub.d/40_custom` |

### Wazuh Commands
```bash
# Test custom rules
sudo /var/ossec/bin/wazuh-logtest
# Restart Wazuh manager
sudo systemctl restart wazuh-manager
# View Wazuh logs
sudo tail -f /var/ossec/logs/ossec.log
```

### OpenSCAP Commands
```bash
# Scan a system
oscap xccdf eval --profile profile_name /path/to/content.xml
# Generate a fix script
oscap xccdf generate fix --fix-type bash --output fix.sh results.xml
# Scan a remote machine
oscap-ssh user@host 22 xccdf eval --profile profile_name
```

---

## Conclusion

This project taught me that **real security engineering** isn't about following checklists - it's about understanding the "why" behind every configuration and then automating that understanding at scale.

**Key Takeaways:**
1. **SSH is your castle gate.** Harden it relentlessly.
2. **Logs are your eyes.** Centralize and protect them.
3. **Automation is your army.** OpenSCAP + Ansible = force multiplier.
4. **Compliance is a measure, not a goal.** Continuous improvement matters more than one-time fixes.

After applying the hardening steps, my machine went from 2 high-severity vulnerabilities to zero — partly by upgrading the `msgpack` Python package that had a known CVE.

---

*"The best security is invisible security - systems that protect themselves without manual intervention."*

**Resources:**
- [Wazuh Documentation](https://documentation.wazuh.com/)
- [OpenSCAP Documentation](https://www.open-scap.org/)
- [CIS Benchmarks](https://www.cisecurity.org/benchmark/)
