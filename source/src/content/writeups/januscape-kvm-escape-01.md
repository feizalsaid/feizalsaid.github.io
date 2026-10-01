---
title: "Januscape (CVE-2026-53359) — KVM/x86 Guest-to-Host Escape"
description: "Root-cause analysis of a 16-year-old use-after-free in KVM's x86 shadow MMU, the one-line role-comparison fix, and a per-distribution patch status tracker."
date: 2026-10-01
category: offensive
readTime: "18 min read"
mitre:
  - "T1611"
tags:
  - "KVM"
  - "Virtualization Escape"
  - "Kernel Exploitation"
  - "Use-After-Free"
  - "CVE-2026-53359"
  - "Linux Kernel"
  - "Cloud Security"
  - "Nested Virtualization"
  - "Vulnerability Research"
summary: "Root-cause analysis of a 16-year-old use-after-free in KVM's x86 shadow MMU, the one-line role-comparison fix, and a per-distribution patch status tracker."
---

<div align="center">

**Research analysis of a disclosed CVE — not original research.**

Discovered and reported by [Hyunwoo Kim (@v4bel)](https://x.com/v4bel), used as a
zero-day in Google's kvmCTF program. Embargo lifted 2026-07-06; PoC published to
oss-security. This writeup covers my own reading of the root cause, the fix, and
the patch landscape.

</div>

---

## TL;DR

| Field | Value |
|---|---|
| CVE | CVE-2026-53359 |
| Component | Linux kernel KVM/x86 **shadow MMU** — `kvm_mmu_get_child_sp()` in `arch/x86/kvm/mmu/mmu.c` |
| Type | Use-after-free → guest-to-host escape / host DoS / local privesc |
| Introduced | `2032a93d66fa` — v2.6.36 (2010-08-01) |
| Prior partial fix | `0cb2af2ea66a` — closed the *GFN*-mismatch variant only |
| Fixed | `81ccda30b4e8` — merged 2026-06-19, first in **v7.2-rc1** |
| Affected window | kernels **2.6.36 → 7.1** (any tree without the backport) |
| Latency | **~16 years** |
| Architecture | x86 only — **both** Intel VMX/EPT and AMD SVM/NPT |
| Trigger | root in guest **+** nested virtualization exposed to that guest |
| Scoring | CVSS 7.8 (Red Hat CNA) / 8.8 HIGH (NVD 3.1), EPSS 0.91%, not in KEV |

The one-sentence version: KVM decided whether to reuse an existing shadow page by
comparing **only the GFN**, never the **role**. A `direct=1` split page and a
`direct=0` indirect page at the same GFN got interchanged, which desynchronized
KVM's reverse-map accounting and produced a use-after-free. The fix adds a role
comparison to the same `if`.

---

## Background: two ways KVM translates a guest address

x86 KVM gets a guest virtual address to a host physical address two ways:

**Hardware two-stage paging** — Intel EPT, AMD NPT. The guest page tables are left
alone and the hardware handles GPA→HPA. This is the default on modern hosts
(`kvm-intel.ept=1`, `tdp_mmu=Y`) and KVM uses the **TDP MMU**.

**Shadow paging** — KVM shadows the guest page tables in software, keeping a
`struct kvm_mmu_page` per level, backed by a 4 KB `sp->spt` page. This is the
**shadow MMU**.

The key is **nested virtualization**. When an L1 guest becomes a hypervisor itself
and runs an L2 guest with EPT/NPT, the hardware has only one stage available, so
L0 must shadow L1's nested EPT/NPT **in software**. Because that nested shadowing
operates on page tables the guest controls, it goes through the legacy shadow MMU
rather than the TDP MMU.

That's the crux: **the bug is only reachable through the shadow MMU, and the
shadow MMU is only reachable from a guest that runs a nested guest.**

All of this happens inside in-kernel KVM. Faults generated as L1 builds its nested
EPT and runs L2 are handled entirely by the host kernel's KVM and never leave to
userspace. This is a pure kernel bug, independent of QEMU — which is why it also
threatens large clouds running their own virtualization stack.

### The rmap invariant

KVM maintains an **rmap** (reverse map) per memslot to reverse-track, by GFN, the
leaf SPTEs each shadow page maps. Installing a leaf adds the SPTE pointer to that
GFN's rmap; tearing it down removes it from the same rmap.

The invariant: **install and teardown must compute the same GFN key.** Januscape
breaks exactly this invariant, and everything downstream follows from that.

---

## Root cause: role-blind shadow page reuse

The vulnerable `kvm_mmu_get_child_sp()` (pre-`81ccda30b4e8`):

```c
static struct kvm_mmu_page *kvm_mmu_get_child_sp(struct kvm_vcpu *vcpu,
						 u64 *sptep, gfn_t gfn,
						 bool direct, unsigned int access)
{
	union kvm_mmu_page_role role;

	if (is_shadow_present_pte(*sptep) && !is_large_pte(*sptep) &&
	    spte_to_child_sp(*sptep) && spte_to_child_sp(*sptep)->gfn == gfn)  /* [1] */
		return ERR_PTR(-EEXIST);

	role = kvm_mmu_child_role(sptep, direct, access);
	return kvm_mmu_get_shadow_page(vcpu, gfn, role);
}
```

Line `[1]` compares only the **GFN** of the child shadow page already linked at
`sptep`. It never looks at the **role** — which encodes what kind of shadow page
this is. The critical field is `role.direct`:

- `direct=0` — **indirect**: shadows a guest page table
- `direct=1` — **direct split**: a large page KVM had to split into 4 KB because
  the host couldn't map it as-is

The shadow MMU's `FNAME(fetch)` path asks for *both* roles at the same GFN, in the
same walk:

```c
	for_each_shadow_entry(vcpu, fault->addr, it) {
		sp = kvm_mmu_get_child_sp(vcpu, it.sptep, table_gfn,
					  false, access);          /* [2] indirect */
	}

	/* ... */

	for (; shadow_walk_okay(&it); shadow_walk_next(&it)) {
		sp = kvm_mmu_get_child_sp(vcpu, it.sptep, base_gfn,
					  true, direct_access);   /* [3] direct split */
	}
```

- `[2]` — an upper-level entry points at a guest page table → need an **indirect**
  shadow page.
- `[3]` — a 2 MB large page can't be mapped as-is by the host → split it into
  4 KB → need a **direct split** shadow page.

Both can target the **same GFN**. Because `[1]` is role-blind, when a direct split
from `[3]` is already linked at `sptep` and `[2]` requests an indirect page,
`kvm_mmu_get_child_sp()` returns `-EEXIST` on the GFN match alone. Fetch then
**reuses the existing page of the wrong role** instead of building a correctly-roled
one.

This is the same bug class as `0cb2af2ea66a` ("Fix shadow paging use-after-free
due to unexpected GFN"). That commit fixed the *GFN* mismatch variant and left the
*role* mismatch open for another 16 years.

---

## The use-after-free

Reusing a shadow page under the wrong role corrupts its lifetime and parent-pointer
accounting. The result is a state where one shadow page has already been freed while
another still holds a pointer into it — an orphaned parent pointer.

When the shadow MMU later tears that structure down and clears the orphan, it writes
a **single fixed constant** through it:

```
__kvm_mmu_prepare_zap_page()
  kvm_mmu_unlink_parents()
    drop_parent_pte()
      mmu_spte_clear_no_track(sptep)                   /* [4] */
        __update_clear_spte_fast()
          WRITE_ONCE(*sptep, SHADOW_NONPRESENT_VALUE)   /* [5] */
```

```c
static void drop_parent_pte(struct kvm *kvm, struct kvm_mmu_page *sp,
			    u64 *parent_pte)
{
	mmu_page_remove_parent_pte(kvm, sp, parent_pte);
	mmu_spte_clear_no_track(parent_pte);   /* [4] */
}

static void mmu_spte_clear_no_track(u64 *sptep)
{
	__update_clear_spte_fast(sptep, SHADOW_NONPRESENT_VALUE);   /* [5] */
}

#ifdef CONFIG_X86_64
#define SHADOW_NONPRESENT_VALUE  BIT_ULL(63)   /* 0x8000000000000000 */
#else
#define SHADOW_NONPRESENT_VALUE  0ULL
#endif
```

At `[4]` the kernel believes it's clearing one slot of a shadow page. If that page
was freed and reallocated as another kernel object, `WRITE_ONCE` at `[5]` writes
`0x8000000000000000` into the victim's memory.

**This is a tighter primitive than a typical UAF write.** The guest chooses the
*slot* (offset) within the page, but the *value* is fixed. No value control, and
the write happens only once — because after the zap, KVM installs no further leaf
SPTEs on that page.

---

## The DoS path

The same corruption has a much simpler second outcome, and it's the one the public
PoC demonstrates: the kernel catches its own inconsistency and panics.

The reused direct split page has no `shadowed_translation`, so it derives the leaf
GFN as `sp->gfn + index`. A leaf installed through it therefore gets **registered**
in the rmap under the real guest GFN, but **looked up** under the computed GFN.

```c
static void kvm_mmu_page_set_translation(struct kvm_mmu_page *sp, int index,
					 gfn_t gfn, unsigned int access)
{
	if (sp->shadowed_translation) {
		sp->shadowed_translation[index] = (gfn << PAGE_SHIFT) | access;
		return;
	}
	/* ... */
	WARN_ONCE(gfn != kvm_mmu_page_get_gfn(sp, index),   /* [6] */
		  "gfn mismatch under %s page %llx (expected %llx, got %llx)\n",
		  sp->role.passthrough ? "passthrough" : "direct",
		  sp->gfn, kvm_mmu_page_get_gfn(sp, index), gfn);
}
```

`[6]` is only a **downstream symptom** — a WARN reporting the GFN mismatch. What
is actually fatal is on teardown, when the leaf is removed from the rmap while the
two keys have diverged:

```
kvm_mmu_page_fault()
  kvm_mmu_do_page_fault()
    ept_page_fault()
      ept_fetch()
        mmu_set_spte()
          drop_spte()
            rmap_remove()
              pte_list_remove()          /* [7] */
                KVM_BUG_ON_DATA_CORRUPTION -> BUG  /* [8] */
```

```c
#define KVM_BUG_ON_DATA_CORRUPTION(cond, kvm)		\
({						\
	bool __ret = !!(cond);				\
	if (IS_ENABLED(CONFIG_BUG_ON_DATA_CORRUPTION))	\
		BUG_ON(__ret);		/* [8] */	\
	else if (WARN_ON_ONCE(__ret && !(kvm)->vm_bugged))	\
		kvm_vm_bugged(kvm);			\
	unlikely(__ret);				\
})
```

`[7]` fires when the looked-up rmap is empty, the single entry doesn't match the
expected `spte`, or the `spte` isn't in a multi-entry chain. With
`CONFIG_BUG_ON_DATA_CORRUPTION=y` (the RHEL default) plus `panic_on_oops`, that's
an immediate host panic.

The DoS path needs neither a reoccupied victim nor any value control — which is
exactly why it's the reproducible one.

Sample panic from RHEL `6.12.0-211.26.1.el10_2.x86_64`:

```
gfn mismatch under direct page 8a00 (expected 8b00, got 256e4)
WARNING: CPU: 6 PID: 974281 at arch/x86/kvm/mmu/mmu.c:689 kvm_mmu_page_set_translation.part.0+0xb7/0x130 [kvm]
CPU: 6 PID: 974281 Comm: qemu-kvm  6.12.0-211.26.1.el10_2.x86_64
kernel BUG at arch/x86/kvm/mmu/mmu.c:1091!
RIP: 0010:pte_list_remove.isra.0+0xd9/0xe0 [kvm]
CPU: 3 PID: 974278 Comm: qemu-kvm
```

Read it top-down: the WARN means role confusion already happened and the rmap was
registered under the wrong key. The `BUG` in `pte_list_remove` is the fatal one —
no rmap entry found under the computed key. `Comm: qemu-kvm` is the host-side KVM
thread that was walking the L2 page tables.

---

## The fix

`81ccda30b4e8` — *KVM: x86: Fix shadow paging use-after-free due to unexpected role*,
by Paolo Bonzini, first released in v7.2-rc1. One role comparison added:

```diff
--- a/arch/x86/kvm/mmu/mmu.c
+++ b/arch/x86/kvm/mmu/mmu.c
@@ -2459,13 +2459,15 @@ static struct kvm_mmu_page *kvm_mmu_get_child_sp(struct kvm_vcpu *vcpu,
 						 u64 *sptep, gfn_t gfn,
 						 bool direct, unsigned int access)
 {
-	union kvm_mmu_page_role role;
+	union kvm_mmu_page_role role = kvm_mmu_child_role(sptep, direct, access);
 
-	if (is_shadow_present_pte(*sptep) && !is_large_pte(*sptep) &&
-	    spte_to_child_sp(*sptep) && spte_to_child_sp(*sptep)->gfn == gfn)
+	if (is_shadow_present_pte(*sptep) &&
+	    !is_large_pte(*sptep) &&
+	    spte_to_child_sp(*sptep) &&
+	    spte_to_child_sp(*sptep)->gfn == gfn &&
+	    spte_to_child_sp(*sptep)->role.word == role.word)
 		return ERR_PTR(-EEXIST);
 
-	role = kvm_mmu_child_role(sptep, direct, access);
 	return kvm_mmu_get_shadow_page(vcpu, gfn, role);
 }
```

With a role mismatch the condition no longer holds, so `fetch` falls through to
`kvm_mmu_get_shadow_page(vcpu, gfn, role)` and builds a correctly-roled page. The
rmap keys stop diverging, and both the corruption and the UAF path disappear.

**That's the whole fix.** Sixteen years, one missing condition.

### Verifying it on your own host

```bash
sudo grep -q "role.word == role.word" \
  /lib/modules/$(uname -r)/build/arch/x86/kvm/mmu/mmu.c \
  && echo "PATCHED" || echo "VULNERABLE (or headers unavailable)"
```

Don't trust the version string on RHEL-family kernels — they backport without
moving the upstream base version. Check the erratum.

---

## Why `ept=1` doesn't save you

A common assumption is that a default host with hardware EPT/NPT and `tdp_mmu=Y`
can't hit a shadow-MMU bug. It can.

Once L1 runs a nested guest, L0 must shadow L1's nested EPT **in software**:

```c
void kvm_init_shadow_ept_mmu(struct kvm_vcpu *vcpu, bool execonly,
			     int huge_page_level, bool accessed_dirty,
			     gpa_t new_eptp)
{
	struct kvm_mmu *context = &vcpu->arch.guest_mmu;   /* [16] */
	/* ... */
	context->page_fault = ept_page_fault;             /* [17] */
}

static inline bool is_tdp_mmu_active(struct kvm_vcpu *vcpu)
{
	return tdp_mmu_enabled && vcpu->arch.mmu->root_role.direct;  /* [18] */
}
```

The nested-EPT MMU (`guest_mmu`) shadows guest-controlled page tables, so its
`root_role.direct` is **false**. Two consequences:

- KVM installs the legacy `ept_page_fault` handler at `[17]`, not
  `kvm_tdp_page_fault` — and that handler reaches `kvm_mmu_get_child_sp()` via
  `FNAME(fetch)`.
- `is_tdp_mmu_active()` at `[18]` is false, so the lockless TDP fast path doesn't
  apply either.

**A default host is exposed as soon as a guest uses nested EPT.** AMD's
`kvm_init_shadow_npt_mmu` is structurally identical.

---

## Dual-architecture: why this one is different

Kim's claim, to the best of public knowledge, is that this is the **first
guest-to-host exploit research triggerable on both Intel and AMD** from a single
code path. Most KVM escapes are architecture-specific.

The reason is structural: `kvm_mmu_get_child_sp()` lives in
`arch/x86/kvm/mmu/mmu.c`, which VMX and SVM share. The PoC expresses the whole
architecture split through a `virt_ops` abstraction that only swaps page-table bit
encodings:

```c
struct virt_ops {
	const char *name;
	int  (*cpu_on)(int cpu);
	void (*cpu_off)(void);
	u64 (*huge_pte)(u64 pa);
	u64 (*tbl_pte)(u64 pa);
	u64 (*leaf4k)(u64 pa);
	u64 (*mk_root)(u64 pml4_pa);
	int  (*vcpu_run)(int cpu);
};

static u64 vmx_huge_pte(u64 pa){ return pa | EPT_LEAF | EPT_PS; }           /* [13] */
static u64 svm_huge_pte(u64 pa){ return pa | PF_P|PF_RW|PF_US|PF_PS; }      /* [14] */
ops = amd ? &svm_ops : &vmx_ops;                                          /* [15] */
```

`[13]` is the Intel EPT entry encoding (RWX `0x7`, memory type WB, PS bit).
`[14]` is the AMD NPT encoding (P/RW/US/PS). `[15]` picks the backend from the
module parameter.

The Intel path brings up EPT12 via `vmxon` / `vmlaunch` / `vmresume`. The AMD
path sets `nested_ctl = SVM_NESTED_CTL_NP_ENABLE` with `nested_cr3 = the_root` and
uses `vmrun`. Same PDE toggle, same L2 fault, same race — only the entry bits
differ.

---

## The PoC's key geometry

The public PoC is a loadable guest kernel module. Inside the guest (L1) it builds
and runs its own nested guest (L2) with **raw** VMX or SVM. Once L2 exists, L0
must shadow L1's nested EPT/NPT, and the role-gap reuse fires on L0.

```
L0  bare-metal x86_64 Linux, kvm_intel/kvm_amd   <-- PANICS HERE
     |
     +-- L1  attacker's guest (poc.ko loaded here)
           |
           +-- L2  nested guest created by poc.ko with raw VMX/SVM
```

The premise is a deliberately degenerate page-table geometry: **one physical page
used simultaneously as both the leaf of a 2 MB page and a page table page.**

```c
	ptg = (u64 *)greg_va;                       /* [10] ptg_pa == greg_pa */
	/* ... */
	nest_pd[PDE_IDX] = ops->huge_pte(greg_pa);  /* [11] gfn == table_gfn   */
	/* ... */
	ptg[0]         = ops->leaf4k(greg_pa);
	ptg[PRIME_IDX] = ops->leaf4k(q_pa);        /* [12] diverging leaf     */
```

- `[10]` — the nested PT page `ptg` **is** the first page of `greg`, so
  `ptg_pa == greg_pa`.
- `[11]` — when the PDE maps `greg` as a 2 MB large page, the resulting `gfn` and
  the `table_gfn` when the same PDE points to `ptg` as a page table are both
  `greg_pa >> 12`. **Equal. Role different.**
- `[12]` — one PT entry points at a separate page `q` (GFN Q) prefilled with
  `0x4141414141414141`, so that when the wrongly-reused direct page installs a
  leaf, the real GFN (Q) diverges from the direct assumption (`sp->gfn + index`).

L2's code is three instructions:

```
movabs rax, GVA ; mov rax,[rax] ; vmcall
```

One load to induce a nested EPT/NPT violation, then exit. That fault is what
drives the L0 shadow MMU fetch.

### The race

Triggering needs two kinds of vCPU. The **writer** toggles one PDE between huge
and table form; the **faulters** repeatedly run L2 to keep raising faults through
that PDE:

```c
	nest_pd[PDE_IDX] = ops->huge_pte(greg_pa);   /* [19] */
	for (k = 0; k < dwell; k++) cpu_relax();
	nest_pd[PDE_IDX] = ops->tbl_pte(ptg_pa);     /* [20] */
	for (k = 0; k < dwell; k++) cpu_relax();
```

- At `[19]` the PDE maps `greg` as 2 MB. But `ptg` shares that GFN, so
  `account_shadowed` sets `disallow_lpage`; `kvm_mmu_hugepage_adjust` downgrades
  the fault to 4 KB and creates a **direct split** (`direct=1`).
- At `[20]` the PDE points at `ptg` as a page table, so L0 needs an **indirect**
  (`direct=0`) shadow page at the same GFN.

The exploitable window is the **non-atomic gap** in L0's emulation of the guest's
PDE write — between the moment L0 commits the new PDE value and the moment it zaps
the old shadow link at `kvm_page_track_write`. A faulter that faults inside that
gap calls `kvm_mmu_get_child_sp()` with the *new* role while the *old*-role child
is still linked at `sptep` → the GFN-match reuse fires.

With `nvcpu=8` the faulters contend over `mmu_lock`, delaying the writer's
`track_write` and widening the window. Time-to-win varies from seconds to minutes,
but on vulnerable code enough attempts trigger it deterministically.

### Sequence to panic

1. Reused direct page installs leaf GFN Q.
2. Real GFN diverges from the direct assumption → `"gfn mismatch under direct page"`
   WARN fires, rmap registered under the real GFN.
3. A later fault overwrites and drops that leaf at the same slot.
4. `pte_list_remove` looks up the rmap under the computed key (`sp->gfn + index`),
   finds nothing, hits `KVM_BUG_ON_DATA_CORRUPTION` → `BUG`.

---

## Impacts

**1. KVM escape.** Guest-side actions alone → compromise the host. Either panic the
host kernel to take down every co-tenant VM (DoS), or run as root on the host to
take over the host and every guest on it (RCE).

**2. Local privilege escalation.** On distros where `/dev/kvm` is world-writable
`0666` (RHEL/EL8+ is the default), an unprivileged local user reaches the same bug
directly — no guest needed. The researcher classes this as the minor impact, but
for shared multi-user and self-hosted CI hosts it's a real exposure: a plain
unprivileged account becomes root.

### Upstream FAQ, condensed

- **arm64 affected?** No. x86 only. (Unpatched ITScape, CVE-2026-46316, hits arm64
  — different MMU entirely.)
- **Is this a QEMU bug?** No. In-kernel KVM, triggered independently of QEMU's
  emulation. Relevant to clouds running their own virtualization stack.
- **Guest root required?** Yes, to load the module. Cloud tenants normally have root
  in their own VM, so the bar is trivially met. Without guest root, chain an LPE.
- **QEMU version sensitivity?** A third-party hotfix collection notes QEMU 6.x
  partially blunts the *PoC* (the L1 VM crashes before the host panics) while the
  escape signal still reached L0 KVM. QEMU is not a security boundary here.

---

## Detection

```bash
uname -r                                    # in the affected window?
uname -m                                    # x86_64 only
cat /sys/module/kvm_intel/parameters/nested # Y = nested virt on
cat /sys/module/kvm_amd/parameters/nested   # AMD host
ls -l /dev/kvm                              # crw-rw-rw- = EL8+ default
grep -r nested /etc/modprobe.d/             # a config re-enabling nesting
```

Also check the fix by source, not version string:

```bash
sudo grep -q "role.word == role.word" \
  /lib/modules/$(uname -r)/build/arch/x86/kvm/mmu/mmu.c \
  && echo PATCHED || echo VULNERABLE
```

---

## Patch status

Stable backports, landed by the kernel CNA on 2026-07-04:

| Tree | First fixed | Commit |
|---|---|---|
| mainline | 7.2-rc1 | `81ccda30b4e8` |
| 7.1.x | 7.1.3 | `1ae7d5a6db6c` |
| 6.18.x (LTS) | 6.18.38 | `5e470998a23e` |
| 6.12.x (LTS) | 6.12.95 | `2ad3afa40ac6` |
| 6.6.x (LTS) | 6.6.144 | `9291654d69e0` |
| 6.1.x (LTS) | 6.1.177 | `b1337aae5e19` |
| 7.0.x | **never** | EOL at 7.0.14 |
| 5.15.x | **never** | no backport expected |
| 5.10.x | **never** | no backport expected |

**Why 5.15 and 5.10 can never be fixed:** those pre-6.0 trees don't contain
`kvm_mmu_get_child_sp()` or `sp->shadowed_translation[]` at all. A backport would
require a manual rewrite against `kvm_mmu_get_page()` and `sp->gfns[]`. The prior
partial fix `0cb2af2ea66a` was never backported to them for the same reason. Both
lines have shipped point releases since 2026-07-04 without picking it up.

### Distribution rollup

| Distribution | Release | First fixed | Status |
|---|---|---|---|
| Debian | sid | 7.1.3-1 | Fixed |
| Debian | trixie (13) | 6.12.95-1 (DSA-6381-1) | Fixed |
| Debian | bookworm (12) | 6.1.177-1 (DLA-4688-1) | Fixed |
| Debian | **bullseye (11), default** | — | **Vulnerable** (5.10.x) |
| Debian | bullseye, opt-in `linux-6.1` | 6.1.177-1~deb11u1 (DLA-4700-1) | Fixed |
| Proxmox VE | 9 default (7.0) | 7.0.14-4-pve | Fixed |
| Proxmox VE | 9 opt-in 6.17 | 6.17.13-15-pve (PSA-2026-00027-1) | Fixed |
| Proxmox VE | **9 opt-in 6.14** | — | **Vulnerable** |
| Proxmox VE | 8 default (6.8) | 6.8.12-33-pve | Fixed |
| Proxmox VE | **8 opt-in 6.14** | — | **Vulnerable** |
| Proxmox VE | **8 old 6.11** | — | **Vulnerable** |
| NixOS | unstable / 26.05 | 6.18.38 | Fixed |
| Rocky / RHEL | EL10 | 6.12.0-211.32.1.el10_2 (RHSA-2026:36956) | Fixed |
| Rocky / RHEL | EL9 | 5.14.0-687.24.1.el9_8 (RHSA-2026:36957) | Fixed |
| Rocky / RHEL | EL8 | 4.18.0-553.144.1.el8_10 (RLSA-2026:39179) | Fixed |
| Amazon Linux | 2023 default (6.1) | ALAS2023-2026-2001 | Fixed |
| Amazon Linux | 2023 kernel6.12 | ALAS2023-2026-1970 | Fixed |
| Amazon Linux | 2023 kernel6.18 | ALAS2023-2026-1969 | Fixed |
| **Amazon Linux 2** | — | — | **Permanently vulnerable** (EOL 2026-06-30, no ALAS) |

Prose-only advisories exist for RHEL 10.0 EUS (RHSA-2026:39371), 9.6 EUS (:38902),
9.4 SAP US (:37729), 9.2 SAP US (:40082), 8.8 TUS/SAP US (:41229), 8.6 AUS/EUS
(:49033), and real-time kernels (:39983, :39082). AlmaLinux rebuilt the main
errata as ALSA-2026:36956/36957/39083. Oracle Linux 10 and CloudLinux OS 10 are
expected to track RHEL.

**Debian vs EL, the key contrast:** Debian keeps `/dev/kvm` at `root:kvm 0660`, so
the unprivileged *local* vector needs `kvm` group membership. The EL family ships
it **world-accessible** by default from EL8 onward, so on those hosts *any* local
user reaches the bug without needing a guest at all. Combined with the guest-escape
path, that makes EL the higher-exposure case.

---

## Mitigations

**The real fix is the kernel patch.** Two interim measures each narrow exposure
without closing the hole.

**Disable nested virtualization** — removes the guest-driven path:

```bash
sudo modprobe -r kvm_intel                                  # kvm_amd on AMD
echo 'options kvm_intel nested=0' | sudo tee /etc/modprobe.d/99-januscape.conf
sudo modprobe kvm_intel
```

Canonical flags unprivileged containers as not a concern (they lack permission to
start KVM-accelerated VMs). **Privileged containers may have sufficient permissions
and should not be considered safe.**

**Restrict `/dev/kvm`** — removes the unprivileged local vector only:

```bash
echo 'KERNEL=="kvm", GROUP="kvm", MODE="0660"' | sudo tee /etc/udev/rules.d/65-kvm.rules
```

This does nothing against a hostile guest escaping. Don't mistake it for a fix.

---

## What I took away

**The rmap key invariant is the thing to audit.** "Install and teardown must agree
on the GFN" sounds trivially true and isn't enforced anywhere — it's an emergent
property of two independent code paths. The moment a page can be *reused* under a
different configuration, every consumer that recomputes identity from partial state
becomes suspect.

**Fixing a bug class is not fixing the class.** `0cb2af2ea66a` fixed the GFN
mismatch. `81ccda30b4e8` fixed the role mismatch. Same function, same data
structure, same failure mode — sixteen years apart. When a patch adds a *condition*
to a reuse check, ask what other identity fields that check is still ignoring.

**Absent fields are load-bearing.** `direct` wasn't a correctness detail. It was
the difference between two kinds of object with different lifetime rules, and
nothing forced the reuse check to care.

**Nested virtualization is a large, quiet attack surface.** It's typically framed
as a feature for CI runners and nested containers. Here it routed a 16-year-old
kernel bug directly into multi-tenant cloud hosts — on a path the host operator
believed was hardware-accelerated and therefore not the legacy software walker.

**Version strings lie on enterprise distros.** RHEL backports without moving the
base version, so `uname -r` cannot confirm a fix. The reliable signals are the
erratum ID and grepping the source for the fixed condition.

---

## The researcher's trilogy

Same researcher, three KVM escapes, each a different subsystem:

| Bug | CVE | Area | Arch |
|---|---|---|---|
| **ITScape** | CVE-2026-46316 | vGIC-ITS | arm64 |
| **Januscape** | CVE-2026-53359 | shadow MMU | x86 |
| **Zapscape** | CVE-2026-64561 | shadow MMU, recursive zap / missing `root_count` | x86 |

---

## Disclosure timeline

- **2026-06-12** — details and exploit submitted to security@kernel.org
- **2026-06-13** — patch handling discussed with KVM maintainers Paolo Bonzini and Sean
- **2026-06-17** — patch posted to lore for pre-merge testing
- **2026-06-19** — `81ccda30b4e8` merged into mainline
- **2026-07-01** — submitted to linux-distros@vs.openwall.org, 5-day embargo
- **2026-07-04** — CVE-2026-53359 assigned; stable backports landed
- **2026-07-06** — embargo ended → oss-security post and public writeup

---

## References

| Source | Link |
|---|---|
| PoC + technical writeup | https://github.com/V4bel/Januscape |
| oss-security post | https://www.openwall.com/lists/oss-security/2026/07/06/7 |
| Patch-status tracker | https://github.com/suominen/januscape |
| Fix commit | https://github.com/torvalds/linux/commit/81ccda30b4e83d8f5cc4fd50503c44e3a33abfeb |
| Introducing commit (v2.6.36) | https://github.com/torvalds/linux/commit/2032a93d66fa282ba0f2ea9152eeff9511fa9a96 |
| Prior partial fix (GFN variant) | https://github.com/torvalds/linux/commit/0cb2af2ea66ad8ff195c156ea690f11216285bdf |
| CVE record | https://www.cve.org/CVERecord?id=CVE-2026-53359 |
| Canonical mitigations | https://canonical.com/blog/januscape-linux-vulnerability-mitigations-available |
| Debian security tracker | https://security-tracker.debian.org/tracker/CVE-2026-53359 |
| kvmCTF program | https://security.googleblog.com/2024/06/virtual-escape-real-reward-introducing.html |
