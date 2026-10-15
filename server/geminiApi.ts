// ---------------------------------------------------------------------------
// Shared Gemini AI endpoints — SINGLE SOURCE OF TRUTH.
//
// BUG FIX (audit "API logic forked between server.ts and vite.config.ts"):
// the /api/gemini/* handlers used to exist TWICE: once as Express routes in
// server.ts (with auth + rate limiting) and once as a hand-rolled raw-socket
// middleware inside vite.config.ts (with NO auth, NO rate limit and slightly
// different behavior). Dev and prod therefore diverged, and any fix had to be
// made in two places. Both runtimes now mount this exact same router:
//   • production : `app.use(createGeminiRouter())` in server.ts
//   • development: `server.middlewares.use(geminiMiddleware())` in vite.config.ts
//
// SECURITY (audit item 1): both endpoints call a paid third-party model with
// the lab's GEMINI_API_KEY, so every request must present a valid HMAC session
// token AND stay under a conservative per-IP budget.
//
// SECURITY (audit item "prompt injection / unvalidated params"): user-supplied
// values are interpolated straight into the prompt template. Every field is now
// strictly type-checked, clamped to plausible engineering ranges and stripped
// of control characters before it reaches the model.
// ---------------------------------------------------------------------------

import express, { Request, Response, NextFunction, Router } from 'express';
import { GoogleGenAI } from '@google/genai';
// IMPORTANT: only ever import *pure* functions from labDbServer here. The
// middleware bundle (server.ts / vite dev) must NOT pull in the full Express
// server module — that copy carries its own startup side effects and was the
// original cause of the dev/prod logic fork. Token verification + DB access
// are injected via configureGeminiAuth() below instead.
import { getClientIp, checkRateLimit } from './rateLimit';

// --- Injectable auth seam ---------------------------------------------------
type VerifyFn = (token: string) => { userId: string; role: string } | null;
let verifyTokenImpl: VerifyFn | null = null;

/**
 * Wire the session-token verifier at startup (called from server.ts and from
 * vite.config.ts with the SAME verifySessionToken used by the lab-data API).
 * Until wired, every Gemini request is refused closed (fail-closed).
 */
export function configureGeminiAuth(verify: VerifyFn): void {
  verifyTokenImpl = verify;
}

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'azmajahanbin-lab' } },
    });
  }
  return aiClient;
}

/** Session-token guard + per-IP budget (defense in depth against key burn / DoS). */
export function geminiGuard(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  let token = '';
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof req.headers['x-session-token'] === 'string') {
    token = req.headers['x-session-token'].trim();
  }
  const payload = token && verifyTokenImpl ? verifyTokenImpl(token) : null;
  if (!payload) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const retryAfter = checkRateLimit(`gemini:${getClientIp(req)}`, 30, 10 * 60 * 1000);
  if (retryAfter !== null) {
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      success: false,
      error: `حد مجاز درخواست‌های هوش مصنوعی تجاوز شده است. لطفاً ${retryAfter} ثانیه دیگر تلاش کنید.`,
    });
    return;
  }
  next();
}

// --- Input validation helpers ---------------------------------------------

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Free-text field: string-coerced, de-controlled, length-capped. */
function str(v: unknown, maxLen = 40): string {
  if (v === undefined || v === null) return '';
  // Reject objects/arrays outright — `String({})` would inject "[object Object]"
  // (and worse, attacker-chosen JSON) into the prompt.
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return String(v).replace(CONTROL_CHARS, ' ').trim().slice(0, maxLen);
}

/** Numeric field with hard plausibility clamp; NaN/out-of-range -> fallback. */
function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.\-]/g, ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Concrete grade must look like C25 / C30 ... — anything else falls back. */
function grade(v: unknown, fallback = 'C25'): string {
  const g = str(v, 8).toUpperCase().replace(/\s+/g, '');
  return /^C\d{2}$/.test(g) ? g : fallback;
}

/**
 * Currency unit disambiguation (audit item "IRR / Toman confusion"): the old
 * prompt said "IRR / Toman" for every figure, which let the model invent its
 * own scale and produce wrong profit summaries. The unit is now declared ONCE,
 * explicitly, and taken from the client (`currencyUnit`) when provided.
 */
function currencyUnit(v: unknown): string {
  const u = str(v, 12);
  if (/^tomans?$/i.test(u)) return 'Toman (تومان)';
  if (/^(irr|rials?)$/i.test(u)) return 'Iranian Rial (ریال)';
  return 'Toman (تومان)'; // app default — financial inputs are stored in Toman
}

const PREDICT_SCHEMA = `{
  "predicted28dStrength": number (in MPa, e.g. 31.4),
  "strengthRatio7to28": number (percentage e.g. 68.5),
  "targetCompliance": "PASS" | "WARNING" | "FAIL",
  "confidenceScore": number (percentage between 85 and 99),
  "structuralRiskLevel": "LOW" | "MODERATE" | "HIGH",
  "analysisFa": "تحلیل تخصصی جامع به زبان فارسی شامل روند رشد مقاومت، ارزیابی اسلامپ و نسبت آب به سیمان و انطباق با مبحث نهم مقررات ملی ساختمان",
  "analysisEn": "Detailed engineering analysis in English",
  "recommendationsFa": ["توصیه عملیاتی ۱", "توصیه عملیاتی ۲", "توصیه عملیاتی ۳"],
  "recommendationsEn": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "curingAdviceFa": "دستورالعمل ویژه عمل‌آوری و مراقبت رطوبتی بتن",
  "estimatedMaturityIndex": "e.g. 480 °C-hours"
}`;

const FINANCIAL_SCHEMA = `{
  "profitMargin": number (percentage),
  "financialHealth": "EXCELLENT" | "STABLE" | "NEEDS_ATTENTION",
  "executiveSummaryFa": "خلاصه مدیریتی جامع عملکرد مالی و عملیاتی آزمایشگاه به زبان فارسی",
  "executiveSummaryEn": "Executive operational and financial performance summary in English",
  "keyObservationsFa": ["نکته کلیدی ۱", "نکته کلیدی ۲", "نکته کلیدی ۳"],
  "keyObservationsEn": ["Key observation 1", "Key observation 2", "Key observation 3"],
  "costOptimizationTipsFa": ["راهکار کاهش هزینه ۱", "راهکار کاهش هزینه ۲"],
  "costOptimizationTipsEn": ["Cost optimization tip 1", "Cost optimization tip 2"],
  "revenueGrowthStrategiesFa": ["استراتژی رشد درآمد ۱", "استراتژی رشد درآمد ۲"]
}`;

// ---------------------------------------------------------------------------
// PERF/RELIABILITY FIX (audit #50): the old generateJson() had NO timeout —
// a hung Gemini call pinned the HTTP request/connection until nginx's 60s
// proxy timeout, and with the 30-req/10-min limiter a few stalled upstream
// calls could saturate the socket pool. Now every call is bounded by an
// AbortSignal.timeout and transient failures (network errors, 429/5xx) get a
// single bounded retry with exponential backoff + jitter. Total worst-case
// wall time (~2 x 20s + 1.5s backoff) stays safely under the nginx limit.
// ---------------------------------------------------------------------------
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 20_000);
const GEMINI_MAX_ATTEMPTS = 2;

function isRetryableGeminiError(err: any): boolean {
  const msg = String(err?.message || err || '');
  // SDK surfaces HTTP status in the message; also treat aborts/network drops.
  if (/status\s*code[:\s]+?(429|500|502|503|504)/i.test(msg)) return true;
  if (/AbortError|TimeoutError|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|fetch failed|socket hang up/i.test(msg)) return true;
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return true;
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateJson(ai: GoogleGenAI, prompt: string, temperature: number) {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature,
          // Hard client-side deadline: never hold the Express request open
          // beyond GEMINI_TIMEOUT_MS even if the upstream connection hangs.
          // (In this SDK version abortSignal lives on GenerateContentConfig,
          // not on GenerateContentParameters.)
          abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        },
      });
      const text = response.text || '{}';
      return JSON.parse(text);
    } catch (err: any) {
      lastErr = err;
      if (attempt < GEMINI_MAX_ATTEMPTS && isRetryableGeminiError(err)) {
        // Exponential backoff with jitter: ~500-1000ms before the retry.
        const base = 500 * Math.pow(2, attempt - 1);
        await sleep(base + Math.floor(Math.random() * base));
        continue;
      }
      break;
    }
  }
  const msg = String(lastErr?.message || lastErr || 'Gemini request failed');
  if (/AbortError|TimeoutError/i.test(msg) || lastErr?.name === 'TimeoutError') {
    throw Object.assign(new Error('سرویس هوش مصنوعی پاسخ نداد (timeout). لطفاً بعداً دوباره تلاش کنید.'), { statusCode: 504 });
  }
  throw lastErr instanceof Error ? lastErr : new Error(msg);
}

function missingKey(res: Response) {
  // 200 + structured error keeps the existing client contract intact (the UI
  // renders `error` inline instead of throwing on a non-2xx response).
  res.status(200).json({
    success: false,
    error: 'GEMINI_API_KEY is not configured in environment secrets.',
  });
}

/** Express router used by the production server (server.ts). */
export function createGeminiRouter(): Router {
  const router = express.Router();
  router.post('/api/gemini/predict-strength', geminiGuard, predictStrengthHandler);
  router.post('/api/gemini/financial-summary', geminiGuard, financialSummaryHandler);
  return router;
}

async function predictStrengthHandler(req: Request, res: Response) {
  try {
    const ai = getAiClient();
    if (!ai) return missingKey(res);

    const b: any = req.body || {};
    const concreteGrade = grade(b.concreteGrade);
    const strength7d = num(b.strength7d, 0, 200, 0);
    const slump = num(b.slump, 0, 300, 0);
    const wcRatio = num(b.wcRatio, 0.2, 1.2, 0.45);
    const cementGrade = str(b.cementGrade, 40) || 'Type II / 42.5R';
    const aggregateSize = str(b.aggregateSize, 20) || '19mm';
    const curingTemp = str(b.curingTemp, 20) || '20°C';
    const targetMpa = concreteGrade.replace('C', '');

    const prompt = `You are a Chief Concrete Materials Engineer and AI Structural Analyst for a certified testing laboratory.
Analyze the following concrete mix and 7-day test data to predict the 28-day compressive strength, failure risk, and provide structural recommendations based on ACI 209R, Eurocode 2, and ASTM C39 / Iranian Concrete Code (ABA):

Test Data:
- Target Concrete Grade: ${concreteGrade} (Target: ${targetMpa} MPa)
- Measured 7-Day Compressive Strength: ${strength7d} MPa
- Slump (روانی بتن): ${slump} mm
- Water/Cement Ratio (w/c): ${wcRatio}
- Cement Type/Grade: ${cementGrade}
- Maximum Aggregate Size: ${aggregateSize}
- Curing Ambient Temperature: ${curingTemp}

Respond strictly in JSON format with this exact structure:
${PREDICT_SCHEMA}`;

    res.json({ success: true, data: await generateJson(ai, prompt, 0.2) });
  } catch (err: any) {
    console.error('Error in /api/gemini/predict-strength:', err);
    // Audit #50: propagate the upstream status when known (e.g. 504 timeout)
    // instead of masking everything as 500.
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    res.status(status).json({ success: false, error: err?.message || 'Gemini API Error' });
  }
}

async function financialSummaryHandler(req: Request, res: Response) {
  try {
    const ai = getAiClient();
    if (!ai) return missingKey(res);

    const b: any = req.body || {};
    const unit = currencyUnit(b.currencyUnit);
    const totalIncome = num(b.totalIncome, -1e15, 1e15, 0);
    const totalExpense = num(b.totalExpense, -1e15, 1e15, 0);
    const pendingInvoices = num(b.pendingInvoices, 0, 1e15, 0);
    const testsCount = num(b.testsCount, 0, 1e9, 0);
    const passRate = num(b.passRate, 0, 100, 0);
    const period = str(b.period, 40) || 'Current Month';

    const prompt = `You are an Executive Financial & Operations Auditor for a Commercial Concrete Testing Laboratory.
All monetary amounts below are expressed in a single currency unit: ${unit}. Never mix units and never convert unless explicitly asked.
Review the following monthly laboratory performance metrics:
- Period: ${period}
- Total Revenue: ${totalIncome} (${unit})
- Total Operating Costs: ${totalExpense} (${unit})
- Net Operating Profit: ${totalIncome - totalExpense} (${unit})
- Outstanding / Unpaid Invoices: ${pendingInvoices} (${unit})
- Total Concrete Break Tests Performed: ${testsCount}
- Overall Quality Pass Rate: ${passRate}%

Generate an executive audit summary in JSON format:
${FINANCIAL_SCHEMA}`;

    res.json({ success: true, data: await generateJson(ai, prompt, 0.3) });
  } catch (err: any) {
    console.error('Error in /api/gemini/financial-summary:', err);
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    res.status(status).json({ success: false, error: err?.message || 'Gemini API Error' });
  }
}

// --- Framework-agnostic entry point for the Vite dev server ----------------
// connect-style middleware (req/res are plain http objects there, so we cannot
// reuse express.Router). It performs the SAME auth/rate-limit/validation path
// as the Express router by delegating to it through a tiny express shim.

type RawReq = {
  method?: string;
  url?: string;
  headers: Record<string, any>;
  socket?: { remoteAddress?: string };
  on(event: string, cb: (chunk?: any) => void): void;
};
type RawRes = {
  statusCode: number;
  setHeader(name: string, value: string | number): void;
  end(chunk?: any): void;
  write?(chunk?: any): void;
};

const MAX_GEMINI_BODY_BYTES = 64 * 1024; // these payloads are tiny metric blobs

function readRawBody(req: RawReq): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';
    const timer = setTimeout(() => reject(new Error('BODY_TIMEOUT')), 10_000);
    req.on('data', (chunk: any) => {
      size += chunk?.length ?? 0;
      if (size > MAX_GEMINI_BODY_BYTES) {
        clearTimeout(timer);
        reject(Object.assign(new Error('PAYLOAD_TOO_LARGE'), { code: 'PAYLOAD_TOO_LARGE' }));
        req.on = () => {}; // stop accumulating
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      clearTimeout(timer);
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', (err: any) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Adapt a connect-style (http) req/res pair to the express handler shape. */
function toExpressLike(req: RawReq, res: RawRes, body: any) {
  const fakeReq: any = {
    body,
    headers: req.headers,
    socket: req.socket,
    ip: req.socket?.remoteAddress,
    method: req.method,
    url: req.url,
  };
  const fakeRes: any = {
    statusCode: 200,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string | number) {
      this.statusCode = res.statusCode;
      try { res.setHeader(name, String(value)); } catch { /* already sent */ }
      return this;
    },
    json(payload: any) {
      if (this.headersSent) return this;
      this.headersSent = true;
      const buf = Buffer.from(JSON.stringify(payload));
      try {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', String(buf.length));
      } catch { /* ignore */ }
      res.statusCode = this.statusCode;
      res.end(buf);
      return this;
    },
    send(payload: any) { return this.json(payload); },
    end(chunk?: any) {
      if (this.headersSent) return this;
      this.headersSent = true;
      res.statusCode = this.statusCode;
      res.end(chunk);
      return this;
    },
  };
  return { fakeReq, fakeRes };
}

/**
 * Vite/connect-compatible middleware exposing the very same Gemini endpoints
 * (same guards, same validation, same prompts) as createGeminiRouter().
 */
export function geminiMiddleware() {
  return async (req: RawReq, res: RawRes, next: () => void) => {
    const url = req.url ? req.url.split('?')[0] : '';
    if (!url.startsWith('/api/gemini/')) return next();

    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
      return;
    }

    let body: any = {};
    try {
      body = await readRawBody(req);
    } catch (err: any) {
      res.statusCode = err?.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
      res.end(JSON.stringify({
        success: false,
        error: err?.code === 'PAYLOAD_TOO_LARGE' ? 'Request body too large' : 'Invalid JSON body',
      }));
      return;
    }

    const { fakeReq, fakeRes } = toExpressLike(req, res, body);
    const done = () => { /* response already ended by the handler */ };

    // Same auth + rate-limit gate as production.
    geminiGuard(fakeReq as any, fakeRes as any, () => {
      const handler =
        url === '/api/gemini/predict-strength' ? predictStrengthHandler
        : url === '/api/gemini/financial-summary' ? financialSummaryHandler
        : null;
      if (!handler) {
        fakeRes.status(404).json({ success: false, error: 'Endpoint not found' });
        return;
      }
      handler(fakeReq as any, fakeRes as any).catch(done);
    });
  };
}
