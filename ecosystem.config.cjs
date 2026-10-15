// PM2 process definition for azmajahanbin.ir (VPS deployment)
// Usage on the server:
//   cp .env.example .env   # then fill in SESSION_SECRET, GEMINI_API_KEY, ...
//   npm ci --omit=dev      # prod install (the bundle no longer needs vite — audit #88/#89)
//   npm run build          # emits dist/ (frontend + dist/server.cjs)
//   pm2 start ecosystem.config.cjs && pm2 save
//
// AUDIT FIX (#83): this file previously carried NO TRUST_PROXY / ALLOWED_ORIGINS,
// while deploy/deployment-checklist.md demanded both. A "standard" PM2 deploy
// (`pm2 start ecosystem.config.cjs`) therefore came up without X-Forwarded-For
// trust (rate limiter spoofable / useless behind nginx) and without a CORS
// allow-list (every cross-origin API call denied). Those two variables are now
// declared here with safe defaults; the actual SECRETS (SESSION_SECRET,
// ADMIN_INITIAL_PASSWORD, ADMIN_BOOTSTRAP_TOKEN, GEMINI_API_KEY) intentionally
// stay ONLY in the untracked .env on the server — never in this committed file.
module.exports = {
  apps: [
    {
      name: 'azmajahanbin-lab',
      script: 'dist/server.cjs',
      cwd: __dirname,
      instances: 1, // single instance: state lives in data/laboratory_db.json + SSE clients
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // AUDIT FIX (#82): PORT unified to 3000 everywhere — .env.example,
        // server.ts default, Dockerfile EXPOSE and the nginx upstream all use
        // 3000 now. The old value (5000) conflicted with the server.ts default
        // (3000): if this override was ever dropped/forgotten the app booted
        // on 3000 and nginx returned 502 for the entire site.
        PORT: 3000,
        // Behind the nginx reverse proxy on the same host: the rate limiter
        // (server/rateLimit.ts) reads X-Forwarded-For only when this is set,
        // and Express enables `trust proxy` accordingly. Keep at 1 whenever
        // traffic arrives through nginx; set to 0 only if the app is exposed
        // directly (then client IPs come straight from the socket).
        TRUST_PROXY: '1',
        // CORS allow-list (comma-separated exact origins). MUST be replaced
        // with the real public origin(s) before go-live — e.g.
        // ALLOWED_ORIGINS=https://azmajahanbin.ir,https://www.azmajahanbin.ir
        // Leaving it empty means same-origin browser traffic still works, but
        // any cross-origin browser request is rejected by design (fail-closed).
        ALLOWED_ORIGINS: '',
        // SESSION_SECRET / ADMIN_INITIAL_PASSWORD / ADMIN_BOOTSTRAP_TOKEN /
        // GEMINI_API_KEY must come from a real .env file on the server —
        // never commit them here. The server refuses to start in production
        // without a strong SESSION_SECRET (assertSessionSecretConfigured()).
      },
      // AUDIT FIX (#82): raised from 400M. The DB layer keeps the full parsed
      // dataset (including base64 media items) in memory; on a large dataset
      // a tight limit caused PM2 kill/restart cycles (OOM-thrash) instead of
      // healthy operation. Tune this to ~2x the observed RSS of a warm process
      // once the production dataset size is known (see deployment checklist).
      max_memory_restart: '1G',
      autorestart: true,
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
