# Deployment Checklist — azmajahanbin.ir (VPS + PM2 + nginx)

Canonical values (must stay identical everywhere — audit #82/#84):

| Setting                | Canonical value                                   | Defined in |
|------------------------|---------------------------------------------------|------------|
| App port               | `3000`                                            | `.env.example`, `ecosystem.config.cjs`, `server.ts` default, `deploy/nginx-azmajahanbin.conf` upstream |
| Frontend build output  | project-root `dist/` (vite build; NO `dist/client`) | `server.ts` (`path.join(PROJECT_ROOT,'dist')`), nginx header comment |
| Process manager        | PM2, single fork instance                         | `ecosystem.config.cjs` |
| Node version           | 22.x (`engines: ">=20 <23"`)                      | `package.json`, `Dockerfile`, CI |

## 1. Server preparation
- [ ] Node 22 installed (`node -v` → v22.x).
- [ ] `git clone` / pull to `/var/www/azmajahanbin` (or equivalent).
- [ ] `npm ci` then `npm run build` (emits `dist/` incl. `dist/server.cjs`).

## 2. Secrets & environment (audit #81/#83/#95) — REQUIRED
Create `.env` from `.env.example` and fill in REAL values — never keep the
template placeholders or copy secrets between environments:

- [ ] `SESSION_SECRET` — generate a fresh one per environment:
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
      (≥ 64 hex chars; the server refuses to boot in production without it.)

      ⚠️ WARNING — `/path/to/deploy` in this snippet is a PLACEHOLDER. If you paste
      the block as-is, `cd` fails ("No such file or directory") but bash keeps
      running the remaining lines: the key silently lands in `$PWD/.env`
      (typically `/root/.env`) — the wrong file — while the app's own `.env` stays
      empty. Because `dotenv/config` resolves `.env` against the process CWD
      (`cwd: __dirname` in ecosystem.config.cjs), PM2 never sees the stray key and
      the app boots without SESSION_SECRET → every restart mints a new signing key
      and invalidates all sessions/refresh tokens.

      Use this fail-safe version instead (run from anywhere):

      ```bash
      APP_DIR=$(pm2 describe azmajahanbin-lab | sed -n 's/.*\[exec cwd\]: *//p' | tr -d "'\" ")
      [ -f "$APP_DIR/package.json" ] || { echo "cannot resolve app dir — set APP_DIR manually"; exit 1; }
      cd "$APP_DIR" || exit 1
      test -f .env || { echo "no .env in $APP_DIR (cp .env.example .env first)"; exit 1; }
      if grep -Eq '^\s*SESSION_SECRET\s*=\s*\S' .env; then
        echo "SESSION_SECRET already set in $APP_DIR/.env — leaving it alone."
        echo "(Rotating it now would log out every user. Only rotate if compromised.)"
        exit 0
      fi
      # drop any empty/duplicate placeholder lines so dotenv can't mis-parse them
      sed -i '/^\s*SESSION_SECRET\s*=\s*$/d' .env
      KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
      printf 'SESSION_SECRET=%s\n' "$KEY" >> .env && chmod 600 .env
      grep -c '^SESSION_SECRET=' .env   # MUST print exactly 1
      pm2 restart azmajahanbin-lab --update-env
      ```

      Verify it actually took effect (two independent checks):

      ```bash
      PID=$(pm2 pid azmajahanbin-lab)
      sudo tr '\0' '\n' < /proc/$PID/environ | grep -c '^SESSION_SECRET='  # 1 = exported
      pm2 logs azmajahanbin-lab --lines 40 --nostream | grep -E 'FATAL|SECURITY'
      # clean output = no match. "[FATAL] SESSION_SECRET ..." means the app still
      # has no key; "[SECURITY] ... persistent fallback secret" means it fell back.
      ```

      Also clean up the stray file created by the failed `cd`:
      `rm -f /root/.env` (or move its key into the real `$APP_DIR/.env` FIRST,
      then delete — otherwise the two files hold different keys and future
      debugging gets confusing). Never keep two `.env` files around.
- [ ] `GEMINI_API_KEY` — from https://aistudio.google.com/apikey (leave empty if AI features unused).
- [ ] `ADMIN_INITIAL_PASSWORD` — strong unique password for the first admin login;
      remove from `.env` after first boot.
- [ ] `ADMIN_BOOTSTRAP_TOKEN` — only for out-of-band recovery:
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
      remove from `.env` once recovery is done.
- [ ] `TRUST_PROXY=1` — app sits behind nginx on the same host. **Without it the
      rate limiter reads the socket IP (always 127.0.0.1) and is trivially
      spoofable/bypassed.** Already declared in `ecosystem.config.cjs`; verify it
      survives if you switch to a bare `node dist/server.cjs` systemd unit.
- [ ] `ALLOWED_ORIGINS=https://azmajahanbin.ir,https://www.azmajahanbin.ir` —
      CORS allow-list. Empty = fail-closed (cross-origin browser calls rejected).
      Also declared in `ecosystem.config.cjs`.
- [ ] `NODE_ENV=production`, `PORT=3000`.
- [ ] `chmod 600 .env` and confirm `.env` is git-ignored (it is).

## 3. PM2
- [ ] `pm2 start ecosystem.config.cjs && pm2 save`
      (the file already sets `NODE_ENV`, `PORT=3000`, `TRUST_PROXY=1`,
      `ALLOWED_ORIGINS` — audit #83; secrets come ONLY from `.env`).
- [ ] `pm2 startup` + `pm2 unstartup` tweaks as needed for reboot survival.
- [ ] Check `max_memory_restart` (currently `1G`): the DB layer keeps the full
      parsed dataset (incl. base64 media) in memory. Once the production
      dataset size is known, set this to ≈2× the observed warm RSS:
      `pm2 monit` → note RSS → edit `ecosystem.config.cjs` → `pm2 reload`.
      A limit BELOW real working-set causes kill/restart cycles (audit #82).

## 4. nginx (TLS) — audit #85
- [ ] Install certbot: `sudo apt install certbot python3-certbot-nginx`.
- [ ] `sudo certbot --nginx -d azmajahanbin.ir -d www.azmajahanbin.ir`
      (or point `ssl_certificate`/`ssl_certificate_key` at real files — the
      443 block will NOT load without them).
- [ ] `sudo nginx -t` MUST pass before `systemctl reload nginx` (CI runs the
      same gate with placeholder certs).
- [ ] Verify upstream target is `127.0.0.1:3000` (matches app port).

## 5. Post-deploy verification
- [ ] `curl -s http://127.0.0.1:3000/api/health` → `{"status":"ok",...}`.
- [ ] `curl -skI https://azmajahanbin.ir/` → 200, HSTS + CSP headers present.
- [ ] Login as admin with `ADMIN_INITIAL_PASSWORD`, change it, then delete the
      variable from `.env` and `pm2 reload`.
- [ ] Confirm `data/laboratory_db.json` lastUpdated is NOT a future timestamp
      (server clamps skew at load — audit #94 — but check clock/NTP anyway:
      `timedatectl status`).
- [ ] `npm run lint` and `npm run test:credentials` green in CI before merge.
