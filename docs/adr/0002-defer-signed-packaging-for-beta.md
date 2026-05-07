# ADR 0002 — Defer signed agent packaging until Phase 6

**Status:** Accepted
**Date:** 2026-05-07
**Supersedes parts of:** spec §11 phase ordering

## Context

Phase 3 of the rollout (`docs/plans/2026-04-30-phase-3-agent-packaging.md`)
packages the macOS agent as a `py2app`-built `.app`, wraps it in a DMG
plus a Homebrew cask, and wires Sparkle auto-update. Two of those four
deliverables — the signed `.app` and Sparkle's signed appcast — require
an Apple Developer Program enrollment ($99/yr) and notarization runs.

We had treated Phase 3 as the natural next step after Phase 5 code
landed. Re-examining the assumption: Phase 5 of the spec is a private
beta of "10–20 invite users." That cohort is, by construction, friends
and early adopters who can comfortably run `git clone && ./start.sh`.
They do not need a notarized DMG to evaluate the product.

## Decision

Defer signed agent packaging (py2app + DMG signing + notarization +
Sparkle) until Phase 6 (public launch). Beta testers in Phase 5 install
from source.

The Phase 3 plan file stays as-is; only its position in the rollout
moves. The Apple Developer enrollment becomes a Phase 6 prerequisite
rather than a Phase 5 blocker.

Phase 5 runtime work — invite gating, telemetry, iteration — runs next
and has no external-vendor dependencies.

## Consequences

- Phase 5 starts immediately without waiting on Apple Developer
  enrollment, cert provisioning, or notarization-pipeline setup.
- Beta testers are restricted to people comfortable with a terminal.
  Acceptable for an "invite users" cohort per spec §11.
- Onboarding doc for testers must cover the Accessibility-permission
  step, the agent log path, and how to file feedback. Drafting that is
  part of Phase 5 runtime.
- Public-launch readiness still requires Phase 3. The plan file
  (`docs/plans/2026-04-30-phase-3-agent-packaging.md`) is preserved and
  picked up before Phase 6 ships.

## Alternatives considered

- **Build an unsigned `.app` for the beta.** Adds a Gatekeeper
  "unidentified developer" warning on every first launch, which
  introduces a distraction from real product feedback and trains
  testers to bypass macOS security prompts. Rejected.
- **Block Phase 5 on the cert.** Pushes beta start out 1–2 weeks for
  enrollment + first notarization run that does not change what the
  beta cohort sees. Rejected.
