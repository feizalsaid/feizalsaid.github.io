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

### Offensive Security — Portfolio Writeups

| Title | Platform | Key Techniques | Read Time |
|-------|----------|---------------|-----------|
| [VulnHub: Covfefe — Buffer Overflow & SSH Key Cracking](/writeup/vh-covfefe-01) | VulnHub | Exposed SSH keys, john, buffer overflow | 8 min |
| [VulnHub: Gaara — Credential Discovery & GDB SUID](/writeup/vh-gaara-01) | VulnHub | Hidden credentials, brainfuck, GDB SUID | 7 min |
| [VulnHub: GEARS_OF_WAR — SMB to Root Shell](/writeup/vh-gears-of-war-01) | VulnHub | SMB, ZIP cracking, Caesar cipher, SUID cp | 10 min |
| [Hack The Box: Krypton — Classical Cryptography](/writeup/vh-krypton-01) | HTB | Base64, ROT13, frequency analysis, Vigenere | 12 min |
| [VulnHub: Cronspire — Cron Job Exploitation](/writeup/vh-cronspire-01) | VulnHub | Cron jobs, path hijacking | 9 min |
| [OverTheWire Bandit: Levels 0-20](/writeup/overthewire-bandit-0-20) | OverTheWire | SSH, Linux commands, privilege escalation | 25 min |
| [UnderTheWire: Century Levels 0-15](/writeup/underthewire-century-0-15) | UnderTheWire | PowerShell, wargames | 10 min |

### Offensive Security — GitHub Writeups

Additional walkthroughs available on my [VulnHub GitHub repo](https://github.com/feizalsaid/vulnhub-works-):

| Machine | Platform | Key Techniques | Status |
|---------|----------|---------------|--------|
| [Insomnia](https://github.com/feizalsaid/vulnhub-works-/blob/main/insomnia.md) | VulnHub | Command injection, writable cron | Partial |
| [Leviathan](https://github.com/feizalsaid/vulnhub-works-/blob/main/leviathan.md) | HTB | ltrace, binary analysis | Partial |
| [Blacklight](https://github.com/feizalsaid/vulnhub-works-/blob/main/blacklight.md) | VulnHub | Custom service, steganography | Complete |
| [Cybersploit](https://github.com/feizalsaid/vulnhub-works-/blob/main/cybersploit.md) | VulnHub | Base64, kernel exploit | Complete |

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
- **13 writeups** published (more coming)
- **5 platforms** covered
- **Offensive + Defensive** coverage
