import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { ServerResponse } from 'http';
import { PROJECT_ROOT } from './pathUtils';
// SINGLE SOURCE OF TRUTH (audit #52/#54): Jalali conversion and site constants
// live in /shared so the client and server bundles can never drift apart.
import { gregorianToJalaliShared, todayJalaliStrShared } from '../shared/jalali';
import { DEFAULT_SITE_EMAIL_DOMAIN } from '../shared/siteConfig';

export interface LabDatabaseState {
  version: number;
  lastUpdated: number;
  currentUserId?: string;
  profiles: any[];
  customers: any[];
  reports: any[];
  invoices: any[];
  accounting: any[];
  calibrations: any[];
  dispatches: any[];
  technicians: any[];
  envLogs: any[];
  media: any[];
  smsLogs: any[];
  trashCustomers: any[];
  seedApplied?: boolean;
}

// ARCHITECTURE FIX (audit item #60): the old `ILabDatabaseService` interface
// was speculative generality — it declared a union return type
// (`Promise<T> | T`) that no consumer honored (everything calls the concrete
// synchronous functions directly), had zero alternative implementations, and
// actively invited race conditions by making "forgot to await" legal (audit
// item #61). It has been removed. If a second storage backend is ever needed,
// introduce an async-only interface together with real dependency injection.

// FIX #1 (VPS): resolve relative to the real project root, not process.cwd().
// See server/pathUtils.ts — running dist/server.cjs from another working dir
// used to make the server silently re-initialize an EMPTY database.
// NOTE (test isolation): PROJECT_ROOT already honours the LAB_DATA_ROOT env
// override (see server/pathUtils.ts). The old code checked ONLY LAB_DATA_DIR
// here and joined PROJECT_ROOT + 'data' otherwise — which made LAB_DATA_ROOT
// a no-op for this module whenever LAB_DATA_DIR was unset: regression tests
// that isolate via LAB_DATA_ROOT silently read/wrote the REAL repository
// database instead of their temp directory. Honour both variables explicitly.
const DATA_DIR = process.env.LAB_DATA_DIR
  ? path.resolve(process.env.LAB_DATA_DIR)
  : process.env.LAB_DATA_ROOT && process.env.LAB_DATA_ROOT.trim()
    ? path.join(path.resolve(process.env.LAB_DATA_ROOT.trim()), 'data')
    : path.join(PROJECT_ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'laboratory_db.json');
const SEED_FILE = path.join(DATA_DIR, 'initial_seed_data.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'active_sessions.json');

// Environment / security configuration
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Session HMAC secret — MUST be provided via environment in production.
// BUILD FIX: this check must run only when the HTTP server actually starts,
// NOT at module-import time. Vite loads vite.config.ts (which imports this
// middleware chain) while bundling the CLIENT during `vite build`, where
// NODE_ENV may already be "production". Throwing at import time crashed the
// entire build. We therefore resolve the secret lazily and expose an explicit
// startup guard (assertSessionSecretConfigured) called from server.ts.
let SESSION_SECRET: string | null = null;

// BUG FIX (problem #1 — "admin panel kicks me out mid-work"):
// Previously, when SESSION_SECRET was unset, EVERY process start minted a
// brand-new RANDOM secret. Any PM2 restart (crash, OOM max_memory_restart,
// deploy, host reboot) therefore invalidated every previously-issued session
// and refresh token at once — users were silently ejected to the login/landing
// page "for no reason" while working in the admin panel.
// The fallback secret used to be persisted to data/.session_secret (0600).
// CRITICAL FIX (this commit): that file lived INSIDE the git-tracked data/
// directory, so `git pull` / `git checkout .` / `reset --hard` / a fresh clone
// could replace or delete it — which rotated the HMAC key and mass-invalidated
// every session AND every refresh token at once (the silent bulk logouts).
// The fallback secret is now stored OUTSIDE the repository (default:
// ~/.azma-session-secret, override via SESSION_SECRET_FILE), never under
// data/, and is git-ignored regardless. Production still fails fast without an
// explicit SESSION_SECRET (see assertSessionSecretConfigured).
function loadPersistedSecretFile(secretFile: string): string | null {
  try {
    if (fs.existsSync(secretFile)) {
      const raw = fs.readFileSync(secretFile, 'utf-8').trim();
      if (raw.length >= 32) return raw;
    }
  } catch { /* unreadable file — fall through */ }
  return null;
}

/**
 * Resolve the fallback-secret file path. NEVER inside DATA_DIR/repo:
 *   1. SESSION_SECRET_FILE env var (explicit operator choice)
 *   2. $HOME/.azma-session-secret
 *   3. os.tmpdir()/.azma-session-secret (last resort, e.g. HOME-less service)
 */
function resolveSecretFallbackFile(): string {
  const explicit = (process.env.SESSION_SECRET_FILE || '').trim();
  if (explicit) return path.resolve(explicit);
  const home = process.env.HOME || os.homedir();
  if (home) return path.join(home, '.azma-session-secret');
  return path.join(os.tmpdir(), '.azma-session-secret');
}

function ensureSessionSecret(): string {
  if (SESSION_SECRET) return SESSION_SECRET;
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    SESSION_SECRET = process.env.SESSION_SECRET.trim();
    return SESSION_SECRET;
  }
  // In production the persisted-file fallback is FORBIDDEN (see the guard
  // below): a deployment that "forgot" SESSION_SECRET must fail loudly rather
  // than run on a mutable repo-side key file that any git operation can rotate.
  if (IS_PRODUCTION) {
    throw new Error(
      '[FATAL] SESSION_SECRET is not configured (missing or shorter than 16 chars). ' +
      'The server refuses to start in production without it, because rotating the ' +
      'signing key invalidates every active session and refresh token at once. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" ' +
      'and put it in .env'
    );
  }
  // Non-production: reuse the persisted one if present…
  const secretFile = resolveSecretFallbackFile();
  const persisted = loadPersistedSecretFile(secretFile);
  if (persisted) {
    SESSION_SECRET = persisted;
    return SESSION_SECRET;
  }
  // …otherwise generate once and persist OUTSIDE the repo for all future restarts.
  SESSION_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn(`[SECURITY] SESSION_SECRET not set or too short — generated a persistent fallback secret in ${secretFile}. Set SESSION_SECRET in .env for full control.`);
  try {
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    fs.writeFileSync(secretFile, SESSION_SECRET, { encoding: 'utf-8', mode: 0o600 });
  } catch { /* non-critical: worst case behaves like the old random-secret mode */ }
  return SESSION_SECRET;
}

/**
 * Called once at real server startup (server.ts / dev middleware mount).
 * Fails fast in production if SESSION_SECRET is missing or too short — the
 * persisted-file fallback is NOT accepted there (audit fix: the checklist
 * promised "the server refuses to boot in production without it", but this
 * function silently passed on the fallback key instead).
 */
export function assertSessionSecretConfigured(): void {
  if (IS_PRODUCTION) {
    const envSecret = (process.env.SESSION_SECRET || '').trim();
    if (envSecret.length < 16) {
      throw new Error(
        '[FATAL] SESSION_SECRET must be set to a strong value (≥ 16 chars) in production. ' +
        'See deploy/deployment-checklist.md §2 for how to generate one.'
      );
    }
  }
  ensureSessionSecret();
}

// Configurable session token lifetime (default 7 days).
// BUG FIX: a non-numeric or non-positive SESSION_TTL_HOURS used to produce
// NaN / 0 ms, making every issued token expire immediately (exp in the past)
// and silently logging all users out. Validate with an explicit fallback now.
const SESSION_TTL_MS = (() => {
  const rawHours = Number(process.env.SESSION_TTL_HOURS);
  const hours = Number.isFinite(rawHours) && rawHours > 0 ? rawHours : 7 * 24;
  return hours * 60 * 60 * 1000;
})();

// Site email domain used for generated user emails (fix: mismatched domain —
// the production site is azmajahanbin.ir, not betonlab.ir). Override via env.
// The fallback now comes from shared/siteConfig.ts so client and server can
// never disagree again (audit #54).
export const SITE_EMAIL_DOMAIN =
  (process.env.SITE_EMAIL_DOMAIN || DEFAULT_SITE_EMAIL_DOMAIN).trim() || DEFAULT_SITE_EMAIL_DOMAIN;

// ---------------------------------------------------------------------------
// SECURITY FIX #2 (hard-coded default credentials removed):
// There is NO built-in default admin password anymore. The bootstrap
// credential comes exclusively from the ADMIN_INITIAL_PASSWORD environment
// variable (.env on the VPS). If it is unset/short, the admin account is
// created NON-LOGINABLE (random unusable hash) and must be reset out-of-band:
//   node -e "..." or POST /api/lab-data/reset-bootstrap-password (see below)
// ---------------------------------------------------------------------------
export const SOLE_ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'admin').trim() || 'admin';

// AUDIT FIX (#69): role lookup for the sole admin. Every call site used to
// inline `p.id === SOLE_ADMIN_ID || p.username === SOLE_ADMIN_USERNAME`; if an
// env override moved either anchor, half the guards silently stopped matching.
// One predicate now, so the special-casing follows the configured identity.
export function isSoleAdminProfile(p: any): boolean {
  return !!p && (p.id === SOLE_ADMIN_ID || p.username === SOLE_ADMIN_USERNAME);
}
const ADMIN_INITIAL_PASSWORD = (process.env.ADMIN_INITIAL_PASSWORD || '').trim();

/**
 * True when the bootstrap credential is genuinely configured. The old build
 * defaulted this to 'Admin@123'; if an operator still has that stale value in
 * .env it must NEVER be treated as a usable admin credential (it is a known
 * public default). Treated as "unset" → non-loginable placeholder + forced
 * out-of-band reset required.
 */
const BOOTSTRAP_CONFIGURED = ADMIN_INITIAL_PASSWORD.length > 0 && ADMIN_INITIAL_PASSWORD !== 'Admin@123';

// FIX (credential-repair S2/S3 regression): the BOOTSTRAP credential hash is
// computed ONCE at module load — with a random salt when ADMIN_INITIAL_PASSWORD
// is unset — so every process that heals an admin account installs a hash no
// OTHER process can reproduce. Without registration, the next cold load sees
// that legitimate repaired hash as an unknown digest whose salt "wasn't
// produced here", `looksLikeReusedForeignSalt()` (all healed accounts share it)
// flags it as forged, and repair re-stamps it with the UNUSABLE placeholder —
// destroying the working bootstrap credential on every restart. Every
// server-generated credential therefore registers its exact salt in this
// in-memory set; the reuse heuristic only judges salts this process has never
// issued. The registry deliberately does NOT survive restarts: a persisted
// bootstrap hash from a previous process is indistinguishable from a forged
// one, which is why repairCorruptedCredentials() also accepts the current
// module's BOOTSTRAP_ADMIN_HASH as genuine (see below).
const serverIssuedScryptSalts = new Set<string>();

/**
 * PERSISTED salt registry (regression fix, credential-repair S2/S3): the
 * in-memory set above dies with the process, so after a restart every hash
 * this server legitimately minted (env-bootstrap credentials, migrated legacy
 * plaintext seeds, healed accounts' placeholders) looked "foreign" to the
 * reuse heuristic. On cold loads whose DB file carries NO admin anchor row,
 * enforceSoleAdminRules() then re-ran its bootstrap branch and DESTROYED those
 * genuine credentials (the healthy admin got an UNUSABLE placeholder while a
 * seeded fake digest survived untouched). Server-minted salts are not secret
 * material (the scrypt preimage is), so persisting them lets every future
 * process recognize its own output. Loaded once at module init — BEFORE any
 * repair/enforce pass can run — merged with the live in-memory set.
 */
const SALTS_FILE = path.join(DATA_DIR, '.server_salts.json');
let serverSaltsLoaded = false;
function loadPersistedServerSalts(): void {
  if (serverSaltsLoaded) return;
  serverSaltsLoaded = true;
  try {
    if (fs.existsSync(SALTS_FILE)) {
      const arr = JSON.parse(fs.readFileSync(SALTS_FILE, 'utf-8'));
      if (Array.isArray(arr)) {
        for (const s of arr) {
          if (typeof s === 'string' && /^[0-9a-f]{32}$/i.test(s)) {
            serverIssuedScryptSalts.add(s.toLowerCase());
          }
        }
      }
    }
  } catch { /* unreadable registry → fall back to in-memory-only semantics */ }
}
function registerServerIssuedScryptHash(hash: string): void {
  const parts = String(hash || '').split(':');
  if (parts.length === 3 && parts[0] === 'scrypt') {
    serverIssuedScryptSalts.add(parts[1].toLowerCase());
    // Persist asynchronously but fire-and-forget off the write path; the next
    // process reads the file before it ever judges a salt as foreign.
    loadPersistedServerSalts();
    void persistServerSalts();
  }
}
async function persistServerSalts(): Promise<void> {
  try {
    ensureDirExists();
    const arr = Array.from(serverIssuedScryptSalts);
    // CRITICAL (regression fix): the registry must be flushed SYNCHRONOUSLY.
    // The credential-repair tests run each scenario in a short-lived
    // `node -e` process whose event loop drains as soon as the printed RESULT
    // line is reached — a fire-and-forget fs.promises.writeFile would still be
    // pending at exit and the freshly-minted bootstrap salt would NEVER reach
    // disk, so the next process re-bricked the working admin credential.
    // Server-minted salts are not secret material (the scrypt preimage is),
    // and this write only happens on rare credential events.
    const json = JSON.stringify(arr);
    if (json === saltsFileWrittenJson) return;
    try {
      fs.writeFileSync(SALTS_FILE, json, 'utf-8');
      saltsFileWrittenJson = json;
    } catch (e1: any) {
      // A previous async write may still hold the file open on some
      // filesystems — retry once after yielding the event loop.
      await new Promise(r => setImmediate(r));
      fs.writeFileSync(SALTS_FILE, json, 'utf-8');
      saltsFileWrittenJson = json;
    }
  } catch { /* non-critical: worst case falls back to pre-fix behavior */ }
}
let saltsFileWrittenJson: string | null = null;
// Load the registry eagerly at module init so even the synchronous cold-load
// fallback (getDatabaseState → loadDatabaseStateUncached) sees server-issued
// salts before any repair decision is made.
loadPersistedServerSalts();

// Bootstrap hash computed once at module load. NOTE: intentionally does NOT go
// through hashPassword()'s min-length guard, so even a short override stays
// usable for first login (the forced-change flow then applies the length rules).
const BOOTSTRAP_ADMIN_HASH: string = (() => {
  if (!BOOTSTRAP_CONFIGURED) {
    // No bootstrap credential configured — non-loginable placeholder.
    return `scrypt:${crypto.randomBytes(16).toString('hex')}:${crypto.randomBytes(64).toString('hex')}`;
  }
  try {
    return hashPassword(ADMIN_INITIAL_PASSWORD);
  } catch {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(ADMIN_INITIAL_PASSWORD, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
  }
})();
// Register the bootstrap salt as server-issued immediately: it is a value THIS
// process produced, so repair heuristics must never flag it as forged.
registerServerIssuedScryptHash(BOOTSTRAP_ADMIN_HASH);

/**
 * FIX #1 (Broken operator password change):
 * The client used to pre-hash passwords with WebCrypto PBKDF2 but label the
 * result `scrypt:<salt>:<digest>`. The server trusted that prefix and stored it
 * verbatim, while verifyPassword() derives keys with Node's crypto.scryptSync.
 * Result: every password set/changed through the UI produced a hash that could
 * NEVER be verified — the account became permanently unloginable.
 *
 * Fix at the root: passwords now travel as plaintext over HTTPS/TLS only and
 * are hashed exactly once on the server with real scrypt. This helper strips
 * any legacy client-side "fake scrypt" wrapper so old cached values can never
 * be re-submitted as if they were credentials.
 */
export function normalizeIncomingPassword(raw?: unknown): string {
  let pwd = typeof raw === 'string' ? raw.trim() : '';
  if (pwd.startsWith('scrypt:')) {
    // Legacy client PBKDF2 digest masquerading as an scrypt hash — unusable as
    // a plaintext credential; force the caller to supply a real password.
    pwd = '';
  }
  return pwd;
}

/**
 * Hash password using Node.js built-in crypto.scryptSync with random salt
 * Format: scrypt:<salt>:<hash>
 * Security fix: empty/short passwords are rejected instead of silently falling back to a default password.
 */
export function hashPassword(password: string): string {
  // SECURITY FIX (audit #2 — credential pass-through): values that merely
  // carry the `scrypt:` prefix are NEVER accepted verbatim anymore. A remote
  // caller could previously submit `password="scrypt:<own-salt>:<own-digest>"`
  // through add-profile / sync-collection and install a self-known
  // "credential" (an account-takeover backdoor). Genuine server hashes are
  // produced only by this function itself, or stored via
  // normalizeStoredPassword(value, /*trusted*/ true) from internal flows.
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('INVALID_PASSWORD: رمز عبور باید حداقل ۸ کاراکتر باشد و نمی‌تواند خالی باشد.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  // Every credential this function mints is server-issued by definition —
  // register the salt so the repair reuse-heuristic never flags it as forged.
  registerServerIssuedScryptHash(`scrypt:${salt}:${hash}`);
  return `scrypt:${salt}:${hash}`;
}

/**
 * Resolve a fallback password for legacy/bootstrap records that have no password set.
 * Uses ADMIN_INITIAL_PASSWORD env if provided; otherwise keeps the record unusable
 * (a non-loginable placeholder hash) until an admin resets it. No hard-coded default.
 */
function bootstrapPasswordHash(): string {
  if (BOOTSTRAP_CONFIGURED && ADMIN_INITIAL_PASSWORD.length >= 8) {
    return hashPassword(ADMIN_INITIAL_PASSWORD);
  }
  // Non-loginable placeholder: random secret nobody knows. Account must be reset via update-password.
  return `scrypt:${crypto.randomBytes(16).toString('hex')}:${crypto.randomBytes(64).toString('hex')}`;
}

// Legacy default password used by the old demo seed data. It is NEVER accepted
// as a login credential (SECURITY FIX #2: hard-coded defaults removed).
// AUDIT FIX (#79): the plaintext value itself is no longer exported anywhere —
// it lives only in this private constant and is observable exclusively through
// the boolean helpers below (isLegacyDefaultChoice / storedHashIsLegacyDefault),
// so middleware/UI code can enforce the blacklist without ever holding the
// secret as a public API surface (permanent audit finding otherwise).
const LEGACY_DEFAULT_PASSWORD = 'Ag12258';

/** True when `candidate` is exactly the well-known legacy default (blacklist match). */
export function isLegacyDefaultChoice(candidate: string): boolean {
  return typeof candidate === 'string' && candidate === LEGACY_DEFAULT_PASSWORD;
}

/** True when a STORED scrypt hash was derived from the public legacy default. */
export function storedHashIsLegacyDefault(storedHash: string): boolean {
  return verifyPassword(LEGACY_DEFAULT_PASSWORD, storedHash);
}

/**
 * SECURITY FIX #1 (locked-out admin / corrupted hash recovery):
 * Out-of-band bootstrap of the sole-admin credential. Two modes:
 * - force=false: allowed ONLY while the admin account has no usable login path
 *   (empty / placeholder / corrupted-hash). Never overwrites a healthy account.
 * - force=true: operator escape hatch — the caller (middleware) must have
 *   proven possession of the server-side ADMIN_BOOTSTRAP_TOKEN, which is
 *   strictly stronger than any HTTP-level auth. This mode additionally REJECTS
 *   the well-known public default 'Admin@123' as a chosen credential so an
 *   attacker who merely reaches the endpoint cannot install a guessable password.
 */
export async function tryBootstrapAdminPassword(newPassword: string, force = false): Promise<boolean> {
  const pwd = normalizeIncomingPassword(newPassword);
  if (pwd.length < 8 || isLegacyDefaultChoice(pwd)) return false;
  // The old hard-coded default is a public secret — never installable here.
  if (pwd === 'Admin@123') return false;

  const current = getDatabaseState();
  const admin = current.profiles.find(isSoleAdminProfile);
  if (!admin) return false;

  // CRITICAL (anti-wipe guard fixed this round): mutate ONLY a copy. The
  // previous version mutated the cached state object BEFORE validating, so a
  // REFUSED attempt (non-forced on a healthy hash) still left the new hash
  // sitting in `cachedState` — enforceSoleAdminRules() then carried that
  // mutated value into the next persistence and silently overwrote the real
  // owner credential. This was a hijack-grade bug reachable through the
  // authenticated-but-non-admin reset path.
  const updatedAdmin = { ...admin };

  if (!force) {
    // Non-forced bootstrap is only for the "fresh install / corrupted hash"
    // scenario: allowed when the admin account currently has NO usable login
    // path (empty, placeholder, or fake/corrupted hash). A genuine scrypt
    // hash — even one whose plaintext we cannot verify — means a real custom
    // password exists and must never be overwritten through this path.
    if (!adminCredentialIsUnusable()) return false;
  }
  // force=true: caller already proved server-operator possession of
  // ADMIN_BOOTSTRAP_TOKEN (see middleware), which is strictly stronger than
  // any HTTP-level auth. Overwrite is safe and is the documented escape hatch
  // for unrecoverable admin hashes (e.g. hashes written by old buggy clients).

  updatedAdmin.password = hashPassword(pwd);
  // Forced-change gate: a bootstrap/forced reset is an out-of-band recovery,
  // so the operator must change it through the normal in-app flow (which also
  // clears the flag). Non-forced bootstrap only runs when ADMIN_INITIAL_PASSWORD
  // is configured — treat that env value as the operator's chosen credential.
  updatedAdmin.mustChangePassword = true;

  // FIX (hash wiped right after a successful reset): the old code assigned
  // admin.password directly on the cached object and saved with NO existing
  // profiles passed to enforceSoleAdminRules(). Because clients only ever
  // receive sanitized profiles, the fresh hash looks like a client echo and
  // resolveCredential() dropped it to '' → the account came back unusable
  // immediately. Route the write through updateProfileServer(), which merges
  // against the authoritative store and persists atomically.
  const result = await updateProfileServer(updatedAdmin, { actorRole: 'admin', actorUserId: SOLE_ADMIN_ID, trusted: true });
  return !!result?.success;
}

/**
 * True when the sole-admin account has NO usable login path: its stored
 * credential matches neither ADMIN_INITIAL_PASSWORD nor the legacy default and
 * is not a genuine server-format scrypt hash (i.e. corrupted / placeholder).
 * Used to decide whether a NON-forced bootstrap reset may run.
 */
export function adminCredentialIsUnusable(): boolean {
  const current = getDatabaseState();
  const admin = current.profiles.find(isSoleAdminProfile);
  if (!admin) return false; // no admin record — nothing to bootstrap into
  const pwd = typeof admin.password === 'string' ? admin.password : '';
  // Empty / missing credential → unusable.
  if (!pwd) return true;
  // Intentional non-loginable placeholders → unusable.
  if (isUnusablePasswordHash(pwd)) return true;
  // Matches the env bootstrap credential → usable, but ONLY when that value is
  // genuinely configured AND not the well-known public default 'Admin@123'.
  // The old builds seeded accounts with a hash of that public password; such an
  // account has no private secret and MUST stay resettable (otherwise a stale
  // ADMIN_INITIAL_PASSWORD=Admin@123 in .env would permanently block the
  // out-of-band recovery path).
  if (BOOTSTRAP_CONFIGURED && verifyPassword(ADMIN_INITIAL_PASSWORD, pwd)) return false;
  // Legacy demo seed plaintext ('Ag12258') was one-time-migrated to a real
  // scrypt hash whose value is public knowledge → still effectively unusable:
  // fall through to the genuine-hash check below without trusting it as a
  // private credential.
  if (storedHashIsLegacyDefault(pwd)) return true;
  // Genuine server-format hash with unknown plaintext = real custom password → usable.
  return !isGenuineServerScryptHash(pwd);
}

/**
 * Verify password strictly against a stored scrypt hash.
 * Security fix: plaintext fallback comparison removed — only `scrypt:<salt>:<hash>`
 * values are accepted. Legacy plaintext seeds are hashed at load time by
 * normalizeStoredPassword(), so no credential is ever compared in clear text.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false;
  if (typeof storedHash !== 'string' || !storedHash.startsWith('scrypt:')) {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const expectedHash = parts[2];
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: 'admin' | 'operator' | 'customer';
  customerId?: string;
  fullName?: string;
  iat: number;
  exp: number;
  jti: string; // unique token id, supports server-side revocation (real logout)
  typ?: string; // token type marker — 'refresh' for refresh tokens (see generateRefreshToken)
  mustChangePassword?: boolean; // PERF FIX (audit #43): forced-password-change gate flag mirrored into the signed token payload so the middleware hot path does not need a DB scan per request. Server-managed only.
}

// PERF/SECURITY FIX (audit #43): when updateUserPassword() clears a user's
// mustChangePassword flag it re-registers the user's live sessions in the
// server-side registry with the cleared flag — keeping each session's ORIGINAL
// jti, so already-issued client tokens remain valid and no exchange round-trip
// is required. `refreshedSessionTokens` is retained only as a compatibility
// seam for getRefreshedSessionToken(); nothing populates it anymore.
const refreshedSessionTokens = new Map<string, string>();

export function getRefreshedSessionToken(jti: string | undefined): string | null {
  if (!jti) return null;
  const t = refreshedSessionTokens.get(jti);
  if (t) refreshedSessionTokens.delete(jti); // single use per revoked jti
  return t ?? null;
}

// Server-side session registry: jti -> payload. Enables real logout/revocation.
const activeSessions = new Map<string, TokenPayload>();
// Revoked tokens kept until natural expiry to prevent replay of old tokens.
const revokedJtis = new Map<string, number>();

export function loadPersistedSessions(): void {
  try {
    ensureDirExists();
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const now = Date.now();
      if (Array.isArray(data.activeSessions)) {
        for (const [jti, payload] of data.activeSessions) {
          if (jti && payload && typeof payload.exp === 'number' && payload.exp > now) {
            activeSessions.set(jti, payload);
          }
        }
      }
      if (Array.isArray(data.revokedJtis)) {
        for (const [jti, exp] of data.revokedJtis) {
          if (jti && typeof exp === 'number' && exp > now) {
            revokedJtis.set(jti, exp);
          }
        }
      }
    }
  } catch { /* ignore corrupted sessions file */ }
}

export function persistSessions(): void {
  try {
    ensureDirExists();
    const now = Date.now();
    const activeArr: Array<[string, TokenPayload]> = [];
    for (const [jti, payload] of activeSessions.entries()) {
      if (payload && payload.exp > now) activeArr.push([jti, payload]);
    }
    const revokedArr: Array<[string, number]> = [];
    for (const [jti, exp] of revokedJtis.entries()) {
      if (typeof exp === 'number' && exp > now) revokedArr.push([jti, exp]);
    }
    const json = JSON.stringify({ activeSessions: activeArr, revokedJtis: revokedArr });
    fs.writeFileSync(SESSIONS_FILE, json, 'utf-8');
  } catch { /* non-critical */ }
}

// Load sessions eagerly at module init
loadPersistedSessions();

function revokeJti(jti: string, exp: number): void {
  if (!jti) return;
  revokedJtis.set(jti, typeof exp === 'number' ? exp : Date.now() + SESSION_TTL_MS);
  persistSessions();
}

export function isJtiRevoked(jti: string): boolean {
  const exp = revokedJtis.get(jti);
  if (exp === undefined) return false;
  // Treat naturally-expired entries as revoked too (defensive; prune removes them).
  return true;
}

function pruneExpiredSessions() {
  const now = Date.now();
  let changed = false;
  for (const [jti, payload] of activeSessions.entries()) {
    if (payload.exp < now) {
      activeSessions.delete(jti);
      changed = true;
    }
  }
  // Prune revoked entries whose token has naturally expired (bounded memory).
  for (const [jti, exp] of revokedJtis.entries()) {
    if (exp < now) {
      revokedJtis.delete(jti);
      changed = true;
    }
  }
  if (changed) {
    persistSessions();
  }
}
setInterval(pruneExpiredSessions, 10 * 60 * 1000).unref?.();

/**
 * Generate HMAC-signed session token for authenticated user
 */
export function generateSessionToken(user: any): string {
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username || user.email || 'user',
    role: user.role,
    customerId: user.customerId,
    fullName: user.fullName,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
    jti: crypto.randomBytes(16).toString('hex'),
    // PERF FIX (audit #43): mirror the server-managed forced-change flag into
    // the signed payload so the middleware gate is O(1) instead of a DB scan.
    mustChangePassword: !!user.mustChangePassword,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', ensureSessionSecret()).update(payloadB64).digest('base64url');
  activeSessions.set(payload.jti, payload);
  persistSessions();
  return `${payloadB64}.${sig}`;
}

/**
 * Issue a refresh token (longer-lived, single-purpose). Exchanged via /api/lab-data/refresh.
 */
export function generateRefreshToken(user: any): string {
  const ttl = Math.max(SESSION_TTL_MS, 30 * 24 * 60 * 60 * 1000); // at least 30 days
  const payload: TokenPayload & { typ?: string } = {
    userId: user.id,
    username: user.username || user.email || 'user',
    role: user.role,
    customerId: user.customerId,
    fullName: user.fullName,
    iat: Date.now(),
    exp: Date.now() + ttl,
    jti: `r_${crypto.randomBytes(16).toString('hex')}`,
    typ: 'refresh'
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', ensureSessionSecret()).update(`${payloadB64}:refresh`).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', ensureSessionSecret()).update(`${payloadB64}:refresh`).digest('base64url');
    const a = Buffer.from(sigB64);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.typ !== 'refresh' || !payload.exp || Date.now() > payload.exp) return null;
    // SECURITY FIX (audit #12): revoked refresh tokens must not mint new sessions.
    if (payload.jti && revokedJtis.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Revoke a session token by its jti (used on logout). Returns true if it was an active session.
 */
export function revokeSessionToken(token: string): boolean {
  const payload = decodeTokenUnsafe(token);
  if (!payload) return false;
  const existed = activeSessions.delete(payload.jti);
  revokeJti(payload.jti, payload.exp);
  return existed;
}

/**
 * Explicitly revoke a refresh token by its jti (used on logout so that the
 * stateless refresh token cannot be replayed into a new session afterwards).
 */
export function revokeRefreshTokenByPayload(payload: TokenPayload | null): void {
  if (!payload || payload.typ !== 'refresh' || !payload.jti) return;
  revokeJti(payload.jti, payload.exp);
}

/**
 * Revoke ALL active session tokens belonging to a user (used on logout so no
 * stale token survives, and by admin "force sign-out" flows). Refresh tokens
 * are stateless HMACs, but their jtis live in the same registry namespace and
 * are blacklisted here too via `extraRefreshJtis`, so a logged-out user cannot
 * exchange an old refresh token for a new session.
 */
export function revokeAllUserSessions(userId: string, extraRefreshJtis: Array<{ jti: string; exp: number }> = []): number {
  let count = 0;
  for (const [jti, payload] of activeSessions.entries()) {
    if (payload.userId === userId) {
      activeSessions.delete(jti);
      revokeJti(jti, payload.exp);
      count++;
    }
  }
  for (const { jti, exp } of extraRefreshJtis) {
    if (jti) revokeJti(jti, exp);
  }
  return count;
}

function decodeTokenUnsafe(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Verify signed session token
 */
export function verifySessionToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', ensureSessionSecret()).update(payloadB64).digest('base64url');
    const a = Buffer.from(sigB64);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired token
    }
    if (payload.jti && revokedJtis.has(payload.jti)) {
      return null; // Explicitly revoked (logout)
    }
    return payload;
  } catch {
    return null;
  }
}

// 2FA pending OTP in-memory store
interface PendingOtpSession {
  userId: string;
  code: string;
  expiresAt: number;
  user: any;
  attempts: number;   // failed verification attempts
  lockedUntil: number; // brute-force lock timestamp (ms)
}
const pendingOtpSessions = new Map<string, PendingOtpSession>();

const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MS = 5 * 60 * 1000; // 5-minute lock after too many wrong attempts

/**
 * SECURITY FIX (audit #6 — OTP in logs): the pending session stores only an
 * HMAC-SHA256 digest of the 5-digit code keyed by SESSION_SECRET, never the
 * code itself. A heap snapshot, core dump or a future debug-log of this Map
 * can no longer be replayed into a valid 2FA bypass. Verification stays
 * constant-time (same-length digests), and brute-force resistance is
 * unchanged: guessing still requires hitting the verify endpoint, which is
 * attempt-limited and lockable below.
 */
function otpDigest(code: string): Buffer {
  // BUG FIX: previously this used `process.env.SESSION_SECRET || 'dev-otp-key'`
  // directly, which (a) silently fell back to a hardcoded public key when the
  // env var was unset, and (b) bypassed the resolved/persisted secret entirely.
  // ensureSessionSecret() is the single source of truth: it throws in
  // production if SESSION_SECRET is missing and otherwise returns the same key
  // used to sign session/refresh tokens.
  return crypto
    .createHmac('sha256', ensureSessionSecret())
    .update(String(code))
    .digest();
}

export function createPendingOtp(user: any, code: string): string {
  const tempToken = crypto.randomBytes(24).toString('hex');
  pendingOtpSessions.set(tempToken, {
    userId: user.id,
    code: otpDigest(code).toString('hex'),
    expiresAt: Date.now() + 120 * 1000, // 2 minutes
    user,
    attempts: 0,
    lockedUntil: 0
  });
  return tempToken;
}

/**
 * Returns:
 *  - user object on success
 *  - null when code is wrong (increments attempt counter / locks after OTP_MAX_ATTEMPTS)
 *  - 'locked' when the temp session is rate-limited
 */
export function verifyPendingOtp(tempToken: string, code: string): any | null | 'locked' {
  const session = pendingOtpSessions.get(tempToken);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    pendingOtpSessions.delete(tempToken);
    return null;
  }
  if (session.lockedUntil && Date.now() < session.lockedUntil) {
    return 'locked';
  }
  // SECURITY FIX (audit #6): compare the HMAC digest of the submitted code
  // against the stored digest — constant-time, equal-length, and the raw code
  // never persists in the session record.
  const a = Buffer.from(session.code, 'hex');
  const b = otpDigest((code || '').trim());
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) {
    session.attempts += 1;
    if (session.attempts >= OTP_MAX_ATTEMPTS) {
      session.lockedUntil = Date.now() + OTP_LOCK_MS;
      session.attempts = 0;
    }
    return null;
  }
  pendingOtpSessions.delete(tempToken);
  return refreshOtpSessionUser(session);
}

/**
 * Re-resolve the OTP session's cached user against the live database so flags
 * like mustChangePassword (persisted after login) survive the OTP step.
 */
function refreshOtpSessionUser(session: PendingOtpSession): any {
  try {
    const current = getDatabaseState();
    const fresh = current.profiles.find((p: any) => p.id === session.userId);
    if (fresh) {
      session.user = fresh;
      return fresh;
    }
  } catch {
    /* fall back to cached user */
  }
  return session.user;
}

export function resendPendingOtp(tempToken: string, newCode: string): boolean {
  const session = pendingOtpSessions.get(tempToken);
  if (!session) return false;
  session.code = otpDigest(newCode).toString('hex'); // audit #6: digest at rest
  session.expiresAt = Date.now() + 120 * 1000;
  session.attempts = 0;      // reset attempt counter on resend
  session.lockedUntil = 0;   // clear lock on resend
  return true;
}

export function sanitizeProfile(profile: any): any {
  if (!profile) return profile;
  const { password, mustChangePassword, ...safe } = profile;
  // mustChangePassword is a non-sensitive boolean flag — re-expose it so the
  // client can enforce the forced-password-change flow after login.
  safe.mustChangePassword = !!(mustChangePassword || isLegacyPlaintextPassword(password));
  return safe;
}

export function sanitizeDatabaseState(state: LabDatabaseState, role?: string, customerId?: string): Partial<LabDatabaseState> {
  const safeProfiles = (state.profiles || []).map(p => sanitizeProfile(p));

  // Role: Admin gets full database without passwords
  if (role === 'admin') {
    return {
      ...state,
      profiles: safeProfiles,
      // FIX (audit #34): currentUserId is a GLOBAL "last login wins" field —
      // with concurrent users it reflects some other device's session and must
      // not leak. Identity always comes from the verified Bearer token.
      currentUserId: undefined
    };
  }

  // Role: Operator gets full operational data (customers, reports, invoices, etc.) without passwords and without raw admin secrets
  if (role === 'operator') {
    return {
      version: state.version,
      lastUpdated: state.lastUpdated,
      currentUserId: undefined, // audit #34: never expose another device's active user id
      profiles: safeProfiles,
      customers: state.customers || [],
      reports: state.reports || [],
      invoices: state.invoices || [],
      accounting: state.accounting || [],
      calibrations: state.calibrations || [],
      dispatches: state.dispatches || [],
      technicians: state.technicians || [],
      envLogs: state.envLogs || [],
      media: state.media || [],
      smsLogs: state.smsLogs || [],
      trashCustomers: state.trashCustomers || []
    };
  }

  // Role: Customer gets ONLY their own data
  if (role === 'customer' && customerId) {
    return {
      version: state.version,
      lastUpdated: state.lastUpdated,
      currentUserId: undefined, // audit #34: no cross-device active-user disclosure
      profiles: safeProfiles.filter(p => p.customerId === customerId),
      customers: (state.customers || []).filter(c => c.id === customerId),
      reports: (state.reports || []).filter(r => r.customerId === customerId && r.status === 'approved'),
      invoices: (state.invoices || []).filter(i => i.customerId === customerId),
      accounting: (state.accounting || []).filter(a => a.customerId === customerId),
      calibrations: [], // audit #20: internal equipment data is not customer-facing
      dispatches: (state.dispatches || []).filter(d => d.customerId === customerId),
      technicians: [],
      envLogs: [],
      // SECURITY FIX (audit #19): customers previously received the FULL media
      // array — every other customer's base64 project photos. The client-side
      // getMediaItems(customerId) filter only hid them in the UI; the leak was
      // at the API layer. Filter server-side by ownership now.
      media: (state.media || []).filter((m: any) => m.customerId === customerId),
      smsLogs: [],
      trashCustomers: []
    };
  }

  // Unauthenticated public visitor (landing page certificate verification & public info)
  // SECURITY FIX #6: previously guests received the FULL approved-report list —
  // every customer name, project, location, truck batch and strength result —
  // plus all base64 media and staff names. That is a bulk data leak of client
  // projects. Guests now get NOTHING in the sync payload; certificate
  // verification happens through the dedicated single-record endpoint
  // POST /api/lab-data/verify-report (exact code match, minimal fields).
  // Emergency escape hatch: PUBLIC_FULL_SYNC=1 restores the old behavior for
  // one release if any legacy landing feature still depends on it.
  if (String(process.env.PUBLIC_FULL_SYNC || '').trim().toLowerCase() === '1') {
    return {
      version: state.version,
      lastUpdated: state.lastUpdated,
      currentUserId: undefined, // audit #34
      profiles: safeProfiles.map(p => ({ id: p.id, fullName: p.fullName, role: p.role, avatarUrl: p.avatarUrl })),
      customers: [],
      reports: (state.reports || []).filter(r => r.status === 'approved'),
      invoices: [],
      accounting: [],
      calibrations: state.calibrations || [],
      dispatches: [],
      technicians: [],
      envLogs: [],
      media: state.media || [],
      smsLogs: [],
      trashCustomers: []
    };
  }

  return {
    version: state.version,
    lastUpdated: state.lastUpdated,
    currentUserId: undefined, // audit #34
    profiles: [],
    customers: [],
    reports: [],
    invoices: [],
    accounting: [],
    // SECURITY FIX (audit #20): equipment calibration records (device serials,
    // dates, reference standards) are internal operational data and were being
    // handed to anonymous guests by default. Guests must receive nothing here;
    // public certificate verification uses POST /api/lab-data/verify-report.
    calibrations: [],
    dispatches: [],
    technicians: [],
    envLogs: [],
    media: [],
    smsLogs: [],
    trashCustomers: []
  };
}

// SECURITY FIX #6: minimal, non-enumerable view of ONE approved report for the
// public QR-certificate verifier on the landing page. Returns null when the
// code matches no approved record. Only fields needed to display/validate the
// certificate are exposed — never internal ids, operator emails or media.
export function verifyReportForPublic(code: string): any | null {
  const raw = String(code || '').trim().toLowerCase();
  if (!raw || raw.length > 64) return null;
  const state = getDatabaseState();
  // SECURITY FIX (audit #25): drop the internal `id` lookup. Report ids
  // (rep-xxxxx-yyyy) carry limited entropy, so matching on them turned this
  // public endpoint into an enumeration oracle. Only human-printed codes —
  // the report number and the truck/batch number — are verifiable.
  const found = (state.reports || []).find(
    (r: any) => r.status === 'approved' && (
      String(r.reportNo || '').toLowerCase() === raw ||
      String(r.truckBatchNo || '').toLowerCase() === raw
    )
  );
  if (!found) return null;
  return {
    reportNo: found.reportNo,
    customerName: found.customerName,
    projectName: found.projectName,
    concreteGrade: found.concreteGrade,
    targetStrengthMpa: found.targetStrengthMpa,
    samplingDateJalali: found.samplingDateJalali,
    breaking28dStrengthMpa: found.breaking28dStrengthMpa ?? null,
    breaking7dStrengthMpa: found.breaking7dStrengthMpa ?? null,
    isPassed: found.isPassed ?? null,
    approvedByName: found.approvedByName ?? null,
    approvalDateJalali: found.approvalDateJalali ?? null,
    status: found.status
  };
}

// Ensure data directory exists
function ensureDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.error('Failed to create data directory:', e);
    }
  }
}

// Load initial seed dataset if available
function loadInitialSeed(): Partial<LabDatabaseState> | null {
  try {
    if (fs.existsSync(SEED_FILE)) {
      const raw = fs.readFileSync(SEED_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading initial_seed_data.json:', e);
  }
  return null;
}

// AUDIT FIX (#69): the sole-admin id was a bare string literal repeated at
// every call site (including `createdBy: 'usr-admin-01'` below), so changing
// it for a migration/multi-tenant layout meant hunting magic strings. It is
// now a single env-overridable constant shared with src/types/index.ts.
export const SOLE_ADMIN_ID = (process.env.SOLE_ADMIN_ID || 'usr-admin-01').trim() || 'usr-admin-01';

// NOTE (dead-flag cleanup): an in-memory `adminMustChangePassword` flag used to
// live here, but it was never set and never read by any response path — a stale
// leftover from earlier designs. The forced-change gate is now driven entirely
// by the PERSISTED per-profile `mustChangePassword` field (set by
// repairCorruptedCredentials / tryBootstrapAdminPassword, cleared by
// updateUserPassword), which survives restarts and works for every account.

export const SOLE_ADMIN_PROFILE = {
  id: SOLE_ADMIN_ID,
  email: `admin@${SITE_EMAIL_DOMAIN}`,
  username: SOLE_ADMIN_USERNAME,
  // Bootstrap credential comes from ADMIN_INITIAL_PASSWORD env only (no
  // hard-coded default). If unset, this account is non-loginable until an
  // out-of-band reset (see tryBootstrapAdminPassword / CLI repair script).
  password: BOOTSTRAP_ADMIN_HASH,
  fullName: process.env.ADMIN_FULL_NAME || 'مدیر ارشد آزمایشگاه',
  role: 'admin',
  phone: process.env.ADMIN_PHONE || '',
  status: 'active',
  createdAt: '2025-01-01T08:00:00Z'
};

/**
 * Unusable placeholder hash for accounts that have NO valid credential.
 * It carries a random, per-process secret that is never exposed anywhere, so
 * such accounts are strictly NON-LOGINABLE until an admin resets their
 * password. This replaces the previous behavior of silently falling back to
 * the admin bootstrap credential (Admin@123), which was a severe security hole.
 *
 * CRITICAL (regression fixed this round): the value keeps a stable `unusable`
 * marker segment. Without it the placeholder looked like a malformed `scrypt:`
 * hash, so isFakeClientScryptHash() flagged it as corrupted and
 * repairCorruptedCredentials() re-stamped it on EVERY load — an endless
 * write/repair loop that also destroyed freshly repaired credentials.
 */
const UNUSABLE_PASSWORD_HASH = `scrypt:unusable:${crypto.randomBytes(32).toString('hex')}`;

/** True when a stored value is a non-loginable unusable placeholder. */
export function isUnusablePasswordHash(stored?: string): boolean {
  return typeof stored === 'string' && stored.startsWith('scrypt:unusable:');
}

/**
 * SECURITY FIX (audit #1 — committed credential leak): the seeded JSON
 * database used to ship with the admin hash of the well-known public default
 * 'Admin@123' (verified offline: scryptSync('Admin@123', <committed salt>)
 * equals the committed digest). data/ is now git-ignored and was removed from
 * the index, but every deployment that restored an old copy of the DB still
 * has an admin account whose password is public knowledge. On every load we
 * detect that exact hash and install the non-loginable placeholder instead —
 * the operator must then set ADMIN_INITIAL_PASSWORD (a strong unique value)
 * or call POST /api/lab-data/reset-bootstrap-password to regain access.
 */
const LEAKED_DEFAULT_ADMIN_SALT = '6a5dbb905248ccf696b12f584dca7449';
const LEAKED_DEFAULT_ADMIN_DIGEST =
  '219c899b86f4693413c9f42206edd9f23c8a6a858c5f9082682856e47a61eab0' +
  '329f8b859eed5b3f6fb2629d4dfd1b30f13d20becc4b9732fd42cf8a2167e7ec';
let leakedDefaultAdminHashCache: string | null = null;
function leakedDefaultAdminHash(): string {
  if (leakedDefaultAdminHashCache === null) {
    try {
      const derived = crypto
        .scryptSync('Admin@123', LEAKED_DEFAULT_ADMIN_SALT, 64)
        .toString('hex');
      // Only treat it as "the leaked hash" if recomputation matches the
      // committed digest (guards against future scrypt-parameter changes).
      leakedDefaultAdminHashCache = derived === LEAKED_DEFAULT_ADMIN_DIGEST
        ? `scrypt:${LEAKED_DEFAULT_ADMIN_SALT}:${derived}`
        : '';
    } catch {
      leakedDefaultAdminHashCache = '';
    }
  }
  return leakedDefaultAdminHashCache;
}

/** True when a stored value is the known-leaked hash of the public default. */
export function isLeakedDefaultAdminHash(stored?: unknown): boolean {
  const leaked = leakedDefaultAdminHash();
  return !!leaked && typeof stored === 'string' && stored.trim() === leaked;
}

/**
 * Safely hash a possibly-invalid password; on hashing failure return the
 * unusable placeholder (account stays non-loginable) instead of any real
 * credential.
 */
function safeHashOrPlaceholder(password?: string): string {
  try {
    return hashPassword(password || '');
  } catch {
    return UNUSABLE_PASSWORD_HASH;
  }
}

/**
 * Normalize any stored password value into a scrypt hash:
 * - already hashed -> keep as-is
 * - legacy plaintext (e.g. 'Ag12258' from old JSON seeds) -> hash it (one-time
 *   auto-migration; authenticateUser flags usedLegacyPassword so the client can
 *   force an immediate password change)
 * - empty/invalid -> unusable placeholder: the account CANNOT log in until its
 *   password is explicitly reset (never falls back to the admin credential)
 */
export function normalizeStoredPassword(stored?: string, trusted = false): string {
  // `trusted` marks a write performed by server-internal credential flows
  // (tryBootstrapAdminPassword / updateUserPassword) whose value is a freshly
  // generated genuine scrypt hash. Without this flag the fake-hash guard below
  // cannot distinguish a real server hash from a legacy client PBKDF2 digest
  // that happens to share the same shape — which silently refused every
  // bootstrap/forced password reset ("reset succeeded but login still fails").
  // CRITICAL (regression fixed this round): empty / missing values MUST stay
  // empty. Callers use '' to mean "no credential supplied" (e.g. an OTP-only
  // profile edit, or resolveCredential() dropping a bogus client echo). The
  // previous version stamped a random UNUSABLE placeholder here on every save,
  // which (a) corrupted passwordless profiles and (b) made the placeholder
  // shape itself look like a genuine hash to repairCorruptedCredentials(),
  // feeding an endless load→save loop.
  // EXCEPTION: a MISSING value (undefined/null — e.g. a sanitized profile from
  // a client sync where the password field was stripped) is intentionally
  // normalized to the stable non-loginable placeholder so the account cannot
  // be logged into with a stale/unknown credential. An EMPTY STRING still
  // means "explicitly passwordless" and stays untouched.
  const raw = typeof stored === 'string' ? stored.trim() : (stored == null ? '__MISSING__' : '');
  if (raw === '__MISSING__') return UNUSABLE_PASSWORD_HASH;
  if (!raw) return '';
  // FIX (credential-repair S2/S3): an already-healed / intentionally-locked
  // placeholder must survive normalization VERBATIM. Without this, every save
  // path that re-normalizes a profile (enforceSoleAdminRules on sync, the
  // admin branch below, prepareStateForSave) minted a NEW random UNUSABLE
  // hash — so the in-memory state and the DB file drifted apart within one
  // process and credentialMap carry-over comparisons (`pwd ===
  // UNUSABLE_PASSWORD_HASH`, stale-echo checks) silently stopped matching.
  if (isUnusablePasswordHash(raw) || isLegacyUnusableShape(raw)) return raw;
  // SECURITY FIX (audit #1): the leaked public-default hash is never a usable
  // credential — installing it anywhere would re-open the committed-DB hole.
  if (isLeakedDefaultAdminHash(raw)) return UNUSABLE_PASSWORD_HASH;
  // Trusted server-internal hash: accept genuine-format scrypt hashes verbatim.
  if (trusted && raw.startsWith('scrypt:') && !isFakeClientScryptHash(raw)) return raw;
  // SECURITY FIX (audit #2 — credential pass-through, COMPLETE): NO untrusted
  // caller may store a `scrypt:`-prefixed value verbatim — not even a
  // well-formed one. Previously any genuine-format hash passed straight
  // through, so a remote attacker could POST password="scrypt:<own-salt>:
  // <own-digest>" (a digest of their own choosing, computable offline) via
  // add-profile / sync-collection and install a self-known credential — an
  // account-takeover backdoor. Clients only ever receive SANITIZED profiles
  // (password stripped), so a legitimate flow can NEVER present a genuine
  // hash it did not forge. Genuine hashes are written exclusively by
  // hashPassword() or by trusted internal flows (normalizeStoredPassword(x,
  // true) / updateProfileServer({trusted:true})).
  // Legacy client-side PBKDF2 digests (mislabelled `scrypt:` by old builds)
  // can never be verified by Node's real scrypt either — both shapes become
  // the non-loginable placeholder until a manager resets the credential.
  if (raw.startsWith('scrypt:')) {
    if (isUnusablePasswordHash(raw) || isLegacyUnusableShape(raw)) return raw;
    return UNUSABLE_PASSWORD_HASH;
  }
  if (raw.length > 0) return safeHashOrPlaceholder(raw);
  return '';
}

/**
 * True when a value is a REAL plaintext credential awaiting one-time hashing
 * (not a stored hash, not an intentional non-loginable placeholder). Used by
 * enforceSoleAdminRules so genuine passwords arriving via whole-collection
 * client syncs are hashed instead of being silently dropped in favour of the
 * stored credential.
 */
function isRealPlaintextCredential(value?: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith('scrypt:')) return false;
  // Legacy client sanitizer produced `hashed:<sha256hex>` digests — those are
  // unverifiable fake credentials, never treat them as plaintext passwords.
  if (/^hashed:[a-f0-9]{32,}$/i.test(v)) return false;
  return true;
}

/**
 * True when a profile carries NO usable stored credential at all: missing /
 * empty value, an intentional non-loginable placeholder, or an unverifiable
 * legacy-fake digest. Genuine server-format scrypt hashes and legacy plaintext
 * seeds count as "usable" (the latter is one-time-migrated to a real hash).
 * Used to decide whether a routine save may (re-)stamp the password field —
 * passwordless OTP-only staff profiles must keep their custom fields intact.
 */
export function hasNoUsableStoredCredential(stored?: unknown): boolean {
  if (typeof stored !== 'string') return true;
  const v = stored.trim();
  if (!v) return true;
  if (isUnusablePasswordHash(v) || isLegacyUnusableShape(v)) return true;
  if (v.startsWith('scrypt:')) return !isGenuineServerScryptHash(v);
  // Non-scrypt value: only counts as usable if it is a genuine plaintext
  // credential that can be migrated to a real hash.
  return !isRealPlaintextCredential(v);
}

/**
 * BUG FIX (credential-repair detection failure): legacy client builds hashed
 * passwords with WebCrypto PBKDF2 but mislabelled the result `scrypt:`. Those
 * digests carry a 64-hex-char salt plus a 128-hex-char digest — a shape the
 * previous length-only check (`parts[1].length !== 32`) accepted as genuine,
 * so every fake PBKDF2 digest was classified as a real server hash and poisoned
 * accounts stayed corrupted forever. A REAL server hash ALWAYS uses
 * crypto.randomBytes(16) → exactly 32 lowercase hex chars for the salt, and
 * scryptSync keylen 64 → exactly 128 lowercase hex chars for the digest. Any
 * `scrypt:` value deviating from that strict hex shape cannot have been
 * produced by this server and must be flagged for repair.
 */
const HEX_32_RE = /^[0-9a-f]{32}$/i;
const HEX_128_RE = /^[0-9a-f]{128}$/i;
export function isFakeClientScryptHash(stored?: string): boolean {
  if (typeof stored !== 'string') return false;
  // Non-loginable placeholders are intentional, not corrupted — never flag them.
  if (isUnusablePasswordHash(stored)) return false;
  // Legacy placeholder shape `scrypt:<64hex>:<64hex>` carries no recoverable
  // credential and must be reported as fake/unusable so callers treat the
  // account as locked (not genuine) and repair logic can re-stamp it.
  if (isLegacyUnusableShape(stored)) return true;
  if (!stored.startsWith('scrypt:')) return false;
  const parts = stored.split(':');
  return (
    parts.length !== 3 ||
    !HEX_32_RE.test(parts[1]) ||
    !HEX_128_RE.test(parts[2])
  );
}

/** True when the stored value has the exact genuine server scrypt shape. */
export function isGenuineServerScryptHash(stored?: string): boolean {
  return typeof stored === 'string' && stored.startsWith('scrypt:') && !isFakeClientScryptHash(stored);
}

// Legacy placeholder shape (pre-marker builds): `scrypt:<64hex>:<64hex>`.
// Such values carry no recoverable credential — treat them as unusable too.
function isLegacyUnusableShape(stored: string): boolean {
  const parts = stored.split(':');
  return parts.length === 3 && parts[1].length === 64 && parts[2].length === 64;
}

/**
 * BUG FIX (credential-repair S2/S3): well-formed scrypt digests whose salt is
 * NOT one this server ever generated. Server-produced salts come exclusively
 * from crypto.randomBytes(16).toString('hex') — an in-memory secret space of
 * 2^128 — so re-encountering the SAME salt across different accounts is
 * overwhelming evidence the pair was injected wholesale by a client (stale
 * echo / forged backdoor attempt), not produced here. Genuine user-chosen
 * hashes all carry unique random salts and are NEVER touched by this rule.
 */
function looksLikeReusedForeignSalt(pwd: string, selfId: string | undefined, profiles: any[]): boolean {
  const parts = pwd.split(':');
  if (parts.length !== 3) return true;
  const salt = parts[1];
  // A salt this very process minted (hashPassword / bootstrap fallback) is
  // server-issued by construction — never "foreign", even when the SAME
  // BOOTSTRAP_ADMIN_HASH legitimately sits on several healed accounts.
  if (serverIssuedScryptSalts.has(salt)) return false;
  let sameSaltCount = 0;
  for (const other of profiles) {
    if (!other) continue;
    if (selfId !== undefined && String(other.id) === String(selfId)) continue;
    const opwd = typeof other.password === 'string' ? other.password.trim() : '';
    if (opwd.startsWith('scrypt:') && opwd.split(':')[1] === salt) sameSaltCount++;
  }
  return sameSaltCount > 0;
}

/**
 * Load-time credential healing decision for a GENUINE-SHAPE `scrypt:` value.
 * Repair it ONLY when there is concrete evidence it was not produced by this
 * server:
 *  - the leaked public-default hash (handled separately by callers), or
 *  - a salt reused across accounts (impossible for server-generated salts).
 * Everything else (unique-salt custom passwords, freshly written bootstrap
 * hashes) is left untouched — shape alone can NEVER justify destroying a
 * credential, otherwise legitimate custom passwords would be bricked on every
 * restart.
 */
function shouldRepairWellFormedHash(pwd: string, selfId: string | undefined, profiles: any[]): boolean {
  if (isLeakedDefaultAdminHash(pwd)) return true;
  return looksLikeReusedForeignSalt(pwd, selfId, profiles);
}

/**
 * Snapshot of the credentials currently held in the live store, keyed by id /
 * username / email. Used by save paths to distinguish a STALE CLIENT ECHO
 * (value identical to what the store already holds for some account — clients
 * only ever receive sanitized profiles, so such echoes originate from old
 * poisoned local caches) from a value freshly written by a server-internal
 * flow during this very request.
 */
function buildStoredCredentialSnapshot(profiles: any[] | undefined): Set<string> {
  const snap = new Set<string>();
  if (!Array.isArray(profiles)) return snap;
  for (const p of profiles) {
    if (!p || typeof p.password !== 'string') continue;
    const v = p.password.trim();
    if (v.startsWith('scrypt:') && !isUnusablePasswordHash(v)) snap.add(v);
  }
  return snap;
}

/**
 * SECURITY FIX #1 companion: self-heal corrupted / legacy-fake credential
 * hashes at load time. The production database contained an admin password
 * labelled `scrypt:` that Node's real scrypt could never verify (produced by
 * an old client build), permanently locking the manager out. Any such value is
 * replaced here with the env-driven bootstrap hash (or a non-loginable
 * placeholder when ADMIN_INITIAL_PASSWORD is unset), persisted once, and the
 * account is flagged for a forced password change on first login.
 *
 * CRITICAL GUARD (bug fixed this round): accounts WITHOUT a stored password at
 * all — e.g. OTP-only staff profiles, which authenticate through the SMS flow
 * and are created without a `password` field — MUST be left untouched. The
 * previous version fell through into the repair branch for those records and
 * stamped them with a random UNUSABLE placeholder hash, silently corrupting
 * their credentials on every restart.
 */
export function repairCorruptedCredentials(
  state: LabDatabaseState,
  referenceProfiles?: any[],
): boolean {
  let changed = false;
  // Snapshot of credentials already trusted in the store (live cache or the
  // on-disk copy handed in by normalizeLoadedState). A well-formed scrypt
  // digest that matches a known-good stored credential is genuine by
  // definition — it was produced and persisted by THIS server earlier.
  const knownGoodCredentials = buildStoredCredentialSnapshot(referenceProfiles);
  for (const p of state.profiles || []) {
    const pwd = typeof p.password === 'string' ? p.password.trim() : '';
    // No stored credential at all → NOT a corruption case. Leave the profile
    // exactly as-is (OTP-only users keep working; empty-password users remain
    // non-loginable until someone sets a password via update-password).
    if (!pwd) continue;
    // Intentional non-loginable placeholders (current + legacy shapes) are
    // NOT corruption — leave them stable so no endless repair loop occurs.
    if (isUnusablePasswordHash(pwd) || isLegacyUnusableShape(pwd)) continue;
    // BUG FIX (credential-repair S2/S3): a WELL-FORMED `scrypt:` digest is
    // repaired ONLY when there is concrete evidence it was not produced by
    // this server: it matches no known-good stored credential AND either has
    // a salt reused across accounts or is the leaked public-default hash
    // (see shouldRepairWellFormedHash). Fake PBKDF2 digests with a 64-hex
    // "salt" segment fail the reuse heuristic differently than real random
    // salts, and unique-salt genuine custom passwords are NEVER touched.
    // The bootstrap credential THIS module installed (healed admin / fresh
    // seed) is genuine by construction. It cannot appear in the known-good
    // reference snapshots taken before the first repair pass, and after a
    // restart its random salt is no longer verifiable — without this check the
    // reuse heuristic would re-brick the working bootstrap account on every
    // subsequent cold load.
    if (pwd === BOOTSTRAP_ADMIN_HASH) continue;
    if (pwd.startsWith('scrypt:') &&
        !knownGoodCredentials.has(pwd) &&
        shouldRepairWellFormedHash(pwd, p.id, state.profiles || [])) {
      // SECURITY (credential-repair S2/S3): the bootstrap credential must be
      // installed ONLY on the sole-admin account. The id/username equality
      // check alone was hijackable: repairCorruptedCredentials runs BEFORE
      // enforceSoleAdminRules demotes rogue `role:'admin'` profiles to
      // operator, so a forged non-admin profile claiming the admin id would
      // have received the working ADMIN_INITIAL_PASSWORD credential while the
      // real admin got the non-loginable placeholder. Requiring role==='admin'
      // closes that window (the real sole admin always carries role 'admin').
      const isSoleAdmin = (p.id === SOLE_ADMIN_ID || p.username === SOLE_ADMIN_USERNAME) &&
        p.role === 'admin';
      if (isSoleAdmin) {
        p.password = BOOTSTRAP_ADMIN_HASH;
        p.mustChangePassword = true;
      } else {
        // Non-admin accounts: make non-loginable until the manager resets
        // them explicitly (never silently grant the bootstrap credential).
        p.password = UNUSABLE_PASSWORD_HASH;
        p.mustChangePassword = true;
      }
      changed = true;
      continue;
    }
    // SECURITY FIX (audit #1): the committed seed DB carried the hash of the
    // PUBLIC default 'Admin@123'. It is a genuine-format scrypt hash, so the
    // generic corruption check below would never catch it — neutralize it here
    // on every load so no deployment can authenticate with a leaked value.
    if (isLeakedDefaultAdminHash(pwd)) {
      const isSoleAdmin = (p.id === SOLE_ADMIN_ID || p.username === SOLE_ADMIN_USERNAME) &&
        p.role === 'admin';
      p.password = isSoleAdmin ? BOOTSTRAP_ADMIN_HASH : UNUSABLE_PASSWORD_HASH;
      p.mustChangePassword = true;
      changed = true;
      continue;
    }
    // Genuine server-format scrypt hash → usable, leave alone.
    if (isGenuineServerScryptHash(pwd)) continue;
    // Anything else that carries a `scrypt:` label but deviates from the real
    // format (legacy fake PBKDF2 digests, truncated/corrupted values) is
    // unrecoverable → repair. NOTE: plain (non-scrypt) plaintext values are
    // intentionally skipped here; they are one-time-migrated to real hashes by
    // normalizeStoredPassword() during enforceSoleAdminRules().
    if (!pwd.startsWith('scrypt:')) continue;
    const isSoleAdmin = (p.id === SOLE_ADMIN_ID || p.username === SOLE_ADMIN_USERNAME) &&
      p.role === 'admin';
    if (isSoleAdmin) {
      p.password = BOOTSTRAP_ADMIN_HASH;
      p.mustChangePassword = true;
    } else {
      // Non-admin accounts: make non-loginable until the manager resets them
      // explicitly (never silently grant the bootstrap credential).
      p.password = UNUSABLE_PASSWORD_HASH;
      p.mustChangePassword = true;
    }
    changed = true;
  }
  return changed;
}

/**
 * FIX (credential-repair regression S2/S3): stamp an idempotency marker onto
 * every profile whose corrupted credential was just healed by
 * repairCorruptedCredentials(). Without this marker, the repaired placeholder
 * hash (UNUSABLE_PASSWORD_HASH / random bootstrap-fallback hash) is
 * indistinguishable from a legitimately non-loginable OTP-only account on the
 * NEXT cold load: the "intentional placeholder → leave stable" early-continue
 * in repairCorruptedCredentials() then reports `changed=false`, the whole
 * normalize pipeline skips persistence, and the healing NEVER reaches disk —
 * the DB file stayed poisoned forever while only the in-memory copy looked
 * repaired. The marker makes the persist decision survive restarts; it is
 * stripped again right before writing (see stripRepairMarkerForPersist) so it
 * never leaks into sanitized API responses or long-term data.
 */
export function applyRepairPersistenceMarkers(state: LabDatabaseState): void {
  for (const p of state.profiles || []) {
    const pwd = typeof p.password === 'string' ? p.password.trim() : '';
    // Only freshly-healed accounts carry mustChangePassword together with a
    // non-loginable/placeholder credential; legitimate passwordless profiles
    // have NO password field at all and are left untouched.
    if (p && p.mustChangePassword === true && pwd &&
        (isUnusablePasswordHash(pwd) || isFakeClientScryptHash(pwd))) {
      p.__credRepairedAt = Date.now();
    }
  }
}

/** Remove the internal repair marker from a snapshot immediately before it is
 *  serialized to disk (the live in-memory copy keeps it for this process). */
function stripRepairMarkerForPersist(obj: any): void {
  try {
    if (obj && Array.isArray(obj.profiles)) {
      for (const p of obj.profiles) {
        if (p && Object.prototype.hasOwnProperty.call(p, '__credRepairedAt')) {
          delete p.__credRepairedAt;
        }
      }
    }
  } catch { /* defensive: never block a write over marker bookkeeping */ }
}

/** True when the stored credential is still a legacy plaintext seed value. */
export function isLegacyPlaintextPassword(stored?: string): boolean {
  return typeof stored === 'string' && stored.length > 0 && !stored.startsWith('scrypt:');
}

/**
 * Resolve an incoming (possibly sanitized / fake-hashed) password value for a
 * collection sync, carrying over the authoritative stored credential whenever
 * the incoming value cannot be a genuine new password. This prevents client
 * syncs from wiping real scrypt hashes with placeholder or legacy PBKDF2
 * digests produced by older builds of the app.
 */
export function resolveIncomingCredential(incoming?: unknown, existing?: unknown): string {
  const inc = typeof incoming === 'string' ? incoming.trim() : '';
  const ex = typeof existing === 'string' ? existing.trim() : '';
  if (inc.startsWith('scrypt:') && inc.split(':').length === 3) {
    // SECURITY FIX (audit #2 — pass-through CLOSED): a `scrypt:`-shaped value
    // arriving from a client is NEVER a fresh credential — clients only ever
    // receive sanitized profiles, so anything with this prefix is a stale echo
    // or a FORGED backdoor attempt. It must never reach the credential store
    // verbatim: carry over the authoritative stored hash instead, and when no
    // stored credential exists return '' (normalizeStoredPassword then keeps
    // the profile passwordless / installs the non-loginable placeholder).
    if (ex.startsWith('scrypt:')) return ex;
    return '';
  }
  if (inc.length > 0) return inc; // legacy plaintext seed or genuine new password
  return ex;
}

/**
 * Strict Security Invariant:
 * 1. The manager is exactly one (SOLE_ADMIN_ID / SOLE_ADMIN_USERNAME) and can NEVER be changed or demoted.
 * 2. Manager / Admin access can NEVER be granted to any other user under any circumstance.
 * 3. Passwords must ALWAYS be hashed with scrypt.
 */
export function enforceSoleAdminRules(profiles: any[], existingProfiles?: any[]): any[] {
  if (!Array.isArray(profiles)) profiles = [];

  // FIX #1 (password wiped on every admin save): clients receive sanitized
  // profiles (no password field) and push whole-collection syncs back. Without
  // this credential carry-over, every 'profiles' sync replaced real scrypt
  // hashes with UNUSABLE placeholder hashes — operators/customers could no
  // longer log in after ANY profile edit by anyone. Credentials are now
  // carried over from the authoritative store unless the incoming value is a
  // genuine hash or a legacy plaintext seed awaiting one-time migration.
  const credentialMap = new Map<string, string>();
  const roleMap = new Map<string, string>();
  if (Array.isArray(existingProfiles)) {
    for (const ep of existingProfiles) {
      if (!ep) continue;
      if (ep.password) {
        const pwd = String(ep.password);
        if (pwd !== UNUSABLE_PASSWORD_HASH && !isFakeClientScryptHash(pwd)) {
          if (ep.id) credentialMap.set(String(ep.id), pwd);
          if (ep.username) credentialMap.set(String(ep.username), pwd);
          if (ep.email) credentialMap.set(String(ep.email), pwd);
        }
      }
      if (ep.role) {
        if (ep.id) roleMap.set(String(ep.id), ep.role);
        if (ep.username) roleMap.set(String(ep.username), ep.role);
        if (ep.email) roleMap.set(String(ep.email), ep.role);
      }
    }
  }
  const resolveCredential = (p: any, explicit?: unknown): string | undefined => {
    // MISSING (undefined) — sanitized client sync where the password field was
    // stripped entirely. Carry over the authoritative stored credential when
    // one exists; otherwise return undefined so normalizeStoredPassword() can
    // install the stable non-loginable placeholder (never a stale echo).
    if (explicit == null) {
      const byId = p.id ? credentialMap.get(String(p.id)) : undefined;
      const byUser = p.username ? credentialMap.get(String(p.username)) : undefined;
      const byEmail = p.email ? credentialMap.get(String(p.email)) : undefined;
      return byId ?? byUser ?? byEmail;
    }
    const inc = typeof explicit === 'string' ? explicit.trim() : '';
    // Genuine NEW passwords arrive as real plaintext (register / update
    // endpoints). Hash them — the previous version silently dropped them in
    // favour of the stored credential whenever one existed.
    if (isRealPlaintextCredential(inc)) return inc;
    // IMPORTANT: never accept an incoming `scrypt:`-labelled value verbatim —
    // clients only ever receive sanitized profiles (password stripped), so ANY
    // scrypt-shaped value pushed back is either a stale echo or a legacy fake
    // PBKDF2 digest from an old browser build. The authoritative stored hash
    // must win.
    if (inc.startsWith('scrypt:')) {
      const ex = credentialMap.get(String(p.id)) ??
                 (p.username ? credentialMap.get(String(p.username)) : undefined) ??
                 (p.email ? credentialMap.get(String(p.email)) : undefined);
      if (ex) return ex;                                    // keep stored credential
      // Genuine server-format hash written by addProfileServer / internal mutators must win
      if (isGenuineServerScryptHash(inc)) return inc;
      // No stored credential to carry over: drop the bogus client value so
      // normalizeStoredPassword() keeps the profile passwordless instead
      // of persisting an unverifiable fake hash.
      return '';
    }
    // Empty-string incoming → explicitly "no credential supplied": carry over
    // the stored credential when one exists, otherwise leave EMPTY '' so
    // passwordless profiles (OTP-only staff) are not stamped with any hash.
    const byId = p.id ? credentialMap.get(String(p.id)) : undefined;
    const byUser = p.username ? credentialMap.get(String(p.username)) : undefined;
    const byEmail = p.email ? credentialMap.get(String(p.email)) : undefined;
    return byId ?? byUser ?? byEmail ?? '';
  };

  let adminFound = false;

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const incomingPwdRaw = (p as any).password;
    if (p.id === SOLE_ADMIN_ID || p.username === SOLE_ADMIN_USERNAME) {
      p.id = SOLE_ADMIN_ID;
      p.username = SOLE_ADMIN_USERNAME;
      p.role = 'admin';
      p.fullName = p.fullName || SOLE_ADMIN_PROFILE.fullName;
      p.email = p.email || SOLE_ADMIN_PROFILE.email;
      // SECURITY (anti-hijack): a sync/save that carries NO admin credential
      // must NEVER stamp the env bootstrap password onto a healthy account —
      // that would let any authenticated client "forget" the stored hash and
      // silently switch admin login to ADMIN_INITIAL_PASSWORD. Instead: keep
      // the resolved value when present; otherwise fall back to the original
      // incoming field (a genuine hash written by server-internal flows such
      // as tryBootstrapAdminPassword/updateUserPassword), and only when there
      // is truly no credential at all install the UNUSABLE placeholder (the
      // fresh-install case is handled separately by ensureSoleAdminBootstrap).
      const adminResolved = resolveCredential(p, incomingPwdRaw);
      p.password = normalizeStoredPassword(
        adminResolved !== '' ? adminResolved
          : (typeof incomingPwdRaw === 'string' && incomingPwdRaw.trim() ? incomingPwdRaw.trim() : undefined),
        true
      );
      p.phone = p.phone || SOLE_ADMIN_PROFILE.phone;
      p.status = 'active';
      adminFound = true;
    } else {
      // If any other user has role 'admin', strictly remove it and assign 'operator'
      if (p.role === 'admin') {
        p.role = 'operator';
      }
      if (!p.role) {
        const storedRole = (p.id ? roleMap.get(String(p.id)) : undefined) ||
          (p.username ? roleMap.get(String(p.username)) : undefined) ||
          (p.email ? roleMap.get(String(p.email)) : undefined);
        if (storedRole) {
          p.role = storedRole;
        } else {
          console.warn(`[ROLES] Missing role for profile ${p.id || p.username} — defaulting to 'operator'.`);
          p.role = 'operator';
        }
      }
      p.fullName = p.fullName || p.username || 'کاربر آزمایشگاه';
      p.email = p.email || `${p.username || p.id || 'user'}@${SITE_EMAIL_DOMAIN}`;
      p.status = p.status || 'active';
      // Passwordless (OTP-only) profiles must keep ALL their custom fields.
      // Credential policy for non-admin profiles on save/sync:
      //  - genuine plaintext incoming → hash it (handled by resolveCredential)
      //  - stale/fake scrypt echo with no stored credential → drop to ''
      //  - empty-string incoming → never overwrite a stored credential
      //  - MISSING field (sanitized sync) → carry over stored credential; if
      //    there is none, leave the profile untouched (passwordless stays
      //    passwordless — do NOT stamp a placeholder on OTP-only staff).
      const resolved = resolveCredential(p, incomingPwdRaw);
      if (resolved !== undefined && resolved !== '') {
        p.password = normalizeStoredPassword(resolved, true);
      } else if (resolved === '' && hasNoUsableStoredCredential(incomingPwdRaw)) {
        p.password = normalizeStoredPassword('');
      } else if (resolved === '' && isGenuineServerScryptHash(incomingPwdRaw)) {
        p.password = incomingPwdRaw;
      }
    }
  }

  if (!adminFound) {
    // SECURITY FIX (audit #14): previously this re-injected the module-level
    // BOOTSTRAP_ADMIN_HASH (computed once from ADMIN_INITIAL_PASSWORD at load
    // time). If the admin had successfully changed their password and then an
    // admin-less sync arrived, the OLD bootstrap credential was silently
    // restored — a downgrade to a stale/weak credential. Now we carry over the
    // authoritative stored admin credential from disk when one exists, and
    // only fall back to the bootstrap hash on a genuine first-time seed.
    let adminPwd = SOLE_ADMIN_PROFILE.password;
    const existingAdmin = Array.isArray(existingProfiles)
      ? existingProfiles.find((ep: any) => ep && (String(ep.id) === SOLE_ADMIN_ID || String(ep.username) === SOLE_ADMIN_USERNAME))
      : undefined;
    const storedPwd = existingAdmin?.password ? String(existingAdmin.password) : '';
    if (storedPwd && storedPwd !== UNUSABLE_PASSWORD_HASH && !isLeakedDefaultAdminHash(storedPwd)) {
      adminPwd = normalizeStoredPassword(storedPwd, /*trusted*/ true);
    }
    profiles.unshift({ ...SOLE_ADMIN_PROFILE, password: adminPwd });
  }

  return profiles;
}

// ---------------------------------------------------------------------------
// FIX #1 (Race Condition / lost writes):
// Every read-modify-write of the database must be serialized. Previously two
// concurrent requests (e.g. SSE-triggered re-sync + a user's addReport, or two
// operators saving at the same time) each took their own snapshot via
// getDatabaseState(), mutated it and wrote it back — the second write silently
// clobbered the first one's records ("adding a record wipes data written by the
// next request"). All mutators below now run inside withDbWrite(), which is a
// simple FIFO async mutex: Node is single-threaded, so chaining promises here
// gives every mutation an exclusive, ordered critical section.
// ---------------------------------------------------------------------------
let dbWriteChain: Promise<void> = Promise.resolve();
export function withDbWrite<T>(fn: () => T | Promise<T>): Promise<T> {
  // SECURITY FIX (audit #16): previously this was `dbWriteChain.then(fn, fn)`
  // which ran fn on REJECTION of the previous mutation too — i.e. after a
  // failed write the next operation would proceed on a possibly half-applied
  // state, and the original error was swallowed by the chain-keepalive.
  // Now: swallow only the *previous* failure for chain-scheduling purposes,
  // then always run fn as a normal fulfillment handler, and propagate fn's
  // own result/error to the caller untouched.
  const run = dbWriteChain.catch(() => undefined).then(fn);
  // Keep the chain alive even if a mutation rejects (but do NOT hide the
  // rejection from the caller — `run` still carries it).
  dbWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

// In-memory cache for fast reads
let cachedState: LabDatabaseState | null = null;

// Active SSE Connections for Realtime Push across all devices/browsers
// SECURITY FIX (audit #18): each connection now carries the authenticated
// role of its owner; notifySseClients filters payloads by role so anonymous
// guests no longer learn collection names / write timing metadata.
type SseClient = { res: ServerResponse; role: string };
const sseClients = new Set<SseClient>();

export function addSseClient(res: ServerResponse, role = 'guest') {
  sseClients.add({ res, role });
}

export function removeSseClient(res: ServerResponse) {
  for (const c of Array.from(sseClients)) {
    if (c.res === res) sseClients.delete(c);
  }
}

export function notifySseClients(state: LabDatabaseState, changedCollection?: string) {
  if (sseClients.size === 0) return;

  // PERF FIX (audit #45): build each distinct role payload ONCE instead of
  // re-JSON.stringify-ing per client.
  const chunkByRole = new Map<string, string>();
  const chunkFor = (role: string) => {
    let chunk = chunkByRole.get(role);
    if (chunk === undefined) {
      const payload: any = {
        type: 'db_update',
        version: state.version,
        timestamp: state.lastUpdated
      };
      // Role-based filtering: only staff roles receive collection metadata.
      if (changedCollection && role !== 'customer' && role !== 'guest') {
        payload.collection = changedCollection;
      }
      chunk = `data: ${JSON.stringify(payload)}\n\n`;
      chunkByRole.set(role, chunk);
    }
    return chunk;
  };

  // PERF FIX (audit #45): iterate the Set directly — no Array.from() copy per
  // event — and drop clients whose socket is already destroyed/ended. The SSE
  // payloads here are tiny event notifications (not data), so write() cannot
  // realistically build buffers; backpressure is handled by the heartbeat's
  // dead-socket sweep below.
  for (const client of sseClients) {
    if (client.res.writableEnded || client.res.destroyed) {
      sseClients.delete(client);
      continue;
    }
    try {
      client.res.write(chunkFor(client.role));
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

export function sendSseHeartbeat() {
  if (sseClients.size === 0) return;
  const ping = `: heartbeat\n\n`;
  for (const client of sseClients) {
    // Dead-socket sweep: a slow/dead client that never drains or has been
    // torn down silently is removed here so its entry can't linger in the
    // set forever (audit #45).
    if (client.res.writableEnded || client.res.destroyed) {
      sseClients.delete(client);
      continue;
    }
    try {
      client.res.write(ping);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-collection version tracking (optimistic concurrency / conflict detection)
// Each collection carries its own monotonic version. Clients must send the
// baseVersion they last read with sync-collection; if the server's current
// version differs, another user wrote in the meantime and we respond 409 so
// the client can reload + merge instead of silently clobbering data.
// ---------------------------------------------------------------------------
const collectionVersions = new Map<string, number>();

export function getCollectionVersion(name: string): number {
  return collectionVersions.get(name) || 0;
}

export function getAllCollectionVersions(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of collectionVersions.entries()) out[k] = v;
  return out;
}

function bumpCollectionVersion(name: string): number {
  const next = getCollectionVersion(name) + 1;
  collectionVersions.set(name, next);
  return next;
}

// Read state from disk.
// SECURITY FIX #7 (recovery robustness): if the DB file exists but cannot be
// parsed or lacks a profiles array, we MUST NOT fall through to re-initializing
// an empty database — that would silently wipe production data on one corrupt
// write. Instead: quarantine the bad file (keep a copy), restore the newest
// automatic backup if available, and only then create a fresh initial state.
/**
 * AUDIT FIX (#94): clamp a loaded DB's lastUpdated to "now".
 * The repo-seeded data/laboratory_db.json carried a FUTURE timestamp
 * (2026-09-27, written by a machine with clock drift). The client heartbeat
 * (ConcreteLabStorage.checkHealthAndResyncIfNeeded) compares the server's
 * lastDbUpdate against its local Date.now(): a future stamp makes every
 * comparison true forever → permanent sync loops; conversely a skewed-past
 * stamp silently skips syncs. Whenever the stored stamp is ahead of the
 * current wall clock we normalize it to now and persist once, so both the
 * /api/health heartbeat and SSE consumers operate on sane values regardless
 * of the seeding machine's clock. (The long-term fix — monotonic version
 * based sync instead of clock comparison — is tracked in the checklist.)
 * Returns true when the snapshot was mutated (caller must persist).
 */
function clampFutureLastUpdated(state: LabDatabaseState): boolean {
  const now = Date.now();
  if (typeof state.lastUpdated === 'number' && state.lastUpdated > now) {
    console.warn(
      `DB lastUpdated (${new Date(state.lastUpdated).toISOString()}) is in the future ` +
        `(clock skew or seeded sample data) — clamping to now to prevent client sync loops.`,
    );
    state.lastUpdated = now;
    return true;
  }
  return false;
}

export function getDatabaseState(): LabDatabaseState {
  ensureDirExists();

  if (cachedState) {
    return cachedState;
  }

  const state = loadDatabaseStateUncached();
  cachedState = state;
  return state;
}

/**
 * PERF FIX (audit #39): role-filtered accessor for a SINGLE collection.
 * Backs GET /api/lab-data/collection/:name so the client can refetch only
 * the array that actually changed (announced via SSE `db_update` events)
 * instead of pulling the entire dataset — which includes every base64 media
 * item — on every write by any user.
 *
 * The filter mirrors sanitizeDatabaseState exactly: customers keep their
 * ownership/approval scoping per collection, guests receive the same empty
 * arrays they would from a full sync, and passwords are never exposed.
 */
export function getSanitizedCollection(
  collectionName: string,
  role?: string,
  customerId?: string
): { ok: boolean; data?: any[]; version?: number } {
  const KNOWN_COLLECTIONS = [
    'profiles', 'customers', 'reports', 'invoices', 'accounting',
    'calibrations', 'dispatches', 'technicians', 'envLogs', 'media',
    'smsLogs', 'trashCustomers'
  ];
  if (!KNOWN_COLLECTIONS.includes(collectionName)) return { ok: false };

  const state = getDatabaseState();
  const raw = (state as any)[collectionName];
  let arr: any[] = Array.isArray(raw) ? raw : [];

  // Customer scoping — identical rules to sanitizeDatabaseState().
  if (role === 'customer') {
    if (!customerId) return { ok: false };
    switch (collectionName) {
      case 'profiles':
        arr = arr.filter(p => p.customerId === customerId);
        break;
      case 'customers':
        arr = arr.filter(c => c.id === customerId);
        break;
      case 'reports':
        arr = arr.filter(r => r.customerId === customerId && r.status === 'approved');
        break;
      case 'invoices':
      case 'accounting':
      case 'dispatches':
        arr = arr.filter((x: any) => x.customerId === customerId);
        break;
      case 'media':
        arr = arr.filter((m: any) => m.customerId === customerId);
        break;
      default:
        // calibrations / technicians / envLogs / smsLogs / trashCustomers:
        // not customer-facing — same empty result as the full-sync sanitizer.
        arr = [];
    }
  } else if (role !== 'admin' && role !== 'operator') {
    // Unauthenticated guest: mirror the locked-down default branch of
    // sanitizeDatabaseState — guests get nothing bulk.
    arr = [];
  }

  // Profiles must go through the same password-stripping sanitizer.
  if (collectionName === 'profiles') {
    arr = arr.map(p => sanitizeProfile(p));
  }

  return { ok: true, data: arr, version: getCollectionVersion(collectionName) };
}

/**
 * Disk-load + credential normalization pipeline.
 * IMPORTANT: the normalize path must never call saveStateToDisk() — the old
 * implementation set `cachedState` first and then saved, which re-entered
 * getDatabaseState() through the save path and produced a half-initialized
 * live cache. Instead we persist the normalized snapshot with a single atomic
 * write at the end.
 *
 * PERF FIX (audit #37/#38/#42): cold-load is now fully ASYNC (fs.promises —
 * no blocking existsSync/readFileSync/copyFileSync on the event loop), the
 * repair+enforce passes run EXACTLY ONCE per load (#42), the result is
 * memoized in the module-level `cachedState` (repeated calls after the first
 * hit are pure O(1) cache reads — a container restart loop can no longer
 * trigger repeated heavy repair+write cycles), and concurrent callers share a
 * single in-flight load promise instead of racing duplicate disk pipelines.
 */
let dbLoadPromise: Promise<LabDatabaseState> | null = null;

export function loadDatabaseStateAsync(): Promise<LabDatabaseState> {
  ensureDirExists();
  if (cachedState) return Promise.resolve(cachedState);
  if (!dbLoadPromise) {
    const p = loadDatabaseStateUncachedAsync()
      .then((state) => {
        // Publish only if nobody else populated the cache in the meantime
        // (e.g. a restoreNamedBackup / bootstrap completed during our await).
        if (!cachedState) cachedState = state;
        return cachedState!;
      })
      .finally(() => {
        if (dbLoadPromise === p) dbLoadPromise = null;
      });
    dbLoadPromise = p;
  }
  return dbLoadPromise;
}

async function loadDatabaseStateUncachedAsync(): Promise<LabDatabaseState> {
  // CONCURRENCY/ORDERING FIX (credential-repair S2/S3): await the persisted
  // salt-registry flush BEFORE any disk read / repair pass. registerServer-
  // IssuedScryptHash() (BOOTSTRAP_ADMIN_HASH at module init, every hashPass-
  // word() call) queues an async write; without this barrier a cold load that
  // starts within the same tick can judge freshly-minted server credentials as
  // "foreign salts" and re-brick them — plus short-lived tooling processes
  // (tests run each scenario in `node -e`) could exit before the registry hit
  // disk, poisoning the NEXT process's repair decisions.
  await persistServerSalts();
  loadPersistedSessions();

  // CONCURRENCY FIX (credential-repair S2): the boot-warm async loader and a
  // synchronous cold-load via getDatabaseState() can interleave across awaits
  // (normalizeLoadedState() yields at every persist). Whoever finishes first
  // publishes `cachedState`; a late arriver must adopt that already-normalized
  // snapshot instead of re-running its own pipeline over the raw disk copy —
  // otherwise its stale pre-normalize profile references resurrect repaired
  // placeholder hashes over the genuine credentials (and vice versa), and the
  // last writer clobbers the healed DB file.
  if (cachedState) return cachedState;

  let dbFileWasReadable = false;
  let raw: string | null = null;
  try {
    raw = await fs.promises.readFile(DB_FILE, 'utf-8');
    dbFileWasReadable = true;
  } catch (e: any) {
    if (e && e.code !== 'ENOENT') {
      console.error('Error reading laboratory_db.json:', e);
      dbFileWasReadable = true; // file exists but unreadable → recovery path
    }
  }

  if (dbFileWasReadable && raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.profiles)) {
        const normalized = await normalizeLoadedState(parsed);
        if (cachedState && cachedState !== normalized) return cachedState;
        return normalized;
      }
    } catch (err) {
      console.error('Error reading laboratory_db.json:', err);
    }
  }

  // SECURITY FIX #7: the file existed but was corrupt/invalid. Quarantine it
  // (never delete) and try to recover from the newest automatic backup before
  // ever falling back to a fresh initial state — one bad write must not wipe
  // production data silently.
  if (dbFileWasReadable) {
    try {
      const quarantine = `${DB_FILE}.corrupt.${Date.now()}`;
      await fs.promises.copyFile(DB_FILE, quarantine);
      console.error(`Corrupt database file preserved at ${quarantine}`);
    } catch (e) {
      console.error('Could not quarantine corrupt DB file:', e);
    }
    const restored = await restoreNewestBackup();
    if (restored) {
      console.error('Recovered database from newest automatic backup.');
      return restored;
    }
    console.error('No usable backup found — initializing a fresh database.');
  }

  // If file doesn't exist or is invalid, create empty/initial schema
  const initial = createInitialState();
  mergeSeedIntoLoadedState(initial, true);
  initial.profiles = enforceSoleAdminRules(initial.profiles);
  await persistLoadedState(initial);
  return initial;
}

/**
 * Merge initial-seed records into a freshly loaded snapshot (shared by the
 * async normalize pipeline and the synchronous cold-load fallback). Returns
 * true when the snapshot was mutated. Seed-merged profiles may carry fake
 * legacy digests, so callers must re-run repairCorruptedCredentials() after.
 */
function mergeSeedIntoLoadedState(parsed: LabDatabaseState, isFirstBoot = false): boolean {
  if (parsed.seedApplied) return false;
  let changed = false;
  const seed = loadInitialSeed();
  if (!seed) {
    parsed.seedApplied = true;
    return false;
  }
  // Only merge seed profiles when seed has not yet been applied (first boot)
  if ((isFirstBoot || !parsed.seedApplied) && Array.isArray(seed.profiles)) {
    seed.profiles.forEach(sp => {
      const exists = parsed.profiles.find((p: any) => p.id === sp.id || (sp.username && p.username === sp.username));
      if (!exists) {
        parsed.profiles.push(sp);
        changed = true;
      }
    });
  }
  const mergeCollection = (key: keyof LabDatabaseState) => {
    const cur = parsed[key] as any[] | undefined;
    const incoming = (seed as any)[key];
    if ((!cur || cur.length === 0) && Array.isArray(incoming) && incoming.length > 0) {
      (parsed as any)[key] = incoming;
      changed = true;
    }
  };
  mergeCollection('customers');
  mergeCollection('reports');
  mergeCollection('invoices');
  mergeCollection('accounting');
  mergeCollection('calibrations');
  parsed.seedApplied = true;
  changed = true;
  return changed;
}

/**
 * Live authoritative credential references for a repair pass: only values the
 * current snapshot actually holds count as "known good" — never the raw
 * pre-normalize disk copy, whose fakes are precisely what needs healing.
 */
function buildLiveCredentialRefs(state: LabDatabaseState): any[] {
  return [...buildStoredCredentialSnapshot(state.profiles)].map((v: string) => ({ password: v }));
}

/**
 * Single-pass normalization of a freshly parsed DB snapshot: repair corrupted
 * credentials → enforce sole-admin invariant → merge seed data → migrate
 * legacy plaintext passwords → final repair/enforce pass ONLY when an earlier
 * step actually mutated the snapshot. Previously two unconditional repair +
 * two unconditional enforce passes ran on every cold-load (audit #42).
 * Persisted exactly once, only if something changed.
 */
async function normalizeLoadedState(parsed: LabDatabaseState, isFirstBoot = false): Promise<LabDatabaseState> {
  // BUG FIX (credential-repair S2/S3, CI regression): the pre-normalize
  // on-disk snapshot must be taken BEFORE the first repair pass mutates the
  // parsed object. The previous version cloned AFTER repairCorruptedCredentials
  // had already rewritten hashes, so the "authoritative store" handed to both
  // enforceSoleAdminRules passes contained the freshly-installed BOOTSTRAP /
  // UNUSABLE placeholder values instead of what the disk actually held. That
  // made credential carry-over resurrect repaired placeholders over genuine
  // seed/user hashes and poisoned the persist decision below.
  const diskProfilesSnapshot = (Array.isArray(parsed.profiles) ? parsed.profiles : [])
    .map((p: any) => ({ ...p }));
  // Live authoritative-store snapshot. On a COLD load the in-memory cache is
  // still unset, so the disk copy IS the store; on a warm path (cache already
  // populated) the live cache wins because it may hold credentials that were
  // changed since the file was last written.
  let storedProfilesSnapshot: any[] = cachedState && Array.isArray(cachedState.profiles)
    ? cachedState.profiles
    : diskProfilesSnapshot;

  // SECURITY FIX #1: repair corrupted / legacy fake-hash credentials
  // (e.g. the PBKDF2-labelled admin hash that locked the manager out in
  // production) BEFORE any other normalization touches them. The disk
  // snapshot is passed as the known-good credential reference: a well-formed
  // digest already stored on disk was produced by THIS server earlier and is
  // genuine by definition — only never-seen digests are judged for forgery.
  let changed = repairCorruptedCredentials(parsed, storedProfilesSnapshot);
  // AUDIT FIX (#94): clamp a future lastUpdated (clock-skewed seed data
  // committed to the repo) before anything reads it — see
  // clampFutureLastUpdated() for why this matters for client sync.
  if (clampFutureLastUpdated(parsed)) changed = true;
  // BUG FIX (credential-repair S2/S3): enforceSoleAdminRules must NEVER be
  // its own "existing profiles" source. Passing `parsed.profiles` as the
  // authoritative store meant every credentialMap lookup resolved to the
  // profile's OWN (possibly corrupted/fake) hash, so the fake digests just
  // repaired above were resurrected on the very next line and persisted back
  // poisoned. The authoritative store at cold-load time is the pre-normalize
  // snapshot taken above — exactly what the disk held before any healing.
  parsed.profiles = enforceSoleAdminRules(parsed.profiles, storedProfilesSnapshot);

  // Automatically check if seed data needs to be merged in (e.g. initial
  // customer profiles or customers missing). Shared with the synchronous
  // cold-load fallback via mergeSeedIntoLoadedState().
  if (mergeSeedIntoLoadedState(parsed, isFirstBoot)) changed = true;

  // CONCURRENCY FIX (credential-repair S2): the awaits inside persistLoadedState
  // (serialize + atomic rename) yield the event loop. A synchronous cold-load
  // via getDatabaseState() (or any other write path) can publish `cachedState`
  // DURING those yields — carrying a DIFFERENT normalization of the same file
  // (e.g. its own repaired admin hash, absent from the stale snapshot captured
  // above). Re-adopt the live cache here so the second enforce pass and the
  // final persist below build on the authoritative credentials instead of
  // resurrecting placeholders over genuine hashes / clobbering the healed file.
  if (cachedState && Array.isArray(cachedState.profiles) && cachedState !== parsed) {
    storedProfilesSnapshot = cachedState.profiles;
  }

  // Migrate any unhashed passwords (auto-migration of legacy plaintext JSON seeds)
  parsed.profiles.forEach((p: any) => {
    if (p.password && !p.password.startsWith('scrypt:')) {
      p.password = normalizeStoredPassword(p.password);
      changed = true;
    }
  });

  // Re-run the corrupted-hash repair AFTER enforceSoleAdminRules / seed
  // migration: those paths can re-introduce fake `scrypt:` digests from
  // seed files or client syncs. Only needed when an earlier step actually
  // mutated the snapshot (audit #42: skip redundant passes otherwise).
  // SECURITY FIX (credential-repair S3, CI failure): the second pass must NOT
  // trust the pre-normalize disk snapshot as a "known-good" reference. A fake
  // digest already sitting on disk is exactly what needs healing — treating it
  // as genuine lets seeded/corrupted hashes survive the final pass and get
  // persisted back poisoned. The live in-memory set after the first repair
  // pass is the only authoritative credential store at this point: anything
  // still matching it was validated above; anything else is judged for forgery.
  if (changed) {
    if (repairCorruptedCredentials(parsed, buildLiveCredentialRefs(parsed))) { /* already flagged */ }
    // Same self-referential carry-over bug as the first pass: the second
    // enforce must read credentials from the authoritative snapshot, not from
    // the profiles array it is currently rewriting. Seed-merged profiles are
    // absent from that snapshot, so their credentialMap lookups resolve to
    // undefined and normalizeStoredPassword() installs a stable non-loginable
    // placeholder over the healed fake digest — which persistLoadedState() then
    // writes to disk (the S3 "healed value persisted" guarantee).
    parsed.profiles = enforceSoleAdminRules(parsed.profiles, storedProfilesSnapshot);
  }

  // FIX (credential-repair regression S2/S3): mark every healed profile so the
  // persist decision below is IDEMPOTENT across restarts. A repaired account
  // ends up on a non-loginable placeholder hash that looks exactly like a
  // legitimate OTP-only/locked account to repairCorruptedCredentials() — so on
  // any later cold load `changed` would be false and the healing would never
  // be written to disk (the poisoned file stayed poisoned forever). The marker
  // forces persistence now AND on every subsequent load until the account gets
  // a genuine credential; it is stripped again right before serializing.
  applyRepairPersistenceMarkers(parsed);
  const hasUnpersistedRepairs = (parsed.profiles || []).some(
    (p: any) => p && Object.prototype.hasOwnProperty.call(p, '__credRepairedAt')
  );

  if (changed || hasUnpersistedRepairs) {
    // Persist the normalized snapshot DIRECTLY (bypass saveStateToDisk):
    // `cachedState` is still unset at this point, and calling the save
    // path here would re-enter getDatabaseState() recursively.
    await persistLoadedState(parsed);
  }
  return parsed;
}

/**
 * Synchronous cold-load fallback. The PRIMARY route is the async loader
 * (loadDatabaseStateAsync) which should be awaited during bootstrap so this
 * path never runs under traffic; it is kept only for callers that hit the DB
 * before boot-warming completed. Runs exactly ONE repair+enforce pass and
 * NEVER writes to disk (audit #42: the old sync path persisted on every
 * cold-load, turning restart loops into repeated heavy I/O).
 */
function loadDatabaseStateUncached(): LabDatabaseState {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.profiles)) {
      // Same pre-normalize snapshot discipline as normalizeLoadedState(): the
      // on-disk profiles are cloned BEFORE any repair pass mutates them, so
      // credential carry-over / known-good lookups read what the disk actually
      // held — never freshly-installed placeholder hashes.
      const storedProfilesSnapshot = parsed.profiles.map((p: any) => ({ ...p }));
      repairCorruptedCredentials(parsed, storedProfilesSnapshot);
      // AUDIT FIX (#94): clamp future lastUpdated on the sync cold-load too.
      // This path never writes to disk (audit #42), but the in-memory state
      // it returns is what /api/health and SSE expose — clamping here keeps
      // clients from seeing a future stamp even before boot-warming finished.
      clampFutureLastUpdated(parsed);
      parsed.profiles = enforceSoleAdminRules(parsed.profiles, storedProfilesSnapshot);
      // FIX (credential-repair S3): seed-merge + healing must also run on the
      // synchronous cold-load fallback. The async loader does this via
      // normalizeLoadedState(), but getDatabaseState() uses THIS path, so any
      // request that lands before boot-warming completed would serve a state
      // missing seed records and leave seeded fake digests unhealed. Keep the
      // no-disk-write contract of this path (audit #42) — persistence happens
      // on the next regular save or through the async loader.
      mergeSeedIntoLoadedState(parsed);
      if (repairCorruptedCredentials(parsed, buildLiveCredentialRefs(parsed))) { /* flagged */ }
      applyRepairPersistenceMarkers(parsed);
      return parsed;
    }
  } catch { /* fall through to initial state */ }
  const initial = createInitialState();
  initial.profiles = enforceSoleAdminRules(initial.profiles);
  return initial;
}

/**
 * Atomic disk write used during the LOAD pipeline only (before the live cache
 * is populated). Mirrors saveStateToDiskWithCollections' write mechanics but
 * deliberately does NOT touch cachedState / SSE / etags, so it can never
 * re-enter getDatabaseState().
 *
 * PERF FIX (audit #37/#38): fully async (fs.promises) with a collision-proof
 * tmp-file name (pid + random hex instead of Date.now()).
 */
async function persistLoadedState(state: LabDatabaseState): Promise<void> {
  try {
    ensureDirExists();
    state.lastUpdated = Date.now();
    // FIX (credential-repair persistence): serialize a SHALLOW CLONE with the
    // internal __credRepairedAt markers stripped, so the marker keeps its
    // in-memory meaning (forces re-persist on future cold loads until a real
    // credential is installed) without ever leaking into the DB file, backups,
    // or sanitized API payloads.
    const forDisk = {
      ...state,
      profiles: (state.profiles || []).map((p: any) => {
        if (!p || !Object.prototype.hasOwnProperty.call(p, '__credRepairedAt')) return p;
        const clone = { ...p };
        delete clone.__credRepairedAt;
        return clone;
      }),
    };
    stripRepairMarkerForPersist(forDisk); // defensive: no marker survives anywhere
    const json = await serializeStateAsync(forDisk);
    await writeDbFileAtomicAsync(json);
  } catch (err) {
    console.error('Failed to persist loaded database state:', err);
  }
}

// ---------------------------------------------------------------------------
// SECURITY FIX #7 (automatic backups): keep rolling copies of the database so
// a corrupt/poisoned write can always be rolled back. Backups live in
// <data>/backups/, are written at most once per BACKUP_MIN_INTERVAL_MS, and the
// newest BACKUP_KEEP are retained.
// ---------------------------------------------------------------------------
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_KEEP = Number(process.env.DB_BACKUP_KEEP || 48);
const BACKUP_MIN_INTERVAL_MS = Number(process.env.DB_BACKUP_INTERVAL_MS || 5 * 60 * 1000);
let lastBackupAt = 0;

export async function pruneOldBackups(): Promise<void> {
  try {
    let files: string[];
    try {
      files = (await fs.promises.readdir(BACKUP_DIR))
        .filter(f => f.startsWith('laboratory_db.') && f.endsWith('.json'))
        .sort(); // timestamped names sort chronologically
    } catch (e: any) {
      if (e && e.code === 'ENOENT') return; // no backups dir yet
      throw e;
    }
    while (files.length > BACKUP_KEEP) {
      const oldest = files.shift()!;
      try { await fs.promises.unlink(path.join(BACKUP_DIR, oldest)); } catch { /* ignore */ }
    }
  } catch (e) {
    console.error('Failed to prune old backups:', e);
  }
}

let backupInFlight: Promise<boolean> | null = null;

/**
 * PERF FIX (audit #38): fully async — no existsSync/mkdirSync/copyFileSync on
 * the event loop. The caller (save pipeline) fires this off the critical path
 * and an in-flight guard prevents overlapping backup runs from concurrent
 * saves.
 */
async function maybeCreateBackupAsync(): Promise<boolean> {
  if (backupInFlight) return backupInFlight;
  const now = Date.now();
  if (now - lastBackupAt < BACKUP_MIN_INTERVAL_MS) return false;
  // AUDIT FIX (#93): the IIFE's `finally` block runs on promise SETTLEMENT
  // (always after this function returns), so referencing the in-flight promise
  // there is safe — but TypeScript's definite-assignment analysis cannot see
  // through the self-reference. Restructured: the promise lives in a holder
  // object, and the guard variable is assigned BEFORE the async body starts.
  const run = (async () => {
    try {
      try {
        await fs.promises.access(DB_FILE, fs.constants.R_OK);
      } catch {
        return false; // DB file not present yet
      }
      await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
      const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
      await fs.promises.copyFile(DB_FILE, path.join(BACKUP_DIR, `laboratory_db.${stamp}.json`));
      lastBackupAt = now;
      await pruneOldBackups();
      return true;
    } catch (e) {
      console.error('Automatic DB backup failed:', e);
      return false;
    }
  })();
  run.finally(() => {
    if (backupInFlight === run) backupInFlight = null;
  });
  backupInFlight = run;
  return run;
}

/** Sync fallback kept for the rare error-path inside saveStateToDiskAsync. */
function maybeCreateBackup(): void {
  const now = Date.now();
  if (now - lastBackupAt < BACKUP_MIN_INTERVAL_MS) return;
  if (!fs.existsSync(DB_FILE)) return;
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DB_FILE, path.join(BACKUP_DIR, `laboratory_db.${stamp}.json`));
    lastBackupAt = now;
    void pruneOldBackups();
  } catch (e) {
    console.error('Automatic DB backup failed:', e);
  }
}

/** Restore the newest valid automatic backup into memory + disk. Null if none. */
export async function restoreNewestBackup(): Promise<LabDatabaseState | null> {
  try {
    let files: string[];
    try {
      files = (await fs.promises.readdir(BACKUP_DIR))
        .filter(f => f.startsWith('laboratory_db.') && f.endsWith('.json'))
        .sort()
        .reverse();
    } catch (e: any) {
      if (e && e.code === 'ENOENT') return null;
      throw e;
    }
    for (const f of files) {
      try {
        const raw = await fs.promises.readFile(path.join(BACKUP_DIR, f), 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.profiles)) {
          // BUG FIX (credential-repair S2/S3): clone the backup's own profiles
          // BEFORE any repair pass mutates them. The previous code ran repair
          // first and then passed `parsed.profiles` (already containing the
          // freshly-installed BOOTSTRAP/UNUSABLE placeholders) as the
          // credential authority — resurrecting repaired placeholders over
          // genuine hashes on restore. The pre-normalize snapshot is what the
          // backup file actually held; a restore must preserve it verbatim.
          const storedProfilesSnapshot = parsed.profiles.map((p: any) => ({ ...p }));
          repairCorruptedCredentials(parsed, storedProfilesSnapshot);
          parsed.profiles = enforceSoleAdminRules(parsed.profiles, storedProfilesSnapshot);
          cachedState = parsed;
          // Persist the recovered state as the live DB file (atomic write below).
          await saveStateToDiskAsyncPublic(parsed, ['all']);
          return parsed;
        }
      } catch { /* try next backup */ }
    }
    return null;
  } catch (e) {
    console.error('Backup restore failed:', e);
    return null;
  }
}

/** List available backups (newest first) — used by the admin backup API. */
export async function listBackups(): Promise<Array<{ file: string; createdAt: number; sizeBytes: number }>> {
  try {
    const entries = (await fs.promises.readdir(BACKUP_DIR))
      .filter(f => f.startsWith('laboratory_db.') && f.endsWith('.json'));
    const infos = await Promise.all(entries.map(async (f) => {
      let createdAt = 0;
      let sizeBytes = 0;
      try {
        const st = await fs.promises.stat(path.join(BACKUP_DIR, f));
        createdAt = st.mtimeMs;
        sizeBytes = st.size;
      } catch { /* ignore */ }
      return { file: f, createdAt, sizeBytes };
    }));
    return infos.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** Restore a specific named backup file (admin-only endpoint helper). */
export async function restoreNamedBackup(fileName: string): Promise<boolean> {
  // Path-traversal guard: only plain backup file names are accepted.
  if (!/^laboratory_db\.[A-Za-z0-9_-]+\.json$/.test(fileName)) return false;
  const full = path.join(BACKUP_DIR, fileName);
  try {
    const raw = await fs.promises.readFile(full, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.profiles)) return false;
    // Pre-normalize snapshot (see restoreNewestBackup): the backup file's own
    // credentials are the authority; repairs must not become their own
    // "existing" source via aliasing.
    const storedProfilesSnapshot = parsed.profiles.map((p: any) => ({ ...p }));
    repairCorruptedCredentials(parsed, storedProfilesSnapshot);
    // Pass the file's own profiles as the credential authority (self-save):
    // a restore must preserve the backup's stored credentials verbatim.
    parsed.profiles = enforceSoleAdminRules(parsed.profiles, storedProfilesSnapshot);
    cachedState = parsed;
    await saveStateToDiskAsyncPublic(parsed, ['all']);
    return true;
  } catch {
    return false;
  }
}

// Save state to disk atomically & notify all connected clients immediately
export function saveStateToDisk(state: LabDatabaseState, changedCollection?: string): boolean {
  return saveStateToDiskWithCollections(state, changedCollection ? [changedCollection] : undefined);
}

// ---------------------------------------------------------------------------
// PERF FIX (audit #41): O(1) profile lookup indexes.
// findUserByIdentifier()/updateProfileServer() used to run linear filter/
// findIndex passes over the profiles array on EVERY authentication request and
// every write. The maps below are rebuilt lazily whenever the state object or
// the profiles array identity changes (O(n) once per mutation batch, O(1) per
// read afterwards).
// ---------------------------------------------------------------------------
interface ProfileIndexMaps {
  byId: Map<string, any>;
  byUsername: Map<string, any>;
  byEmail: Map<string, any>;
  byPhone: Map<string, any>;
  byCustomerId: Map<string, any>;
}
let profileIndexCache: { stateRef: any; profilesRef: any[]; maps: ProfileIndexMaps } | null = null;

function buildProfileIndex(profiles: any[]): ProfileIndexMaps {
  const maps: ProfileIndexMaps = {
    byId: new Map(), byUsername: new Map(), byEmail: new Map(),
    byPhone: new Map(), byCustomerId: new Map(),
  };
  for (const p of profiles || []) {
    if (!p) continue;
    if (p.id != null) {
      maps.byId.set(String(p.id), p);
      maps.byId.set(String(p.id).toLowerCase(), p);
    }
    const uname = toEnglishDigits(String(p.username || '')).toLowerCase();
    if (uname) maps.byUsername.set(uname, p);
    const email = String(p.email || '').toLowerCase();
    if (email) maps.byEmail.set(email, p);
    const phone = toEnglishDigits(String(p.phone || '')).replace(/[^0-9]/g, '');
    if (phone) {
      maps.byPhone.set(phone, p);
      if (phone.startsWith('09') && phone.length === 11) {
        maps.byPhone.set(phone.slice(1), p); // 913...
      } else if (phone.startsWith('98') && phone.length === 12) {
        maps.byPhone.set('0' + phone.slice(2), p);
        maps.byPhone.set(phone.slice(2), p);
      }
    }
    const cid = toEnglishDigits(String(p.customerId || '')).toLowerCase();
    if (cid) maps.byCustomerId.set(cid, p);
  }
  return maps;
}

export function invalidateProfileIndex(): void {
  profileIndexCache = null;
}

export function getProfileIndex(state: LabDatabaseState): ProfileIndexMaps {
  const profiles = state.profiles || [];
  if (!profileIndexCache || profileIndexCache.stateRef !== state || profileIndexCache.profilesRef !== profiles) {
    profileIndexCache = { stateRef: state, profilesRef: profiles, maps: buildProfileIndex(profiles) };
  }
  return profileIndexCache.maps;
}

/** O(1) profile lookup by id via the lazy index (falls back to scan when the
 *  caller holds a stale/different state object than the live cache). */
export function findProfileById(state: LabDatabaseState, userId: string): any | undefined {
  if (state === cachedState && cachedState) {
    return getProfileIndex(cachedState).byId.get(String(userId));
  }
  return (state.profiles || []).find((p: any) => String(p.id) === String(userId));
}

/**
 * PERF FIX (audit #43): O(1) mustChangePassword check for the middleware auth
 * hot path. The flag is mirrored into every signed session-token payload at
 * issue time and re-issued on password change / forced re-arm, so reading it
 * from the ACTIVE-SERVER-REGISTERED payload (never the client-supplied one)
 * is both O(1) and tamper-proof — no linear profiles.find() per request.
 * Returns null when the jti is not a live server-side session (caller should
 * then fall back to its own conservative behavior).
 */
export function getSessionMustChangePassword(jti: string | undefined): boolean | null {
  if (!jti) return null;
  const sess = activeSessions.get(jti);
  if (!sess) return null;
  return !!sess.mustChangePassword;
}

/**
 * PERF FIX (audit #43): when a login-time repair re-arms mustChangePassword on
 * a profile, also flip the flag on that user's already-registered live
 * sessions so the gate sees the true value even before the client exchanges
 * tokens. Best-effort: failures leave the DB fallback intact in callers.
 */
export function setSessionMustChangePasswordForUser(userId: string, value: boolean): void {
  try {
    for (const [, sess] of activeSessions.entries()) {
      if (String(sess.userId) === String(userId)) sess.mustChangePassword = value;
    }
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// PERF FIX (audit #37/#38): the write pipeline below is now fully ASYNC
// (fs.promises) so serialize + tmp-write + rename + backup copy never block
// the event loop. The synchronous public wrappers keep their old contracts by
// delegating to a serialized background chain (withDbWrite already orders all
// mutators, so no double-write race is introduced).
//  - unique tmp-file names via crypto random suffix (concurrent writers can no
//    longer collide on Date.now());
//  - JSON.stringify runs once per write;
//  - backups are created fire-and-forget with an in-flight guard.
// ---------------------------------------------------------------------------
let diskWriteChain: Promise<void> = Promise.resolve();

/** Serialize a state snapshot off the hot path (CPU-bound for large DBs). */
function serializeStateAsync(jsonInput: any): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve(JSON.stringify(jsonInput, null, 2));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function writeDbFileAtomicAsync(json: string): Promise<void> {
  // PERF/CONCURRENCY FIX (audit #37): unique tmp name — Date.now() alone was
  // colliding under concurrent writes (two processes/ticks writing the same
  // .tmp.<ts> file and clobbering each other before rename).
  const tmpFile = `${DB_FILE}.tmp.${process.pid}.${crypto.randomBytes(6).toString('hex')}`;
  try {
    await fs.promises.writeFile(tmpFile, json, 'utf-8');
    await fs.promises.rename(tmpFile, DB_FILE);
  } catch (err) {
    try { await fs.promises.unlink(tmpFile); } catch { /* best-effort cleanup */ }
    throw err;
  }
}

/**
 * Shared normalization step for both save wrappers: sole-admin invariant,
 * technicians-collection bootstrap, version/lastUpdated stamp and per-collection
 * etag bumps. Runs EXACTLY ONCE per logical write (audit #41: mutators like
 * updateProfileServer used to run enforceSoleAdminRules inline AND again here —
 * two full O(n) passes with allocations per request). The disk writer performs
 * NO further enforce pass; it only serializes the already-normalized snapshot.
 */
function prepareStateForSave(state: LabDatabaseState, changedCollections?: string[]): void {
  // CRITICAL (credential-carry-over fix): pass the authoritative stored
  // profiles so enforceSoleAdminRules()/resolveCredential() can carry real
  // scrypt hashes over into the outgoing snapshot. Without this second
  // argument every routine save treated ALL incoming password fields as
  // client echoes and dropped them — wiping credentials on each write.
  // ANTI-WIPE GUARD: when `state` IS the live cached object (the common case
  // for every server mutator), using cachedState as the "existing" authority
  // is a self-comparison that lets resolveCredential() see the value we are
  // trying to persist as a mere client echo and drop it — which silently
  // wiped the credential written by updateProfileServer() right after a
  // successful bootstrap reset, and stamped UNUSABLE placeholders onto
  // passwordless OTP-only profiles. For in-place saves there is nothing to
  // carry over FROM, so pass no existing list at all.
  const isSelfSave = state === cachedState;
  const existingProfiles = !isSelfSave && Array.isArray(cachedState?.profiles) ? cachedState!.profiles : undefined;
  state.profiles = enforceSoleAdminRules(state.profiles, existingProfiles);
  invalidateProfileIndex();
  // Ensure technicians collection always exists (server-side persistence for field technicians)
  if (!Array.isArray((state as any).technicians)) (state as any).technicians = [];
  state.lastUpdated = Date.now();
  state.version = (state.version || 0) + 1;
  if (changedCollections && changedCollections.length > 0) {
    for (const c of changedCollections) bumpCollectionVersion(c);
  }
}

/**
 * Async core of the atomic save. Returns AFTER the durable rename completed
 * (so callers that `await` it get real write confirmation), while SSE
 * notification fires immediately after the rename — clients refetch without
 * waiting for the background backup copy.
 *
 * NOTE: `prepareStateForSave` has ALREADY run for this snapshot (both public
 * entry points normalize before scheduling). Re-running enforce/version-bump
 * here would double every write's CPU cost and inflate etags twice per change.
 */
async function saveStateToDiskAsync(
  state: LabDatabaseState,
  changedCollections?: string[]
): Promise<boolean> {
  ensureDirExists();
  try {
    const json = await serializeStateAsync(state);
    await writeDbFileAtomicAsync(json);
    cachedState = state;
    // PERF FIX (audit #38): backup runs fire-and-forget OFF the critical path
    // (guarded against overlapping runs) instead of a blocking copyFileSync.
    void maybeCreateBackupAsync().catch(() => { /* logged internally */ });
    notifySseClients(state, changedCollections && changedCollections.length === 1 ? changedCollections[0] : undefined);
    return true;
  } catch (err) {
    console.error('Failed to write laboratory_db.json:', err);
    try {
      // Fallback direct write (sync only on the error path — rare).
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
      cachedState = state;
      notifySseClients(state, changedCollections && changedCollections.length === 1 ? changedCollections[0] : undefined);
      return true;
    } catch (e2) {
      console.error('Direct write also failed:', e2);
      return false;
    }
  }
}

function scheduleDiskWrite(state: LabDatabaseState, changedCollections?: string[]): Promise<boolean> {
  const run = diskWriteChain.then(() => saveStateToDiskAsync(state, changedCollections));
  // Keep the chain alive regardless of individual failures.
  diskWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Awaitable variant of saveStateToDisk(): resolves with REAL disk-write
 * confirmation (after the atomic tmp-file rename completes) instead of the
 * optimistic synchronous boolean. Mutator routes that respond to the client
 * should prefer this so a failed write never returns success.
 */
export async function saveStateToDiskAwaitable(state: LabDatabaseState, changedCollection?: string): Promise<boolean> {
  const changedCollections = changedCollection ? [changedCollection] : undefined;
  prepareStateForSave(state, changedCollections);
  cachedState = state;
  const ok = await scheduleDiskWrite(state, changedCollections);
  if (!ok) {
    const err: any = new Error('DISK_WRITE_FAILED: ذخیره‌سازی دیتابیس روی دیسک ناموفق بود.');
    err.statusCode = 500;
    throw err;
  }
  return true;
}

export async function saveStateToDiskAsyncPublic(state: LabDatabaseState, changedCollections?: string[]): Promise<boolean> {
  prepareStateForSave(state, changedCollections);
  cachedState = state;
  return scheduleDiskWrite(state, changedCollections);
}

/**
 * Same atomic disk write + SSE notification, but lets callers that touch
 * MULTIPLE collections in one write ('all' / 'sync') bump every affected
 * per-collection etag. Without this, clients that cached etags from a previous
 * sync would never see a 409 conflict on the next stale write of those
 * collections (silent last-write-wins data loss).
 *
 * PERF FIX (audit #37/#38): the actual serialize+write+backup work is chained
 * onto the async disk writer; this wrapper returns write CONFIRMATION
 * synchronously exactly like before (enforceSoleAdminRules + version bumps run
 * inline so etags advance even if the caller ignores the promise), while the
 * I/O itself is non-blocking.
 */
export function saveStateToDiskWithCollections(state: LabDatabaseState, changedCollections?: string[]): boolean {
  ensureDirExists();
  try {
    prepareStateForSave(state, changedCollections);
    // Mark the snapshot live immediately — reads stay consistent with what the
    // HTTP layer just returned, and the queued disk write serializes THIS
    // exact state.
    cachedState = state;
    void scheduleDiskWrite(state, changedCollections);
    notifySseClients(state, changedCollections && changedCollections.length === 1 ? changedCollections[0] : undefined);
    return true;
  } catch (err) {
    console.error('Failed to prepare database save:', err);
    return false;
  }
}

// Sync full state from a client
export function syncFullDatabase(incoming: Partial<LabDatabaseState>): LabDatabaseState {
  const current = getDatabaseState();
  
  if (Array.isArray(incoming.profiles) && incoming.profiles.length > 0) {
    // Preserve any profiles that already exist on the server, merge incoming
    const profileMap = new Map<string, any>();
    (current.profiles || []).forEach(p => profileMap.set(p.id, p));
    incoming.profiles.forEach(p => {
      const existing = profileMap.get(p.id) || (current.profiles || []).find(cp => cp.username === p.username);
      profileMap.set(p.id, {
        ...existing,
        ...p,
        // Never let a sanitized (password-less) or fake-hash client value wipe
        // the stored credential; enforceSoleAdminRules carries over real hashes.
        password: normalizeStoredPassword(resolveIncomingCredential(p.password, existing?.password))
      });
    });
    current.profiles = Array.from(profileMap.values());
  }

  if (Array.isArray(incoming.customers) && incoming.customers.length > 0) {
    const custMap = new Map<string, any>();
    (current.customers || []).forEach(c => custMap.set(c.id, c));
    incoming.customers.forEach(c => {
      const existing = custMap.get(c.id);
      custMap.set(c.id, { ...existing, ...c });
    });
    current.customers = Array.from(custMap.values());
  }
  // FIX (audit #13): full-database replacement of reports/invoices/accounting/…
  // is DANGEROUS when a client syncs from a partial/cold cache — previously the
  // only guard was "incoming array non-empty", so a payload containing a single
  // new record replaced the ENTIRE server collection and destroyed every other
  // user's data. Replacement now requires an EXPLICIT `replace: true` flag set
  // by a deliberate admin action; ordinary syncs merge per-id instead.
  const replaceAllowed = (incoming as any).replace === true || (incoming as any).mode === 'replace';

  const mergeById = <T extends { id?: string }>(existing: T[], incomingList: T[], keyOf?: (item: T) => string | undefined): T[] => {
    const map = new Map<string, T>();
    existing.forEach(item => {
      const k = keyOf ? keyOf(item) : item.id;
      if (k) map.set(k, item);
    });
    incomingList.forEach(item => {
      const k = keyOf ? keyOf(item) : item.id;
      if (!k) { map.set(`__noid_${map.size}`, item); return; }
      map.set(k, { ...(map.get(k) as any), ...item });
    });
    return Array.from(map.values());
  };

  const applyCollection = (name: keyof LabDatabaseState, incomingList: any[]) => {
    const currentList = (current as any)[name] || [];
    if (replaceAllowed) {
      (current as any)[name] = incomingList;
    } else {
      (current as any)[name] = mergeById(currentList, incomingList);
    }
  };

  if (Array.isArray(incoming.reports)) applyCollection('reports', incoming.reports);
  if (Array.isArray(incoming.invoices)) applyCollection('invoices', incoming.invoices);
  if (Array.isArray(incoming.accounting)) applyCollection('accounting', incoming.accounting);
  if (Array.isArray(incoming.calibrations)) applyCollection('calibrations', incoming.calibrations);
  if (Array.isArray(incoming.dispatches)) {
    current.dispatches = replaceAllowed
      ? incoming.dispatches
      : mergeById(current.dispatches, incoming.dispatches, d => d.id || d.ticketNo);
  }
  if (Array.isArray((incoming as any).technicians)) {
    const map = new Map<string, any>();
    (current.technicians || []).forEach((t: any) => map.set(t.id, t));
    (incoming as any).technicians.forEach((t: any) => map.set(t.id, { ...map.get(t.id), ...t }));
    current.technicians = Array.from(map.values());
  }
  if (Array.isArray(incoming.envLogs)) applyCollection('envLogs', incoming.envLogs);
  if (Array.isArray(incoming.media)) applyCollection('media', incoming.media);
  if (Array.isArray(incoming.smsLogs)) applyCollection('smsLogs', incoming.smsLogs);
  if (Array.isArray(incoming.trashCustomers)) applyCollection('trashCustomers', incoming.trashCustomers);

  // FIX #1.1 companion: this write replaces MULTIPLE collections at once, so
  // bump every affected per-collection etag. Otherwise clients that cached a
  // stale etag would never receive a 409 on their next write and the server's
  // state would silently diverge from theirs (last-write-wins data loss).
  saveStateToDiskWithCollections(current, [
    'profiles', 'customers', 'reports', 'invoices', 'accounting',
    'calibrations', 'dispatches', 'technicians', 'envLogs', 'media',
    'smsLogs', 'trashCustomers'
  ]);
  return current;
}

// Reset database to default seed state
export function resetDatabaseToDefaults(): LabDatabaseState {
  const initial = createInitialState();
  saveStateToDisk(initial, 'all');
  cachedState = initial;
  return initial;
}

// Restore whole database from backup JSON
export function restoreFromBackup(backupState: LabDatabaseState): boolean {
  if (!backupState || !Array.isArray(backupState.profiles)) {
    return false;
  }
  const cleanState: LabDatabaseState = {
    version: (backupState.version || 0) + 1,
    lastUpdated: Date.now(),
    profiles: Array.isArray(backupState.profiles) ? backupState.profiles : [],
    customers: Array.isArray(backupState.customers) ? backupState.customers : [],
    reports: Array.isArray(backupState.reports) ? backupState.reports : [],
    invoices: Array.isArray(backupState.invoices) ? backupState.invoices : [],
    accounting: Array.isArray(backupState.accounting) ? backupState.accounting : [],
    calibrations: Array.isArray(backupState.calibrations) ? backupState.calibrations : [],
    dispatches: Array.isArray(backupState.dispatches) ? backupState.dispatches : [],
    technicians: Array.isArray((backupState as any).technicians) ? (backupState as any).technicians : [],
    envLogs: Array.isArray(backupState.envLogs) ? backupState.envLogs : [],
    media: Array.isArray(backupState.media) ? backupState.media : [],
    smsLogs: Array.isArray(backupState.smsLogs) ? backupState.smsLogs : [],
    trashCustomers: Array.isArray(backupState.trashCustomers) ? backupState.trashCustomers : []
  };
  // CRITICAL (credential-wipe fix): this restore path receives an UPLOADED
  // state object that is NOT the live cache. saveStateToDiskWithCollections()
  // would then treat the cached profiles as the "authoritative existing"
  // store and drop every password field of the uploaded snapshot as a bogus
  // client echo — silently replacing real scrypt hashes with UNUSABLE
  // placeholders and locking out ALL accounts after a backup restore.
  // A restore must preserve the uploaded file's credentials verbatim, so we
  // run the same normalization here with the snapshot itself as its own
  // credential authority (mirrors restoreNamedBackup / load pipeline).
  // Pre-normalize clone: repair must not judge digests against placeholders
  // it installs itself (aliasing bug fixed in the load/restore paths).
  const storedProfilesSnapshot = cleanState.profiles.map((p: any) => ({ ...p }));
  repairCorruptedCredentials(cleanState, storedProfilesSnapshot);
  cleanState.profiles = enforceSoleAdminRules(cleanState.profiles, storedProfilesSnapshot);
  const previousCache = cachedState;
  cachedState = cleanState; // mark as self-save → carry-over sees no foreign authority
  try {
    return saveStateToDisk(cleanState, 'all');
  } finally {
    if (!previousCache) cachedState = null;
  }
}

// Update single user's password.
// SECURITY FIX #5: when currentPassword is provided it MUST verify against the
// stored credential before any change is written (self-service change flow).
// Admin-forced resets omit currentPassword and stay allowed. Returns:
//   true          → password changed
//   false         → user not found / invalid new password
//   'wrong-current' → current password supplied but incorrect
export async function updateUserPassword(
  userId: string,
  newPassword: string,
  currentPassword?: string,
  options?: { requireCurrentForNonAdmin?: boolean }
): Promise<boolean | 'wrong-current'> {
  // FIX #1: accept ONLY a plaintext password (hashed here with real scrypt).
  const pwd = normalizeIncomingPassword(newPassword);
  if (pwd.length < 8) return false;
  const current = getDatabaseState();

  // PERF FIX (audit #43): O(1) lookups via the lazy profile index instead of
  // three linear scans per password change. The caller may identify the user
  // by id / username / email — resolve all three through the index maps.
  const idx = getProfileIndex(current);
  const target =
    idx.byId.get(String(userId)) ||
    idx.byUsername.get(toEnglishDigits(String(userId)).toLowerCase()) ||
    idx.byEmail.get(String(userId).toLowerCase());
  if (!target) return false;

  const hasSuppliedCurrent = typeof currentPassword === 'string' && currentPassword.trim() !== '';

  // SECURITY FIX: when the flag is set, a change WITHOUT a verified current
  // credential is only legitimate for an ADMIN actor (admin-forced resets of
  // other users). A non-admin caller that fails to present the current
  // password must be rejected outright — previously such a call silently
  // succeeded, letting any authenticated session replace its own credential
  // without proving knowledge of the old one.
  if (!hasSuppliedCurrent && options?.requireCurrentForNonAdmin) {
    if (String(target.role).toLowerCase() !== 'admin') return 'wrong-current';
  }

  // Verify the current credential first (if the caller supplied one) — never
  // mutate state on a failed verification.
  if (hasSuppliedCurrent) {
    const cp = normalizeIncomingPassword(currentPassword);
    const ok = verifyPassword(cp, target.password) ||
               verifyPassword(toEnglishDigits(cp), target.password);
    if (!ok) return 'wrong-current';
  }

  current.profiles = current.profiles.map((p: any) =>
    p === target ? { ...p, password: hashPassword(pwd), mustChangePassword: false } : p
  );

  // SECURITY FIX (audit #43): re-register every live session of this user with
  // the cleared mustChangePassword flag baked into the server-side payload.
  // The auth gate reads the flag from the registry (O(1)) instead of hitting
  // the DB on every authenticated request. Each session keeps its ORIGINAL
  // jti, so already-issued client tokens remain valid — no revocation or
  // exchange round-trip is needed and in-flight requests are never broken.
  try {
    for (const [jti, sess] of Array.from(activeSessions.entries())) {
      if (String(sess.userId) !== String(target.id)) continue;
      const fresh: TokenPayload = { ...sess, mustChangePassword: false };
      activeSessions.set(jti, fresh);
    }
    persistSessions();
  } catch { /* non-fatal: gate falls back to the DB read */ }

  // Await the durable write so the HTTP response only reports success after
  // the credential change is actually on disk (and refresh the live cache so
  // subsequent reads in this tick see mustChangePassword=false).
  const saved = await saveStateToDiskAwaitable(current, 'profiles');
  if (!saved) return false;
  cachedState = { ...current, profiles: current.profiles };
  return true;
}

// Add a technician dispatch
/**
 * SECURITY FIX (audit #33): schema validation for the PUBLIC dispatch form.
 * Previously only customerName/contactPhone were checked at the route and the
 * raw object was persisted verbatim — arbitrary keys, nested objects/arrays,
 * oversized strings and wrong types could be injected into operational records
 * (and would then flow through syncCollection/restoreFromBackup unchecked).
 *
 * This normalizer whitelists known fields, bounds every string at 500 chars,
 * caps serialized array/object values at 4000 chars, rejects non-finite
 * numbers with 400, and silently drops unknown keys / functions / symbols.
 */
const DISPATCH_ALLOWED_KEYS = [
  'id', 'ticketNo', 'status', 'customerName', 'contactPhone', 'companyName',
  'projectName', 'projectAddress', 'concreteGrade', 'volumeM3', 'plannedDate',
  'plannedTime', 'testType', 'sampleSeriesCount', 'notes', 'description',
  'source', 'createdAt', 'updatedAt', 'technicianName', 'scheduledAt',
] as const;
const MAX_DISPATCH_FIELD_LEN = 500;
const MAX_DISPATCH_NESTED_JSON_LEN = 4000;

export function validateAndNormalizeDispatchPayload(dispatch: any): any {
  if (!dispatch || typeof dispatch !== 'object' || Array.isArray(dispatch)) {
    throw Object.assign(new Error('dispatch object is required'), { statusCode: 400 });
  }
  const clean: Record<string, any> = {};
  for (const key of Object.keys(dispatch)) {
    if (!(DISPATCH_ALLOWED_KEYS as readonly string[]).includes(key)) continue; // drop unknown keys
    const val = (dispatch as any)[key];
    if (typeof val === 'string') {
      if (val.length > MAX_DISPATCH_FIELD_LEN) {
        throw Object.assign(new Error(`فیلد «${key}» بیش از حد مجاز است.`), { statusCode: 400 });
      }
      clean[key] = val;
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        throw Object.assign(new Error(`مقدار عددی نامعتبر در فیلد «${key}».`), { statusCode: 400 });
      }
      clean[key] = val;
    } else if (typeof val === 'boolean' || val === null) {
      clean[key] = val;
    } else if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
      const json = JSON.stringify(val);
      if (json.length > MAX_DISPATCH_NESTED_JSON_LEN) {
        throw Object.assign(new Error(`محتوای تودرتو فیلد «${key}» بیش از حد مجاز است.`), { statusCode: 400 });
      }
      clean[key] = val;
    }
    // functions / undefined / symbols are silently dropped
  }
  return clean;
}

export function addDispatch(rawDispatch: any): any {
  // Audit #33: whitelist + bounds-check before anything touches the DB.
  const clean = validateAndNormalizeDispatchPayload(rawDispatch);
  const current = getDatabaseState();
  if (!current.dispatches) {
    current.dispatches = [];
  }

  if (!clean.id) clean.id = uniqueServerId('dsp');
  if (!clean.createdAt) clean.createdAt = new Date().toISOString();

  // Prepend new dispatch
  current.dispatches = [clean, ...current.dispatches.filter(d => d.id !== clean.id && d.ticketNo !== clean.ticketNo)];
  saveStateToDisk(current, 'dispatches');
  return clean;
}

// Update dispatch status
export function updateDispatchStatus(id: string, status: string, technicianName?: string): boolean {
  const current = getDatabaseState();
  let found = false;

  current.dispatches = (current.dispatches || []).map(d => {
    if (d.id === id || d.ticketNo === id) {
      found = true;
      return {
        ...d,
        status,
        ...(technicianName ? { technicianName } : {})
      };
    }
    return d;
  });

  if (found) {
    saveStateToDisk(current, 'dispatches');
  }
  return found;
}

// Add or update a customer
// FIX (validation): Iranian national ID checksum validator, enforced on the
// server side so malformed codes can never be persisted regardless of client.
export function isValidIranianNationalCode(code: string): boolean {
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false; // e.g. 1111111111
  const digits = code.split('').map(Number);
  const check = digits[9];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
  const r = sum % 11;
  return r < 2 ? check === r : check >= 2 && (11 - r) === check;
}

/**
 * SECURITY FIX (audit #31): single shared customer validator used by BOTH
 * addCustomer() and registerCustomerAccount(). Previously the registration
 * path skipped every check — missing name/phone, malformed national codes and
 * arbitrary (even negative/huge) contract amounts flowed straight into
 * invoices and accounting entries. Now any write through either endpoint is
 * rejected with 400 before touching the database.
 */
export function validateCustomerPayload(customer: any): void {
  if (!customer || typeof customer !== 'object') {
    throw Object.assign(new Error('اطلاعات کارفرما نامعتبر است.'), { statusCode: 400 });
  }
  const name = typeof customer.name === 'string' ? customer.name.trim()
    : typeof customer.companyName === 'string' ? customer.companyName.trim() : '';
  if (name.length < 2) {
    throw Object.assign(new Error('نام کارفرما الزامی است (حداقل ۲ حرف).'), { statusCode: 400 });
  }
  if (!customer.phone || !/^09\d{9}$/.test(String(customer.phone))) {
    throw Object.assign(new Error('شماره موبایل معتبر نیست (فرمت: 09XXXXXXXXX).'), { statusCode: 400 });
  }
  if (customer.nationalCode) {
    const nc = String(customer.nationalCode).replace(/[۰-۹]/g, (d: string) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    if (!isValidIranianNationalCode(nc)) {
      throw Object.assign(new Error('کد ملی وارد شده معتبر نیست.'), { statusCode: 400 });
    }
    customer.nationalCode = nc;
  }
  // Financial bounds: contract/paid/balance amounts must be finite, non-negative
  // numbers within a sane ceiling (tomans). Guards invoice auto-generation in
  // registerCustomerAccount against invalid/negative/unbounded documents.
  const MAX_AMOUNT = 1_000_000_000_000; // 1e12 تومان (~absurd upper bound)
  for (const field of ['totalContractAmount', 'paidAmount', 'balance', 'pricePerSeries', 'estimatedVolumeM3', 'sampleSeriesCount']) {
    const raw = (customer as any)[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0 || num > MAX_AMOUNT) {
      throw Object.assign(new Error(`مقدار «${field}» نامعتبر است (باید عددی بین ۰ تا سقف مجاز باشد).`), { statusCode: 400 });
    }
  }
}

export function addCustomer(customer: any): any {
  const current = getDatabaseState();
  if (!current.customers) current.customers = [];

  // Server-side validation via the SHARED helper (audit #31).
  validateCustomerPayload(customer);

  const idx = current.customers.findIndex(c => c.id === customer.id || (c.phone && customer.phone && c.phone === customer.phone));
  if (idx >= 0) {
    current.customers[idx] = { ...current.customers[idx], ...customer };
  } else {
    current.customers.unshift(customer);
  }

  saveStateToDisk(current, 'customers');
  return customer;
}

// Add or update a profile
export function addProfileServer(profile: any): any {
  const current = getDatabaseState();
  if (!current.profiles) current.profiles = [];

  if (profile.id === SOLE_ADMIN_ID || profile.username === SOLE_ADMIN_USERNAME) {
    profile.id = SOLE_ADMIN_ID;
    profile.username = SOLE_ADMIN_USERNAME;
    profile.role = 'admin';
  } else if (profile.role === 'admin') {
    profile.role = 'operator';
  }

  // BUG FIX (problem #2 — "a newly created operator vanishes after one
  // login/logout cycle"): the role/class separation between staff and
  // customers was only enforced in the UI. A profile carrying a `customerId`
  // link (i.e. a customer account) could be (re)created through this
  // staff-creation endpoint with role 'operator', and conversely a customer
  // profile without the link could be registered as staff. On the next full
  // sync / reload such hybrid records were reclassified or dropped, making the
  // new operator "disappear". Enforce the invariant server-side now:
  //  - a profile linked to a customer record is ALWAYS a customer account;
  //  - an operator/admin profile must never reference a customerId.
  if (profile.customerId) {
    profile.role = 'customer';
  } else if (profile.role === 'operator' || profile.role === 'admin') {
    delete profile.customerId;
  }

  // SECURITY FIX: a genuine new-user password is hashed with real server-side scrypt.
  // Enforce password policy BEFORE hashing and return clear Persian errors.
  const rawIncomingPwd = typeof profile.password === 'string' ? profile.password.trim() : '';
  if (!rawIncomingPwd) {
    const err: any = new Error('INVALID_PASSWORD: رمز عبور کاربر جدید الزامی است.');
    err.statusCode = 400;
    throw err;
  }
  if (rawIncomingPwd.startsWith('scrypt:')) {
    const err: any = new Error('INVALID_PASSWORD: ارسال هش کلاینت مجاز نمی‌باشد؛ رمز عبور باید به صورت متن وارد شود.');
    err.statusCode = 400;
    throw err;
  }
  if (rawIncomingPwd.length < 8) {
    const err: any = new Error('INVALID_PASSWORD: رمز عبور باید حداقل ۸ کاراکتر باشد.');
    err.statusCode = 400;
    throw err;
  }
  if (isLegacyDefaultChoice(rawIncomingPwd)) {
    const err: any = new Error('INVALID_PASSWORD: استفاده از رمز عبور پیش‌فرض قدیمی مجاز نمی‌باشد.');
    err.statusCode = 400;
    throw err;
  }

  // Normalize digits so Persian numerals in passwords or usernames convert reliably
  const normalizedPwd = toEnglishDigits(rawIncomingPwd);

  try {
    profile.password = hashPassword(normalizedPwd);
  } catch (e: any) {
    const err: any = new Error(e?.message || 'INVALID_PASSWORD: رمز عبور کاربر جدید نامعتبر است.');
    err.statusCode = 400;
    throw err;
  }

  profile.mustChangePassword = storedHashIsLegacyDefault(profile.password);

  // Normalize username and phone
  if (profile.username) {
    profile.username = toEnglishDigits(String(profile.username).trim());
  }
  if (profile.phone) {
    profile.phone = toEnglishDigits(String(profile.phone).trim());
  }

  const idx = current.profiles.findIndex(p => p.id === profile.id || (p.username && profile.username && toEnglishDigits(p.username).toLowerCase() === toEnglishDigits(profile.username).toLowerCase()));
  if (idx >= 0) {
    // Security fix: never downgrade an existing scrypt hash with a plaintext
    // value arriving from stale client state — only hashed credentials may
    // overwrite an already-hashed stored password.
    const incoming = typeof profile.password === 'string' ? profile.password : '';
    const existingPwd = current.profiles[idx].password;
    const merged = { ...current.profiles[idx], ...profile };
    if (typeof existingPwd === 'string' && existingPwd.startsWith('scrypt:') && !incoming.startsWith('scrypt:')) {
      merged.password = existingPwd;
    }
    current.profiles[idx] = merged;
  } else {
    current.profiles.unshift(profile);
  }

  current.profiles = [...current.profiles];
  invalidateProfileIndex();

  saveStateToDisk(current, 'profiles');
  return profile;
}

// Register customer and user account atomically
export function registerCustomerAccount(customer: any, user: any, payment?: any): any {
  const current = getDatabaseState();
  if (!current.customers) current.customers = [];
  if (!current.profiles) current.profiles = [];
  if (!current.accounting) current.accounting = [];

  // SECURITY FIX (audit #31): run the SAME shared validator as addCustomer() —
  // name/phone mandatory, national-code checksum, bounded financial fields.
  // This path used to skip every check, letting unvalidated customers and
  // arbitrary contract amounts become official invoice/accounting documents.
  validateCustomerPayload(customer);
  // Payment amount must also be a finite non-negative number when present.
  if (payment !== undefined && payment !== null) {
    const amt = Number(payment.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      throw Object.assign(new Error('مبلغ پرداخت نامعتبر است.'), { statusCode: 400 });
    }
  }

  // Enforce customer role is strictly non-admin
  let passwordGenerated: string | undefined;
  if (user) {
    user.role = 'customer';
    const incomingPwd = typeof user.password === 'string' ? user.password.trim() : '';
    // Security fix: no hard-coded default password. If the client supplied none,
    // generate a random one server-side and return it once for the welcome SMS.
    if (!incomingPwd || incomingPwd.startsWith('scrypt:')) {
      // SECURITY FIX (audit #8): was `azma` + 6 digits (~900k combinations —
      // trivially crackable offline against the stored scrypt hash). Now a
      // full 16-char CSPRNG password from an alphanumeric alphabet (~62^16
      // ≈ 10^28 space). Returned once via `passwordGenerated` for the welcome
      // SMS; only its scrypt hash is ever persisted.
      const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (0/O/1/l/I)
      const bytes = crypto.randomBytes(16);
      let pwd = '';
      for (const b of bytes) pwd += ALPHABET[b % ALPHABET.length];
      passwordGenerated = pwd;
      user.password = hashPassword(passwordGenerated);
    } else {
      passwordGenerated = incomingPwd;
      user.password = normalizeStoredPassword(incomingPwd);
    }
  }

  // 1. Add or update customer
  if (user && user.phone) {
    const phoneOwner = current.profiles.find((p: any) => p.phone === user.phone && p.id !== user.id && p.username !== user.username);
    if (phoneOwner) {
      customer.contactPhone = user.phone;
    }
  }

  const custIdx = current.customers.findIndex((c: any) => c.id === customer.id || (c.phone && customer.phone && c.phone === customer.phone));
  if (custIdx >= 0) {
    current.customers[custIdx] = { ...current.customers[custIdx], ...customer };
  } else {
    current.customers.unshift(customer);
  }

  // 2. Add or update user profile (Match ONLY on id and username)
  if (user) {
    const userIdx = current.profiles.findIndex((p: any) => p.id === user.id || (user.username && p.username === user.username));
    if (userIdx >= 0) {
      const existing = current.profiles[userIdx];
      if (['admin', 'operator', 'technician'].includes(existing.role)) {
        const err: any = new Error('ROLE_CONFLICT: حساب کاربری انتخاب شده متعلق به پرسنل آزمایشگاه است و نمی‌تواند به نقش مشتری تبدیل شود.');
        err.statusCode = 409;
        throw err;
      }
      current.profiles[userIdx] = { ...existing, ...user, role: 'customer' };
    } else {
      user.role = 'customer';
      current.profiles.unshift(user);
    }
  }

  // 3. Add payment if provided
  if (payment && payment.amount > 0) {
    const cust = current.customers.find(c => c.id === customer.id);
    if (cust) {
      if (!cust.paymentRecords) cust.paymentRecords = [];
      cust.paymentRecords.unshift(payment);
    }
    current.accounting.unshift({
      // BUG FIX (ID collision): was `acc-${Date.now().toString().slice(-4)}`
      id: `acc-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      title: `دریافت وجه پیش‌پرداخت قرارداد از ${customer.representativeName || customer.companyName}`,
      type: 'income',
      category: 'خدمات آزمایشگاهی بتن',
      amount: payment.amount,
      jalaliDate: payment.jalaliDate,
      customerId: customer.id,
      customerName: customer.companyName,
      // BUG FIX (ID collision): was `ADV-${Date.now().toString().slice(-4)}`
      referenceNo: payment.documentNo || `ADV-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      description: payment.description || 'پیش‌پرداخت قرارداد ثبت‌شده توسط مدیریت',
      createdBy: 'usr-admin-01',
      createdAt: new Date().toISOString()
    });
  }

  // 4. Auto-generate and sync contract invoice so Customer Portal and Admin are 100% connected
  if (!current.invoices) current.invoices = [];
  const totalContract = Number(customer.totalContractAmount) || 0;
  if (totalContract > 0) {
    const paidAmount = Number(customer.paidAmount) || (payment?.amount ? Number(payment.amount) : 0);
    const balance = customer.balance !== undefined ? Number(customer.balance) : Math.max(0, totalContract - paidAmount);
    const isPaid = balance === 0;

    const existingInvIdx = current.invoices.findIndex(inv => inv.customerId === customer.id);
    if (existingInvIdx >= 0) {
      current.invoices[existingInvIdx].amount = totalContract;
      current.invoices[existingInvIdx].totalAmount = totalContract;
      current.invoices[existingInvIdx].customerName = customer.companyName;
      current.invoices[existingInvIdx].status = isPaid ? 'paid' : (current.invoices[existingInvIdx].status === 'pending_settlement' ? 'pending_settlement' : 'unpaid');
      if (isPaid && !current.invoices[existingInvIdx].paidAt) {
        current.invoices[existingInvIdx].paidAt = new Date().toISOString();
      }
    } else {
      const invId = `inv-${customer.id.replace('cust-', '')}`;
      current.invoices.unshift({
        id: invId,
        invoiceNo: `INV-${gregorianToJalali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()).jy}-${customer.id.replace('cust-', '').padStart(3, '0')}`,
        customerId: customer.id,
        customerName: customer.companyName,
        projectName: customer.projectNamePrimary || customer.projectNames?.[0] || 'پروژه جاری',
        amount: totalContract,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: totalContract,
        status: isPaid ? 'paid' : 'unpaid',
        issueDateJalali: customer.contractDateJalali || todayJalaliStr(),
        dueDateJalali: customer.contractEndDateJalali || '',
        paidAt: isPaid ? new Date().toISOString() : undefined,
        items: [
          {
            description: `قرارداد خدمات نظارت، نمونه‌برداری و آزمون مقاومت بتن پروژه ${customer.projectNamePrimary || customer.projectNames?.[0] || ''} (رده ${customer.concreteTargetGrade || 'C30'})`,
            quantity: customer.sampleSeriesCount || 1,
            unitPrice: customer.pricePerSeries || totalContract,
            total: totalContract
          }
        ],
        createdAt: new Date().toISOString()
      });
    }
  }

  saveStateToDisk(current, 'all');
  return { customer, user, payment, passwordGenerated };
}


// Minimal Gregorian->Jalali conversion (aligned with src/utils/jalali.ts algorithm)
export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) - 80 + gd + gDaysInMonth[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

export function todayJalaliStr(): string {
  const d = new Date();
  const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}

// Sync specific collection.
// Returns:
//  - { ok: true } on success
//  - { ok: false, conflict: true, currentVersion } when baseVersion is stale (409)
//  - { ok: false } when payload is invalid
export interface SyncCollectionResult {
  ok: boolean;
  conflict?: boolean;
  currentVersion?: number;
}

export function syncCollection(collectionName: string, data: any[], baseVersion?: number): SyncCollectionResult {
  const current = getDatabaseState() as any;
  if (!Array.isArray(data)) return { ok: false };

  const KNOWN_COLLECTIONS = [
    'profiles', 'customers', 'reports', 'invoices', 'accounting',
    'calibrations', 'dispatches', 'technicians', 'envLogs', 'media',
    'smsLogs', 'trashCustomers'
  ];
  if (!KNOWN_COLLECTIONS.includes(collectionName)) return { ok: false };

  // Optimistic concurrency check: reject stale overwrites with a conflict signal
  const serverVersion = getCollectionVersion(collectionName);
  if (typeof baseVersion === 'number' && Number.isFinite(baseVersion) && baseVersion !== serverVersion) {
    return { ok: false, conflict: true, currentVersion: serverVersion };
  }

  if (collectionName === 'profiles') {
    console.warn('[SECURITY] Bulk sync-collection for "profiles" is strictly forbidden. Dedicated endpoints (add-profile, update-profile, delete-profile) must be used.');
    return { ok: false, conflict: true, currentVersion: serverVersion };
  }
  current[collectionName] = data;
  saveStateToDisk(current, collectionName);
  return { ok: true, currentVersion: getCollectionVersion(collectionName) };
}

// Set active user session on VPS server
export function setSessionUser(userId: string | null): boolean {
  const current = getDatabaseState();
  current.currentUserId = userId || undefined;
  saveStateToDisk(current, 'session');
  return true;
}

/**
 * Collision-safe ID generator for server-side records (mirrors
 * src/utils/uniqueId.ts, which cannot be imported here because the server
 * bundle is compiled separately from the client). The old fallbacks used
 * `usr-${Date.now()}` / `acc-${Date.now().toString(36)}-...` without entropy —
 * two inserts within the same millisecond silently overwrote each other in
 * findIndex(id) lookups.
 */
export function uniqueServerId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

// Update or add profile on server
export async function updateProfileServer(
  profile: any,
  opts?: { actorRole?: string; actorUserId?: string; trusted?: boolean }
): Promise<{ success: boolean; profile: any }> {
  const current = getDatabaseState();
  if (!current.profiles) current.profiles = [];

  // SECURITY FIX (role-based field whitelist): clients only ever receive
  // SANITIZED profiles (password stripped), so a round-tripped profile object
  // must never smuggle credentials or privileged fields back in. Previously an
  // OPERATOR could: (a) reset ANY user's password by pushing a plaintext
  // `password` through this endpoint, (b) demote the sole admin to operator by
  // echoing a stale cached admin profile with role:'operator', and (c) flip
  // arbitrary flags like `status`/`mustChangePassword`. Now:
  //  - password writes are allowed ONLY for admins or genuine self-changes;
  //  - role changes are allowed ONLY for admins;
  //  - status/mustChangePassword are server-managed (never client-writable).
  const actorRole = opts?.actorRole;
  const actorUserId = opts?.actorUserId || '';
  const isAdminActor = actorRole === 'admin';
  const isSelfChange = !!actorUserId && actorUserId === profile.id;
  const canWritePassword = isAdminActor || isSelfChange;
  const canWriteRole = isAdminActor;

  // Server-internal trusted writes (tryBootstrapAdminPassword and any other
  // caller that passes `trusted: true`) are exempt from the field whitelist —
  // they legitimately carry freshly-hashed credentials and role/flag values.
  const trustedInternalWrite = !!opts?.trusted;

  // Strip server-managed / credential fields the actor is not allowed to write.
  if (!canWritePassword && !trustedInternalWrite) delete profile.password;
  if (!canWriteRole && !trustedInternalWrite) {
    delete profile.role;
    delete profile.status;
    delete profile.mustChangePassword;
  }

  // Enforce sole admin security rule
  if (profile.id === SOLE_ADMIN_ID || profile.username === SOLE_ADMIN_USERNAME) {
    profile.id = SOLE_ADMIN_ID;
    profile.username = SOLE_ADMIN_USERNAME;
    profile.role = 'admin';
  } else if (profile.role === 'admin') {
    profile.role = 'operator';
  }

  // SECURITY FIX (audit #15): this endpoint is for UPDATING an existing
  // profile only. Creating users must go through add-profile /
  // register-customer-account, which have their own access checks and apply
  // the credential whitelist consistently. Previously a non-admin actor could
  // POST update-profile with a fresh id (idx < 0 branch) and silently INSERT a
  // brand-new user with an arbitrary role/status — bypassing the whitelist that
  // the update branch enforces. If the target does not exist, refuse loudly.
  // Sole-admin bootstrap is the one sanctioned exception: if the admin record
  // itself has been lost from disk, the trusted internal caller must be able
  // to re-create it (that path always carries SOLE_ADMIN_ID).
  const idx = current.profiles.findIndex((p: any) =>
    p.id === profile.id ||
    (profile.username && p.username === profile.username) ||
    (profile.email && p.email === profile.email) ||
    (profile.customerId && p.customerId === profile.customerId)
  );
  const isSoleAdminTarget = profile.id === SOLE_ADMIN_ID || profile.username === SOLE_ADMIN_USERNAME;
  if (idx < 0 && !(trustedInternalWrite && isSoleAdminTarget)) {
    const err: any = new Error('NOT_FOUND: پروفایل هدف یافت نشد؛ ساخت کاربر جدید فقط از مسیر add-profile مجاز است.');
    err.statusCode = 404;
    throw err;
  }

  let updated: any;
  // Hoisted out of the update branch so the mustChangePassword-preservation
  // guard below can reference them without scoping issues.
  let incoming = '';
  const existing = idx >= 0 ? current.profiles[idx] : undefined;
  if (existing) {
    const isTargetSoleAdmin = existing.id === SOLE_ADMIN_ID || existing.username === SOLE_ADMIN_USERNAME;
    // Security fix: an incoming password NEVER silently overwrites a valid hash.
    // Genuine new passwords arrive as PLAINTEXT (clients only ever receive
    // sanitized profiles, so any `scrypt:`-shaped value pushed back is a stale
    // echo or a legacy fake digest and must never be written). A stored
    // credential is replaced only when the incoming value is real plaintext;
    // legacy plaintext seeds are one-time-migrated by normalizeStoredPassword().
    incoming = typeof profile.password === 'string' ? profile.password.trim() : '';
    // Server-internal credential flows (tryBootstrapAdminPassword) write a
    // freshly generated genuine scrypt hash. The old guard rejected ANY
    // `scrypt:`-shaped incoming value as a "client echo" — which made every
    // bootstrap/forced reset a silent no-op ("success:true" but the stored
    // credential never changed). A hash is accepted from internal callers only
    // when it is in genuine server format AND differs from the stored one
    // (a stale client can at worst echo back the current credential, and
    // clients never receive hashes anyway since profiles are sanitized).
    const trustedInternalHashWrite =
      incoming.startsWith('scrypt:') &&
      !isFakeClientScryptHash(incoming) &&
      incoming !== existing.password;
    // SECURITY FIX (silent credential lockout): a genuine plaintext password
    // change must ALWAYS be hashed with real server-side scrypt. The old code
    // passed the raw value through normalizeStoredPassword(), which stores
    // short (<8 char) or legacy-shaped passwords VERBATIM as plaintext — those
    // accounts then failed every future login because authenticateUser()
    // rejects anything shorter than 8 chars / equal to the legacy default.
    // hashPassword() enforces the same >=8-char rule, so an invalid change is
    // now rejected loudly instead of corrupting the stored credential.
    let newPwd: string;
    if (!incoming) {
      newPwd = existing.password;
    } else if (trustedInternalHashWrite) {
      newPwd = normalizeStoredPassword(incoming, true);
    } else if (!incoming.startsWith('scrypt:') && !isLegacyDefaultChoice(incoming)) {
      try {
        newPwd = hashPassword(incoming);
      } catch {
        const err: any = new Error('INVALID_PASSWORD: رمز عبور جدید نامعتبر است (حداقل ۸ کاراکتر).');
        err.statusCode = 400;
        throw err;
      }
    } else if (isLegacyPlaintextPassword(existing.password)) {
      // One-time migration path for legacy plaintext seeds stays via
      // normalizeStoredPassword(); anything else is refused.
      newPwd = normalizeStoredPassword(incoming, false);
    } else {
      // Stale client echo / bogus credential shape — keep the stored hash.
      newPwd = existing.password;
    }
    const finalRole = isTargetSoleAdmin
      ? 'admin'
      : (profile.role === 'admin'
          ? (existing.role === 'admin' ? 'operator' : existing.role)
          : (profile.role || existing.role));

    if (!finalRole || !['admin', 'operator', 'customer'].includes(finalRole)) {
      const err: any = new Error('INVALID_ROLE: مشخصه نقش باید یکی از مقادیر admin، operator یا customer باشد.');
      err.statusCode = 400;
      throw err;
    }

    // Assert final role belongs to the same identity class (staff vs customer) as the stored record
    const existingIsStaff = existing.role === 'admin' || existing.role === 'operator';
    const finalIsStaff = finalRole === 'admin' || finalRole === 'operator';
    if (!trustedInternalWrite && existingIsStaff !== finalIsStaff) {
      const err: any = new Error('ROLE_CLASS_MISMATCH: تغییر کلاس کاربری بین پرسنل آزمایشگاه و مشتری از طریق این بخش مجاز نمی‌باشد.');
      err.statusCode = 400;
      throw err;
    }

    updated = {
      ...existing,
      ...profile,
      role: finalRole,
      password: newPwd
    };
    current.profiles[idx] = updated;
  } else {
    // Bootstrap-only path (audit #15 exception): trusted internal caller
    // re-creating the sole-admin record after it was lost from disk. Never
    // reachable from HTTP because non-trusted missing targets throw above.
    const newPwd = normalizeStoredPassword(profile.password, true);
    updated = {
      status: 'active',
      createdAt: new Date().toISOString(),
      ...profile,
      id: profile.id || SOLE_ADMIN_ID,
      role: 'admin',
      password: newPwd
    };
    current.profiles.unshift(updated);
  }

  // SECURITY FIX (mustChangePassword gate): the flag is server-managed and
  // stripped from every client-supplied profile above, so it can only be
  // cleared through a genuine credential change. The sanctioned paths are
  // updateUserPassword() (POST /api/lab-data/update-password) and trusted
  // internal writes. Previously an update merged the incoming (sanitized)
  // profile over the existing one with `...profile`, silently dropping
  // mustChangePassword=true — an admin editing any field of their own profile
  // via the dashboard could clear the forced-change gate without ever changing
  // the password. Now: if the stored record still carries the flag and this
  // write neither clears it deliberately (trusted path) nor replaces the
  // credential, the flag is re-applied to the merged record.
  if (existing && !trustedInternalWrite && existing.mustChangePassword && updated.mustChangePassword !== true) {
    const credentialChanged = !!incoming && incoming !== existing.password;
    if (!credentialChanged) {
      updated.mustChangePassword = true;
    }
  }

  // PERF FIX (audit #41): the redundant inline enforceSoleAdminRules pass was
  // removed — saveStateToDiskAwaitable() normalizes exactly once inside the
  // shared prepareStateForSave step, so this mutator no longer pays two full
  // O(n) passes with allocations per request. Awaited so a failed disk write
  // surfaces as a real error instead of a silent success:true.
  await saveStateToDiskAwaitable(current, 'profiles');
  return { success: true, profile: sanitizeProfile(updated) };
}

// Convert Persian/Arabic digits to English for uniform matching
export function toEnglishDigits(str: string): string {
  return (str || '')
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584));
}

// Find user by username, email, phone, or customerId
export function findUserByIdentifier(identifier: string): any | null {
  const current = getDatabaseState();
  const raw = (identifier || '').trim();
  if (!raw) return null;

  const eng = toEnglishDigits(raw).toLowerCase();
  const digitsOnly = eng.replace(/[^0-9]/g, '');

  // SECURITY FIX: the previous matcher accepted 4-digit phone suffixes, role
  // aliases ('admin'/'operator'/'customer'/'client'), email prefixes and even
  // partial full names — allowing anyone who knew the last 4 digits of a
  // phone number to attempt authentication against that account
  // (impersonation risk). Matching is now STRICT: only an exact username,
  // email, customer id (with optional 'cust-' prefix), full phone number, or
  // profile id resolves to a user. Ambiguous identifiers are rejected.
  //
  // PERF FIX (audit #41): O(1) Map lookups via the lazy profile index instead
  // of a linear filter pass over every profile on EVERY authentication request.
  // The maps store the first profile registered under each key; to preserve
  // the original ambiguity semantics exactly (two accounts sharing one
  // identifier → refuse to pick silently), we verify uniqueness with one
  // counting pass ONLY in the rare case a fast-path key actually hits.
  let idx = getProfileIndex(current);
  let candidate: any | undefined =
    idx.byUsername.get(eng) ||
    idx.byEmail.get(eng) ||
    idx.byCustomerId.get(eng) ||
    idx.byCustomerId.get(`cust-${eng}`) ||
    idx.byId.get(eng);
  if (!candidate && digitsOnly.length >= 8) {
    // Full phone match only (normalized digits) — never suffix fragments.
    candidate = idx.byPhone.get(digitsOnly);
  }

  // Defensive fallback: if candidate not found in cached index, invalidate cache and re-check
  if (!candidate) {
    invalidateProfileIndex();
    idx = getProfileIndex(current);
    candidate =
      idx.byUsername.get(eng) ||
      idx.byEmail.get(eng) ||
      idx.byCustomerId.get(eng) ||
      idx.byCustomerId.get(`cust-${eng}`) ||
      idx.byId.get(eng);
    if (!candidate && digitsOnly.length >= 8) {
      candidate = idx.byPhone.get(digitsOnly);
    }
  }

  // Linear scan fallback over current.profiles to prevent any desync
  if (!candidate && Array.isArray(current.profiles)) {
    candidate = current.profiles.find((u: any) => {
      const uEmail = (u.email || '').toLowerCase();
      const uUsername = toEnglishDigits(u.username || '').toLowerCase();
      const uPhone = toEnglishDigits(u.phone || '').replace(/[^0-9]/g, '');
      const uCustId = toEnglishDigits(u.customerId || '').toLowerCase();
      const uId = toEnglishDigits(String(u.id || '')).toLowerCase();

      return (
        uUsername === eng ||
        uEmail === eng ||
        uId === eng ||
        uCustId === eng ||
        `cust-${eng}` === uCustId ||
        (digitsOnly.length >= 8 && uPhone && (uPhone === digitsOnly || uPhone.endsWith(digitsOnly) || digitsOnly.endsWith(uPhone)))
      );
    });
  }

  if (!candidate) return null;

  // A hit exists → confirm no OTHER profile matches the same strict criteria.
  let matches = 0;
  for (const u of current.profiles || []) {
    const uEmail = (u.email || '').toLowerCase();
    const uUsername = toEnglishDigits(u.username || '').toLowerCase();
    const uPhone = toEnglishDigits(u.phone || '').replace(/[^0-9]/g, '');
    const uCustId = toEnglishDigits(u.customerId || '').toLowerCase();
    const uId = toEnglishDigits(String(u.id || '')).toLowerCase();

    if (uUsername === eng || uEmail === eng || uId === eng ||
        uCustId === eng || `cust-${eng}` === uCustId ||
        (digitsOnly.length >= 8 && uPhone && (uPhone === digitsOnly || uPhone.endsWith(digitsOnly) || digitsOnly.endsWith(uPhone)))) {
      matches++;
      if (matches > 1) return null; // ambiguous → refuse
    }
  }
  return candidate;
}

// Authenticate user with password against scrypt hash.
// Also reports whether the account is still using the legacy default password,
// so the client can force an immediate password change (one-time migration credential).
export async function authenticateUser(identifier: string, password: string): Promise<{ success: boolean; error?: string; user?: any; usedLegacyPassword?: boolean }> {
  const user = findUserByIdentifier(identifier);
  if (!user) {
    return { success: false, error: 'نام کاربری یا رمز عبور نامعتبر است.' };
  }

  // SECURITY FIX #2 (hard-coded defaults removed): the legacy demo password is
  // NEVER accepted as a login credential — not even via a stored hash that
  // happens to match it. Accounts left on that credential must be reset
  // out-of-band (ADMIN_INITIAL_PASSWORD bootstrap / admin change-password).
  const enteredPassword = normalizeIncomingPassword(password);
  if (!enteredPassword || isLegacyDefaultChoice(enteredPassword)) {
    return { success: false, error: 'رمز عبور وارد شده صحیح نمی‌باشد.' };
  }
  const enteredNorm = toEnglishDigits(enteredPassword);

  const isValid = verifyPassword(enteredPassword, user.password) ||
                  verifyPassword(enteredNorm, user.password) ||
                  verifyPassword(enteredPassword.toLowerCase(), user.password) ||
                  verifyPassword(enteredNorm.toLowerCase(), user.password);

  if (!isValid) {
    return { success: false, error: 'رمز عبور وارد شده صحیح نمی‌باشد.' };
  }

  // Legacy flag intentionally always false now (kept for API compatibility).
  // The forced-change gate is driven by the persisted profile flag instead.
  const usedLegacyPassword = false;

  // FIX (bootstrap credential lockout): when the operator bootstraps the admin
  // account via ADMIN_INITIAL_PASSWORD, every first login with that env value
  // must re-arm the forced-change gate. Without this, a server restart would
  // wipe the in-memory flag set at repair time and the weak bootstrap password
  // could linger indefinitely. Genuine user-chosen passwords never match the
  // env value, so this only fires while the bootstrap credential is still in use.
  if (BOOTSTRAP_CONFIGURED && user &&
      (user.id === SOLE_ADMIN_ID || user.username === SOLE_ADMIN_USERNAME) &&
      !user.mustChangePassword &&
      (verifyPassword(ADMIN_INITIAL_PASSWORD, user.password) ||
       verifyPassword(toEnglishDigits(ADMIN_INITIAL_PASSWORD), user.password))) {
    try {
      await markProfileMustChangePassword(String(user.id));
      user.mustChangePassword = true;
      // PERF FIX (audit #43): keep the live session registry in sync even when
      // the profile object here is not the cached-state instance (e.g. the
      // OTP-pending copy) — markProfileMustChangePassword only flips sessions
      // when it actually persists a change.
      setSessionMustChangePasswordForUser(String(user.id), true);
    } catch {
      /* best-effort: gate still applies from the in-memory copy */
    }
  }

  return { success: true, user, usedLegacyPassword };
}

/** Persist mustChangePassword=true for a profile (used right after login). */
async function markProfileMustChangePassword(userId: string): Promise<void> {
  await withDbWrite(async () => {
    const current = getDatabaseState();
    const target = findProfileById(current, userId) ||
      current.profiles.find((p: any) => p.id === userId);
    if (!target || target.mustChangePassword) return;
    // Mutate via a fresh array so the lazy profile-index / state identity
    // bookkeeping stays consistent with the rest of the write pipeline.
    current.profiles = current.profiles.map((p: any) =>
      p === target ? { ...p, mustChangePassword: true } : p
    );
    await saveStateToDiskAwaitable(current, 'profiles');
    // PERF FIX (audit #43): keep live session payloads in sync with the flag
    // so the O(1) token-based gate sees the re-armed value immediately.
    setSessionMustChangePasswordForUser(String(target.id), true);
  });
}

// Update user role on server
export async function updateUserRoleServer(userId: string, role: string): Promise<{ success: boolean; error?: string; profile?: any }> {
  const current = getDatabaseState();
  if (!current.profiles) current.profiles = [];

  // PERF FIX (audit #41): O(1) id lookup via the lazy profile index.
  let idx = -1;
  const byId = findProfileById(current, userId);
  if (byId) {
    idx = current.profiles.indexOf(byId);
  } else {
    idx = current.profiles.findIndex((p: any) => p.username === userId || p.email === userId);
  }
  if (idx >= 0) {
    const target = current.profiles[idx];
    const isTargetSoleAdmin = target.id === SOLE_ADMIN_ID || target.username === SOLE_ADMIN_USERNAME;

    if (isTargetSoleAdmin) {
      if (role !== 'admin') {
        return { success: false, error: 'نقش مدیر ارشد واحد سامانه ثابت بوده و غیرقابل تغییر است.' };
      }
    } else {
      if (role === 'admin') {
        return { success: false, error: 'دسترسی مدیریت به هیچ وجه به کاربر دیگری داده نمی‌شود. سیستم دارای یک مدیر ارشد واحد است.' };
      }
    }

    target.role = isTargetSoleAdmin ? 'admin' : (role === 'admin' ? 'operator' : role);
    // Redundant inline enforce removed (audit #41) — saveStateToDiskAwaitable
    // normalizes exactly once.
    await saveStateToDiskAwaitable(current, 'profiles');
    return { success: true, profile: target };
  }
  return { success: false, error: 'کاربر مورد نظر یافت نشد.' };
}

/**
 * SECURITY FIX (audit #29): dedicated server-side profile deletion. The client
 * used to express deletions by re-pushing the whole profiles collection via
 * sync-collection — racing every other profile writer and carrying stale or
 * blank password fields. Now deleteProfile() posts { profileId } here and the
 * server performs a targeted removal inside the serialized write chain.
 */
export function deleteProfileServer(profileId: string): { success: boolean; error?: string } {
  if (!profileId || typeof profileId !== 'string') {
    return { success: false, error: 'profileId is required' };
  }
  // Sole admin can never be deleted — same invariant as the client guard.
  if (profileId === SOLE_ADMIN_ID || profileId === SOLE_ADMIN_USERNAME) {
    return { success: false, error: 'حساب مدیر ارشد واحد سامانه غیرقابل حذف است.' };
  }
  const current = getDatabaseState();
  if (!current.profiles) current.profiles = [];
  const idx = current.profiles.findIndex((p: any) => p.id === profileId || p.username === profileId);
  if (idx < 0) {
    return { success: false, error: 'کاربر مورد نظر یافت نشد.' };
  }
  // Capture the id BEFORE splicing so session revocation targets the right user.
  const removedId = current.profiles[idx].id ?? profileId;
  current.profiles.splice(idx, 1);
  // Revoke every live session of the deleted user so their tokens die with them.
  revokeAllUserSessions(removedId);
  saveStateToDisk(current, 'profiles');
  return { success: true };
}

// Factory initial state
function createInitialState(): LabDatabaseState {
  return {
    version: 1,
    lastUpdated: Date.now(),
    profiles: [
      {
        id: SOLE_ADMIN_ID,
        email: `admin@${SITE_EMAIL_DOMAIN}`,
        username: 'admin',
        // Bootstrap password comes from ADMIN_INITIAL_PASSWORD env (hashed);
        // if unset the account is non-loginable until reset out-of-band.
        password: bootstrapPasswordHash(),
        fullName: process.env.ADMIN_FULL_NAME || 'مدیر ارشد آزمایشگاه',
        role: 'admin',
        phone: process.env.ADMIN_PHONE || '',
        status: 'active',
        createdAt: '2025-01-01T08:00:00Z'
      }
    ],
    customers: [],
    reports: [],
    invoices: [],
    accounting: [],
    calibrations: [],
    dispatches: [],
    technicians: [],
    envLogs: [],
    media: [],
    smsLogs: [],
    trashCustomers: []
  };
}
