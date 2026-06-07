# Detox Preview <version>

Public GitHub preview for Detox Isle. This release is intended for Mac users who are comfortable installing from GitHub while signed Developer ID builds are still pending.

## Downloads

- `Detox-preview-<version>.dmg` — primary Mac preview package
- `Detox-preview-<version>.app.zip` — fallback package if the DMG path has trouble

## SHA256

```text
<sha256>  Detox-preview-<version>.dmg
<sha256>  Detox-preview-<version>.app.zip
```

## Install

1. Download `Detox-preview-<version>.dmg`.
2. Open the DMG and drag `Detox.app` into `/Applications`.
3. First launch attempt: double-click `Detox.app` and let macOS show the unsigned-app warning.
4. Open **System Settings -> Privacy & Security**, scroll down to **Security**, then click **Open Anyway** for Detox.
5. Confirm the follow-up unsigned-app warning.
6. Grant Accessibility: **System Settings -> Privacy & Security -> Accessibility -> Detox**.
7. Click the menu-bar lantern and choose **Open Dashboard**.

If the DMG does not work, download `Detox-preview-<version>.app.zip`, unzip it, move `Detox.app` into `/Applications`, then use the same **Open Anyway** flow.

## Unsigned Build Notice

This preview build is unsigned. macOS will warn that the developer cannot be verified. Signed and notarized builds are planned once Detox has an Apple Developer ID.

## What's Included

- Menu-bar Detox app with pause/resume, dashboard, logs, launch-at-login, cloud pairing, sync, and sign-out controls.
- Local-first screen-time tracking using the Mac's frontmost app.
- Detox Isle dashboard, clickable isometric buildings, residents, goals, blocks, market rewards, postcards, privacy controls, export, and delete.
- Programmatic SVG villager residents with closed local walking routes that avoid building footprints.
- Generated SVG item previews across the 100-item market catalog; no bitmap catalog or resident sprite atlas dependency.
- Optional hosted dashboard pairing for users running a compatible cloud deployment.

## Known Limitations

- The app is unsigned and must be opened with the documented **Open Anyway** flow.
- macOS Accessibility permission is required before usage appears.
- Sparkle auto-update is not active for unsigned preview builds.
- Homebrew cask distribution is deferred until signed builds exist.
