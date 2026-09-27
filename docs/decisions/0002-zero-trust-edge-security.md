# 0002: Zero-Trust Edge Security for Kiosk Deployment

> **Status:** accepted
> **Date:** 2026-09-26
> **Author:** @soham
> **Reviewers:** @soumyadeep

## Context

MediKiosk kiosks are deployed in hospital OPD lobbies — physically accessible to anyone.
They handle PHI (patient voice recordings, medical documents, clinical data) and connect
to national health infrastructure (ABDM). A compromised kiosk could leak thousands of
patient records.

The hackathon prototype had zero security: no encryption at rest, no authentication,
CORS allow-all, no USB protection, no disk encryption, and secrets stored as plain
environment variables.

## Decision

Adopt a Zero-Trust security model for all kiosk edge deployments:

1. **Encrypt everything at rest** using AES-256-GCM with keys sealed to the TPM.
2. **Encrypt everything in transit** using TLS 1.3 with certificate pinning.
3. **Lock USB ports** at the OS level — only whitelisted HID devices (kiosk peripherals) allowed.
4. **Secure boot chain** — signed bootloader, read-only root filesystem, no external boot media.
5. **Ephemeral local storage** — all patient data wiped after session purge; no persistent PHI on kiosk disk.
6. **mTLS between kiosk and API gateway** — each kiosk has a unique client certificate.
7. **Session tokens** are 256-bit random, rotated every 5 minutes, bound to kiosk hardware ID.
8. **LLM context isolation** — each LLM API call uses a fresh context; no conversation history carried between sessions.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| VPN-only (no mTLS) | Simpler setup | Doesn't prevent compromised kiosk from accessing API |
| Full-disk encryption only | Easy to implement | Doesn't protect against runtime memory dumps |
| Cloud-only processing (no local compute) | Simplest security | Fails offline requirement from VISION.md |
| Zero-Trust (chosen) | Defense in depth, no single point of failure | More complex provisioning |

## Consequences

### Positive
- A stolen kiosk hard drive yields only encrypted data that requires the TPM to decrypt
- A compromised kiosk cannot access other kiosks' data (unique certificates)
- LLM calls cannot leak previous patient data (stateless context)
- USB attacks are blocked at the kernel level

### Negative
- Kiosk provisioning is more complex (TPM enrollment, certificate issuance)
- Certificate rotation requires fleet management tooling
- Read-only root filesystem requires careful update procedure

### Risks
- TPM not available on budget kiosk hardware
  - **Mitigation:** Fall back to software-based key derivation with mandatory disk encryption
- Certificate management at scale (100+ kiosks)
  - **Mitigation:** Automated certificate lifecycle via internal CA
