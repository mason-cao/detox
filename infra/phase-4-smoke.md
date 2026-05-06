# Phase 4 — first-deploy smoke

Run through this once Railway and Cloudflare Pages are live. Each step is a yes/no check; capture the failure mode if any step is "no" and fix-on-find before flipping the cloud on for general use.

## Prerequisites

- Supabase project created. Anon key + URL noted. Magic-link provider enabled.
- Railway project running. Postgres + Redis attached. Env vars set per `infra/railway/README.md`.
- `alembic upgrade head` has been run against the Railway Postgres (`railway run --service api -- alembic -c api/alembic.ini upgrade head`).
- Cloudflare Pages project linked to the repo, with build command `infra/cloudflare/build.sh`, output dir `web`, env vars set, `app.detox.app` mapped.
- DNS: `app.detox.app` → Cloudflare CNAME, `api.detox.app` → Railway custom domain.

## 1. Health probes

```bash
curl -s https://api.detox.app/healthz | jq .
# → {"ok": true, "service": "Detox API", ...}

curl -i https://app.detox.app/config.js | head -5
# → 200, body sets window.DETOX_SUPABASE_URL etc.
```

## 2. Remote sign-in

- [ ] Visit `https://app.detox.app/` in a fresh browser. You're bounced to `/sign-in.html`.
- [ ] Enter your email. The page says "Check your email."
- [ ] The magic-link email arrives, opens in the browser, and lands you on `/`.
- [ ] DevTools → Network shows `Authorization: Bearer <jwt>` on every `/v1/*` request.
- [ ] The Isle renders empty — no app data yet.

## 3. Pair the local agent

- [ ] On the deployed web app, navigate to `/pair.html`. A 6-character code appears.
- [ ] On the Mac you want to track, run `python3 -m agent.cli.pair` and paste the code.
- [ ] CLI prints `✓ Paired as <hostname>`.
- [ ] The web `/pair.html` flips to `✓ paired <hostname>` within 5 s.
- [ ] Open the Detox menubar app. The "Cloud:" line says paired.
- [ ] Within 5 minutes, `/api/dashboard` on the web shows real usage from the Mac.
- [ ] `Sync now` in the menubar reports `ok: <n> posted`.

## 4. Rules round-trip

- [ ] In the web Charter, set a daily-total goal of 120 minutes.
- [ ] Within 30 s the menubar's "Last sync" updates.
- [ ] `python3 -c "from agent import database as db; print(db.get_db().__enter__().execute('SELECT * FROM cloud_goals').fetchall())"` shows the goal.
- [ ] On the Mac, opening a blocked app force-quits it (only matters if you set a block at the same time).

## 5. Rewards

- [ ] `curl -H "Authorization: Bearer <token>" https://api.detox.app/v1/rewards/balances` returns the same `sunlight` count the web HUD shows.
- [ ] Buy any item from the web Market.
- [ ] Sunlight goes down by the item price; inventory updates on a refresh.
- [ ] Same data visible from a second browser signed into the same account.

## 6. Privacy + auth sweep

- [ ] No `Authorization` header → 401 from every `/v1/*` endpoint:

  ```bash
  for path in /v1/rules /v1/ingest /v1/rewards/balances /v1/devices; do
      printf "%-30s %s\n" "$path" "$(curl -s -o /dev/null -w '%{http_code}' https://api.detox.app$path)"
  done
  ```
  Expected: all `401`.

- [ ] CORS rejects `https://evil.com`:

  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS \
      -H "Origin: https://evil.com" \
      -H "Access-Control-Request-Method: GET" \
      https://api.detox.app/v1/rules
  # → no allow-origin header in the response
  ```

- [ ] App names do not appear in the Railway logs (`railway logs --service api`). Errors are scrubbed; nothing user-identifying leaks.

## 7. Rate limit

- [ ] Hammering `/v1/ingest` past 60 req/min/device returns `429`. Verifies Redis and the rate-limit wiring.

## If a step fails

Capture the request/response, fix the underlying bug, and commit as `fix(phase-4): <what>`. The plan called this Step 7 of Task 11; the cadence is "fix-on-find, commit only if anything changes."
