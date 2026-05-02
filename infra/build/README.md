# Detox Agent Build

This directory owns the local macOS app bundle pipeline for Phase 3.

## Prerequisites

- Python 3.11.
- Runtime dependencies from the repo root: `python3 -m pip install -r requirements.txt`.
- `py2app>=0.28` for bundle creation.
- Apple Developer ID Application certificate installed in the build machine keychain.
- `notarytool` keychain profile named `detox-notary`.
- Sparkle EdDSA key pair generated with Sparkle's `generate_keys` tool.
- Sparkle private key stored outside the repo, preferably in 1Password.

The certificate, notarization profile, Sparkle framework, and private key are release blockers. Alias builds do not require them.

Sparkle is pinned to 2.9.1. Download the official release archive and unpack the framework and tools into this directory:

```bash
curl -L -o /tmp/Sparkle-2.9.1.tar.xz \
  https://github.com/sparkle-project/Sparkle/releases/download/2.9.1/Sparkle-2.9.1.tar.xz
shasum -a 256 /tmp/Sparkle-2.9.1.tar.xz
tar -xJf /tmp/Sparkle-2.9.1.tar.xz -C infra/build ./Sparkle.framework ./bin/sign_update ./bin/generate_keys
```

Expected archive SHA256:

```text
c0dde519fd2a43ddfc6a1eb76aec284d7d888fe281414f9177de3164d98ba4c7
```

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

Run the signed release entrypoint:

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

The default signing identity is a placeholder:

```text
Developer ID Application: Mason Cao (TEAMID)
```

Override it on the command line once the real certificate exists:

```bash
DEVELOPER_ID="Developer ID Application: Mason Cao (ABCD123456)" ./build.sh 1.0.0
```

Until the certificate is installed, `./build.sh 1.0.0` is expected to fail after the py2app step with:

```text
error: codesign identity not found
```

`notarize.sh` can be re-run directly after certificate or notarization-profile changes:

```bash
KEYCHAIN_PROFILE=detox-notary ./notarize.sh dist/Detox.app
```

## Sparkle Public Key

`Info.plist.tmpl` keeps `__SPARKLE_PUB_KEY__` as a placeholder until Task 6 wires Sparkle. The public key will live in `infra/build/sparkle.pub`; the private key stays off-repo.

Generate keys with the vendored tool:

```bash
infra/build/bin/generate_keys
```

Write the public key to `infra/build/sparkle.pub`. `build.sh` copies `Info.plist.tmpl` into `build/Info.plist` and substitutes that key before running py2app. If `sparkle.pub` is absent, the placeholder remains so unsigned dev builds still work.

Sign a DMG for an appcast enclosure:

```bash
SPARKLE_PRIV_KEY=/path/to/ed25519_private_key ./sparkle_sign.sh dist/Detox-1.0.0.dmg
```

The appcast URL is:

```text
https://detox.app/appcast.xml
```

The appcast and signed DMGs are published to the static release bucket fronted by Cloudflare Pages.

## Icon

`icon.icns` is a placeholder Dawn Cove lighthouse mark. Final app art should replace it before public launch.
