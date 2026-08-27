---
title: "Vagrant Homelab Setup: Reproducible VMs"
description: "Using Vagrant and VirtualBox to spin up reproducible VMs for lab automation."
date: 2026-08-27
category: defensive
readTime: "5 min read"
mitre:
  []
tags:
  - "Vagrant"
  - "VirtualBox"
  - "Lab Setup"
  - "Virtualization"
  - "Automation"
summary: "Using Vagrant and VirtualBox to spin up reproducible VMs for lab automation."
---

Setting up virtual machines by hand is slow and inconsistent. With **Vagrant** and **VirtualBox**, I can define a VM once in a `Vagrantfile` and spin up identical, reproducible environments in seconds — ideal for building pentesting labs and test targets without repeating manual configuration.

## Requirements

- [VirtualBox](https://www.virtualbox.org/) (Oracle)
- [Vagrant](https://www.vagrantup.com/) (HashiCorp)

## Getting Started

Open a **PowerShell as Administrator** and run the following.

### 1. Verify the installation

```powershell
vagrant --version
```

This confirms which version of Vagrant is installed before we go further.

### 2. Initialize a VM

Create a dedicated folder for each VM, then bootstrap it one of two ways:

```powershell
# Option A: with a specific base image
vagrant init bento/ubuntu-22.04

# Option B: generate a bare Vagrantfile to customize yourself
vagrant init
```

`vagrant init <os image>` writes a `Vagrantfile` pre-configured with default memory and storage for that image. Running bare `vagrant init` generates a `Vagrantfile` you can edit to customize networking, storage, and provisioning.

![Vagrant init](/content/writeups/vagrant-setup/images/vagrant-init.png)

### 3. Start the machine

```powershell
vagrant up
```

This downloads the base image (or reuses one already cached locally) and boots the VM. Once it's up, confirm it's running as expected.

![VM running](/content/writeups/vagrant-setup/images/vm-running.png)

## Management Commands

| Command           | Action                                            |
|-------------------|---------------------------------------------------|
| `vagrant up`      | Start / provision the machine                     |
| `vagrant halt`    | Gracefully shut it down                           |
| `vagrant suspend` | Suspend (save) the machine state                  |
| `vagrant reload`  | Restart the VM and apply `Vagrantfile` changes    |
| `vagrant destroy` | Kill the machine and delete all of its resources  |

![Vagrantfile](/content/writeups/vagrant-setup/images/vagrantfile.png)

## What I Did

- [x] Download Vagrant and VirtualBox
- [x] Set up a VM using Vagrant
- [x] Initialize, start, and confirm the machine works as expected

## Takeaways

Vagrant turns VM management into **infrastructure-as-code**: every machine is described in a text file, version-controllable with Git, and reproducible on any machine with Vagrant installed. That's a huge time-saver when standing up repeated lab environments.
