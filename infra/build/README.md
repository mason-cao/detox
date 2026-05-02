# Detox Agent Build

This directory owns the local macOS app bundle pipeline for Phase 3.

## Prerequisites

- Python 3.11.
- `py2app>=0.28`.
- Apple Developer ID Application certificate installed in the build machine keychain.
- `notarytool` keychain profile named `detox-notary`.
- Sparkle EdDSA key pair generated with Sparkle's `generate_keys` tool.
- Sparkle private key stored outside the repo, preferably in 1Password.

The certificate, notarization profile, Sparkle framework, and private key are release blockers. Alias builds do not require them.

## Dev Build

From this directory:

```bash
python3 setup.py py2app -A
```

Alias mode is unsigned and fast. It should produce:

```text
dist/Detox.app/Contents/MacOS/Detox
```

Launch that bundle for a local smoke test, then quit Detox and confirm `data/monitor.pid` is removed.

## Release Build

Task 5 adds the signed release entrypoint:

```bash
./build.sh 1.0.0
```

The release build will:

1. Run `python3 setup.py py2app`.
2. Sign `dist/Detox.app` with hardened runtime.
3. Submit the app zip to `notarytool`.
4. Staple the notarization ticket.
5. Build and sign `dist/Detox-1.0.0.dmg`.
6. Print the DMG SHA256 for release notes and Homebrew cask updates.

## Sparkle Public Key

`Info.plist.tmpl` keeps `__SPARKLE_PUB_KEY__` as a placeholder until Task 6 wires Sparkle. The public key will live in `infra/build/sparkle.pub`; the private key stays off-repo.

The appcast URL is:

```text
https://detox.app/appcast.xml
```

The appcast and signed DMGs are published to the static release bucket fronted by Cloudflare Pages.

## Icon

`icon.icns` is a placeholder Dawn Cove lighthouse mark. Final app art should replace it before public launch.
