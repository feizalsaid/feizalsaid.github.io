---
title: "Cloud Security Journey"
description: "Exploring AWS IAM, Azure security architectures, and cloud-native threat detection."
date: 2026-08-25
category: defensive
readTime: "3 min read"
mitre:
  []
tags:
  - "AWS"
  - "Azure"
  - "IAM"
  - "Cloud Security"
  - "Zero Trust"
  - "Cloud Architecture"
summary: "Exploring AWS IAM, Azure security architectures, and cloud-native threat detection."
---

<div align="center">

**[ COMING SOON — Actively Being Developed ]**

</div>

---

## Why Cloud Security

The shift to cloud is not a trend — it's the default. And with it, the attack surface has fundamentally changed.

- **95% of cloud breaches** stem from customer misconfiguration, not provider failure (CSA, 2024)
- **82% of breaches** involve a human element — misconfigured IAM policies, exposed storage, weak access controls (Verizon DBIR, 2024)
- **Cloud-native attacks** are rising — adversaries now target IAM roles, service accounts, and API keys directly

Securing on-prem infrastructure is no longer enough. The skills that protect a Linux server don't automatically translate to protecting an S3 bucket, an Azure AD tenant, or a Kubernetes cluster.

This is my journey into that gap.

---

## What I'm Exploring

### AWS Security

| Topic | Status | What I'm Building |
|-------|--------|-------------------|
| IAM Policies & Roles | In Progress | Policy analysis lab — testing least-privilege vs. over-permissioned roles |
| S3 Bucket Security | Planned | Misconfiguration detection — public buckets, encryption gaps |
| CloudTrail & GuardDuty | Planned | Log-based threat detection in AWS |
| VPC & Network Security | Planned | Security groups, NACLs, flow logs |

### Azure Security

| Topic | Status | What I'm Building |
|-------|--------|-------------------|
| Azure AD / Entra ID | In Progress | Identity & access management — MFA, conditional access |
| Azure Security Center | Planned | Regulatory compliance, secure score analysis |
| Azure Sentinel | Planned | Cloud-native SIEM — detecting attacks in Azure workloads |
| Azure Key Vault | Planned | Secrets management, key rotation |

### Cloud-Native Concepts

| Topic | Status |
|-------|--------|
| Zero Trust Architecture | Studying |
| CSPM (Cloud Security Posture Management) | Researching |
| Container Security (Docker/Kubernetes) | Planned |
| Serverless Security | Planned |

---

## Roadmap

```
Q3 2026   ── AWS IAM + Azure AD foundations
            └── Build identity-focused lab

Q4 2026   ── Cloud logging & threat detection
            └── CloudTrail + Azure Sentinel integration

Q1 2027   ── Cloud posture management
            └── CSPM tools, compliance frameworks

Q2 2027   ── Container & serverless security
            └── Docker/Kubernetes hardening, Lambda security
```

---

## What This Means for My Work

This is not a pivot away from offensive or defensive security — it's an expansion. The goal is to operate across all three layers:

1. **On-prem** — SIEM, log analysis, network monitoring (Wazuh, Splunk)
2. **Offensive** — penetration testing, exploitation, privilege escalation (HTB CPTS)
3. **Cloud** — IAM, cloud-native threat detection, posture management (AWS, Azure)

A security engineer who can secure a server, break into a network, AND harden a cloud environment is significantly more valuable than one who can only do one.

---

<div align="content">

**This section is actively being developed. New labs, findings, and writeups will be added as I progress.**

</div>
