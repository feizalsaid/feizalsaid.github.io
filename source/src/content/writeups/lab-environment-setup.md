---
title: "Building Cybersecurity Lab Environments from Scratch"
description: "Building, managing, and tearing down custom lab environments."
date: 2026-08-25
category: defensive
readTime: "10 min read"
mitre:
  []
tags:
  - "Lab Setup"
  - "VMware"
  - "Ansible"
  - "Docker"
  - "Virtualization"
  - "Homelab"
summary: "Building, managing, and tearing down custom lab environments."
---

Every serious cybersecurity practitioner needs a lab. Not a pre-built course lab — one you design, build, and break yourself. Here's how I set up mine.

## Why Build Your Own Labs

Pre-built labs teach you the steps. Building your own teaches you the **why** — networking, virtualization, OS internals, and automation. When something breaks (and it will), you learn more from debugging than from any walkthrough.

## Lab Architecture

My standard lab setup runs three nodes on a NAT network:

```
┌──────────────────────────────────────────┐
│              NAT Network                 │
│                                          │
│  ┌──────────────┐    ┌────────────────┐  │
│  │ Ubuntu Server │    │  Arch Linux    │  │
│  │              │    │                │  │
│  │ Wazuh Manager│    │   Attacker    │  │
│  │ SIEM/Dashboard│    │  (Kali tools) │  │
│  │ 192.168.x.x  │    │ 192.168.x.x   │  │
│  └──────────────┘    └────────────────┘  │
│                                          │
│         ┌────────────────┐               │
│         │   Windows 11   │               │
│         │                │               │
│         │    Target      │               │
│         │ 192.168.x.x    │               │
│         └────────────────┘               │
└──────────────────────────────────────────┘
```

- **Ubuntu Server** — Wazuh Manager, Indexer, Dashboard. Central SIEM for log collection and alerting.
- **Arch Linux** — Attacking machine. Running offensive tools (Nmap, Metasploit, Burp Suite, custom scripts).
- **Windows 11** — Target machine. Simulates a real enterprise endpoint with logs, services, and vulnerabilities.

All three communicate over a NAT network — isolated from my production environment but with internet access for updates.

## The Hypervisor Journey

Not every hypervisor works well on limited hardware.

| Hypervisor | Experience |
|------------|------------|
| **VirtualBox** | Started here. Crashed repeatedly with multiple VMs on 8GB RAM. Unstable snapshots. |
| **QEMU** | Tried for raw performance. Config overhead was too high for quick lab spins. |
| **VMware** | Current choice. Stable, handles 3 VMs simultaneously, snapshots work reliably. |

VMware Workstation Player (free for non-commercial) handles my workload without the crashes I saw with VirtualBox. Snapshots let me reset machines to a clean state after exploitation.

## Configuration: Manual → Automated

### Before: Manual Setup

Every lab was built by hand — install OS, configure networking, install tools, harden configs. Repeat for every new lab. Tedious, error-prone, and impossible to reproduce exactly.

### Now: Ansible Playbooks

I'm transitioning to Ansible for configuration management. One playbook to:
- Configure network interfaces
- Install and start Wazuh agents
- Set up monitoring rules
- Deploy offensive tools on the attacker machine

```yaml
# Example: Wazuh agent setup playbook
- name: Install Wazuh Agent
  hosts: targets
  become: yes
  tasks:
    - name: Add Wazuh GPG key
      apt_key:
        url: https://packages.wazuh.com/GPG-KUNWAZUH
        state: present

    - name: Install Wazuh agent
      apt:
        name: wazuh-agent
        state: present

    - name: Configure manager IP
      lineinfile:
        path: /var/ossec/etc/ossec.conf
        regexp: '<address>.*</address>'
        line: '<address>192.168.217.131</address>'

    - name: Start Wazuh agent
      systemd:
        name: wazuh-agent
        state: started
        enabled: yes
```

Docker comes in for lightweight tools — running security scanners, log analyzers, or testing exploit code without polluting the base system.

## Terminal Workflow

Keyboard-first navigation keeps things fast:

| Shortcut | Action |
|----------|--------|
| `Ctrl+E` | Jump to end of line |
| `Ctrl+A` | Jump to beginning of line |
| `Ctrl+R` | Search command history |
| `Ctrl+K` | Kill to end of line |
| `!!` | Repeat last command |
| `!$` | Use last argument |

These compound — fast lab management means fast terminal navigation.

## What I Learned

Building labs from scratch teaches you things courses skip:

- **Networking** — NAT vs bridged vs host-only. Why your VMs can't talk to each other. DNS resolution across networks.
- **OS internals** — How services start, where logs live, what "hardening" actually means.
- **Automation** — If you do it twice, script it. If you script it, Ansible it.
- **Troubleshooting** — When the Wazuh agent won't connect, you learn firewall rules, port numbers, and log analysis the hard way.

The lab is where theory meets practice. Every machine I pwn, every alert I triage, every rule I write — it all starts here.
