# Preview Release Smoke

Run this checklist before uploading an unsigned GitHub preview release. Capture any failure mode and fix it before publishing the assets.

## 1. Build assets

```bash
cd infra/build
./preview.sh <version>
```

Expected outputs:

- `dist/Detox-preview-<version>.dmg`
- `dist/Detox-preview-<version>.app.zip`
- SHA256 lines for both assets

Record the SHA256 values in the GitHub Release notes.

## 2. Clean install path

- [ ] Download `Detox-preview-<version>.dmg` from a local draft release or copied artifact, not from `dist/`.
- [ ] Open the DMG and drag `Detox.app` into `/Applications`.
- [ ] First launch: right-click `Detox.app`, choose **Open**, then confirm the unsigned-app warning.
- [ ] The menu-bar lantern appears.
- [ ] macOS prompts for Accessibility, or Detox shows the denied state until you grant it.
- [ ] Grant **System Settings -> Privacy & Security -> Accessibility -> Detox**.

Repeat with `Detox-preview-<version>.app.zip` if the DMG path fails or if GitHub/browser download behavior changes.

## 3. Local app smoke

- [ ] Click the menu-bar lantern and choose **Open Dashboard**.
- [ ] `http://localhost:5050` opens.
- [ ] Visit every section: Isle, Residents, Chronicle, Charter, Rule Board, Market, Postcards, Study.
- [ ] Leave Detox running for at least 60 seconds.
- [ ] Refresh the Isle and confirm today's total is non-zero.
- [ ] Toggle **Pause tracking**. The glyph changes and today's total stops increasing.
- [ ] Toggle resume. Tracking resumes.
- [ ] Quit Detox from the menu bar.
- [ ] `data/monitor.pid` is removed after quit.

## 4. Optional cloud smoke

Run this only if the preview release points users at a live hosted dashboard.

- [ ] Open the hosted dashboard and sign in.
- [ ] Visit `/pair.html`; a 6-character code appears.
- [ ] Pair the installed app with `python3 -m agent.cli.pair` from the same checkout or with the bundled pairing flow if available.
- [ ] **Sync now** posts usage successfully.
- [ ] The hosted Isle shows the Mac's data within 5 minutes.

## 5. Publish gate

Do not publish the release if any of these are true:

- [ ] The app cannot launch with the documented right-click **Open** flow.
- [ ] Accessibility permission is granted but usage remains empty after 60 seconds.
- [ ] **Open Dashboard** does not reach `localhost:5050`.
- [ ] Quit leaves a stale `data/monitor.pid`.
- [ ] Release notes do not include the unsigned-build warning and SHA256 values.
