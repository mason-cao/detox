# Privacy Policy

**Effective:** 2026-05-07
**Version:** 1.0 (Phase 5 — private beta)

This is the privacy policy for Detox, the macOS screen-time tracker
("Detox", "we", "the app"). It is short on purpose. Read all of it.

## What we collect

The Detox agent runs on your Mac and polls the frontmost application
every 2 seconds. Each poll records:

- the application name (e.g. `Slack`)
- a Unix timestamp
- a derived calendar date (so we don't need to recompute it on every read)

The agent also writes:

- **sessions** (start time, end time, app) for visualization
- **pickups** (timestamps of context switches) for the "checking every X
  minutes" stat
- **goals**, **blocks**, **categories**, **settings** that you configure
- **rewards ledger** entries when you spend or refund Sunlight or
  Starshards in the Market
- **milestone awards** when you hit a streak

We do **not** collect window titles, URLs, keystrokes, screenshots,
clipboard contents, file paths, contacts, location, or anything from
other applications.

## Where it lives

By default everything is in a single SQLite file on your Mac at
`~/<your detox install>/data/screentime.db`. Nothing leaves your
machine until you pair the agent to a hosted account.

Once paired:

- Sessions, app usage, pickups, blocks, goals, settings, rewards, and
  milestones flush to a hosted Postgres database every 5 minutes.
- All transport is TLS 1.3.
- Database is encrypted at rest by the cloud provider.
- Each row is scoped to your `user_id` and isolated via Postgres
  row-level security.

## Ghost Mode

Ghost Mode is an opt-in toggle in the Mayor's Study. With it on, the
agent hashes app names before they leave your Mac:

- The hash is `SHA-256(salt + ":" + app_name)`, truncated to 8 hex
  characters and prefixed with `resident-`. Example: `resident-9a3f1c0b`.
- The salt is generated locally the first time you enable Ghost Mode and
  stored in your SQLite settings. It never leaves your device.
- Your local dashboard still shows real names because it reads SQLite
  directly. Only the cloud sees hashes.

Known limitations of v1 Ghost Mode:

- **Per-device salt.** If you pair more than one Mac, each generates its
  own salt. The same real app produces different hashes per device, so
  multi-device aggregation under Ghost Mode is broken in the v1 beta.
- **Not retroactive.** Rows ingested *before* you turn Ghost Mode on
  remain in cleartext on the server. Disabling Ghost Mode does not
  rotate hashes.
- **Local data is unaffected.** Ghost Mode only applies to data leaving
  the device. Local exports and cards still contain real app names.

## Telemetry

Detox does not currently run any telemetry, analytics, or
error-reporting service. Errors surface in the local agent log
(`data/monitor.log`) and the hosted API's deploy logs.

We do not run ad networks, third-party trackers, session replay, or
fingerprinting on the dashboard. If we ever add crash reporting or
aggregate page-view counts we will note it here and bump the version
above.

## Cookies and local storage

The dashboard uses local storage to remember your dark-mode preference,
the last tab you visited, and (when paired) your Supabase session JWT.
That is the entire footprint. We set no third-party cookies.

## Retention

- **Local data** lives on your Mac for as long as you keep it.
- **Cloud data** lives until you delete it. We do not auto-prune.

## Your rights

You can:

- **Export everything.** Mayor's Study → Data Export → Download Archive
  ships every row in your account as a single JSON file. Hits the local
  agent when running locally and the hosted API when paired.
- **Delete everything.** Mayor's Study → Danger Zone → Delete Everything.
  Wipes every session, decree, reward, and milestone. The cloud version
  cascades from your `users` row, so a single statement empties your
  footprint.
- **Stop tracking** at any time by quitting the agent (`./stop.sh` or
  the menubar Quit).

Deleting your cloud data does *not* delete your Supabase auth user. To
fully revoke your account, sign out from the Mayor's Study, then delete
your authentication record from your Supabase identity provider.

## Children

Detox is not directed at children under 13 and we do not knowingly
collect data from them.

## Changes

We will note material changes here and bump the version at the top.
Material change = scope of collection grows, retention extends, or a
new sub-processor receives data.

## Contact

For privacy questions or deletion requests email
[masoncao7@gmail.com](mailto:masoncao7@gmail.com).
