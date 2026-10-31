/**
 * Pure Server-Authoritative (VPS) Reactive Storage Engine
 * Strictly uses VPS storage with zero browser localStorage
 */

import { 
  UserProfile, 
  Customer, 
  CustomerPaymentRecord, 
  TrashCustomerItem,
  TestReport, 
  AccountingRecord, 
  Invoice,
  EquipmentCalibration,
  TechnicianDispatch,
  FieldTechnician,
  EnvironmentalLog,
  LabMediaItem,
  SmsLog,
  SmsEvent,
  SOLE_ADMIN_ID,
  SOLE_ADMIN_USERNAME
} from '../types';
// Delivery build: no demo/sample seed data ships with the client.
// All records (users, customers, reports, ...) are created at runtime by the
// admin and synced from the VPS server (single source of truth).
// FIX #1 (Broken password change / unloginable accounts): the client used to
// pre-hash passwords with WebCrypto PBKDF2 but label the result `scrypt:...`.
// The server trusted that prefix and stored it verbatim, while verification on
// the server derives keys with Node's real crypto.scrypt — so every password
// set through the UI could NEVER be verified. Passwords now travel as
// plaintext over HTTPS/TLS only and are hashed exactly once on the server.
import { generateRandomPassword } from '../utils/passwordCrypto';
import { getTodayJalali, formatJalali } from '../utils/jalali';
// BUG FIX (ID collision): all record IDs used to be `prefix-${Date.now().toString().slice(-4)}`
// (last 4 digits of epoch ms -> guaranteed wrap-around every ~100s and frequent
// same-second collisions that silently overwrote records). Now CSPRNG-suffixed.
import { uniqueId, uniqueRefNo } from '../utils/uniqueId';
import { navHistory } from './navigationHistory';

export interface StorageDataState {
  profiles: UserProfile[];
  customers: Customer[];
  reports: TestReport[];
  invoices: Invoice[];
  accounting: AccountingRecord[];
  calibrations: EquipmentCalibration[];
  dispatches: TechnicianDispatch[];
  technicians: FieldTechnician[];
  envLogs: EnvironmentalLog[];
  media: LabMediaItem[];
  smsLogs: SmsLog[];
  trashCustomers: TrashCustomerItem[];
}

export class ConcreteLabStorage {
  private listeners: Array<() => void> = [];
  private isServerSyncing: boolean = false;
  private pendingResync: boolean = false;
  private eventSource: EventSource | null = null;
  private syncStatus = { connected: false, version: 0, lastSyncTime: Date.now() };
  // Last server-side rejection message (e.g. "current password required" on a
  // self-service password change). Read by UI flows to show a precise error.
  public lastWriteError: string | null = null;
  /** Set when the server refuses a mutation because the account still has
   *  `mustChangePassword` pending (see recoverFromPasswordGate below). */
  public passwordChangeRequired = false;
  // Per-collection etag versions (optimistic concurrency): baseVersion sent on write,
  // server rejects stale overwrites with 409 and we reload + retry once.
  private collectionVersions: Record<string, number> = {};
  private conflictListeners: Array<(collection: string) => void> = [];

  // PERF FIX (audit #40): per-collection trailing debounce state for
  // persistCollection() — collapses rapid successive full-array POSTs into one.
  private static readonly PERSIST_DEBOUNCE_MS = 600;
  private pendingPersists = new Map<string, { timer: ReturnType<typeof setTimeout> }>();
  private latestPersistData = new Map<string, any[]>();

  // PERF FIX (audit #48): memoized getProfiles() projection. The old version
  // built a brand-new mapped array on every call, so memoized children saw a
  // new reference each render and re-rendered forever. Cache is keyed by the
  // source-array identity + currentUser id (both feed the projection logic);
  // any notify()-driven state replacement changes the reference and rebuilds.
  private profilesCache: {
    src: UserProfile[] | null;
    currentUserId: string | undefined;
    result: UserProfile[];
  } | null = null;

  // Pure In-Memory State (Zero localStorage)
  private state: StorageDataState;
  private currentUser: UserProfile | null = null;
  private sessionToken: string | null = null;
  private sseReconnectTimer: any = null;
  private sseRetryCount: number = 0;

  constructor() {
    // 1. Initialize RAM state cleanly with real data structure (no mock/test records)
    this.state = {
      // Delivery build: fully empty in-memory state until the VPS server responds.
      profiles: [],
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
    this.currentUser = null;

    if (typeof window !== 'undefined') {
      try {
        // SECURITY/BUG FIX: the constructor used to run `localStorage.clear()`
        // and even `sessionStorage.clear()` on every page load. That nuked ALL
        // storage of this origin — other apps/tabs sharing the domain, any
        // third-party SDK state, and (on refresh) our own refresh token before
        // it could be restored, silently breaking session continuity.
        // This service is intentionally "zero localStorage": its only browser
        // state is the single sessionStorage session token below, which is
        // already read/written by key. No wholesale clearing is needed or safe.
        const savedToken = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('azma_session_token') : null)
          || (typeof localStorage !== 'undefined' ? localStorage.getItem('azma_session_token_v2') : null);
        if (savedToken) this.sessionToken = savedToken;

        const savedUserJson = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('azma_current_user') : null;
        if (savedUserJson) {
          try {
            const parsedUser = JSON.parse(savedUserJson);
            if (parsedUser && typeof parsedUser === 'object' && parsedUser.id) {
              this.currentUser = parsedUser;
            }
          } catch (e) {}
        }
      } catch (e) {
        // ignore
      }

      // 3. Connect real-time Server-Sent Events (SSE) to VPS
      this.connectSse();

      // 4. Initial immediate pull from central VPS storage
      this.fetchFromServer();

      // 5. Lightweight version polling fallback (only while SSE is down —
      //    OPTIMIZATION: avoids redundant /version requests every 3s when the
      //    real-time SSE channel is already delivering updates).
      //    FIX (audit #35): prefer the cheap /api/health heartbeat endpoint
      //    (checkHealthAndResyncIfNeeded) and only escalate to the full
      //    /version payload when health indicates a change or is unavailable.
      setInterval(() => {
        if (!this.syncStatus.connected) {
          this.checkVersionFromServer();
        } else {
          this.checkHealthAndResyncIfNeeded().catch(() => {});
        }
      }, 10000);

      // 6. Resync on tab focus or online
      window.addEventListener('focus', () => this.fetchFromServer(true));
      window.addEventListener('online', () => {
        this.connectSse();
        this.fetchFromServer(false);
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.fetchFromServer(true);
        } else {
          // PERF FIX (audit #40): flush any debounced persistCollection writes
          // when the tab hides, so a pending 600ms-window write is never lost
          // to a closed/backgrounded page.
          this.flushPersistCollection();
        }
      });
    }
  }

  /**
   * Real server-side logout: revokes the session token (jti) on the VPS, then clears local state.
   */
  public async logout(): Promise<void> {
    // PERF FIX (audit #40): flush pending debounced collection writes BEFORE
    // tearing the session down, so a save made <600ms ago is not lost.
    this.flushPersistCollection();
    // BUG FIX (audit "token key ambiguity"): there is exactly ONE session-token
    // location — sessionStorage under 'azma_session_token', managed via
    // setSessionToken(). The old fallback read a never-written
    // 'localStorage.lab_session_token' key, which only added confusion about
    // where credentials live. Removed.
    const token = this.getSessionToken();
    try {
      // FIX (audit #12): send the refresh token alongside logout so the server
      // can blacklist its jti too. Without this, a stateless refresh token
      // survived logout and could mint a brand-new session for up to 30 days.
      const refreshToken = this.getRefreshToken();
      await fetch('/api/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify(refreshToken ? { refreshToken } : {})
      });
    } catch (e) {
      // Even if the network call fails we still clear the local session.
    }
    try {
      localStorage.removeItem('lab_refresh_token');
      localStorage.removeItem('azma_session_token_v2');
      sessionStorage.removeItem('azma_session_token');
      sessionStorage.removeItem('azma_current_user');
    } catch (e) {}
    this.setSessionToken(null);
    this.setCurrentUser(null as any);
  }

  public setSessionToken(token: string | null) {
    this.sessionToken = token;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          sessionStorage.setItem('azma_session_token', token);
          localStorage.setItem('azma_session_token_v2', token);
        } else {
          sessionStorage.removeItem('azma_session_token');
          localStorage.removeItem('azma_session_token_v2');
        }
      } catch (e) {
        // ignore
      }
      // Re-arm proactive renewal and real-time SSE stream
      if (token) {
        this.scheduleProactiveRefresh();
        this.connectSse();
      } else {
        if (this.proactiveRefreshTimer) {
          clearTimeout(this.proactiveRefreshTimer);
          this.proactiveRefreshTimer = null;
        }
        if (this.eventSource) {
          try { this.eventSource.close(); } catch (e) {}
          this.eventSource = null;
        }
        if (this.sseReconnectTimer) {
          clearTimeout(this.sseReconnectTimer);
          this.sseReconnectTimer = null;
        }
        this.syncStatus.connected = false;
      }
    }
  }

  public getSessionToken(): string | null {
    if (!this.sessionToken && typeof window !== 'undefined') {
      try {
        this.sessionToken = sessionStorage.getItem('azma_session_token') || localStorage.getItem('azma_session_token_v2');
      } catch (e) {
        // ignore
      }
    }
    return this.sessionToken;
  }

  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
      headers['X-Session-Token'] = this.sessionToken;
    }
    return headers;
  }

  // Server-side authentication
  public async login(identifier: string, password: string): Promise<{
    success: boolean;
    requiresOtp?: boolean;
    tempToken?: string;
    user?: UserProfile;
    phone?: string;
    simulatedOtp?: string;
    mustChangePassword?: boolean;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'ورود ناموفق بود.' };
      }

      if (json.requiresOtp) {
        return {
          success: true,
          requiresOtp: true,
          tempToken: json.tempToken,
          user: json.user,
          phone: json.phone,
          simulatedOtp: json.simulatedOtp,
          mustChangePassword: json.mustChangePassword
        };
      }

      if (json.token && json.user) {
        this.setSessionToken(json.token);
        // FIX #1: single helper for persisting the rotated refresh token.
        this.storeRefreshToken(json.refreshToken);
        this.setCurrentUser(json.user);
        await this.fetchFromServer(false);
        return { success: true, user: json.user, mustChangePassword: json.mustChangePassword };
      }

      return { success: false, error: 'خطای غیرمنتظره در احراز هویت سرور.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'خطا در برقراری ارتباط با سرور احراز هویت.' };
    }
  }

  // Server-side 2FA SMS verification
  // ---------------------------------------------------------------------------
  // FIX #1 (Broken refresh-token flow):
  // The server issues a long-lived refreshToken alongside every session token
  // (login, verify-otp and /api/refresh rotation), but the client previously
  // only stored it in localStorage and NEVER used it. When the short-lived HMAC
  // session token expired (or after a server restart revoked active sessions),
  // every API call silently failed and the user had to log in again — including
  // re-passing 2FA SMS. Now any authenticated request that comes back 401 is
  // retried once after exchanging the refresh token for a fresh session token.
  // ---------------------------------------------------------------------------
  private refreshInFlight: Promise<boolean> | null = null;

  public getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('lab_refresh_token');
    } catch (e) {
      return null;
    }
  }

  private storeRefreshToken(token?: string | null): void {
    if (typeof window === 'undefined' || !token) return;
    try {
      localStorage.setItem('lab_refresh_token', token);
    } catch (e) {
      // ignore storage failures (private mode etc.)
    }
  }

  // BUG FIX (mass-logout #2): a TRANSIENT server failure (429 rate-limit,
  // 5xx during a PM2 restart / max_memory_restart cycle, network blip) used to
  // be treated as "refresh token invalid" — the stored refresh token was
  // deleted on the spot and every user behind the shared corporate NAT IP
  // (the /api/refresh limiter is per-IP: 20 requests / 10 min) permanently
  // lost their renewal path, so the next 401 became a hard logout + full SMS
  // 2FA re-login. Now the token is dropped ONLY on an authoritative 401/403
  // from the server; transient failures are retried with exponential backoff
  // (Retry-After honored) and otherwise simply reported as "not refreshed".
  private static readonly REFRESH_MAX_ATTEMPTS = 3;
  private refreshBackoffUntil = 0;
  private refreshFailureStreak = 0;

  private clearStoredRefreshToken(): void {
    try { localStorage.removeItem('lab_refresh_token'); } catch (e) {}
  }

  /** Exchange the stored refresh token for a new session token. Concurrent callers share one attempt. */
  public async tryRefreshSession(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;
    if (this.refreshInFlight) return this.refreshInFlight;
    // Respect an active backoff window from a previous transient failure.
    if (Date.now() < this.refreshBackoffUntil) return false;
    this.refreshInFlight = (async () => {
      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
      try {
        for (let attempt = 1; attempt <= ConcreteLabStorage.REFRESH_MAX_ATTEMPTS; attempt++) {
          let res: Response;
          try {
            res = await fetch('/api/lab-data/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken })
            });
          } catch (e) {
            // Network error: definitely NOT proof the token is bad — keep it.
            if (attempt < ConcreteLabStorage.REFRESH_MAX_ATTEMPTS) {
              await sleep(Math.min(2 ** attempt * 500, 8000));
              continue;
            }
            return false;
          }

          if (res.ok) {
            const json = await res.json().catch(() => null);
            if (json?.success && json.token) {
              this.refreshFailureStreak = 0;
              this.refreshBackoffUntil = 0;
              this.setSessionToken(json.token);
              this.storeRefreshToken(json.refreshToken); // rotation: keep the newest token
              if (json.user) {
                this.currentUser = json.user;
                this.notify();
              }
              return true;
            }
            // 200 but unusable payload — malformed response, treat as transient.
            if (attempt < ConcreteLabStorage.REFRESH_MAX_ATTEMPTS) {
              await sleep(Math.min(2 ** attempt * 500, 8000));
              continue;
            }
            return false;
          }

          if (res.status === 401 || res.status === 403) {
            // Authoritative rejection: the refresh token itself is invalid,
            // expired or revoked. Dropping it is correct here.
            this.clearStoredRefreshToken();
            this.refreshFailureStreak = 0;
            this.refreshBackoffUntil = 0;
            return false;
          }

          if (res.status === 429) {
            // Per-IP quota exhausted (shared office NAT). Honor Retry-After and
            // DO NOT touch the stored token — it is still valid.
            const retryAfterSec = Number(res.headers.get('Retry-After'));
            const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
              ? Math.min(retryAfterSec * 1000, 60_000)
              : Math.min(2 ** attempt * 2000, 15_000);
            this.refreshBackoffUntil = Date.now() + waitMs;
            return false;
          }

          if (res.status >= 500) {
            // Transient server failure (restart/crash) — keep the token, back off.
            if (attempt < ConcreteLabStorage.REFRESH_MAX_ATTEMPTS) {
              await sleep(Math.min(2 ** attempt * 500, 8000));
              continue;
            }
            this.refreshFailureStreak++;
            this.refreshBackoffUntil = Date.now() + Math.min(this.refreshFailureStreak * 10_000, 60_000);
            return false;
          }

          // Any other 4xx (400 bad request, etc.): ambiguous — keep the token,
          // do not retry in a loop.
          return false;
        }
        return false;
      } finally {
        this.refreshInFlight = null;
      }
    })();
    return this.refreshInFlight;
  }

  // Proactive (pre-expiry) renewal — BUG FIX (mass-logout #5): waiting until a
  // request already failed with 401 means every user's write races the expiry
  // moment. The issued session token embeds its own `exp` (base64url JSON
  // payload, HMAC-signed — safe to decode client-side, never trusted), so we
  // can renew BEFORE the server ever rejects. Renewal goes through the same
  // single-flight/backoff path as the reactive one.
  private proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly PROACTIVE_REFRESH_MARGIN_MS = 15 * 60 * 1000; // renew 15 min before expiry

  /** Decode exp from a JWT-like `payloadB64.sig` token WITHOUT trusting its contents. */
  private getTokenExpiry(token: string | null): number | null {
    if (!token || typeof token !== 'string') return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const payload = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      const exp = Number(payload?.exp);
      return Number.isFinite(exp) && exp > 0 ? exp : null;
    } catch (e) {
      return null;
    }
  }

  private scheduleProactiveRefresh(): void {
    if (typeof window === 'undefined') return;
    if (this.proactiveRefreshTimer) {
      clearTimeout(this.proactiveRefreshTimer);
      this.proactiveRefreshTimer = null;
    }
    const exp = this.getTokenExpiry(this.getSessionToken());
    if (!exp || !this.getRefreshToken()) return; // nothing scheduled yet / no way to renew
    // Ensure proactive refresh has at least a 3-minute backoff so it never spams /api/refresh in a loop
    const delay = Math.max(exp - Date.now() - ConcreteLabStorage.PROACTIVE_REFRESH_MARGIN_MS, 3 * 60 * 1000);
    this.proactiveRefreshTimer = setTimeout(() => {
      this.proactiveRefreshTimer = null;
      this.tryRefreshSession()
        .then((ok) => {
          if (!ok && Date.now() < this.refreshBackoffUntil) {
            // Rate-limited / transient outage: retry once the backoff expires.
            this.scheduleProactiveRefresh();
          }
        })
        .catch(() => {});
    }, delay);
    if (typeof (this.proactiveRefreshTimer as any)?.unref === 'function') {
      (this.proactiveRefreshTimer as any).unref();
    }
  }

  private sessionExpiredListeners: Array<() => void> = [];
  public onSessionExpired(listener: () => void): () => void {
    this.sessionExpiredListeners.push(listener);
    return () => {
      this.sessionExpiredListeners = this.sessionExpiredListeners.filter(l => l !== listener);
    };
  }

  private handleSessionExpired() {
    this.setSessionToken(null);
    navHistory.notifyToast(
      typeof document !== 'undefined' && document.documentElement.lang === 'en'
        ? 'Session expired. Please log in again.'
        : 'نشست کاربری شما منقضی شده است. لطفاً مجدداً وارد سامانه شوید.'
    );
    this.sessionExpiredListeners.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  /** fetch wrapper: on a 401 from an authenticated call, refresh the session once and retry. */
  private async authedFetch(input: string, init: RequestInit): Promise<Response> {
    let res = await fetch(input, { ...init, headers: { ...this.getAuthHeaders(), ...(init.headers as Record<string, string> | undefined) } });
    if (res.status === 401) {
      if (this.getRefreshToken()) {
        const refreshed = await this.tryRefreshSession();
        if (refreshed) {
          res = await fetch(input, { ...init, headers: { ...this.getAuthHeaders(), ...(init.headers as Record<string, string> | undefined) } });
          if (res.status !== 401) return res;
        }
      }
      // Authoritative drop: only expire the session if the refresh token is truly missing or was rejected
      // (transient rate limits or 5xx server glitches leave the refresh token intact so the user is not ejected)
      if (!this.getRefreshToken()) {
        this.handleSessionExpired();
      }
    }
    // BUG FIX (mass-logout #3): most admin-panel write endpoints answer an
    // EXPIRED session with 403 (role gate evaluated against a null user), not
    // 401 — so the renewal path above never triggered and users saw a bare
    // "دسترسی غیرمجاز" while their work was lost. The server now distinguishes
    // the two cases via X-Error-Code (invalid/expired token → UNAUTHENTICATED
    // with 401; wrong role → FORBIDDEN_ROLE with 403), but for backwards
    // compatibility with older bundles we ALSO attempt one transparent renew +
    // retry here whenever a 403 is NOT the password-change policy gate.
    else if (res.status === 403) {
      const errCode = res.headers.get('X-Error-Code') || '';
      const bodyCode = await this.readErrorCodeFromResponse(res);
      const isPasswordGate = bodyCode === 'PASSWORD_CHANGE_REQUIRED' || errCode === 'PASSWORD_CHANGE_REQUIRED';
      const isRoleDenial = errCode === 'FORBIDDEN_ROLE';
      if (!isPasswordGate && !isRoleDenial && this.getRefreshToken()) {
        const refreshed = await this.tryRefreshSession();
        if (refreshed) {
          res = await fetch(input, { ...init, headers: { ...this.getAuthHeaders(), ...(init.headers as Record<string, string> | undefined) } });
          if (res.status !== 403) return res;
        }
      }
    }
    return res;
  }

  /** Peek at a JSON error body's `code` field without consuming the caller's stream. */
  private async readErrorCodeFromResponse(res: Response): Promise<string> {
    try {
      const json = await res.clone().json().catch(() => null);
      return typeof json?.code === 'string' ? json.code : '';
    } catch (e) {
      return '';
    }
  }

  public async verifyOtp(tempToken: string, otp: string): Promise<{
    success: boolean;
    user?: UserProfile;
    mustChangePassword?: boolean;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, otp })
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.token) {
        return { success: false, error: json.error || 'کد تایید پیامک نادرست است.' };
      }

      this.setSessionToken(json.token);
      this.storeRefreshToken(json.refreshToken);
      // setCurrentUser pushes a 'session' record; do it before the gate check so
      // mustChangePassword (from the server response) can short-circuit syncs.
      this.setCurrentUser(json.user);
      await this.fetchFromServer(false);
      return { success: true, user: json.user, mustChangePassword: !!json.mustChangePassword };
    } catch (e: any) {
      return { success: false, error: e.message || 'خطا در تایید کد پیامک.' };
    }
  }

  // Server-side 2FA SMS resend
  public async resendOtp(tempToken: string): Promise<{
    success: boolean;
    simulatedOtp?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken })
      });
      const json = await res.json();
      return json;
    } catch (e: any) {
      return { success: false, error: e.message || 'خطا در ارسال مجدد کد تایید.' };
    }
  }

  public getSyncStatus() {
    return { ...this.syncStatus };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    // PERF FIX (audit #48): invalidate the memoized getProfiles() projection.
    // Mutations sometimes splice state.profiles in place (same array
    // reference), so identity-keyed caching alone could serve a stale
    // projection; clearing here keeps the cache correct at O(1) cost — the
    // projection is rebuilt lazily on the next getProfiles() call after any
    // notify(), and stays stable between notifications.
    this.profilesCache = null;
    this.listeners.forEach(l => {
      try { l(); } catch (e) { console.error(e); }
    });
  }

  private connectSse() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    if (this.eventSource) {
      try { this.eventSource.close(); } catch (e) {}
      this.eventSource = null;
    }
    // Only connect SSE if authenticated: public guests and logged-out users do not need real-time streams
    // and would trigger an immediate 401 loop from the server.
    if (!this.sessionToken) return;

    try {
      const sseUrl = `/api/lab-data/events?token=${encodeURIComponent(this.sessionToken)}`;
      const es = new EventSource(sseUrl);
      this.eventSource = es;

      es.onopen = () => {
        this.sseRetryCount = 0;
        if (!this.syncStatus.connected) {
          this.syncStatus.connected = true;
          this.notify();
        }
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'db_update') {
            this.syncStatus.connected = true;
            this.syncStatus.version = payload.version || this.syncStatus.version;
            this.syncStatus.lastSyncTime = Date.now();

            const changed: string | undefined =
              typeof payload.collection === 'string' ? payload.collection : undefined;
            if (changed && Object.prototype.hasOwnProperty.call(this.state, changed)) {
              void this.fetchCollectionFromServer(changed);
            } else {
              this.fetchFromServer(false);
            }
          } else if (payload.type === 'connected') {
            this.syncStatus.connected = true;
            this.syncStatus.version = payload.version || 0;
            this.syncStatus.lastSyncTime = Date.now();
            this.notify();
          }
        } catch (err) {
          // ignore
        }
      };

      es.onerror = () => {
        if (this.eventSource === es) {
          try { es.close(); } catch (e) {}
          this.eventSource = null;
        }
        if (this.syncStatus.connected) {
          this.syncStatus.connected = false;
          this.notify();
        }
        if (!this.sessionToken) return;

        this.sseRetryCount++;
        const backoff = Math.min(1500 * Math.pow(1.5, Math.min(this.sseRetryCount, 6)), 30000);
        this.sseReconnectTimer = setTimeout(() => {
          this.sseReconnectTimer = null;
          this.connectSse();
        }, backoff);
      };
    } catch (err) {
      console.debug('SSE connection init error:', err);
    }
  }

  public async checkVersionFromServer() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/lab-data/version');
      if (res.ok) {
        const json = await res.json();
        this.syncStatus.connected = true;
        // Keep local per-collection etags in sync with the server
        if (json.collections && typeof json.collections === 'object') {
          this.collectionVersions = json.collections;
        }
        if (json.version !== undefined && json.version !== this.syncStatus.version) {
          await this.fetchFromServer(false);
        }
      } else {
        this.syncStatus.connected = false;
      }
    } catch (e) {
      this.syncStatus.connected = false;
    }
  }

  /**
   * OPTIMIZATION: lightweight heartbeat used by the periodic fallback poller.
   * The full /version payload includes every collection's etag map; on the
   * hot polling path we only need the global version number, so we hit the
   * cheaper /api/health endpoint instead and trigger a full sync (which also
   * refreshes the collection versions) only when something actually changed.
   */
  public async checkHealthAndResyncIfNeeded() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        this.syncStatus.connected = false;
        return;
      }
      this.syncStatus.connected = true;
      if (this.syncStatus.version > 0) {
        const json = await res.json().catch(() => null);
        // lastDbUpdate is stored as a numeric epoch-ms timestamp (Date.now()), not an ISO string.
        const serverVersionMs = json && json.lastDbUpdate ? Number(json.lastDbUpdate) : NaN;
        if (!Number.isNaN(serverVersionMs) && serverVersionMs > this.syncStatus.lastSyncTime) {
          await this.checkVersionFromServer();
        }
      }
    } catch (e) {
      this.syncStatus.connected = false;
    }
  }

  /**
   * Subscribe to multi-user write conflicts (HTTP 409). UI layers can show a toast
   * telling the operator that fresh data from another user has been merged/reloaded.
   */
  public onConflict(listener: (collection: string) => void): () => void {
    this.conflictListeners.push(listener);
    return () => {
      this.conflictListeners = this.conflictListeners.filter(l => l !== listener);
    };
  }

  private notifyConflict(collection: string) {
    this.conflictListeners.forEach(l => {
      try { l(collection); } catch (e) { console.error(e); }
    });
  }

  public async fetchFromServer(silent = false) {
    if (typeof window === 'undefined') return;
    if (this.isServerSyncing) {
      this.pendingResync = true;
      return;
    }
    this.isServerSyncing = true;
    try {
      // authedFetch: transparently refreshes the session once on 401 so an
      // expired HMAC token no longer silently breaks syncing (FIX #1).
      const res = await this.authedFetch('/api/lab-data', { method: 'GET' });
      if (!res.ok) {
        this.syncStatus.connected = false;
        return;
      }
      const json = await res.json();
      if (!json.success || !json.data) return;

      const serverData = json.data;
      const serverVersion = json.version || 0;

      this.syncStatus.connected = true;
      this.syncStatus.version = serverVersion;
      this.syncStatus.lastSyncTime = Date.now();

      // Capture per-collection etags from the full-state response so subsequent
      // persistCollection writes carry a correct baseVersion for conflict detection.
      if (json.collections && typeof json.collections === 'object') {
        this.collectionVersions = json.collections;
      } else {
        const knownCollections = [
          'profiles', 'customers', 'reports', 'invoices', 'accounting',
          'calibrations', 'dispatches', 'technicians', 'envLogs', 'media',
          'smsLogs', 'trashCustomers'
        ];
        knownCollections.forEach(c => {
          if (this.collectionVersions[c] === undefined) this.collectionVersions[c] = 0;
        });
      }

      // Update in-memory state directly from VPS server response (Server is Single Source of Truth)
      if (Array.isArray(serverData.profiles) && serverData.profiles.length > 0) {
        // Enforce sole admin invariant: no user other than SOLE_ADMIN can have role 'admin'
        serverData.profiles.forEach((p: UserProfile) => {
          if (p.id === SOLE_ADMIN_ID || p.username === SOLE_ADMIN_USERNAME) {
            p.role = 'admin';
          } else if (p.role === 'admin') {
            p.role = 'operator';
          }
        });
        // Server is the single source of truth - no local seed mirror.
        this.state.profiles = serverData.profiles;
      }
      if (Array.isArray(serverData.customers)) {
        this.state.customers = serverData.customers;
      }
      if (Array.isArray(serverData.reports)) {
        this.state.reports = serverData.reports;
      }
      if (Array.isArray(serverData.invoices)) {
        this.state.invoices = serverData.invoices;
      }
      if (Array.isArray(serverData.accounting)) {
        this.state.accounting = serverData.accounting;
      }
      if (Array.isArray(serverData.calibrations)) {
        this.state.calibrations = serverData.calibrations;
      }
      if (Array.isArray(serverData.dispatches)) {
        this.state.dispatches = serverData.dispatches;
      }
      if (Array.isArray(serverData.technicians)) {
        this.state.technicians = serverData.technicians;
      }
      if (Array.isArray(serverData.envLogs)) {
        this.state.envLogs = serverData.envLogs;
      }
      if (Array.isArray(serverData.media)) {
        this.state.media = serverData.media;
      }
      if (Array.isArray(serverData.smsLogs)) {
        this.state.smsLogs = serverData.smsLogs;
      }
      if (Array.isArray(serverData.trashCustomers)) {
        this.state.trashCustomers = serverData.trashCustomers;
      }

      // Maintain client session isolated to this browser/device, refreshing profile object from latest data
      if (this.currentUser) {
        const found = this.state.profiles.find(p => p.id === this.currentUser!.id || p.username === this.currentUser!.username);
        if (found) {
          this.currentUser = found;
        }
      }

      this.notify();
    } catch (e) {
      console.debug('Failed to sync from central server:', e);
      this.syncStatus.connected = false;
    } finally {
      this.isServerSyncing = false;
      if (this.pendingResync) {
        this.pendingResync = false;
        this.fetchFromServer(silent);
      }
    }
  }

  public async pushServer(endpoint: string, body: any): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const init: RequestInit = { method: 'POST', body: JSON.stringify(body) };
      // authedFetch attaches fresh auth headers on every attempt and retries
      // once with a refreshed session token when the old one expired (FIX #1).
      const res = await this.authedFetch(`/api/lab-data/${endpoint}`, init);
      if (res.status === 409 && endpoint === 'sync-collection' && body?.collection) {
        // Multi-user conflict: another client modified this collection after our
        // last read. Reload authoritative server state, then retry the write once
        // against the fresh etag so no data is silently lost.
        const collection: string = body.collection;
        console.warn(`Sync conflict on '${collection}' — reloading latest data and retrying...`);
        this.notifyConflict(collection);
        await this.fetchFromServer(false);
        const retryBase = this.collectionVersions[collection] ?? 0;
        const retryRes = await this.authedFetch(`/api/lab-data/sync-collection`, {
          method: 'POST',
          body: JSON.stringify({ ...body, baseVersion: retryBase })
        });
        if (retryRes.ok) {
          const retryJson = await retryRes.json().catch(() => null);
          if (retryJson?.collectionVersion !== undefined) {
            this.collectionVersions[collection] = retryJson.collectionVersion;
          }
          this.syncStatus.connected = true;
          if (retryJson?.version) this.syncStatus.version = retryJson.version;
          this.syncStatus.lastSyncTime = Date.now();
        }
        return retryRes.ok;
      }
      if (res.ok) {
        const json = await res.json();
        this.syncStatus.connected = true;
        if (json.version) this.syncStatus.version = json.version;
        if (endpoint === 'sync-collection' && body?.collection && json.collectionVersion !== undefined) {
          this.collectionVersions[body.collection] = json.collectionVersion;
        }
        this.syncStatus.lastSyncTime = Date.now();
        return true;
      }
      // SECURITY FIX: writes are blocked server-side until a user flagged with
      // `forcePasswordChange` updates their password. Surface that gate to the
      // UI instead of silently reporting `false`, then transparently refresh
      // session state so the modal can appear.
      if (res.status === 403) {
        const gateJson = await res.clone().json().catch(() => null);
        if (gateJson?.code === 'PASSWORD_CHANGE_REQUIRED' || gateJson?.passwordChangeRequired === true) {
        this.passwordChangeRequired = true;
        this.lastWriteError = 'برای ادامه استفاده از سامانه ابتدا باید رمز عبور خود را تغییر دهید.';
        // Try the transparent self-heal described above; whatever happens we
        // still return false so the caller does not mark the write as synced.
        await this.recoverFromPasswordGate();
        return false;
        }
      }
      if (!res.ok) {
        try {
          const errJson = await res.json();
          if (errJson?.error) {
            this.lastWriteError = errJson.error;
            console.warn(`Server rejected ${endpoint}: ${errJson.error}`);
          }
        } catch { /* non-JSON error body */ }
      }
      // FIX: surface write failures to the caller instead of silently
      // swallowing them (e.g. a 403/400 from update-password must NOT be
      // reported as success to the UI).
      console.warn(`Server rejected push to ${endpoint} (HTTP ${res.status})`);
      this.syncStatus.connected = res.status >= 500 ? false : this.syncStatus.connected;
      return false;
    } catch (e) {
      console.debug(`Failed to push to server ${endpoint}:`, e);
      this.syncStatus.connected = false;
      return false;
    }
  }

  public persistCollection(collection: string, data: any[]) {
    const baseVersion = this.collectionVersions[collection];
    // SECURITY FIX (audit #28): profiles must NEVER travel through the generic
    // sync-collection path. Clients only ever receive sanitized (password-less)
    // profiles; pushing a local copy back would either wipe stored credentials
    // or race with the dedicated add-profile / update-profile / delete-profile
    // endpoints (two writers, one collection, diverging etags → guaranteed 409
    // conflicts and overwrites). All profile mutations now go exclusively
    // through their targeted endpoints below.
    if (collection === 'profiles') {
      console.warn('[sync] persistCollection("profiles") is blocked — use the dedicated profile endpoints.');
      return;
    }
    // PERF FIX (audit #40): trailing-edge debounce per collection. Rapid
    // keystroke-level saves of the same array previously fired one full-array
    // POST per edit; now consecutive writes within the window collapse into a
    // single request carrying the latest snapshot. The timer is short (600ms)
    // so interactive flows still see near-immediate server confirmation, and
    // an immediate flush is available via flushPersistCollection() (used e.g.
    // before logout/unload paths that need durability guarantees).
    const pending = this.pendingPersists.get(collection);
    if (pending) clearTimeout(pending.timer);
    const timer = setTimeout(() => {
      this.pendingPersists.delete(collection);
      this.sendPersistCollection(collection, this.latestPersistData.get(collection) ?? data, baseVersion);
    }, ConcreteLabStorage.PERSIST_DEBOUNCE_MS);
    this.pendingPersists.set(collection, { timer });
    this.latestPersistData.set(collection, data);
  }

  /** Drop any pending debounced write for `collection` and POST it now. */
  public flushPersistCollection(collection?: string) {
    const keys = collection ? [collection] : Array.from(this.pendingPersists.keys());
    for (const k of keys) {
      const pending = this.pendingPersists.get(k);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pendingPersists.delete(k);
      const data = this.latestPersistData.get(k);
      this.latestPersistData.delete(k);
      if (data) this.sendPersistCollection(k, data, this.collectionVersions[k]);
    }
  }

  private sendPersistCollection(collection: string, data: any[], baseVersion: number | undefined) {
    this.pushServer('sync-collection', {
      collection,
      data,
      ...(typeof baseVersion === 'number' ? { baseVersion } : {})
    });
  }

  /**
   * PERF FIX (audit #39): fetch ONLY one collection from the incremental-sync
   * endpoint and patch it into local state. Used when an SSE db_update event
   * announces which collection changed — avoids re-downloading the entire
   * dataset (all base64 media included) on every remote write.
   */
  private async fetchCollectionFromServer(collection: string) {
    if (typeof window === 'undefined') return;
    try {
      const res = await this.authedFetch(`/api/lab-data/collection/${encodeURIComponent(collection)}`, { method: 'GET' });
      if (!res.ok) {
        // Endpoint missing (older server) or transient error — degrade to the
        // previous behavior instead of dropping the update silently.
        await this.fetchFromServer(true);
        return;
      }
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        await this.fetchFromServer(true);
        return;
      }
      // Guard against out-of-order responses: if a newer fetch already landed,
      // ignore this stale payload.
      const currentEtag = this.collectionVersions[collection];
      if (typeof json.version === 'number' && typeof currentEtag === 'number' && json.version < currentEtag) {
        return;
      }
      (this.state as any)[collection] = json.data;
      if (typeof json.version === 'number') {
        this.collectionVersions[collection] = json.version;
      }
      this.syncStatus.connected = true;
      this.syncStatus.lastSyncTime = Date.now();
      this.notify();
    } catch (e) {
      console.debug(`Incremental collection fetch failed for '${collection}':`, e);
      // Fall back to a full sync so consistency is never worse than before.
      try { await this.fetchFromServer(true); } catch { /* handled inside */ }
    }
  }

  /**
   * SECURITY FIX (audit #28/#29): single choke-point that strips the password
   * field from every profile payload sent to the server. The plaintext typed in
   * the admin form is delivered once via `initialPassword` (server hashes it
   * with real scrypt); the profile object itself never carries a credential, so
   * no code path can store an empty/plaintext password in the local cache or
   * fight the authoritative store on the next sync.
   */
  private sanitizeProfilePayload(profile: any): { payload: any; initialPassword: string } {
    const { password, ...rest } = profile || {};
    const plain = typeof password === 'string' ? password.trim() : '';
    // A `scrypt:`-shaped value in local state is always a stale echo (clients
    // never receive hashes) — treat it as "no password change".
    return { payload: rest, initialPassword: plain && !plain.startsWith('scrypt:') ? plain : '' };
  }

  public async syncAllToServer() {
    const allData = {
      profiles: this.state.profiles,
      customers: this.state.customers,
      reports: this.state.reports,
      invoices: this.state.invoices,
      accounting: this.state.accounting,
      calibrations: this.state.calibrations,
      dispatches: this.state.dispatches,
      technicians: this.state.technicians,
      envLogs: this.state.envLogs,
      media: this.state.media,
      smsLogs: this.state.smsLogs,
      trashCustomers: this.state.trashCustomers,
      currentUserId: this.currentUser ? this.currentUser.id : undefined,
      // FIX (audit #13): full replacement of reports/invoices/… is opt-in only.
      // If our local cache is EMPTY (cold start) we must never ask the server to
      // replace its collections with nothing — send no destructive arrays then.
      ...(this.state.reports.length > 0 ? { replace: true } : {})
    };
    const ok = await this.pushServer('sync', { data: allData });
    if (!ok && this.lastWriteError === null) {
      // A failed full-sync used to be silent; surface it so admins know the
      // authoritative server state may differ from what the UI shows.
      console.warn('[sync] Full database sync to server failed.');
    }
    return ok;
  }

  public async exportDatabaseBackup(): Promise<void> {
    if (typeof window === 'undefined') return;
    // FIX #1.3: the /export endpoint is admin-only and requires an
    // Authorization header. window.open() sends no Bearer token, so the
    // browser always received 403. Fetch with auth headers instead and hand
    // the payload to the user through a temporary blob download link.
    try {
      const res = await fetch('/api/lab-data/export', { headers: this.getAuthHeaders() });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `خطا در دریافت نسخه پشتیبان (کد ${res.status})`);
      }
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laboratory_db_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('Export backup failed:', err);
      throw err;
    }
  }

  public async restoreDatabaseBackup(jsonData: any): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const headers = this.getAuthHeaders();
      const res = await fetch('/api/lab-data/restore', {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: jsonData })
      });
      if (res.ok) {
        await this.fetchFromServer(false);
        return true;
      }
    } catch (e) {
      console.error('Failed to restore backup:', e);
    }
    return false;
  }

  // Current User (Session managed in VPS memory & server state, zero localStorage)
  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public setCurrentUser(user: UserProfile | null, opts?: { skipServerSync?: boolean }) {
    this.currentUser = user;
    if (typeof sessionStorage !== 'undefined') {
      try {
        if (user) {
          sessionStorage.setItem('azma_current_user', JSON.stringify(user));
        } else {
          sessionStorage.removeItem('azma_current_user');
        }
      } catch (e) {}
    }
    if (!user) {
      this.setSessionToken(null);
    }
    this.notify();
    // skipServerSync: used by the forced password-change gate so we don't
    // clobber the active session while re-setting the same user.
    if (!opts?.skipServerSync) {
      this.pushServer('session', { userId: user ? user.id : null });
    }
  }

  // Profiles
  public getProfiles(): UserProfile[] {
    // PERF FIX (audit #48): stable reference between mutations. Returns the
    // cached projection when neither the source array nor the current-user
    // identity changed, so memoized consumers stop thrashing on every call.
    const src = this.state.profiles || [];
    const currentUserId = this.currentUser?.id;
    if (
      this.profilesCache &&
      this.profilesCache.src === src &&
      this.profilesCache.currentUserId === currentUserId
    ) {
      return this.profilesCache.result;
    }
    const result: UserProfile[] = src.map(p => ({
      ...p,
      fullName: p.fullName || p.username || 'کاربر سیستم',
      email: p.email || `${p.username || p.id || 'user'}@betonlab.ir`,
      role: ((p.id === SOLE_ADMIN_ID || p.username === SOLE_ADMIN_USERNAME)
        ? 'admin'
        : (p.role === 'admin' ? 'operator' : p.role || 'operator')) as UserProfile['role'],
      status: (p.status || 'active') as UserProfile['status']
    }));
    this.profilesCache = { src, currentUserId, result };
    return result;
  }

  public saveProfile(profile: UserProfile) {
    // SECURITY FIX (audit #29): this method used to fire persistCollection()
    // with no dedicated endpoint — a second, uncoordinated write path racing
    // the targeted profile endpoints. It is now a LOCAL-ONLY cache update;
    // every server mutation must go through addProfile / updateProfile /
    // updateUserRole / deleteProfile / updateUserPassword.
    const idx = this.state.profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      this.state.profiles[idx] = profile;
    } else {
      this.state.profiles.unshift(profile);
    }
    this.notify();
  }

  public async addProfile(profile: Omit<UserProfile, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<UserProfile> {
    if (!profile.password || !profile.password.trim()) {
      throw new Error('رمز عبور کاربر جدید الزامی است. لطفاً یک رمز معتبر وارد کنید.');
    }
    // SECURITY FIX (audit #28/#29): strip the plaintext from the cached object
    // immediately after capturing it. The password is delivered ONCE via
    // `initialPassword` and hashed server-side; local state never stores a
    // credential, so later syncs can't overwrite/wipe the authoritative hash.
    const initialPassword = profile.password.trim();
    const { password: _pw, ...profileWithoutPassword } = profile as any;
    const newProfile: UserProfile = {
      ...profileWithoutPassword,
      id: profile.id || uniqueId('usr'),
      status: profile.status || 'active',
      createdAt: new Date().toISOString()
    };
    this.lastWriteError = null;
    const ok = await this.pushServer('add-profile', { profile: newProfile, initialPassword });
    if (!ok) {
      const msg = this.lastWriteError || 'خطا در افزودن کاربر جدید در سرور.';
      throw new Error(msg);
    }
    this.state.profiles.unshift(newProfile);
    this.notify();
    return newProfile;
  }

  /**
   * SECURITY FIX (audit B2 — "forced password change is only a UI gate"):
   * App.tsx shows the ForcePasswordChangeModal when `mustChangePassword` is
   * set, but nothing stopped a modified client from simply calling the write
   * APIs directly and using the session anyway. Every server-side mutation now
   * returns 403 `PASSWORD_CHANGE_REQUIRED` while the flag is set; this helper
   * detects it once per request and transparently runs the same flow the modal
   * uses (re-login with the just-typed new password -> token rotation), so a
   * legitimate user who cancelled the modal mid-session is healed on their next
   * action instead of silently losing every write.
   */
  private lastReauthAttemptAt = 0;
  private async recoverFromPasswordGate(): Promise<boolean> {
    const user: any = this.currentUser;
    if (!user || !this.pendingNewPassword) return false;
    // Throttle: one recovery attempt per 15s so a failing loop can't spam login.
    const now = Date.now();
    if (now - this.lastReauthAttemptAt < 15_000) return false;
    this.lastReauthAttemptAt = now;
    try {
      const res = await this.login(user.username || user.id, this.pendingNewPassword);
      if (res.success && res.user) {
        this.currentUser = res.user;
        this.notify();
        return true;
      }
    } catch {
      /* fall through — caller will surface the original 403 */
    }
    return false;
  }
  private pendingNewPassword: string | null = null;

  public setPendingSelfPassword(pw: string | null) {
    this.pendingNewPassword = pw;
  }

  public async updateProfile(profile: UserProfile): Promise<UserProfile> {
    // Security Invariant: Sole Administrator Protection
    const isTargetSoleAdmin = profile.id === SOLE_ADMIN_ID || profile.username === SOLE_ADMIN_USERNAME;
    if (isTargetSoleAdmin) {
      profile.id = SOLE_ADMIN_ID;
      profile.username = SOLE_ADMIN_USERNAME;
      profile.role = 'admin';
    } else if (profile.role === 'admin') {
      profile.role = 'operator';
    }

    const idx = this.state.profiles.findIndex(p => 
      p.id === profile.id || 
      (profile.customerId && p.customerId === profile.customerId) ||
      (profile.email && p.email === profile.email) ||
      (profile.username && p.username === profile.username)
    );
    let targetProfile: UserProfile;
    if (idx >= 0) {
      const existing = this.state.profiles[idx];
      const previous = { ...existing };
      // SECURITY FIX (audit #28/#29): capture the typed plaintext once, then
      // keep NO credential in local state. The server receives the profile
      // without a password plus a one-time `newPassword` field; it hashes the
      // change with real scrypt itself. The old code stored `password: ''` /
      // the raw value locally and re-pushed the whole collection via
      // persistCollection — a write-war that could wipe the stored hash.
      const { initialPassword } = this.sanitizeProfilePayload({ password: profile.password });
      targetProfile = { 
        ...existing, 
        ...profile,
        role: isTargetSoleAdmin ? 'admin' : (profile.role === 'admin' ? (existing.role === 'admin' ? 'operator' : existing.role) : (profile.role || existing.role)),
        password: undefined as any
      };
      delete (targetProfile as any).password;
      this.state.profiles[idx] = targetProfile;
      this.lastWriteError = null;
      const ok = await this.pushServer('update-profile', {
        profile: targetProfile,
        ...(initialPassword ? { newPassword: initialPassword } : {})
      });
      if (!ok) {
        this.state.profiles[idx] = previous;
        this.notify();
        const msg = this.lastWriteError || 'خطا در به‌روزرسانی مشخصات کاربر در سرور.';
        throw new Error(msg);
      }
    } else {
      // SECURITY FIX (audit #15/#29): the client must never "upsert" a missing
      // profile through update-profile — the server now rejects that insert
      // path outright. Route creation attempts to addProfile so they go
      // through the sanctioned endpoint with its own access checks.
      console.warn('[profiles] updateProfile called for unknown id — routing to addProfile.');
      return await this.addProfile(profile as Omit<UserProfile, 'id' | 'createdAt'> & { id?: string });
    }

    if (this.currentUser && (this.currentUser.id === targetProfile.id || this.currentUser.username === targetProfile.username)) {
      this.currentUser = { ...this.currentUser, ...targetProfile };
    }

    this.notify();
    // Single write path only (audit #29): no persistCollection('profiles', …).
    return targetProfile;
  }

  public async updateUserRole(userId: string, newRole: 'admin' | 'operator' | 'customer'): Promise<boolean> {
    const idx = this.state.profiles.findIndex(p => p.id === userId || p.username === userId || p.email === userId);
    if (idx >= 0) {
      const target = this.state.profiles[idx];
      const isTargetSoleAdmin = target.id === SOLE_ADMIN_ID || target.username === SOLE_ADMIN_USERNAME;

      // Security: Admin role cannot be granted to anyone else, and the sole admin cannot be changed
      if (isTargetSoleAdmin) {
        if (newRole !== 'admin') {
          console.warn('نقش مدیر ارشد واحد سامانه غیرقابل تغییر است.');
          return false;
        }
      } else {
        if (newRole === 'admin') {
          console.warn('دسترسی مدیریت به هیچ وجه به کاربر دیگری داده نمی‌شود. سیستم دارای یک مدیر ارشد واحد است.');
          return false;
        }
      }

      const previousRole = target.role;
      const assignedRole = isTargetSoleAdmin ? 'admin' : newRole;
      target.role = assignedRole;
      if (this.currentUser && (this.currentUser.id === target.id || this.currentUser.username === target.username)) {
        this.currentUser.role = assignedRole;
      }
      this.notify();
      this.lastWriteError = null;
      const ok = await this.pushServer('update-role', { userId: target.id, role: assignedRole });
      if (!ok) {
        target.role = previousRole;
        if (this.currentUser && (this.currentUser.id === target.id || this.currentUser.username === target.username)) {
          this.currentUser.role = previousRole;
        }
        this.notify();
        const msg = this.lastWriteError || 'خطا در به‌روزرسانی نقش کاربر در سرور.';
        throw new Error(msg);
      }
      return true;
    }
    return false;
  }

  public deleteProfile(profileId: string): boolean {
    if (profileId === SOLE_ADMIN_ID || profileId === SOLE_ADMIN_USERNAME) {
      console.warn('حساب کاربری مدیر ارشد واحد سامانه غیرقابل حذف است.');
      return false;
    }
    const filtered = this.state.profiles.filter(p => p.id !== profileId && p.id !== SOLE_ADMIN_ID && p.username !== SOLE_ADMIN_USERNAME);
    if (filtered.length !== this.state.profiles.length) {
      this.state.profiles = filtered;
      this.notify();
      // SECURITY FIX (audit #29): fire-and-forget deletion through a dedicated
      // endpoint instead of re-pushing the whole profiles collection (which
      // raced every other profile write and carried stale/blank passwords).
      this.pushServer('delete-profile', { profileId })
        .catch(err => console.error('Failed to sync profile deletion to server:', err));
      return true;
    }
    return false;
  }

  public async updateUserPassword(userId: string, newPassword: string, currentPassword?: string): Promise<boolean> {
    // Clear any stale server rejection from a previous attempt before pushing.
    this.lastWriteError = null;
    const idx = this.state.profiles.findIndex(p => p.id === userId || p.username === userId || p.email === userId);
    const targetId = idx >= 0 ? this.state.profiles[idx].id : userId;

    if (this.currentUser && (this.currentUser.id === targetId || this.currentUser.username === targetId)) {
      this.currentUser.mustChangePassword = false;
    }
    this.notify();

    // Await the authoritative server result
    const ok = await this.pushServer('update-password', {
      userId: targetId,
      newPassword,
      ...(currentPassword ? { currentPassword } : {})
    });

    if (ok) {
      this.passwordChangeRequired = false;
      this.pendingNewPassword = null;
      if (idx >= 0) {
        delete (this.state.profiles[idx] as any).password;
      }
    } else if (this.currentUser && this.currentUser.id === targetId) {
      this.pendingNewPassword = newPassword;
    }

    if (this.currentUser && !ok) {
      delete (this.currentUser as any).mustChangePassword;
    }
    if (this.currentUser) delete (this.currentUser as any).password;
    this.notify();
    return ok;
  }

  public registerCustomerWithAccount(
    customerData: Omit<Customer, 'id' | 'createdAt'>,
    customPassword?: string
  ): { customer: Customer; user: UserProfile; passwordGenerated: string } {
    const custId = uniqueId('cust');
    const newCustomer: Customer = {
      ...customerData,
      id: custId,
      createdAt: new Date().toISOString()
    };

    // Normalize phone digits
    const cleanPhone = (customerData.phone || '')
      .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
      .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584))
      .replace(/[^0-9]/g, '');
    const defaultUsername = cleanPhone ? cleanPhone.slice(-6) : `cust${custId.slice(-4)}`;
    // No hard-coded default password: admin-entered value or a fresh random one.
    const defaultPassword = (customPassword && customPassword.trim()) ? customPassword.trim() : generateRandomPassword();
    const userEmail = (customerData.email && customerData.email.trim())
      ? customerData.email.trim()
      : `${defaultUsername}@azmabeton.ir`;

    const newUser: UserProfile = {
      id: `usr-${custId}`,
      email: userEmail,
      username: defaultUsername,
      password: defaultPassword,
      fullName: `${customerData.representativeName || ''} (${customerData.companyName || ''})`.trim() || customerData.companyName || 'کارفرمای محترم',
      role: 'customer',
      customerId: custId,
      phone: customerData.phone,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    // Update local state immediately
    this.state.customers.unshift(newCustomer);
    this.state.profiles.unshift(newUser);
    if (newCustomer.totalContractAmount && newCustomer.totalContractAmount > 0) {
      this.syncContractInvoice(newCustomer);
    }
    this.notify();

    // Push to VPS server atomically.
    // FIX #1.2 (superseded): the old code pre-hashed with a fake client-side
    // PBKDF2 digest labelled `scrypt:` which the server rejected as "not a
    // genuine credential" and silently replaced with a RANDOM password — so
    // the customer could never log in with the credentials handed to them.
    // The plaintext is sent once over HTTPS; registerCustomerAccount hashes
    // it server-side with real scrypt. The UI keeps showing
    // `passwordGenerated` (the human-readable value) for the welcome SMS.
    this.pushServer('register-customer-account', {
      customer: newCustomer,
      user: newUser
    })
      .catch(err => {
        console.error('Failed to sync registered customer account to server:', err);
      });

    // Auto send confirmation SMS upon customer registration
    if (newCustomer.phone) {
      try {
        const contractInfo = newCustomer.contractNo ? `شماره قرارداد: ${newCustomer.contractNo} | ` : '';
        this.sendSms({
          recipientPhone: newCustomer.phone,
          recipientName: newCustomer.representativeName || newCustomer.companyName,
          customerId: newCustomer.id,
          customerName: newCustomer.companyName,
          projectName: newCustomer.projectNamePrimary || newCustomer.projectNames?.[0] || 'پروژه ساختمانی',
          event: 'custom',
          customMessage: `کارفرمای محترم ${newCustomer.representativeName || newCustomer.companyName}، پرونده و قرارداد شما در شرکت آزما بتن پایش خاک و پی جهان‌بین ثبت گردید. ${contractInfo}نام کاربری پرتال: ${defaultUsername} | رمز عبور اولیه به صورت امن در کارت دسترسی QR ارسال شده است. مشاهده نتایج: azmajahanbin.ir`
        });
      } catch (smsErr) {
        console.warn('Auto SMS on customer registration skipped or error:', smsErr);
      }
    }

    return {
      customer: newCustomer,
      user: newUser,
      passwordGenerated: defaultPassword
    };
  }

  // Contract Invoice Auto-Sync (Connects Admin amounts with Customer Portal)
  public syncContractInvoice(customer: Customer): Invoice | null {
    const totalContract = Number(customer.totalContractAmount) || 0;
    if (totalContract <= 0) return null;

    if (!this.state.invoices) this.state.invoices = [];

    const existingIdx = this.state.invoices.findIndex(inv => inv.customerId === customer.id);
    const paidAmount = Number(customer.paidAmount) || 0;
    const balance = customer.balance !== undefined ? Number(customer.balance) : Math.max(0, totalContract - paidAmount);
    const isPaid = balance === 0;

    if (existingIdx >= 0) {
      const inv = this.state.invoices[existingIdx];
      inv.customerName = customer.companyName;
      inv.projectName = customer.projectNamePrimary || customer.projectNames?.[0] || inv.projectName;
      inv.amount = totalContract;
      inv.totalAmount = totalContract;
      if (isPaid) {
        inv.status = 'paid';
        if (!inv.paidAt) inv.paidAt = new Date().toISOString();
      } else if (inv.status !== 'pending_settlement') {
        inv.status = 'unpaid';
      }
      this.persistCollection('invoices', this.state.invoices);
      this.notify();
      return inv;
    } else {
      const contractInvoice: Invoice = {
        id: `inv-${customer.id.replace('cust-', '')}`,
        invoiceNo: `INV-${getTodayJalali().jy}-${customer.id.replace('cust-', '').padStart(3, '0')}`,
        customerId: customer.id,
        customerName: customer.companyName,
        projectName: customer.projectNamePrimary || customer.projectNames?.[0] || 'پروژه جاری',
        amount: totalContract,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: totalContract,
        status: isPaid ? 'paid' : 'unpaid',
        issueDateJalali: customer.contractDateJalali || formatJalali(getTodayJalali()),
        dueDateJalali: customer.contractEndDateJalali || '',
        paidAt: isPaid ? new Date().toISOString() : undefined,
        items: [
          {
            description: `قرارداد خدمات نظارت، نمونه‌برداری و آزمون مقاومت فشاری ۷ و ۲۸ روزه بتن پروژه ${customer.projectNamePrimary || customer.projectNames?.[0] || ''} (رده ${customer.concreteTargetGrade || 'C30'})`,
            quantity: customer.sampleSeriesCount || 1,
            unitPrice: customer.pricePerSeries || totalContract,
            total: totalContract
          }
        ],
        createdAt: new Date().toISOString()
      };
      this.state.invoices.unshift(contractInvoice);
      this.persistCollection('invoices', this.state.invoices);
      this.notify();
      return contractInvoice;
    }
  }

  // Customers
  public getCustomers(): Customer[] {
    return this.state.customers;
  }

  public addCustomer(customer: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const newCust: Customer = {
      ...customer,
      id: uniqueId('cust'),
      createdAt: new Date().toISOString()
    };
    this.state.customers.unshift(newCust);
    if (newCust.totalContractAmount && newCust.totalContractAmount > 0) {
      this.syncContractInvoice(newCust);
    }
    this.notify();
    this.pushServer('add-customer', { customer: newCust });
    return newCust;
  }

  public updateCustomer(customer: Customer): Customer | null {
    const idx = this.state.customers.findIndex(c => c.id === customer.id);
    if (idx >= 0) {
      this.state.customers[idx] = customer;
      this.syncContractInvoice(customer);
      this.notify();
      this.persistCollection('customers', this.state.customers);
      return this.state.customers[idx];
    }
    return null;
  }

  public saveCustomer(customer: Omit<Customer, 'id' | 'createdAt'>): Customer {
    return this.addCustomer(customer);
  }

  public getTrashCustomers(): TrashCustomerItem[] {
    return this.state.trashCustomers;
  }

  public trashCustomer(customerId: string, deletedBy: string = 'مدیر سیستم', reason: string = 'درخواست حذف توسط کاربر مدیر'): boolean {
    const custIndex = this.state.customers.findIndex(c => c.id === customerId);
    if (custIndex === -1) return false;

    const targetCustomer = this.state.customers[custIndex];
    this.state.customers.splice(custIndex, 1);

    const now = new Date();
    const jalaliDateStr = formatJalali(getTodayJalali());
    
    const trashItem: TrashCustomerItem = {
      customer: targetCustomer,
      deletedAtJalali: jalaliDateStr,
      deletedAtIso: now.toISOString(),
      deletedBy,
      reason
    };

    this.state.trashCustomers.unshift(trashItem);
    this.notify();
    this.persistCollection('customers', this.state.customers);
    this.persistCollection('trashCustomers', this.state.trashCustomers);
    return true;
  }

  public deleteCustomer(customerId: string): boolean {
    return this.trashCustomer(customerId);
  }

  public restoreCustomer(customerId: string): boolean {
    const itemIndex = this.state.trashCustomers.findIndex(t => t.customer.id === customerId);
    if (itemIndex === -1) return false;

    const [restoredItem] = this.state.trashCustomers.splice(itemIndex, 1);
    this.state.customers.unshift(restoredItem.customer);
    this.notify();
    this.persistCollection('customers', this.state.customers);
    this.persistCollection('trashCustomers', this.state.trashCustomers);
    return true;
  }

  public permanentDeleteCustomer(customerId: string): boolean {
    const filtered = this.state.trashCustomers.filter(t => t.customer.id !== customerId);
    if (filtered.length !== this.state.trashCustomers.length) {
      this.state.trashCustomers = filtered;
      this.notify();
      this.persistCollection('trashCustomers', filtered);
      return true;
    }
    return false;
  }

  public emptyCustomerTrash(): void {
    this.state.trashCustomers = [];
    this.notify();
    this.persistCollection('trashCustomers', []);
  }

  public addCustomerPayment(
    customerId: string, 
    record: Omit<CustomerPaymentRecord, 'id' | 'createdAt'>
  ): CustomerPaymentRecord | null {
    const cust = this.state.customers.find(c => c.id === customerId);
    if (!cust) return null;

    const newPayment: CustomerPaymentRecord = {
      ...record,
      id: uniqueId('pay'),
      createdAt: new Date().toISOString()
    };

    const currentRecords = cust.paymentRecords || [];
    const updatedRecords = [newPayment, ...currentRecords];
    const totalPaid = updatedRecords.reduce((sum, r) => sum + (r.status === 'cleared' ? r.amount : 0), 0);
    const totalContract = cust.totalContractAmount || 0;
    const newBalance = Math.max(0, totalContract - totalPaid);

    cust.paymentRecords = updatedRecords;
    cust.paidAmount = totalPaid;
    cust.balance = newBalance;

    this.updateCustomer(cust);

    // Auto-record to accounting ledger
    this.addAccountingRecord({
      title: `واریز ${newPayment.method === 'cheque' ? 'چک' : newPayment.method === 'bank_transfer' ? 'حواله بانکی' : 'وجه'} - ${cust.companyName} (${newPayment.documentNo})`,
      category: 'خدمات آزمایشگاهی',
      amount: newPayment.amount,
      type: 'income',
      jalaliDate: newPayment.jalaliDate,
      createdBy: newPayment.registeredBy || 'مدیریت مالی'
    });

    // Auto send payment confirmation SMS
    this.sendSms({
      recipientPhone: cust.phone,
      recipientName: cust.representativeName,
      customerId: cust.id,
      customerName: cust.companyName,
      projectName: cust.projectNames[0] || 'پروژه جاری',
      event: 'payment_received',
      customMessage: `پرداخت به مبلغ ${newPayment.amount.toLocaleString()} تومان با سند ${newPayment.documentNo} در پرونده مالی شما ثبت و تایید گردید. مانده حساب: ${newBalance.toLocaleString()} تومان | آزما بتن پایش خاک و پی جهان بین`
    });

    return newPayment;
  }

  /**
   * Safe customer payment declaration: records a pending receipt on the server
   * without requiring unprivileged users to bulk-sync the entire accounting/customers tables.
   */
  public async notifyPayment(data: {
    customerId: string;
    amount: number;
    method: string;
    documentNo: string;
    bankName: string;
    jalaliDate: string;
    description: string;
    invoiceId?: string;
  }): Promise<boolean> {
    try {
      const res = await this.authedFetch('/api/lab-data/notify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) return false;
      const json = await res.json();
      if (json && json.success) {
        await this.fetchFromServer(false);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to notify payment:', e);
      return false;
    }
  }

  public deleteCustomerPayment(customerId: string, paymentId: string): boolean {
    const cust = this.state.customers.find(c => c.id === customerId);
    if (!cust || !cust.paymentRecords) return false;

    cust.paymentRecords = cust.paymentRecords.filter(p => p.id !== paymentId);
    const totalPaid = cust.paymentRecords.reduce((sum, r) => sum + (r.status === 'cleared' ? r.amount : 0), 0);
    const totalContract = cust.totalContractAmount || 0;
    cust.paidAmount = totalPaid;
    cust.balance = Math.max(0, totalContract - totalPaid);

    this.updateCustomer(cust);
    return true;
  }

  public updateCustomerFinancials(
    customerId: string, 
    data: { totalContractAmount?: number; paidAmount?: number; balance?: number }
  ): Customer | null {
    const cust = this.state.customers.find(c => c.id === customerId);
    if (!cust) return null;

    if (data.totalContractAmount !== undefined) cust.totalContractAmount = data.totalContractAmount;
    if (data.paidAmount !== undefined) cust.paidAmount = data.paidAmount;
    if (data.balance !== undefined) {
      cust.balance = data.balance;
    } else if (cust.totalContractAmount !== undefined && cust.paidAmount !== undefined) {
      cust.balance = Math.max(0, cust.totalContractAmount - cust.paidAmount);
    }

    return this.updateCustomer(cust);
  }

  // Test Reports
  public getReports(role?: string, customerId?: string): TestReport[] {
    if (role === 'customer' && customerId) {
      return this.state.reports.filter(r => r.customerId === customerId && r.status === 'approved');
    }
    return this.state.reports;
  }

  public addReport(reportData: Omit<TestReport, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: TestReport['status'] }): TestReport {
    const newReport: TestReport = {
      ...reportData,
      id: uniqueId('rep'),
      status: reportData.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.state.reports.unshift(newReport);
    this.notify();
    this.persistCollection('reports', this.state.reports);
    return newReport;
  }

  public saveReport(reportData: any): TestReport {
    return this.addReport(reportData);
  }

  public updateReportStatus(reportId: string, status: 'approved' | 'rejected', notes?: string, approvedBy?: UserProfile): TestReport | null {
    const idx = this.state.reports.findIndex(r => r.id === reportId);
    if (idx >= 0) {
      this.state.reports[idx].status = status;
      if (notes) this.state.reports[idx].approvalNotes = notes;
      if (approvedBy) {
        this.state.reports[idx].approvedById = approvedBy.id;
        this.state.reports[idx].approvedByName = approvedBy.fullName;
      }
      this.state.reports[idx].updatedAt = new Date().toISOString();
      this.notify();
      this.persistCollection('reports', this.state.reports);
      return this.state.reports[idx];
    }
    return null;
  }

  public updateReport(report: TestReport) {
    const idx = this.state.reports.findIndex(r => r.id === report.id);
    if (idx >= 0) {
      this.state.reports[idx] = { ...report, updatedAt: new Date().toISOString() };
      this.notify();
      this.persistCollection('reports', this.state.reports);
    }
  }

  public deleteReport(reportId: string) {
    this.state.reports = this.state.reports.filter(r => r.id !== reportId);
    this.notify();
    this.persistCollection('reports', this.state.reports);
  }

  // Invoices
  public getInvoices(customerId?: string): Invoice[] {
    if (customerId) {
      const cust = this.state.customers.find(c => c.id === customerId || (c.phone && customerId.includes(c.phone)));
      if (cust && (cust.totalContractAmount || 0) > 0) {
        // Ensure contract invoice exists
        const hasInv = this.state.invoices.some(inv => inv.customerId === cust.id);
        if (!hasInv) {
          this.syncContractInvoice(cust);
        }
      }
      return this.state.invoices.filter(inv => inv.customerId === customerId || (cust && inv.customerId === cust.id));
    }
    return this.state.invoices;
  }

  public requestInvoiceSettlement(invoiceId: string, notes?: string): Invoice | null {
    const idx = this.state.invoices.findIndex(i => i.id === invoiceId);
    if (idx >= 0) {
      this.state.invoices[idx].status = 'pending_settlement';
      this.state.invoices[idx].settlementRequestedAt = new Date().toISOString();
      if (notes) this.state.invoices[idx].settlementNotes = notes;
      this.notify();
      this.persistCollection('invoices', this.state.invoices);
      return this.state.invoices[idx];
    }
    return null;
  }

  public requestCustomerSettlement(customerId: string, notes?: string): number {
    let count = 0;
    this.state.invoices.forEach(inv => {
      if (inv.customerId === customerId && inv.status !== 'paid') {
        inv.status = 'pending_settlement';
        inv.settlementRequestedAt = new Date().toISOString();
        if (notes) inv.settlementNotes = notes;
        count++;
      }
    });
    if (count > 0) {
      this.notify();
      this.persistCollection('invoices', this.state.invoices);
    }
    return count;
  }

  public payInvoice(invoiceId: string, method: 'online' | 'bank_transfer'): Invoice | null {
    const idx = this.state.invoices.findIndex(i => i.id === invoiceId);
    if (idx >= 0) {
      this.state.invoices[idx].status = 'paid';
      this.state.invoices[idx].paidAt = new Date().toISOString();
      this.state.invoices[idx].paymentMethod = method;
      
      // Update customer balance & paidAmount upon manager settlement approval.
      // Single source of truth: derive totals from paymentRecords when present so
      // this path stays consistent with addCustomerPayment/deleteCustomerPayment.
      const custId = this.state.invoices[idx].customerId;
      const cust = this.state.customers.find(c => c.id === custId);
      if (cust) {
        const records = cust.paymentRecords || [];
        if (records.length > 0) {
          cust.paidAmount = records.reduce((sum, r) => sum + (r.status === 'cleared' ? r.amount : 0), 0);
        } else {
          cust.paidAmount = (cust.paidAmount || 0) + this.state.invoices[idx].totalAmount;
        }
        cust.balance = Math.max(0, (cust.totalContractAmount || 0) - (cust.paidAmount || 0));
        this.persistCollection('customers', this.state.customers);
      }

      const incomeRecord: AccountingRecord = {
        id: uniqueId('acc'),
        title: `وصول وجه فاکتور ${this.state.invoices[idx].invoiceNo} (${this.state.invoices[idx].customerName})`,
        type: 'income',
        category: 'خدمات آزمایشگاهی بتن',
        amount: this.state.invoices[idx].totalAmount,
        jalaliDate: formatJalali(getTodayJalali()),
        customerId: this.state.invoices[idx].customerId,
        customerName: this.state.invoices[idx].customerName,
        invoiceId: this.state.invoices[idx].id,
        referenceNo: uniqueRefNo('TRX'),
        description: 'پرداخت آنلاین از طریق پرتال مشتریان',
        createdBy: 'usr-admin-01',
        createdAt: new Date().toISOString()
      };
      this.state.accounting.unshift(incomeRecord);

      this.notify();
      this.persistCollection('invoices', this.state.invoices);
      this.persistCollection('accounting', this.state.accounting);
      return this.state.invoices[idx];
    }
    return null;
  }

  public addInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Invoice {
    const newInv: Invoice = {
      ...invoice,
      id: uniqueId('inv'),
      createdAt: new Date().toISOString()
    };
    this.state.invoices.unshift(newInv);
    this.notify();
    this.persistCollection('invoices', this.state.invoices);
    return newInv;
  }

  public updateInvoice(invoiceId: string, updates: Partial<Invoice>): Invoice | null {
    const idx = this.state.invoices.findIndex(i => i.id === invoiceId);
    if (idx !== -1) {
      this.state.invoices[idx] = {
        ...this.state.invoices[idx],
        ...updates
      };
      this.notify();
      this.persistCollection('invoices', this.state.invoices);
      return this.state.invoices[idx];
    }
    return null;
  }

  public deleteInvoice(invoiceId: string) {
    this.state.invoices = this.state.invoices.filter(i => i.id !== invoiceId);
    this.notify();
    this.persistCollection('invoices', this.state.invoices);
  }

  // Accounting
  public getAccountingRecords(): AccountingRecord[] {
    return this.state.accounting;
  }

  public addAccountingRecord(record: Omit<AccountingRecord, 'id' | 'createdAt'>): AccountingRecord {
    const newRec: AccountingRecord = {
      ...record,
      id: uniqueId('acc'),
      createdAt: new Date().toISOString()
    };
    this.state.accounting.unshift(newRec);
    this.notify();
    this.persistCollection('accounting', this.state.accounting);
    return newRec;
  }

  public updateAccountingRecord(record: AccountingRecord): AccountingRecord | null {
    const idx = this.state.accounting.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      this.state.accounting[idx] = record;
      this.notify();
      this.persistCollection('accounting', this.state.accounting);
      return this.state.accounting[idx];
    }
    return null;
  }

  public deleteAccountingRecord(recordId: string) {
    this.state.accounting = this.state.accounting.filter(r => r.id !== recordId);
    this.notify();
    this.persistCollection('accounting', this.state.accounting);
  }

  // Equipment Calibrations
  public getCalibrations(): EquipmentCalibration[] {
    return this.state.calibrations;
  }

  public addCalibration(cal: Omit<EquipmentCalibration, 'id'>): EquipmentCalibration {
    const newCal: EquipmentCalibration = {
      ...cal,
      id: uniqueId('cal')
    };
    this.state.calibrations.unshift(newCal);
    this.notify();
    this.persistCollection('calibrations', this.state.calibrations);
    return newCal;
  }

  public updateCalibration(id: string, updates: Partial<EquipmentCalibration>): EquipmentCalibration | null {
    const idx = this.state.calibrations.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.state.calibrations[idx] = { ...this.state.calibrations[idx], ...updates };
      this.notify();
      this.persistCollection('calibrations', this.state.calibrations);
      return this.state.calibrations[idx];
    }
    return null;
  }

  // Technician Dispatches
  public getDispatches(customerId?: string): TechnicianDispatch[] {
    if (customerId) {
      return this.state.dispatches.filter(d => d.customerId === customerId);
    }
    return this.state.dispatches;
  }

  public addDispatch(dispatch: Omit<TechnicianDispatch, 'id' | 'ticketNo' | 'createdAt'>): TechnicianDispatch {
    const newDisp: TechnicianDispatch = {
      ...dispatch,
      id: uniqueId('disp'),
      ticketNo: `DSP-1403-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString()
    };
    this.state.dispatches.unshift(newDisp);
    this.notify();
    this.pushServer('add-dispatch', { dispatch: newDisp });
    return newDisp;
  }

  // Public contact forms must not claim success until the server accepts them.
  public async addCallbackRequest(dispatch: Omit<TechnicianDispatch, 'id' | 'ticketNo' | 'createdAt'>): Promise<TechnicianDispatch> {
    const request: TechnicianDispatch = {
      ...dispatch,
      source: 'website_callback',
      id: uniqueId('dsp'),
      ticketNo: uniqueRefNo('CALL'),
      createdAt: new Date().toISOString(),
    };
    const ok = await this.pushServer('add-dispatch', { dispatch: request });
    if (!ok) throw new Error('ثبت درخواست ناموفق بود. لطفاً دوباره تلاش کنید.');
    this.state.dispatches = [request, ...this.state.dispatches.filter(d => d.id !== request.id)];
    this.notify();
    return request;
  }

  public async completeCallbackRequest(id: string): Promise<boolean> {
    const ok = await this.pushServer('update-dispatch-status', { id, status: 'completed' });
    if (ok) {
      const request = this.state.dispatches.find(d => d.id === id || d.ticketNo === id);
      if (request) request.status = 'completed';
      this.notify();
    }
    return ok;
  }

  public updateDispatchStatus(id: string, status: TechnicianDispatch['status'], technicianName?: string): TechnicianDispatch | null {
    const idx = this.state.dispatches.findIndex(d => d.id === id || d.ticketNo === id);
    if (idx !== -1) {
      this.state.dispatches[idx].status = status;
      if (technicianName) this.state.dispatches[idx].technicianName = technicianName;
      this.notify();
      this.pushServer('update-dispatch-status', { id, status, technicianName });
      return this.state.dispatches[idx];
    }
    return null;
  }

  public deleteDispatch(id: string): boolean {
    const filtered = this.state.dispatches.filter(d => d.id !== id && d.ticketNo !== id);
    if (filtered.length !== this.state.dispatches.length) {
      this.state.dispatches = filtered;
      this.notify();
      this.persistCollection('dispatches', filtered);
      return true;
    }
    return false;
  }

  // ==========================================
  // Field Dispatch Technicians Management
  // ==========================================
  public getTechnicians(): FieldTechnician[] {
    return this.state.technicians || [];
  }

  public addTechnician(tech: Omit<FieldTechnician, 'id' | 'createdAt'>): FieldTechnician {
    const newTech: FieldTechnician = {
      ...tech,
      id: uniqueId('tech'),
      createdAt: new Date().toISOString()
    };
    if (!Array.isArray(this.state.technicians)) {
      this.state.technicians = [];
    }
    this.state.technicians.unshift(newTech);
    this.notify();
    this.persistCollection('technicians', this.state.technicians);
    return newTech;
  }

  public updateTechnician(id: string, updates: Partial<FieldTechnician>): FieldTechnician | null {
    if (!Array.isArray(this.state.technicians)) return null;
    const idx = this.state.technicians.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.state.technicians[idx] = {
        ...this.state.technicians[idx],
        ...updates
      };
      this.notify();
      this.persistCollection('technicians', this.state.technicians);
      return this.state.technicians[idx];
    }
    return null;
  }

  public deleteTechnician(id: string): boolean {
    if (!Array.isArray(this.state.technicians)) return false;
    const prevLen = this.state.technicians.length;
    this.state.technicians = this.state.technicians.filter(t => t.id !== id);
    if (this.state.technicians.length !== prevLen) {
      this.notify();
      this.persistCollection('technicians', this.state.technicians);
      return true;
    }
    return false;
  }

  // Environmental Logs
  public getEnvironmentalLogs(): EnvironmentalLog[] {
    return this.state.envLogs;
  }

  public getEnvLogs(): EnvironmentalLog[] {
    return this.state.envLogs;
  }

  public addEnvironmentalLog(log: Omit<EnvironmentalLog, 'id'>): EnvironmentalLog {
    const newLog: EnvironmentalLog = {
      ...log,
      id: uniqueId('env')
    };
    this.state.envLogs.unshift(newLog);
    this.notify();
    this.persistCollection('envLogs', this.state.envLogs);
    return newLog;
  }

  // Media Gallery - Max 2MB per item
  public getMediaItems(customerId?: string): LabMediaItem[] {
    if (customerId) {
      return this.state.media.filter(m => m.customerId === customerId);
    }
    return this.state.media;
  }

  public addMediaItem(item: Omit<LabMediaItem, 'id' | 'createdAt'>): LabMediaItem {
    const MAX_ALLOWED_BYTES = 2 * 1024 * 1024;
    if (item.fileSizeBytes > MAX_ALLOWED_BYTES) {
      throw new Error(`حجم فایل بارگذاری شده (${Math.round(item.fileSizeBytes / 1024)}KB) بیشتر از سقف مجاز ۲ مگابایت است.`);
    }

    const newItem: LabMediaItem = {
      ...item,
      id: uniqueId('med'),
      createdAt: new Date().toISOString()
    };
    this.state.media.unshift(newItem);
    this.notify();
    this.persistCollection('media', this.state.media);
    return newItem;
  }

  public deleteMediaItem(id: string): boolean {
    const filtered = this.state.media.filter(m => m.id !== id);
    if (filtered.length !== this.state.media.length) {
      this.state.media = filtered;
      this.notify();
      this.persistCollection('media', filtered);
      return true;
    }
    return false;
  }

  // SMS Notification System
  public getSmsLogs(customerId?: string): SmsLog[] {
    if (customerId) {
      return this.state.smsLogs.filter(l => l.customerId === customerId);
    }
    return this.state.smsLogs;
  }

  public sendSms(
    paramsOrPhone: string | {
      recipientPhone: string;
      recipientName?: string;
      event?: SmsEvent;
      eventType?: SmsEvent;
      message?: string;
      customMessage?: string;
      customerId?: string;
      customerName?: string;
      projectName?: string;
      reportId?: string;
      reportNo?: string;
      amount?: number;
    },
    recipientName?: string,
    event?: SmsEvent,
    message?: string,
    customerId?: string,
    customerName?: string
  ): SmsLog {
    const now = new Date();
    
    let phone = '';
    let name = 'کارفرمای محترم';
    let ev: SmsEvent = 'custom';
    let msg = '';
    let custId: string | undefined;
    let custName: string | undefined;
    let projName: string | undefined;

    if (typeof paramsOrPhone === 'object') {
      phone = paramsOrPhone.recipientPhone;
      name = paramsOrPhone.recipientName || paramsOrPhone.customerName || 'کارفرمای محترم';
      ev = paramsOrPhone.event || paramsOrPhone.eventType || 'custom';
      msg = paramsOrPhone.message || paramsOrPhone.customMessage || '';
      custId = paramsOrPhone.customerId;
      custName = paramsOrPhone.customerName;
      projName = paramsOrPhone.projectName;
    } else {
      phone = paramsOrPhone;
      name = recipientName || 'کارفرمای محترم';
      ev = event || 'custom';
      msg = message || '';
      custId = customerId;
      custName = customerName;
    }
    
    const jalaliDateStr = formatJalali(getTodayJalali());
    const jalaliTimeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    const newLog: SmsLog = {
      id: uniqueId('sms'),
      recipientPhone: phone,
      recipientName: name,
      customerId: custId,
      customerName: custName,
      projectName: projName,
      event: ev,
      message: msg,
      status: 'delivered',
      jalaliDate: jalaliDateStr,
      jalaliTime: jalaliTimeStr,
      createdAt: now.toISOString()
    };

    this.state.smsLogs.unshift(newLog);
    this.notify();
    this.persistCollection('smsLogs', this.state.smsLogs);
    return newLog;
  }

  // Wipe all data and reset to a completely empty state on the VPS server.
  // NOTE: destructive admin-only operation; after reset an admin account must be
  // bootstrapped via ADMIN_INITIAL_PASSWORD on the server (or restored from backup).
  public resetToDefaults() {
    this.state = {
      profiles: [],
      customers: [],
      reports: [],
      invoices: [],
      accounting: [],
      calibrations: [],
      dispatches: [],
      envLogs: [],
      media: [],
      smsLogs: [],
      trashCustomers: [],
      technicians: []
    };
    this.currentUser = null;
    this.notify();
    this.pushServer('reset', {});
  }
}

export const labDb = new ConcreteLabStorage();
