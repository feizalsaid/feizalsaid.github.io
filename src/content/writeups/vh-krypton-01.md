---
title: "Krypton — Hack The Box Walkthrough"
description: "Working through Krypton's 5-level cryptography challenge."
date: 2024-05-20
category: offensive
readTime: "12 min read"
mitre:
  []
tags:
  - "Hack The Box"
  - "Cryptography"
  - "Base64"
  - "ROT13"
  - "Vigenere"
  - "Frequency Analysis"
  - "CTF"
summary: "Working through Krypton's 5-level cryptography challenge."
---

**Platform:** Hack The Box
**Difficulty:** Easy
**Key Techniques:** Classical cryptography — Base64, ROT13, Caesar cipher, frequency analysis, Vigenere cipher

---

## Overview

Krypton is a cryptography-focused challenge on Hack The Box. Each level introduces a different classical cipher, building from simple encoding to polyalphabetic substitution. The challenge progresses through 6 levels, each requiring the previous password to access.

---

## Level 1 → Level 2: Base64 Encoding

**Clue:** The first level provides a Base64-encoded string.

```bash
echo "S1JZUFRPTk1JU0dSRUFU" | base64 -d
# Output: KRYPTONISGREAT
```

**Password for Level 2:** `KRYPTONISGREAT`

---

## Level 2 → Level 3: ROT13 Substitution

**Clue:** A file containing ROT13-encoded text.

```bash
echo "YBATR GUR OCNFFJBEQ EBGNLR" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
# Output: LEVEL TWO PASSWORD ROTTEN
```

**Password for Level 3:** `ROTTEN`

---

## Level 3 → Level 4: Caesar Cipher (ROT-Based)

**Clue:** An encrypted file and a key-based rotation cipher.

The encryption used a simple substitution where each letter maps to another. By analyzing the mapping pattern:

```
Input:  abc → Output: mno
Pattern: a→m, b→n, c→o (shift of 12)
```

Applying the reverse shift to the encrypted text `AYCQYPGQCYQWOMQEMDUEQMEK`:

```bash
echo "AYCQYPGQCYQWOMQEMDUEQMEK" | tr 'M-ZA-Lm-za-l' 'A-MN-Za-mn-z'
```

**Password for Level 4:** `CAESARISEASY`

---

## Level 4 → Level 5: Frequency Analysis

**Clue:** Three encrypted files (`found1`, `found2`, `found3`) encrypted with monoalphabetic substitution.

### Approach

Counted letter frequencies across all three files and compared against English language frequency distributions:

| Letter | found1 | found2 | found3 | English Expected |
|--------|--------|--------|--------|-----------------|
| q | 10.1% | 8.7% | 8.6% | ~0.1% |
| j | 6.6% | 7.4% | 7.3% | ~0.2% |
| c | 6.9% | 4.0% | 6.1% | ~2.8% |
| g | 5.3% | 5.2% | 6.2% | ~2.0% |
| u | 6.5% | 6.1% | 4.8% | ~2.8% |

The high-frequency letters (q, j, c) likely mapped to common English letters (e, t, a, o, i, n). Using **JCryptTool** for frequency analysis and **quipqiup** for automated decryption:

**Password for Level 5:** `brute`

---

## Level 5 → Level 6: Vigenere Cipher

**Clue:** A Vigenere-encrypted message with key length 6.

The Vigenere cipher uses a keyword to shift each letter by a different amount. With a known key length of 6:

1. Split the ciphertext into 6 groups (every 6th character)
2. Each group is encrypted with the same Caesar shift
3. Apply frequency analysis to each group independently
4. Reconstruct the keyword from the individual shifts

Using this approach, the plaintext was recovered.

**Password for Level 6:** `cleartext`

---

## Level 6: Polyalphabetic Cipher (Incomplete)

Level 6 involves a more complex polyalphabetic cipher. This level was not completed — it requires deeper analysis of the encryption scheme.

---

## Tools Used

| Tool | Purpose |
|------|---------|
| `base64` | Decoding Base64 strings |
| `tr` | ROT13 and Caesar cipher rotation |
| JCryptTool | Frequency analysis and cipher identification |
| quipqiup | Automated substitution cipher solver |
| CyberChef | Multi-format encoding/decoding |

---

## Lessons Learned

1. **Classical ciphers are still relevant** — understanding them builds the foundation for modern cryptography.
2. **Frequency analysis is powerful** — even with small samples, letter frequency can break monoalphabetic ciphers.
3. **`tr` is a versatile tool** — quick ROT13 and Caesar shifts without external tools.
4. **Polyalphabetic ciphers resist simple frequency analysis** — each position has its own frequency distribution, requiring more sophisticated techniques.
