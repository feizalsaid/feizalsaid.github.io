---
title: "CTF & Machine Writeup Collection"
description: "A consolidated index of walkthroughs across CTF platforms."
date: 2026-08-25
category: offensive
readTime: "5 min read"
mitre:
  []
tags:
  - "CTF"
  - "VulnHub"
  - "HTB"
  - "TryHackMe"
  - "Writeups"
  - "Penetration Testing"
summary: "A consolidated index of walkthroughs across CTF platforms."
---

A consolidated index of all my walkthroughs across multiple platforms — from beginner wargames to intermediate exploitation. Each writeup covers the full attack chain with defensive takeaways.

## Platforms

| Platform | Profile | Focus |
|----------|---------|-------|
| **Hack The Box** | [feizalsaid](https://app.hackthebox.com/users/feizalsaid) | Offensive, active machines |
| **TryHackMe** | [feizalsaid](https://tryhackme.com/p/feizalsaid) | Structured learning paths |
| **VulnHub** | [GitHub Repo](https://github.com/feizalsaid/vulnhub-works-) | Offline vulnerable VMs |
| **OverTheWire** | [Bandit](https://overthewire.org/wargames/bandit/) | Linux fundamentals |
| **UnderTheWire** | [Century](https://underthewire.tech/century) | PowerShell mastery |

## All Writeups

### Defensive Security

| Title | Platform | Read Time |
|-------|----------|-----------|
| [Building a Security-Hardened Homelab with Wazuh](/writeup/wazuh-siemsetup) | Wazuh / Homelab | 15 min |
| [Splunk Deep Dive: Detecting RDP Lateral Movement](/writeup/splunk-rdp-lateral-02) | Splunk / THM | 15 min |
| [CompTIA Security+ (SY0-701): How I Passed](/writeup/security-plus-journey) | CompTIA | 3 min |

### Hack The Box Writeups

| Title | Difficulty | Key Techniques | Read Time |
|-------|------------|---------------|-----------|
| [Explosion — RDP Default Credentials](/writeups/htb-explosion-01/) | Very Easy | RDP, blank Administrator password | 2 min |
| [Preignition — Dir Brute-Force & Default Creds](/writeups/htb-preignition-01/) | Very Easy | Gobuster, admin.php, default credentials | 3 min |
| [Synced — Open rsync Share](/writeups/htb-synced-01/) | Very Easy | rsync, unauthenticated share | 3 min |
| [Mongod — Unauthenticated MongoDB](/writeups/htb-mongod-01/) | Very Easy | MongoDB, NoSQL database enumeration | 3 min |
| [Funnel — SSH Tunneling to PostgreSQL](/writeups/htb-funnel-01/) | Very Easy | FTP, SSH port forwarding, PostgreSQL | 6 min |
| [Pennyworth — Jenkins Groovy RCE](/writeups/htb-pennyworth-01/) | Very Easy | Jenkins, default creds, Groovy script console | 4 min |
| [Bike — Node.js SSTI](/writeups/htb-bike-01/) | Easy | Handlebars SSTI, remote code execution | 4 min |
| [MetaTwo — WordPress SQLi → XXE → root](/writeups/htb-metatwo-01/) | Easy | BookingPress SQLi, WordPress XXE, passpie/PGP | 10 min |

Also available on GitHub: [feizalsaid/htb-writeups](https://github.com/feizalsaid/htb-writeups)

### VulnHub Writeups

| Title | Key Techniques | Read Time |
|-------|---------------|-----------|
| [Covfefe — Buffer Overflow & SSH Key Cracking](/writeups/vh-covfefe-01/) | Exposed SSH keys, john, buffer overflow | 8 min |
| [Gaara — Credential Discovery & GDB SUID](/writeups/vh-gaara-01/) | Hidden credentials, brainfuck, GDB SUID | 7 min |
| [GEARS_OF_WAR — SMB to Root Shell](/writeups/vh-gears-of-war-01/) | SMB, ZIP cracking, Caesar cipher, SUID cp | 10 min |
| [Cronspire — Cron Job Exploitation](/writeups/vh-cronspire-01/) | Cron jobs, path hijacking | 9 min |

Additional walkthroughs on [VulnHub GitHub repo](https://github.com/feizalsaid/vulnhub-works-):

| Machine | Key Techniques | Status |
|---------|---------------|--------|
| [Insomnia](https://github.com/feizalsaid/vulnhub-works-/blob/main/insomnia.md) | Command injection, writable cron | Partial |
| [Leviathan](https://github.com/feizalsaid/vulnhub-works-/blob/main/leviathan.md) | ltrace, binary analysis | Partial |
| [Blacklight](https://github.com/feizalsaid/vulnhub-works-/blob/main/blacklight.md) | Custom service, steganography | Complete |
| [Cybersploit](https://github.com/feizalsaid/vulnhub-works-/blob/main/cybersploit.md) | Base64, kernel exploit | Complete |

### Other Platforms

| Title | Platform | Key Techniques | Read Time |
|-------|----------|---------------|-----------|
| [Krypton — Classical Cryptography](/writeups/vh-krypton-01/) | HTB | Base64, ROT13, frequency analysis, Vigenere | 12 min |
| [OverTheWire Bandit: Levels 0-20](/writeups/overthewire-bandit-0-20/) | OverTheWire | SSH, Linux commands, privilege escalation | 25 min |
| [UnderTheWire: Century Levels 0-15](/writeups/underthewire-century-0-15/) | UnderTheWire | PowerShell, wargames | 10 min |

### AI Security

| Title | Platform | Read Time |
|-------|----------|-----------|
| [AI Agent Prompt Injection: Attacking LLM-Powered Agents](/writeup/ai-agent-prompt-03) | Research | 12 min |

## My Methodology

Every machine follows a consistent approach:

1. **Reconnaissance** — Nmap scans, service enumeration, OS fingerprinting
2. **Enumeration** — Directory brute-forcing, version analysis, credential discovery
3. **Exploitation** — Gaining initial foothold through identified vulnerabilities
4. **Privilege Escalation** — Escalating from user to root/admin
5. **Defensive Takeaways** — What could have prevented this attack

This last step matters most. Every offensive writeup includes defensive recommendations — because the goal isn't just to break things, it's to learn how to defend them.

## Stats

- **72+ machines** completed across all platforms
- **21 writeups** published (more coming)
- **5 platforms** covered — HTB, VulnHub, OverTheWire, UnderTheWire, Splunk
- **Offensive + Defensive** coverage
