import 'dotenv/config';
import express from 'express';
import path from 'path';
// AUDIT FIX (#88/#89): vite used to be a TOP-LEVEL static import here. Because
// esbuild bundles server.ts with --packages=external, that turned the heavy
// build-time-only dev tool into a hard runtime dependency of the production
// bundle: any deployment that installs with `npm ci --omit=dev` (or otherwise
// prunes vite) crashed at startup with "Cannot find module 'vite'" — even
// though NODE_ENV=production never touches the dev middleware branch below.
// It is now loaded lazily via dynamic import ONLY in the non-production
// branch, so the production code path has zero reference to vite.
import { handleLabDataApi } from './server/labDbMiddleware';
import * as labDb from './server/labDbServer';
import { assertSessionSecretConfigured, getDatabaseState } from './server/labDbServer';
import { PROJECT_ROOT } from './server/pathUtils';
import { isTrustProxyEnabled } from './server/rateLimit';
import { createGeminiRouter, configureGeminiAuth } from './server/geminiApi';
import { securityHeaders } from './server/securityHeaders';

// SECURITY FIX (audit #10): geminiApi keeps its token verifier behind an
// injectable seam so the middleware bundle never imports the full Express
// server module. The seam used to be left unwired — verifyTokenImpl stayed
// null and geminiGuard answered 401 for EVERY request, silently disabling the
// whole AI feature (fail-closed, so no key leak, but broken and misleading).
// Wire it with the exact same verifySessionToken the lab-data API uses,
// BEFORE the router is mounted below.
configureGeminiAuth((token: string) => {
  const payload = labDb.verifySessionToken(token);
  return payload ? { userId: payload.userId, role: payload.role } : null;
});

// Expose the DB layer on the bundle's CommonJS exports so integration tests
// (tests/credential-repair.test.cjs) can exercise the EXACT production code
// from dist/server.cjs. Harmless for normal HTTP serving.
export const __testables = labDb;

// SECURITY: fail fast at real server startup (not at import/build time) if the
// session HMAC secret is missing or too short in production.
assertSessionSecretConfigured();

async function startServer() {
  const app = express();

  // SECURITY FIX: the rate limiter in server/rateLimit.ts reads X-Forwarded-For
  // only when TRUST_PROXY=1 is set in .env (i.e. this app sits behind nginx on
  // the same machine, which overwrites client-supplied XFF). When TRUST_PROXY
  // is enabled we must ALSO tell Express to trust the proxy hop, so req.ip and
  // any framework-level middleware see the real client IP instead of 127.0.0.1.
  if (isTrustProxyEnabled()) {
    app.set('trust proxy', 1);
  }

  // AUDIT FIX (#82): PORT is now the single canonical value everywhere:
  // .env.example (PORT=3000), ecosystem.config.cjs (PORT=3000), this default,
  // and deploy/nginx-azmajahanbin.conf (upstream 127.0.0.1:3000). Previously
  // PM2 forced 5000 while this file defaulted to 3000 — if the env override
  // was ever dropped or forgotten, the app came up on 3000 and nginx returned
  // 502 for the whole site.
  const argvPortIndex = process.argv.indexOf('--port');
  const cliPort = argvPortIndex !== -1 && process.argv[argvPortIndex + 1] ? Number(process.argv[argvPortIndex + 1]) : NaN;
  const rawPort = Number.isFinite(cliPort) && cliPort >= 0 ? cliPort : Number(process.env.PORT);
  const PORT = Number.isFinite(rawPort) && rawPort >= 0 && rawPort < 65536 ? rawPort : 3000;

  const argvHostIndex = process.argv.indexOf('--host');
  const cliHost = argvHostIndex !== -1 && process.argv[argvHostIndex + 1] ? process.argv[argvHostIndex + 1] : '';
  const HOST = cliHost || process.env.HOST || '0.0.0.0';

  // SECURITY FIX (audit B3/CSP): hardened HTTP headers (CSP, HSTS, frame and
  // referrer policy, cache discipline for index.html) on every response.
  app.use(securityHeaders);

  // Middleware for parsing JSON. Limit is configurable (default 5mb) — the old
  // hard-coded 15mb was a DoS risk; large base64 payloads should go through the
  // dedicated upload path or external storage instead.
  app.use(express.json({ limit: process.env.MAX_BODY_SIZE || '5mb' }));

  // API Health Check (also exposes the DB last-update time so clients can use
  // this cheap endpoint as a sync heartbeat instead of polling /api/lab-data)
  app.get('/api/health', (req, res) => {
    let lastDbUpdate: number | string | null = null;
    try {
      lastDbUpdate = getDatabaseState().lastUpdated ?? null;
    } catch { /* non-critical */ }
    res.json({ status: 'ok', time: new Date().toISOString(), lastDbUpdate });
  });

  // Mount Laboratory Database Central Persistent API
  app.use((req, res, next) => {
    if (req.url && (
      req.url.startsWith('/api/lab-data') || 
      req.url.startsWith('/api/login') || 
      req.url.startsWith('/api/verify-otp') || 
      req.url.startsWith('/api/resend-otp') ||
      req.url.startsWith('/api/me') ||
      // FIX (routing gate): /api/logout and /api/refresh are handled by
      // handleLabDataApi (see server/labDbMiddleware.ts) but were missing from
      // this allow-list, so in production they fell through to the SPA
      // fallback and returned index.html instead of revoking sessions.
      req.url.startsWith('/api/logout') ||
      req.url.startsWith('/api/refresh')
    )) {
      handleLabDataApi(req, res, next);
      return;
    }
    next();
  });

  // SECURITY FIX #2 + audit fix: /api/gemini/* now require a valid session token and a
  // per-IP budget. The guard, validation and handlers live in
  // server/geminiApi.ts so dev (Vite plugin) and prod (Express) share one copy.

  // Shared Gemini endpoints (single source of truth for BOTH the Express
  // production server and the Vite dev-server plugin — see server/geminiApi.ts).
  app.use(createGeminiRouter());

  // Vite middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== 'production') {
    // AUDIT FIX (#88/#89): dynamic import — vite is only ever loaded on the
    // dev path. The production bundle never resolves the 'vite' module, so it
    // can run in installs that omit devDependencies.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // FIX #1 (VPS): resolve dist/ relative to the real project root, not cwd.
    const distPath = path.join(PROJECT_ROOT, 'dist');
    app.use((req, res, next) => {
      if (req.path.startsWith('/server.cjs')) {
        res.status(404).end();
        return;
      }
      next();
    });
    app.use(express.static(distPath));
    // SECURITY FIX (audit #26): unknown /api/* routes must NOT fall through
    // to the SPA index.html — clients calling res.json() on such a response
    // crash with "SyntaxError: Unexpected token <". Return a proper 404 JSON
    // for any unmatched API path before the catch-all handler.
    app.use('/api', (req, res) => {
      res.status(404).json({ success: false, error: `Unknown API route: ${req.method} ${req.originalUrl}` });
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // FIX (boot-warming / test bootstrap): await the FULL async load pipeline
  // (fs.promises cold-read → repairCorruptedCredentials → enforceSoleAdminRules
  // → seed merge → single atomic persist) BEFORE the server starts accepting
  // connections and before startServer() resolves. Two reasons:
  //  1. Production: traffic that arrives in the first milliseconds would hit
  //     the sync getDatabaseState() fallback, which normalizes but NEVER
  //     persists (audit #42 anti-restart-loop rule) — corrupted credentials
  //     would then be re-derived on every request and never healed on disk.
  //  2. Tooling/tests: tests/credential-repair.test.cjs requires this bundle
  //     as a library and immediately inspects state + disk from a short-lived
  //     `node -e` process. Without awaiting here, the event loop drained and
  //     the process exited while the async load was still in flight, so the
  //     repair/persist assertions could not observe their effects.
  // The loader is idempotent and memoized (cachedState + shared in-flight
  // promise), so this costs one cold read at startup and nothing afterwards.
  await labDb.loadDatabaseStateAsync();

  const listener = app.listen(PORT, HOST, () => {
    console.log(`BetonLab Central Server running on http://${HOST}:${PORT}`);
  });

  // FIX (testability): when the bundle is require()'d by regression tests
  // (tests/credential-repair.test.cjs) or running with PORT=0, close the listener
  // so tooling never fights over ports. In PM2 or normal production runs,
  // require.main is the entry module and the server MUST stay listening.
  const isRunningUnderPm2 = typeof process.env.pm_id !== 'undefined';
  const isLibraryImport = typeof require !== 'undefined' && require.main && require.main !== module;
  const isTestRunner = Boolean(process.env.LAB_DATA_ROOT || process.env.IS_TEST_SUITE || process.env.PORT === '0');
  if (!isRunningUnderPm2 && (isLibraryImport || isTestRunner)) {
    listener.close();
  }
}

startServer().catch(err => {
  console.error('Fatal Server Error:', err);
  process.exit(1);
});
