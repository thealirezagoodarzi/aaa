// ---------------------------------------------------------------------------
// Shared in-memory rate limiter (no external deps) + correct client-IP
// resolution behind a reverse proxy (nginx).
//
// SECURITY FIX: previously getClientIp() blindly trusted the FIRST entry of
// X-Forwarded-For, which any client can spoof — making every per-IP limit
// trivially bypassable. Now the IP is taken from the socket peer by default;
// XFF/X-Real-IP headers are honored ONLY when TRUST_PROXY=1 is set (i.e. the
// app is known to sit behind nginx on the same machine, which overwrites
// those headers). See server.ts (`app.set('trust proxy', ...)`) and
// deploy/nginx-azmajahanbin.conf.
// ---------------------------------------------------------------------------

import proxyaddr from 'proxy-addr';

const TRUST_PROXY = (() => {
  const v = String(process.env.TRUST_PROXY || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
})();

export function isTrustProxyEnabled(): boolean {
  return TRUST_PROXY;
}

/**
 * Trusted-proxy ranges: loopback + RFC1918 + link-local (v4 & v6). Our nginx
 * terminates on the same machine/private network; anything outside these
 * ranges is treated as attacker-controlled input and never trusted as the
 * client identity. Extend with TRUSTED_PROXY_CIDRS="10.0.0.0/8,::1/128".
 */
const EXTRA_TRUSTED_CIDRS: string[] = (process.env.TRUSTED_PROXY_CIDRS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const DEFAULT_TRUSTED_CIDRS = [
  '127.0.0.0/8', '::1/128', 'fc00::/7', 'fe80::/10',
  '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
];

// Compiled ONCE at module load — NOT per request. `proxyaddr.compile()`
// re-parses every CIDR and allocates lookup tables; calling it inside
// getClientIp() would make the unauthenticated login/OTP endpoints a cheap
// CPU-amplification target.
const TRUST_FN = proxyaddr.compile([...DEFAULT_TRUSTED_CIDRS, ...EXTRA_TRUSTED_CIDRS]);

export function getClientIp(req: {
  headers: Record<string, any>;
  socket?: { remoteAddress?: string };
}): string {
  const socketIp = req.socket?.remoteAddress || 'unknown';
  if (!TRUST_PROXY) return socketIp;
  // SECURITY FIX (audit #9): the old code took the LAST comma-separated item
  // of X-Forwarded-For. That equals the real client only for a single trusted
  // hop: nginx appends the peer address it sees via $proxy_add_x_forwarded_for,
  // so with any second proxy/CDN in front, the last item becomes an upstream-
  // chosen value and - worse - with a forged client header chain the attacker
  // still controls which address lands there, letting login/OTP/Gemini rate
  // limits be rotated per fake IP. We now delegate to `proxy-addr` (the exact
  // library Express's `trust proxy` setting uses): it walks the XFF chain from
  // RIGHT to LEFT and stops at the first address that is NOT one of our
  // trusted proxy ranges.
  try {
    return proxyaddr(req as any, TRUST_FN);
  } catch {
    // Malformed header chain - fall back to the socket peer.
    return socketIp;
  }
}

// ---------------------------------------------------------------------------
// PERF/SECURITY FIX (audit #49): sliding-window rate limiter.
//
// The old implementation was a plain FIXED window: at the boundary between two
// windows a client could fire 2x maxAttempts in ~2x(window/2) ms (burst across
// the edge). It also relied solely on a 60s global sweep, so IP-keyed entries
// lived up to a full minute after expiry.
//
// New design keeps one small ring of per-window counters per key. The current
// effective count is the exact sum of the closed sub-windows plus a linear
// interpolation of the still-open oldest sub-window — the standard
// "sliding-window counter" approximation used by CDNs/API gateways. Memory is
// bounded (O(keys * windows)) and expired keys are pruned lazily per-key plus
// a lightweight periodic sweep as a backstop.
// ---------------------------------------------------------------------------
const SLIDING_SUBWINDOWS = 5; // resolution of the sliding estimate

interface SubWindowSlot { startAt: number; count: number; }
interface SlidingBucket {
  windowMs: number;
  subMs: number;
  slots: SubWindowSlot[]; // ordered oldest -> newest, length <= SLIDING_SUBWINDOWS
  lastSeenAt: number;     // for lazy pruning of idle keys
}
const rateBuckets = new Map<string, SlidingBucket>();

/** Returns null when allowed, or retry-after seconds when blocked. */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): number | null {
  const now = Date.now();
  const subMs = Math.max(1, Math.floor(windowMs / SLIDING_SUBWINDOWS));

  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.lastSeenAt > windowMs * 2) {
    // New key OR idle long enough that every slot has fully aged out.
    bucket = { windowMs, subMs, slots: [{ startAt: now, count: 1 }], lastSeenAt: now };
    rateBuckets.set(key, bucket);
    return null;
  }
  bucket.lastSeenAt = now;

  // Roll forward: drop fully-aged slots, open a new sub-window if needed.
  while (bucket.slots.length && now - bucket.slots[0].startAt >= windowMs + subMs) {
    bucket.slots.shift();
  }
  const head = bucket.slots[bucket.slots.length - 1];
  if (!head || now - head.startAt >= subMs) {
    bucket.slots.push({ startAt: now, count: 1 });
  } else {
    head.count += 1;
  }
  // Hard cap on retained sub-windows (defensive against clock skew).
  while (bucket.slots.length > SLIDING_SUBWINDOWS + 1) bucket.slots.shift();

  // Sliding estimate: closed slots inside the trailing window + interpolated
  // fraction of the oldest (partially overlapping) slot.
  const windowStart = now - windowMs;
  let closedSum = 0;
  let oldest: SubWindowSlot | null = null;
  for (const s of bucket.slots) {
    if (s.startAt <= windowStart) oldest = s; else closedSum += s.count;
  }
  let weighted = closedSum;
  if (oldest) {
    const overlapRatio = Math.min(1, Math.max(0, (oldest.startAt + subMs - windowStart) / subMs));
    weighted += oldest.count * overlapRatio;
  }

  if (weighted > maxAttempts) {
    // Earliest instant where the estimate can drop below the limit: once the
    // oldest contributing sub-window fully leaves the trailing window.
    const releaseAt = (oldest ? oldest.startAt : bucket.slots[0].startAt) + windowMs;
    return Math.max(1, Math.ceil((releaseAt - now) / 1000));
  }
  return null;
}

// Periodic backstop sweep so the map never grows unbounded even if traffic to
// some keys stops (lazy per-key pruning above handles the common case).
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets.entries()) {
    if (now - b.lastSeenAt > b.windowMs * 2) rateBuckets.delete(k);
  }
}, 60 * 1000).unref?.();
