import { IncomingMessage, ServerResponse } from 'http';
import { 
  getDatabaseState, 
  syncFullDatabase, 
  updateUserPassword, 
  addDispatch, 
  updateDispatchStatus,
  addCustomer,
  addProfileServer,
  updateProfileServer,
  updateUserRoleServer,
  deleteProfileServer,
  registerCustomerAccount,
  syncCollection,
  withDbWrite,
  addSseClient,
  removeSseClient,
  sendSseHeartbeat,
  resetDatabaseToDefaults,
  restoreFromBackup,
  setSessionUser,
  getCollectionVersion,
  getAllCollectionVersions,
  sanitizeDatabaseState,
  sanitizeProfile,
  verifyReportForPublic,
  authenticateUser,
  generateSessionToken,
  verifySessionToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeSessionToken,
  revokeAllUserSessions,
  revokeRefreshTokenByPayload,
  createPendingOtp,
  verifyPendingOtp,
  resendPendingOtp,
  isLegacyDefaultChoice,
  normalizeIncomingPassword,
  hasNoUsableStoredCredential,
  findUserByIdentifier,
  verifyPassword,
  toEnglishDigits,
  tryBootstrapAdminPassword,
  listBackups,
  restoreNamedBackup,
  findProfileById,
  getSanitizedCollection,
  recordCustomerPaymentNotification,
  TokenPayload
} from './labDbServer';

import crypto from 'crypto';
// SECURITY FIX #3: single shared rate limiter with spoof-proof client-IP
// resolution. The old local copy trusted the FIRST X-Forwarded-For entry,
// which any client can forge — every per-IP limit was trivially bypassable.
// getClientIp() now honors XFF/X-Real-IP ONLY when TRUST_PROXY=1 is set
// (nginx on the same host overwrites those headers); otherwise it uses the
// socket peer address. See server/rateLimit.ts and deploy/nginx config.
import { getClientIp, checkRateLimit } from './rateLimit';
import { sendSmsOtp } from './smsService';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Security headers applied to every API response
function applySecurityHeaders(res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
}

// Setup periodic heartbeat to prevent proxy timeout.
// Guarded by a module-level boolean flag so that even if this middleware is
// imported/mounted more than once (e.g. dev + prod bundle), only ONE interval
// is ever created — avoids duplicated SSE heartbeat traffic.
let heartbeatStarted = false;
function ensureSseHeartbeat() {
  if (heartbeatStarted) return;
  heartbeatStarted = true;
  const timer = setInterval(() => {
    sendSseHeartbeat();
  }, 20000);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}
ensureSseHeartbeat();

// Helper to parse JSON body
function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'object') return resolve(req.body);
      if (typeof req.body === 'string') {
        try { return resolve(req.body.trim() ? JSON.parse(req.body) : {}); }
        catch (e) { return reject(e); }
      }
    }

    // SECURITY FIX (audit #17): enforce a hard size cap on the raw stream
    // (express.json's limit does not apply on the Vite-dev middleware path)
    // and clear the fallback timer on completion/error so it cannot fire
    // late or leak.
    const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB — generous for base64 media syncs
    let receivedBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (body) {
        try { resolve(JSON.parse(body)); } catch (e) { resolve({}); }
      } else if (req.complete || req.readableEnded) {
        resolve({});
      } else {
        reject(new Error('Request body read timed out'));
      }
    }, 1500);

    let body = '';
    req.on('data', (chunk: any) => {
      if (settled) return;
      receivedBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : (chunk?.length || 0);
      if (receivedBytes > MAX_BODY_BYTES) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('Request body too large'));
        req.destroy?.();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', (err: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Extract and verify HMAC session token from Authorization or X-Session-Token headers
function extractAuthUser(req: IncomingMessage): TokenPayload | null {
  const authHeader = req.headers['authorization'];
  let token = '';
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token'] && typeof req.headers['x-session-token'] === 'string') {
    token = req.headers['x-session-token'].trim();
  }

  if (!token) return null;
  return verifySessionToken(token);
}

// BUG FIX (mass-logout #3): role gates used to answer a bare 403 for BOTH
// "no/invalid/expired token" and "wrong role". The client's authedFetch only
// retried on 401, so an expired session surfaced as "دسترسی غیرمجاز" and the
// user's work was lost instead of the session being refreshed transparently.
// Now: unauthenticated/expired -> 401 UNAUTHENTICATED (triggers refresh),
//      authenticated but insufficient role -> 403 FORBIDDEN_ROLE.
// The client distinguishes the two via the code field, so proactive/retry
// refresh stays safe even when a legitimately-forbidden user hits these gates.
function requireRole(
  req: IncomingMessage,
  res: ServerResponse,
  authUser: TokenPayload | null,
  allowedRoles: string | string[],
  forbiddenError: string
): boolean {
  if (!authUser) {
    res.statusCode = 401;
    res.setHeader('X-Error-Code', 'UNAUTHENTICATED');
    res.end(JSON.stringify({
      success: false,
      code: 'UNAUTHENTICATED',
      error: 'نشست شما منقضی یا نامعتبر است. در حال نوسازی…'
    }));
    return true;
  }
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!roles.includes(authUser.role)) {
    res.statusCode = 403;
    res.setHeader('X-Error-Code', 'FORBIDDEN_ROLE');
    res.end(JSON.stringify({ success: false, code: 'FORBIDDEN_ROLE', error: forbiddenError }));
    return true;
  }
  return false;
}

function respondRoleGate(
  req: IncomingMessage,
  res: ServerResponse,
  authUser: TokenPayload | null,
  forbiddenError: string
): boolean {
  if (authUser) {
    res.statusCode = 403;
    res.setHeader('X-Error-Code', 'FORBIDDEN_ROLE');
    res.end(JSON.stringify({ success: false, code: 'FORBIDDEN_ROLE', error: forbiddenError }));
    return true;
  }
  res.statusCode = 401;
  res.setHeader('X-Error-Code', 'UNAUTHENTICATED');
  res.end(JSON.stringify({
    success: false,
    code: 'UNAUTHENTICATED',
    error: 'نشست شما منقضی یا نامعتبر است. در حال نوسازی…'
  }));
  return true;
}

// SECURITY FIX (server-side forced password-change gate): previously the
// "must change legacy/default password" rule lived ONLY in the React UI, so a
// scripted client could keep using a weak credential and perform every write.
// The flag is persisted on the profile by authenticateUser()/bootstrap paths
// and cleared server-side by update-password — so checking it here against the
// live DB record (not just the token payload) cannot be bypassed.
const PASSWORD_CHANGE_ALLOWLIST = new Set([
  '/api/me', '/api/lab-data/me',
  '/api/logout', '/api/lab-data/logout',
  '/api/refresh', '/api/lab-data/refresh',
  '/api/lab-data/update-password'
]);

function userMustChangePassword(authUser: TokenPayload): boolean {
  if (!authUser.mustChangePassword) {
    return false;
  }
  // If the token carries mustChangePassword === true, verify against live DB
  // to ensure a user who just updated their password isn't blocked on existing token.
  try {
    const state = getDatabaseState();
    const profile = findProfileById(state, authUser.userId) ||
      (state.profiles || []).find((p: any) => String(p.id) === String(authUser.userId));
    if (profile && !profile.mustChangePassword) {
      return false;
    }
    return profile ? !!profile.mustChangePassword : true;
  } catch {
    return false;
  }
}

// Helper to mask phone number
function maskPhone(phone?: string): string {
  if (!phone || phone.length < 10) return '۰۹۱۳***۳۱۷۷';
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
}

// Main middleware handler for both Vite configureServer and Express
export async function handleLabDataApi(
  req: IncomingMessage, 
  res: ServerResponse, 
  next: () => void
): Promise<void> {
  const url = req.url ? req.url.split('?')[0] : '';

  const isAuthRoute = 
    url === '/api/login' || url === '/api/lab-data/login' ||
    url === '/api/verify-otp' || url === '/api/lab-data/verify-otp' ||
    url === '/api/resend-otp' || url === '/api/lab-data/resend-otp' ||
    url === '/api/logout' || url === '/api/lab-data/logout' ||
    url === '/api/refresh' || url === '/api/lab-data/refresh' ||
    url === '/api/me' || url === '/api/lab-data/me';

  const isLabDataRoute = url.startsWith('/api/lab-data');

  if (!isAuthRoute && !isLabDataRoute) {
    return next();
  }

  // Security hardening headers
  applySecurityHeaders(res);

  // CORS: reflect the request origin (credentials-compatible) instead of '*'.
  // SECURITY FIX #4: in PRODUCTION an empty ALLOWED_ORIGINS no longer means
  // "allow every origin" — cross-origin credentialed requests are refused and
  // the operator gets a loud startup warning. Same-origin browser traffic
  // sends no Origin header and is unaffected. Outside production the permissive
  // default is kept for local dev convenience.
  const reqOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  let corsOrigin: string | null = null;
  if (!reqOrigin) {
    corsOrigin = null; // same-origin / non-browser call — no CORS header needed
  } else if (allowedOrigins.length > 0) {
    if (allowedOrigins.includes(reqOrigin)) corsOrigin = reqOrigin;
  } else if (!IS_PRODUCTION) {
    corsOrigin = reqOrigin; // dev fallback: reflect origin
  } else {
    console.warn(`[CORS] Rejected cross-origin request from ${reqOrigin} — set ALLOWED_ORIGINS in .env to permit it.`);
  }
  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  // BUG FIX (mass-logout #3): the client reads X-Error-Code to tell an expired
  // session (UNAUTHENTICATED → renew) apart from a genuine role denial
  // (FORBIDDEN_ROLE → don't hammer refresh). Cross-origin fetch can only see
  // this header if it is explicitly exposed.
  res.setHeader('Access-Control-Expose-Headers', 'X-Error-Code, X-Password-Change-Required, Retry-After');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Server-side enforcement of the forced password-change policy (see above).
  const gateUser = extractAuthUser(req);
  if (gateUser && !PASSWORD_CHANGE_ALLOWLIST.has(url) && userMustChangePassword(gateUser)) {
    res.statusCode = 403;
    res.setHeader('X-Password-Change-Required', 'true');
    res.end(JSON.stringify({
      success: false,
      code: 'PASSWORD_CHANGE_REQUIRED',
      passwordChangeRequired: true,
      error: 'برای ادامه استفاده از سامانه، ابتدا رمز عبور پیش‌فرض حساب خود را از بخش تنظیمات کاربری تغییر دهید.'
    }));
    return;
  }

  try {
    // 1. GET /api/lab-data/events -> Real-time Server-Sent Events (SSE) Stream
    if (req.method === 'GET' && url === '/api/lab-data/events') {
      // SECURITY FIX (audit #18): EventSource cannot set headers, so the
      // session token is accepted via ?token= query param. Unauthenticated
      // connections are rejected with 401 instead of joining the broadcast.
      const sseToken = (() => {
        try {
          const params = new URLSearchParams(req.url && req.url.includes('?') ? req.url.substring(req.url.indexOf('?') + 1) : '');
          return params.get('token') || '';
        } catch { return ''; }
      })();
      const sseAuth = sseToken ? verifySessionToken(sseToken) : null;
      if (!sseAuth) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: valid session token required for event stream' }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      });
      res.flushHeaders?.();

      const state = getDatabaseState();
      res.write(`data: ${JSON.stringify({ type: 'connected', version: state.version, timestamp: state.lastUpdated })}\n\n`);
      addSseClient(res, String((sseAuth as any).role || 'guest'));

      req.on('close', () => {
        removeSseClient(res);
      });
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // 2. GET /api/me or /api/lab-data/me -> Return current authenticated user profile
    if (req.method === 'GET' && (url === '/api/me' || url === '/api/lab-data/me')) {
      const authUser = extractAuthUser(req);
      if (!authUser) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        return;
      }
      const state = getDatabaseState();
      const profile = state.profiles.find((p: any) => p.id === authUser.userId);
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        user: sanitizeProfile(profile || authUser)
      }));
      return;
    }

    // 3. GET /api/lab-data -> Database retrieval with Role-Based filtering
    if (req.method === 'GET' && url === '/api/lab-data') {
      const authUser = extractAuthUser(req);
      const state = getDatabaseState();
      // Role-based sanitized state (Customer sees only own data, Guest sees only public verification records, Passwords never exposed)
      const data = sanitizeDatabaseState(state, authUser?.role, authUser?.customerId);

      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        timestamp: state.lastUpdated,
        version: state.version,
        role: authUser?.role || 'guest',
        // FIX #1.1: expose per-collection etags here too. The client caches
        // these to send a baseVersion with every write; without them every
        // optimistic-concurrency check saw etag 0 and the server answered
        // 409 CONFLICT, breaking realtime sync in production.
        collections: getAllCollectionVersions(),
        data
      }));
      return;
    }

    // 4. GET /api/lab-data/version -> Lightweight polling check (incl. per-collection etag versions)
    if (req.method === 'GET' && url === '/api/lab-data/version') {
      const state = getDatabaseState();
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        timestamp: state.lastUpdated,
        version: state.version,
        collections: getAllCollectionVersions()
      }));
      return;
    }

    // 4a. GET /api/lab-data/collection/:name -> PERF FIX (audit #39):
    // incremental sync endpoint. When an SSE db_update event announces which
    // single collection changed, the client refetches ONLY that array instead
    // of the entire dataset (which carries every base64 media item). Role
    // scoping is applied server-side identically to GET /api/lab-data.
    if (req.method === 'GET' && url.startsWith('/api/lab-data/collection/')) {
      const authUser = extractAuthUser(req);
      const name = decodeURIComponent(url.slice('/api/lab-data/collection/'.length));
      const result = getSanitizedCollection(name, authUser?.role, authUser?.customerId);
      if (!result.ok) {
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, error: 'unknown_collection' }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        collection: name,
        version: result.version,
        data: result.data
      }));
      return;
    }

    // 4d. POST /api/lab-data/verify-report -> Public QR-certificate lookup
    // SECURITY FIX #6: replaces the old "give every guest the full approved
    // report list" behavior. One exact code in → at most one minimal public
    // record out. Rate-limited per IP to block enumeration sweeps.
    if (url === '/api/lab-data/verify-report') {
      const rlVerify = checkRateLimit(`verify:${getClientIp(req)}`, 30, 10 * 60 * 1000);
      if (rlVerify !== null) {
        res.statusCode = 429;
        res.setHeader('Retry-After', String(rlVerify));
        res.end(JSON.stringify({ success: false, error: `تعداد تلاش‌های استعلام بیش از حد مجاز است. لطفاً ${rlVerify} ثانیه دیگر تلاش کنید.` }));
        return;
      }
      const body = await readJsonBody(req);
      const code = typeof body.code === 'string' ? body.code : (typeof body.reportNo === 'string' ? body.reportNo : '');
      const record = verifyReportForPublic(code);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, found: !!record, report: record }));
      return;
    }

    // 4b. GET /api/lab-data/backups -> List automatic DB backups (Admin only)
    if (req.method === 'GET' && url === '/api/lab-data/backups') {
      const authUser = extractAuthUser(req);
      if (requireRole(req, res, authUser, ['admin'], 'دسترسی غیرمجاز: مشاهده لیست پشتیبان‌ها فقط توسط مدیر ارشد مجاز است.')) return;
      try {
        // listBackups is async (fs.promises) — must be awaited.
        const backups = await listBackups();
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, backups }));
      } catch (e: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error: e?.message || 'failed to list backups' }));
      }
      return;
    }

    // 4c. POST /api/lab-data/reset-bootstrap-password -> Out-of-band recovery of
    // the sole-admin credential when its stored hash is corrupted/unusable
    // (locked-out admin fix). Guarded server-side by tryBootstrapAdminPassword():
    // refuses to run whenever the admin account already has a working credential,
    // so it can never hijack a healthy account. Requires an authenticated admin
    // session OR an explicit ADMIN_BOOTSTRAP_TOKEN env match (for the locked-out
    // case where no session exists yet).
    if (url === '/api/lab-data/reset-bootstrap-password') {
      // NOTE: readJsonBody must be awaited INSIDE each POST branch that needs it,
      // because the shared `const payload` below is declared after these early
      // branches (TDZ). Reading the body twice would hang, so this branch owns
      // its own body read and returns before reaching the shared parse.
      const body = await readJsonBody(req);
      const authUser = extractAuthUser(req);
      const bootstrapToken = (process.env.ADMIN_BOOTSTRAP_TOKEN || '').trim();
      // SECURITY FIX (audit #3): in production the token path is DISABLED
      // unless ADMIN_BOOTSTRAP_TOKEN is explicitly configured. Previously a
      // deployment that left the variable unset could still be "protected" by
      // any shared/sample default value — identical across installs, i.e. a
      // remote forced admin reset for anyone who had seen the repo. Recovery
      // without a session now requires the operator to set a unique one-time
      // token out-of-band (and remove it afterwards).
      const tokenPathEnabled = bootstrapToken.length >= 16 &&
        !(IS_PRODUCTION && !process.env.ADMIN_BOOTSTRAP_TOKEN);
      const providedToken = typeof body.token === 'string' ? body.token.trim() : '';
      const authorizedBySession = !!authUser && authUser.role === 'admin';
      let authorizedByToken = false;
      if (tokenPathEnabled && providedToken) {
        // Constant-time compare with NO length oracle: pad both buffers to a
        // fixed length before timingSafeEqual (the previous short-circuit on
        // `providedToken.length === bootstrapToken.length` leaked the exact
        // token length to unauthenticated callers via response timing).
        const TOKEN_CMP_LEN = 256;
        const a = Buffer.alloc(TOKEN_CMP_LEN, 0x00);
        const b = Buffer.alloc(TOKEN_CMP_LEN, 0x00);
        a.write(providedToken.slice(0, TOKEN_CMP_LEN), 'utf8');
        b.write(bootstrapToken.slice(0, TOKEN_CMP_LEN), 'utf8');
        authorizedByToken = crypto.timingSafeEqual(a, b);
      }
      if (!authorizedBySession && !authorizedByToken) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'دسترسی غیرمجاز: این عملیات نیازمند نشست مدیر ارشد یا توکن بازیابی (ADMIN_BOOTSTRAP_TOKEN) است.' }));
        return;
      }
      const newPassword = normalizeIncomingPassword(body.newPassword);
      if (newPassword.length < 8 || isLegacyDefaultChoice(newPassword)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'رمز عبور جدید باید حداقل ۸ نویتر بوده و نمی‌تواند رمز پیش‌فرض قدیمی باشد.' }));
        return;
      }
      // force=true is ONLY honored when the caller authenticated with the
      // server-side ADMIN_BOOTSTRAP_TOKEN (operator-level proof). It overrides
      // the "existing credential" guard for unrecoverable hashes (e.g. legacy
      // client-written scrypt values whose original password is unknown).
      const forceRequested = body.force === true && authorizedByToken;
      const ok = await withDbWrite(() => tryBootstrapAdminPassword(newPassword, forceRequested));
      if (!ok) {
        res.statusCode = 409;
        res.end(JSON.stringify({ success: false, error: 'بازیابی انجام نشد: حساب مدیر ارشد در حال حاضر اعتبارنامه فعال دارد. برای بازنشانی اجباری (هش غیرقابل‌بازیابی)، توکن ADMIN_BOOTSTRAP_TOKEN را همراه force=true ارسال کنید یا ADMIN_INITIAL_PASSWORD را تنظیم و سرور را ری‌استارت نمایید.' }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: 'اعتبارنامه مدیر ارشد با موفقیت بازنشانی شد. اکنون با رمز جدید وارد شوید.' }));
      return;
    }

    // 4d. POST /api/lab-data/restore-backup -> Restore from an automatic backup file (Admin only)
    if (url === '/api/lab-data/restore-backup') {
      const body = await readJsonBody(req); // own read: shared `payload` is in TDZ here
      const authUser = extractAuthUser(req);
      if (requireRole(req, res, authUser, ['admin'], 'دسترسی غیرمجاز: بازگردانی پشتیبان خودکار فقط توسط مدیر ارشد مجاز است.')) return;
      const fileName = typeof body.file === 'string' ? body.file : '';
      const ok = await withDbWrite(() => restoreNamedBackup(fileName));
      const state = getDatabaseState();
      res.statusCode = ok ? 200 : 400;
      res.end(JSON.stringify({
        success: ok,
        error: ok ? undefined : 'فایل پشتیبان یافت نشد یا معتبر نیست.',
        timestamp: state.lastUpdated,
        version: state.version,
        data: sanitizeDatabaseState(state, 'admin')
      }));
      return;
    }

    // 5. GET /api/lab-data/export -> Download raw database JSON backup (Admin only)
    if (req.method === 'GET' && url === '/api/lab-data/export') {
      const authUser = extractAuthUser(req);
      if (requireRole(req, res, authUser, ['admin'], 'دسترسی غیرمجاز: دانلود نسخه پشتیبان فقط توسط مدیر ارشد سامانه مجاز است.')) return;
      const state = getDatabaseState();
      res.setHeader('Content-Disposition', `attachment; filename="laboratory_db_backup_${Date.now()}.json"`);
      res.statusCode = 200;
      res.end(JSON.stringify(state, null, 2));
      return;
    }

    // All subsequent routes require POST
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
      return;
    }

    const payload = await readJsonBody(req);
    const authUser = extractAuthUser(req);

    // 6. POST /api/login or /api/lab-data/login -> Centralized Server-Side Authentication
    if (url === '/api/login' || url === '/api/lab-data/login') {
      // IP-based rate limit: max 10 login attempts per 5 minutes
      const rl = checkRateLimit(`login:${getClientIp(req)}`, 10, 5 * 60 * 1000);
      if (rl !== null) {
        res.statusCode = 429;
        res.setHeader('Retry-After', String(rl));
        res.end(JSON.stringify({ success: false, error: `تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً ${rl} ثانیه دیگر تلاش کنید.` }));
        return;
      }

      const { identifier, password } = payload;
      if (!identifier || !password) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'شناسه کاربری و رمز عبور الزامی است.' }));
        return;
      }

      const authResult = await authenticateUser(identifier, password);
      if (!authResult.success || !authResult.user) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: authResult.error || 'نام کاربری یا رمز عبور نامعتبر است.' }));
        return;
      }

      const user = authResult.user;
      // SECURITY FIX #2: the legacy default password is no longer accepted at
      // login, so `usedLegacyPassword` is always false. The forced-change gate
      // comes from the persisted profile flag (set by the bootstrap/repair
      // paths) and survives the OTP step via verifyPendingOtp's re-resolution.
      const mustChangePassword = !!authResult.usedLegacyPassword || !!user.mustChangePassword;

      // Operator & Admin 2FA SMS verification (only when an SMS provider is configured, or explicitly enabled)
      const hasSmsProvider = Boolean(
        process.env.KAVENEGAR_API_KEY ||
        process.env.FARAZSMS_API_KEY ||
        process.env.IPPANEL_API_KEY ||
        process.env.SMS_WEBHOOK_URL
      );
      const isSmsOtpEnforced = (user.role === 'admin' || user.role === 'operator') &&
        process.env.DISABLE_SMS_OTP !== '1' &&
        (hasSmsProvider || process.env.ENABLE_SMS_OTP === '1');

      if (isSmsOtpEnforced) {
        const code = (crypto.randomInt(10000, 100000)).toString();
        const tempToken = createPendingOtp(user, code);
        const otpResponse: any = {
          success: true,
          requiresOtp: true,
          tempToken,
          user: sanitizeProfile(user),
          phone: maskPhone(user.phone),
          mustChangePassword
        };
        // Dispatch SMS via configured gateway (Kavenegar / FarazSMS / Webhook / simulation)
        void sendSmsOtp(user.phone || '', code, user.username);

        // In dev or if DEV_SMS_EXPOSE=1, return simulated OTP in response for testing
        if (!IS_PRODUCTION || process.env.DEV_SMS_EXPOSE === '1') {
          otpResponse.simulatedOtp = code; // Dev-only simulated SMS OTP
        } else {
          const otpFingerprint = crypto
            .createHash('sha256')
            .update(`${code}|${user.id}`)
            .digest('hex')
            .slice(0, 8);
          console.log(`[OTP][${new Date().toISOString()}] issued user=${user.username} phone=${maskPhone(user.phone)} ref=${otpFingerprint}`);
        }
        res.statusCode = 200;
        res.end(JSON.stringify(otpResponse));
        return;
      }

      // Customer accounts -> Direct HMAC session token issued
      const sessionToken = generateSessionToken(user);

      // SECURITY FIX #7: customer login must ALSO verify the current password
      // server-side. The old findUserByPhone() path returned a user after only
      // matching the phone number — no credential check at all — so anyone who
      // knew a customer's phone could obtain a full session token. If the
      // strict identifier+password auth did not resolve this account, fall
      // back to resolving by phone but require the password to verify against
      // that account's stored credential before issuing any token.
      if (user.role === 'customer') {
        const resolvedForAuth = findUserByIdentifier(String(identifier));
        const alreadyVerified = !!(resolvedForAuth && String(resolvedForAuth.id) === String(user.id));
        if (!alreadyVerified) {
          const cp = normalizeIncomingPassword(password);
          const pwOk = verifyPassword(cp, user.password) ||
                       verifyPassword(toEnglishDigits(cp), user.password);
          if (!pwOk) {
            res.statusCode = 401;
            res.end(JSON.stringify({ success: false, error: 'رمز عبور وارد شده صحیح نمی‌باشد.' }));
            return;
          }
        }
      }

      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        token: sessionToken,
        refreshToken: generateRefreshToken(user),
        user: sanitizeProfile(user),
        mustChangePassword
      }));
      return;
    }

    // 7. POST /api/verify-otp or /api/lab-data/verify-otp -> Verify 2FA SMS OTP
    if (url === '/api/verify-otp' || url === '/api/lab-data/verify-otp') {
      // Per-IP rate limit on OTP verification attempts too
      const rl = checkRateLimit(`otp:${getClientIp(req)}`, 15, 5 * 60 * 1000);
      if (rl !== null) {
        res.statusCode = 429;
        res.setHeader('Retry-After', String(rl));
        res.end(JSON.stringify({ success: false, error: `تعداد تلاش‌ها بیش از حد مجاز است. ${rl} ثانیه دیگر تلاش کنید.` }));
        return;
      }

      const { tempToken, otp } = payload;
      if (!tempToken || !otp) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'کد تایید و توکن احراز هویت الزامی است.' }));
        return;
      }

      const verifiedUser = verifyPendingOtp(tempToken, otp);
      if (verifiedUser === 'locked') {
        res.statusCode = 429;
        res.end(JSON.stringify({ success: false, error: 'به دلیل تلاش‌های ناموفق مکرر، این کد قفل شده است. لطفاً مجدداً وارد شوید یا کد را دوباره ارسال کنید.' }));
        return;
      }
      if (!verifiedUser) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'کد تایید پیامک نادرست است یا منقضی گردیده است.' }));
        return;
      }

      const sessionToken = generateSessionToken(verifiedUser);
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        token: sessionToken,
        refreshToken: generateRefreshToken(verifiedUser),
        // FIX #1 (forced password-change gate): mustChangePassword was omitted
        // from the verify-otp response, so operators/admins logging in with the
        // legacy migration credential never saw the gate and their accounts kept
        // the weak default password. The flag is persisted on the profile by
        // authenticateUser() and cleared server-side by update-password.
        mustChangePassword: !!verifiedUser.mustChangePassword,
        user: sanitizeProfile(verifiedUser)
      }));
      return;
    }

    // 8. POST /api/resend-otp or /api/lab-data/resend-otp -> Resend 2FA SMS OTP
    if (url === '/api/resend-otp' || url === '/api/lab-data/resend-otp') {
      const { tempToken } = payload;
      if (!tempToken) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'توکن ورود الزامی است.' }));
        return;
      }

      const rlResend = checkRateLimit(`resend:${getClientIp(req)}`, 5, 10 * 60 * 1000);
      if (rlResend !== null) {
        res.statusCode = 429;
        res.setHeader('Retry-After', String(rlResend));
        res.end(JSON.stringify({ success: false, error: `حد مجاز ارسال مجدد کد تجاوز شده است. ${rlResend} ثانیه دیگر تلاش کنید.` }));
        return;
      }

      const newCode = (crypto.randomInt(10000, 100000)).toString();
      const ok = resendPendingOtp(tempToken, newCode);
      if (!ok) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'نشست ورود منقضی شده است. لطفاً مجدداً وارد شوید.' }));
        return;
      }

      const resendResponse: any = { success: true };
      void sendSmsOtp((authUser as any)?.phone || '', newCode, (authUser as any)?.username || 'user');

      if (!IS_PRODUCTION || process.env.DEV_SMS_EXPOSE === '1') {
        resendResponse.simulatedOtp = newCode;
      } else {
        const otpFingerprint = crypto
          .createHash('sha256')
          .update(`${newCode}|resend`)
          .digest('hex')
          .slice(0, 8);
        console.log(`[OTP][${new Date().toISOString()}] RESEND issued ref=${otpFingerprint}`);
      }
      res.statusCode = 200;
      res.end(JSON.stringify(resendResponse));
      return;
    }

    // 9. POST /api/lab-data/sync -> Sync full database (Strictly Admin only)
    // FIX #1 (Race Condition / lost writes): serialize every read-modify-write
    // through withDbWrite() so concurrent requests can no longer clobber each
    // other's records. Handlers await the result and then re-read the state.
    if (url === '/api/lab-data/sync') {
      if (requireRole(req, res, authUser, ['admin'], 'دسترسی غیرمجاز: همگام‌سازی کامل پایگاه داده منحصراً توسط مدیر ارشد (Admin) مجاز است.')) return;
      const incomingData = payload.data || payload;
      const updatedState = await withDbWrite(() => syncFullDatabase(incomingData));
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        timestamp: updatedState.lastUpdated,
        version: updatedState.version,
        data: sanitizeDatabaseState(updatedState, 'admin')
      }));
      return;
    }

    // 10. POST /api/lab-data/reset -> Reset database to initial factory defaults (Admin only)
    if (url === '/api/lab-data/reset') {
      if (requireRole(req, res, authUser, ['admin'], 'دسترسی غیرمجاز: بازنشانی سیستم به حالت اولیه فقط توسط مدیر ارشد سامانه مجاز است.')) return;
      const state = await withDbWrite(() => resetDatabaseToDefaults());
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        timestamp: state.lastUpdated,
        version: state.version,
        data: sanitizeDatabaseState(state, 'admin')
      }));
      return;
    }

    // 11. POST /api/lab-data/restore -> Restore whole database from uploaded JSON (Admin only)
    if (url === '/api/lab-data/restore') {
      if (requireRole(req, res, authUser, ['admin'], 'دسترسی غیرمجاز: بازیابی فایل پشتیبان پایگاه داده فقط برای مدیر ارشد مجاز است.')) return;
      const incoming = payload.data || payload;
      const ok = await withDbWrite(() => restoreFromBackup(incoming));
      const state = getDatabaseState();
      res.statusCode = ok ? 200 : 400;
      res.end(JSON.stringify({
        success: ok,
        timestamp: state.lastUpdated,
        version: state.version,
        data: sanitizeDatabaseState(state, 'admin')
      }));
      return;
    }

    // 12. POST /api/lab-data/update-role -> Update user role (Admin only)
    if (url === '/api/lab-data/update-role') {
      if (requireRole(req, res, authUser, ['admin'], 'دسترسی غیرمجاز: تغییر دسترسی و نقش کاربران فقط توسط مدیر ارشد سامانه مجاز است.')) return;
      const { userId, role } = payload;
      if (!userId || !role) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'userId and role are required' }));
        return;
      }
      const result = await withDbWrite(() => updateUserRoleServer(userId, role));
      const state = getDatabaseState();
      res.statusCode = result.success ? 200 : (result.error ? 403 : 404);
      res.end(JSON.stringify({
        success: result.success,
        error: result.error,
        timestamp: state.lastUpdated,
        version: state.version,
        data: result.profile
      }));
      return;
    }

    // 12b. POST /api/lab-data/delete-profile -> Targeted profile deletion (Admin only)
    // SECURITY FIX (audit #29): deletions previously travelled through
    // sync-collection (whole-array overwrite). This dedicated endpoint performs
    // a single-record removal inside the serialized write chain and revokes
    // the deleted user's live sessions server-side.
    if (url === '/api/lab-data/delete-profile') {
      if (requireRole(req, res, authUser, ['admin'], 'دسترسی غیرمجاز: حذف کاربران فقط توسط مدیر ارشد سامانه مجاز است.')) return;
      const { profileId } = payload;
      const result = await withDbWrite(() => deleteProfileServer(String(profileId || '')));
      const state = getDatabaseState();
      res.statusCode = result.success ? 200 : 400;
      res.end(JSON.stringify({
        success: result.success,
        error: result.error,
        timestamp: state.lastUpdated,
        version: state.version
      }));
      return;
    }

    // 13. POST /api/lab-data/sync-collection -> Sync a specific table/collection
    // Supports optimistic concurrency: client sends `baseVersion` it last read;
    // if another user modified the collection since then, server responds 409 CONFLICT
    // instead of silently overwriting (last-write-wins data loss fix).
    if (url === '/api/lab-data/sync-collection') {
      const { collection, data, baseVersion } = payload;
      if (!collection || !Array.isArray(data)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'collection name and data array are required' }));
        return;
      }

      // Profiles collection can NEVER be bulk-synced; reject with 409
      if (collection === 'profiles') {
        console.warn(`[SECURITY] Bulk sync-collection for "profiles" is forbidden. Attempted by user: ${authUser?.username || 'unauthenticated'}`);
        res.statusCode = 409;
        res.end(JSON.stringify({
          success: false,
          conflict: true,
          collection: 'profiles',
          error: 'SYNC_COLLECTION_FORBIDDEN_FOR_PROFILES: ویرایش مستقیم جدول کاربران مجاز نیست؛ لطفاً از متدهای اختصاصی استفاده فرمایید.'
        }));
        return;
      } else {
        // Operational collections require Admin or Operator
        if (requireRole(req, res, authUser, ['admin', 'operator'], 'دسترسی ویرایش فقط برای تکنسین‌ها یا مدیر مجاز است.')) return;
      }

      const result = await withDbWrite(() => syncCollection(collection, data, typeof baseVersion === 'number' ? baseVersion : undefined));
      const state = getDatabaseState();
      if (result.conflict) {
        res.statusCode = 409;
        res.end(JSON.stringify({
          success: false,
          conflict: true,
          collection,
          serverVersion: result.currentVersion,
          timestamp: state.lastUpdated,
          version: state.version,
          error: 'CONFLICT: این جدول همزمان توسط کاربر دیگری ویرایش شده است. لطفاً داده‌ها را تازه‌سازی کنید.'
        }));
        return;
      }
      res.statusCode = result.ok ? 200 : 400;
      res.end(JSON.stringify({
        success: result.ok,
        timestamp: state.lastUpdated,
        version: state.version,
        collectionVersion: result.currentVersion ?? getCollectionVersion(collection)
      }));
      return;
    }

    // 14. POST /api/lab-data/update-password -> Update user password (Self or Admin)
    if (url === '/api/lab-data/update-password') {
      const { userId, newPassword, currentPassword } = payload;
      if (!userId || !newPassword) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'userId and newPassword are required' }));
        return;
      }
      if (typeof newPassword !== 'string' || newPassword.trim().length < 8) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.' }));
        return;
      }
      if (isLegacyDefaultChoice(String(newPassword).trim())) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'استفاده از رمز عبور پیش‌فرض قدیمی ممنوع است. یک رمز جدید انتخاب کنید.' }));
        return;
      }

      // Allowed if user changes their own password OR is admin
      const isSelf = authUser && (authUser.userId === userId || authUser.username === userId);
      const isAdmin = authUser && authUser.role === 'admin';
      if (!isSelf && !isAdmin) {
        if (respondRoleGate(req, res, authUser, 'دسترسی غیرمجاز برای تغییر رمز عبور.')) return;
      }

      // SECURITY FIX #5: a SELF-service change must prove knowledge of the
      // current credential. Previously any authenticated session could replace
      // its own (or an admin's, via a stolen token replay window) password
      // without ever presenting the old one. Admin-forced resets legitimately
      // omit currentPassword.
      // DEAD CODE REMOVED: an `isSelfChange` flag used to be computed here and
      // discarded (`void isSelfChange`) — the authorization decision below is
      // driven entirely by the actor's ROLE (admin vs non-admin), not by
      // self/other identity, so the unused computation was deleted.
      const hasCurrentPw = typeof currentPassword === 'string' && currentPassword.trim() !== '';
      // FIX (credential-repair regression S2): a NON-admin account whose
      // corrupted credential was healed to the non-loginable placeholder on
      // load can NEVER prove knowledge of "the current password" — the old
      // value is unrecoverable by design. Requiring it made such accounts
      // permanently brick themselves out of the self-service reset flow, even
      // though they hold a valid authenticated session. When the stored
      // credential is server-managed-unusable, the possession of the live
      // session token itself is the authenticator; the strength/blacklist
      // checks above still fully apply. Admin actors and healthy credentials
      // keep the strict current-password proof requirement.
      const targetHasCredential = !hasNoUsableStoredCredential(
        (() => {
          try {
            const st = getDatabaseState();
            const t = findProfileById(st, userId);
            return t ? t.password : undefined;
          } catch { return undefined; }
        })()
      );
      if (authUser && authUser.role !== 'admin' && !hasCurrentPw && targetHasCredential) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'برای تغییر رمز عبور، وارد کردن رمز فعلی الزامی است.' }));
        return;
      }

      const result = await withDbWrite(() =>
        updateUserPassword(userId, newPassword, hasCurrentPw ? currentPassword : undefined, {
          // Defense-in-depth: even if the HTTP-layer checks above are ever
          // bypassed/changed, a non-admin target may never have its credential
          // replaced without proving the current one — UNLESS the stored
          // credential is already unusable (healed placeholder), in which case
          // there is nothing to prove against (see the FIX note above).
          requireCurrentForNonAdmin: targetHasCredential
        })
      );
      if (result === 'wrong-current') {
        res.statusCode = 403;
        res.end(JSON.stringify({ success: false, error: 'رمز عبور فعلی صحیح نیست.' }));
        return;
      }
      const ok = result === true;
      const state = getDatabaseState();
      res.statusCode = ok ? 200 : 404;
      res.end(JSON.stringify({
        success: ok,
        timestamp: state.lastUpdated,
        version: state.version,
        message: ok ? 'Password updated successfully on server' : 'User not found'
      }));
      return;
    }

    // 15. POST /api/lab-data/add-dispatch -> New online test request / technician dispatch (Public form, rate-limited)
    if (url === '/api/lab-data/add-dispatch') {
      // Public endpoint: throttle per IP to prevent spam/DoS (max 8 submissions / 10 min)
      const rlDispatch = checkRateLimit(`dispatch:${getClientIp(req)}`, 8, 10 * 60 * 1000);
      if (rlDispatch !== null) {
        res.statusCode = 429;
        res.setHeader('Retry-After', String(rlDispatch));
        res.end(JSON.stringify({ success: false, error: `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${rlDispatch} ثانیه دیگر تلاش کنید.` }));
        return;
      }
      const { dispatch } = payload;
      if (!dispatch || typeof dispatch !== 'object') {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'dispatch object is required' }));
        return;
      }
      // Basic input validation for the public submission form
      const name = typeof dispatch.customerName === 'string' ? dispatch.customerName.trim() : '';
      const phone = typeof dispatch.contactPhone === 'string' ? dispatch.contactPhone.trim() : '';
      if (!name || name.length > 120 || !/^[\d+()-]{8,20}$/.test(phone)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'نام و شماره تماس معتبر الزامی است.' }));
        return;
      }

      // IDOR defense: if authenticated as customer, strictly bind dispatch to their own customerId.
      // If unauthenticated guest submission, do not allow arbitrary customerId attachment.
      if (authUser && authUser.role === 'customer') {
        dispatch.customerId = authUser.customerId || undefined;
      } else if (!authUser) {
        delete dispatch.customerId;
      }

      const saved = await withDbWrite(() => addDispatch(dispatch));
      const state = getDatabaseState();
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        timestamp: state.lastUpdated,
        version: state.version,
        data: saved
      }));
      return;
    }

    // 15b. POST /api/lab-data/notify-payment (Authenticated Customer, Operator, or Admin)
    if (url === '/api/lab-data/notify-payment') {
      if (!authUser) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: ورود به سامانه الزامی است.' }));
        return;
      }
      const { customerId, invoiceId, amount, method, documentNo, bankName, jalaliDate, description } = payload;
      let targetCustId = typeof customerId === 'string' ? customerId.trim() : '';
      if (authUser.role === 'customer') {
        if (!authUser.customerId) {
          res.statusCode = 403;
          res.end(JSON.stringify({ success: false, error: 'شناسه کاربری شما به هیچ پرونده کارفرمایی متصل نیست.' }));
          return;
        }
        targetCustId = authUser.customerId;
      }
      if (!targetCustId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'شناسه کارفرما نامعتبر است.' }));
        return;
      }
      const numAmount = Number(amount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'مبلغ اعلامی باید عددی مثبت باشد.' }));
        return;
      }
      const cleanDocNo = typeof documentNo === 'string' ? documentNo.trim() : '';
      if (!cleanDocNo || cleanDocNo.length > 100) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'شماره سند یا رسید پیگیری واریز الزامی است.' }));
        return;
      }

      const saved = await withDbWrite(() => recordCustomerPaymentNotification(targetCustId, {
        amount: numAmount,
        method: typeof method === 'string' ? method.slice(0, 50) : 'bank_transfer',
        documentNo: cleanDocNo,
        bankName: typeof bankName === 'string' ? bankName.slice(0, 100) : 'حواله بانکی',
        jalaliDate: typeof jalaliDate === 'string' ? jalaliDate.slice(0, 30) : '',
        description: typeof description === 'string' ? description.slice(0, 500) : '',
        registeredBy: `کارفرما (${authUser.fullName || authUser.username})`,
        invoiceId: typeof invoiceId === 'string' ? invoiceId.trim() : undefined
      }));

      const state = getDatabaseState();
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        timestamp: state.lastUpdated,
        version: state.version,
        data: saved
      }));
      return;
    }

    // 16. POST /api/lab-data/update-dispatch-status (Admin or Operator)
    if (url === '/api/lab-data/update-dispatch-status') {
      if (requireRole(req, res, authUser, ['admin', 'operator'], 'دسترسی غیرمجاز.')) return;
      const { id, status, technicianName } = payload;
      if (!id || !status) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'id and status are required' }));
        return;
      }
      const ok = await withDbWrite(() => updateDispatchStatus(id, status, technicianName));
      const state = getDatabaseState();
      res.statusCode = ok ? 200 : 404;
      res.end(JSON.stringify({
        success: ok,
        timestamp: state.lastUpdated,
        version: state.version
      }));
      return;
    }

    // 17. POST /api/lab-data/add-customer (Admin or Operator)
    if (url === '/api/lab-data/add-customer') {
      if (requireRole(req, res, authUser, ['admin', 'operator'], 'ثبت کارفرمای جدید فقط توسط پرسنل آزمایشگاه مجاز است.')) return;
      const { customer } = payload;
      if (!customer) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'customer object is required' }));
        return;
      }
      // SECURITY FIX (audit #31/#33): the shared validator throws with a
      // statusCode — translate it into a clean 4xx JSON instead of a 500.
      let saved: any;
      try {
        saved = await withDbWrite(() => addCustomer(customer));
      } catch (e: any) {
        const code = typeof e?.statusCode === 'number' ? e.statusCode : 500;
        res.statusCode = code;
        res.end(JSON.stringify({ success: false, error: e?.message || 'failed' }));
        return;
      }
      const state = getDatabaseState();
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        timestamp: state.lastUpdated,
        version: state.version,
        data: saved
      }));
      return;
    }

    // 18. POST /api/lab-data/add-profile (Admin or Operator)
    if (url === '/api/lab-data/add-profile') {
      if (requireRole(req, res, authUser, ['admin', 'operator'], 'دسترسی غیرمجاز: تعریف کاربر جدید منحصراً توسط پرسنل مجاز آزمایشگاه امکان‌پذیر است.')) return;
      const { profile, initialPassword } = payload;
      if (!profile) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'profile object is required' }));
        return;
      }
      // SECURITY FIX (audit #28/#29): the client now strips `password` from the
      // cached profile and delivers the typed credential once via
      // `initialPassword`. Map it onto profile.password for the hashing path
      // in addProfileServer (which still rejects forged `scrypt:` echoes).
      if (typeof initialPassword === 'string' && initialPassword.trim()) {
        profile.password = initialPassword.trim();
      }
      let saved: any;
      try {
        saved = await withDbWrite(() => addProfileServer(profile));
      } catch (err: any) {
        const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 400;
        res.statusCode = statusCode;
        res.end(JSON.stringify({
          success: false,
          error: err?.message || 'خطا در ثبت کاربر جدید در سرور.'
        }));
        return;
      }
      const state = getDatabaseState();
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        timestamp: state.lastUpdated,
        version: state.version,
        data: sanitizeProfile(saved)
      }));
      return;
    }

    // 19. POST /api/lab-data/update-profile (Admin, Operator, or Self)
    if (url === '/api/lab-data/update-profile') {
      const { profile } = payload;
      if (!profile) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'profile object is required' }));
        return;
      }

      const isSelf = authUser && (authUser.userId === profile.id || authUser.username === profile.username);
      const isStaff = authUser && (authUser.role === 'admin' || authUser.role === 'operator');

      if (!isSelf && !isStaff) {
        if (respondRoleGate(req, res, authUser, 'دسترسی غیرمجاز برای ویرایش پروفایل.')) return;
      }

      // SECURITY FIX (role-based field whitelist): pass the ACTING user's role
      // and id so labDbServer can strip password/role/status/mustChangePassword
      // from non-privileged actors. A genuine self-edit is identified by the
      // session token's userId (never by the client-supplied profile body).
      // SECURITY FIX (audit #28/#29): the cached profile no longer carries a
      // password; an admin-initiated credential change arrives once via
      // `newPassword`. Map it onto profile.password so updateProfileServer's
      // hashing path sees it — the server-side whitelist still enforces WHO
      // may write credentials (admin or true self-change only).
      if (typeof payload.newPassword === 'string' && payload.newPassword.trim()) {
        profile.password = payload.newPassword.trim();
      }
      // SECURITY FIX (audit #15/#33): map thrown validation errors (incl. the
      // new NOT_FOUND for insert-attempts through this endpoint) to clean JSON.
      let result: any;
      try {
        result = await withDbWrite(() => updateProfileServer(profile, {
          actorRole: authUser?.role,
          actorUserId: authUser?.userId,
        }));
      } catch (e: any) {
        const code = typeof e?.statusCode === 'number' ? e.statusCode : 500;
        res.statusCode = code;
        res.end(JSON.stringify({ success: false, error: e?.message || 'failed' }));
        return;
      }
      const state = getDatabaseState();
      res.statusCode = result.success ? 200 : 400;
      res.end(JSON.stringify({
        success: result.success,
        timestamp: state.lastUpdated,
        version: state.version,
        data: result.profile
      }));
      return;
    }

    // 20. POST /api/lab-data/register-customer-account (Admin or Operator)
    if (url === '/api/lab-data/register-customer-account') {
      if (requireRole(req, res, authUser, ['admin', 'operator'], 'دسترسی غیرمجاز.')) return;
      const { customer, user, payment } = payload;
      if (!customer || !user) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'customer and user are required' }));
        return;
      }
      // SECURITY FIX (audit #31/#33): shared validator throws with statusCode —
      // surface as 400 JSON instead of crashing the handler with a 500.
      let result: any;
      try {
        result = await withDbWrite(() => registerCustomerAccount(customer, user, payment));
      } catch (e: any) {
        const code = typeof e?.statusCode === 'number' ? e.statusCode : 500;
        res.statusCode = code;
        res.end(JSON.stringify({ success: false, error: e?.message || 'failed' }));
        return;
      }
      const state = getDatabaseState();
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        timestamp: state.lastUpdated,
        version: state.version,
        data: {
          customer: result.customer,
          user: sanitizeProfile(result.user),
          payment: result.payment,
          // One-time plaintext reveal for the welcome SMS / entry card only.
          // The stored credential itself is always a scrypt hash.
          passwordGenerated: result.passwordGenerated
        }
      }));
      return;
    }

    // 21. POST /api/lab-data/session -> Store active user session on VPS server
    if (url === '/api/lab-data/session') {
      // SECURITY: never trust a client-supplied userId without a valid session token.
      const effectiveUserId = authUser ? authUser.userId : null;
      await withDbWrite(() => setSessionUser(effectiveUserId));
      const state = getDatabaseState();
      res.statusCode = 200;
      // SECURITY (audit #34): do not echo the globally-stored active user id.
      // The caller's identity is derived from their own token only.
      res.end(JSON.stringify({
        success: true,
        timestamp: state.lastUpdated,
        version: state.version,
        authenticated: !!authUser,
        role: authUser?.role || 'guest'
      }));
      return;
    }

    // 22. POST /api/logout or /api/lab-data/logout -> Revoke current session token server-side
    if (url === '/api/logout' || url === '/api/lab-data/logout') {
      const authHeader = req.headers['authorization'];
      let rawToken = '';
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        rawToken = authHeader.substring(7).trim();
      } else if (typeof req.headers['x-session-token'] === 'string') {
        rawToken = req.headers['x-session-token'].trim();
      }
      // SECURITY FIX (logout revocation): previously only the single token
      // presented in this request was revoked. Because /api/refresh can hand
      // out additional live session tokens for the same user (and multiple
      // tabs/devices may hold separate jtis), stale tokens survived logout and
      // remained usable until natural expiry. Now ALL active sessions of the
      // authenticated user are revoked server-side.
      // SECURITY FIX (audit #12): the refresh token presented alongside logout
      // is stateless HMAC — it must ALSO be blacklisted by its jti, otherwise
      // the logged-out client could mint a brand-new session with it for up to
      // 30 days. We verify-then-revoke regardless of authUser so that even an
      // expired/invalid session bearer cannot skip refresh revocation.
      let revoked = rawToken ? revokeSessionToken(rawToken) : false;
      const rawRefresh = typeof payload?.refreshToken === 'string' ? payload.refreshToken : '';
      const presentedRefreshPayload = rawRefresh ? verifyRefreshToken(rawRefresh) : null;
      if (presentedRefreshPayload) {
        revokeRefreshTokenByPayload(presentedRefreshPayload);
        revoked = true;
      }
      if (authUser?.userId || presentedRefreshPayload?.userId) {
        const owner = String(authUser?.userId ?? presentedRefreshPayload?.userId);
        const extra: Array<{ jti: string; exp: number }> = presentedRefreshPayload?.userId === owner && presentedRefreshPayload.jti
          ? [{ jti: presentedRefreshPayload.jti, exp: presentedRefreshPayload.exp }]
          : [];
        const count = revokeAllUserSessions(owner, extra);
        revoked = revoked || count > 0;
      }
      if (authUser) await withDbWrite(() => setSessionUser(null));
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, revoked }));
      return;
    }

    // 23. POST /api/refresh or /api/lab-data/refresh -> Exchange refresh token for a fresh session token
    if (url === '/api/refresh' || url === '/api/lab-data/refresh') {
      const rlRefresh = checkRateLimit(`refresh:${getClientIp(req)}`, 120, 10 * 60 * 1000);
      if (rlRefresh !== null) {
        res.statusCode = 429;
        res.setHeader('Retry-After', String(rlRefresh));
        res.end(JSON.stringify({ success: false, error: 'تعداد درخواست‌های تمدید نشست بیش از حد مجاز است.' }));
        return;
      }
      const refreshToken = payload.refreshToken;
      const refreshPayload = refreshToken ? verifyRefreshToken(refreshToken) : null;
      if (!refreshPayload) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'توکن تمدید نشست نامعتبر یا منقضی شده است.' }));
        return;
      }
      const state = getDatabaseState();
      const user = state.profiles.find((p: any) => p.id === refreshPayload.userId);
      if (!user || user.status !== 'active') {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'حساب کاربری یافت نشد یا غیرفعال است.' }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        token: generateSessionToken(user),
        refreshToken: generateRefreshToken(user),
        user: sanitizeProfile(user)
      }));
      return;
    }

    // Not found
    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
  } catch (err: any) {
    console.error('API Error in labDataApi:', err);
    // FIX (validation): propagate explicit 4xx validation errors thrown by
    // server-side validators instead of masking them as 500.
    res.statusCode = typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode
      : 500;
    // SECURITY FIX (audit #6): raw internal error messages (stack-derived
    // text, fs paths, DB internals) must never reach HTTP clients in
    // production. The full error is already logged above; the response only
    // carries a generic message. Explicit 4xx validation errors thrown by
    // server-side validators keep their safe, user-facing Persian text.
    const isValidation4xx = typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500;
    const clientError = isValidation4xx
      ? (err.message || 'درخواست نامعتبر است.')
      : (IS_PRODUCTION ? 'خطای داخلی سرور. در صورت تداوم با مدیر سامانه تماس بگیرید.' : (err.message || 'Internal Server Error'));
    res.end(JSON.stringify({ success: false, error: clientError }));
  }
}
