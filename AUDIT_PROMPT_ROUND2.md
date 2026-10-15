# پرامپت ممیزی — دور دوم (به‌روزشده با وضعیت واقعی کد، ۲۰۲۶-۰۹-۲۷)

> این فایل جایگزین/مکمل `AUDIT_PROMPT.md` است. برخلاف نسخه اول که روی «افشای داده مهمان» و «Gemini بدون احراز هویت» تأکید داشت، آن موارد در کد فعلی **اصلاح شده‌اند** (با برچسب SECURITY FIX #2/#4/#5/#6). پرامپت زیر با حذف یافته‌های منسوخ و افزودن یافته‌های **تازه تأییدشده با شماره خط** نوشته شده است.

---

## متن پرامپت (از اینجا به بعد کپی کنید)

تو یک تیم ارشد متشکل از «معمار نرم‌افزار»، «متخصص امنیت اپلیکیشن (OWASP)»، «متخصص Node/Express»، «متخصص React/Vite» و «SRE مسئول دیپلوی VPS» هستی. مخزن زیر را خط‌به‌خط بررسی کن. برای هر یافته: سطح ریسک، فایل و شماره خط، سناریو بروز مشکل، و کد اصلاح آماده بده. **فقط بر اساس کدی که واقعاً می‌بینی نظر بده؛ اگر موردی از لیست پایین منسوخ یا نادرست است، صریحاً رد کن.** در پایان نقشه راه Phase 1/2/3 بده.

### معرفی پروژه
SPA مدیریت آزمایشگاه مرکزی بتن (azmajahanbin.ir) با سه نقش admin/operator/customer + صفحات عمومی (لندینگ، استعلام گواهی QR، درخواست آزمون).
- فرانت: React 19 + Vite 6 + Tailwind 4 + Three.js + Recharts (~۳۶ هزار خط TSX)
- بک‌اند: Express در `server.ts` + `server/labDbMiddleware.ts` (۱۰۳۹ خط) + `server/labDbServer.ts` (۲۳۰۲ خط)
- «دیتابیس»: فایل JSON `data/laboratory_db.json` با کش کامل in-memory، write اتمی tmp+rename، mutex ترتیبی `withDbWrite`، etag per-collection با 409، بکاپ چرخشی
- Auth: scrypt سمت سرور + HMAC session token + refresh token + OTP دو مرحله‌ای (بدون SMS gateway)
- Realtime: SSE در `/api/lab-data/events`
- AI: `/api/gemini/*` با `@google/genai`
- دیپلوی: PM2 fork instances=1 (`ecosystem.config.cjs`) + nginx (`deploy/nginx-azmajahanbin.conf`)

### الف) یافته‌های قبلی که در کد فعلی رفع شده — فقط تأیید/رد کن، دوباره گزارش نکن
1. Gemini endpoints حالا `geminiGuard` دارند (auth + rate-limit): `server.ts:90-111`.
2. Guest دیگر کل reports/media را نمی‌گیرد؛ `sanitizeDatabaseState` برای visitor حداقل داده برمی‌گرداند و مسیر جدید `POST /api/lab-data/verify-report` تک‌رکوردی است: `server/labDbServer.ts:607-650`. ⚠️ ولی escape hatch `PUBLIC_FULL_SYNC=1` همان رفتار نشت داده را برگردانده — ارزیابی کن آیا باید حذف شود.
3. CORS: در production با `ALLOWED_ORIGINS` خالی، cross-origin با credentials رد می‌شود: `server/labDbMiddleware.ts:160-185`.
4. تغییر رمز self-service حالا رمز فعلی الزامی دارد: `server/labDbMiddleware.ts:741-757`.
5. `SESSION_TTL_HOURS` نامعتبر clamp شده: `server/labDbServer.ts:87-91`.
6. `trust proxy` پشت nginx ست می‌شود (TRUST_PROXY): `server.ts:41-47`.
7. مسیر `/server.cjs*` در static سرو مسدود شده: `server.ts:234-237`.

### ب) یافته‌های تازه تأییدشده — این‌ها را عمیق تحلیل و راستی‌آزمایی کن

**امنیت:**
- **B1 (Critical) — حالت dev vite بدون auth روی Gemini:** `vite.config.ts:22-160` پیاده‌سازی موازی `geminiApiPlugin` **هیچ بررسی session/rate-limit ندارد** (برخلاف server.ts). هر کسی که dev server در دسترس باشد (یا drift عمدی prod/dev) کلید Gemini شما را رایگان مصرف می‌کند. همچنین دو پیاده‌سازی = قطعی‌شدن drift امنیتی.
- **B2 (High) — gate اجباری تغییر رمز فقط سمت کلاینت:** `src/App.tsx:152` و پاسخ login (`labDbMiddleware.ts:427,532`) فلگ `mustChangePassword` را می‌دهند، اما هیچ endpoint احراز هویت‌شده‌ای در سرور وجود آن را **جلوگیری** نمی‌کند؛ با دورزدن UI یا call مستقیم API، سشن با رمز ضعیف/legacy تمام عملیات را مجاز است.
- **B3 (High) — نبود CSP/HSTS/helmet:** هیچ‌جا (نه `server.ts`، نه `labDbMiddleware.ts` هدرها، نه کانفیگ nginx) Content-Security-Policy یا HSTS وجود ندارد؛ در حالی که توکن سشن در sessionStorage و refresh در `localStorage.lab_refresh_token` است (`ConcreteLabStorage.ts:245-254`) → یک XSS = حساب‌ربایی کامل.
- **B4 (High) — افشای PII در سورس و دیتابیس commit‌شده:** `labDbServer.ts:733-735` نام کامل مدیر + موبایل `09131703177` hard-code؛ `LEGACY_DEFAULT_PASSWORD='Ag12258'` در `labDbServer.ts:192`؛ همین شماره در `data/laboratory_db.json` هم موجود است و **هم دیتابیس و هم بکاپ‌ها در git commit شده‌اند** (`.gitignore` عملاً محتوای موثری ندارد و `git check-ignore` برای data/ rc=1 می‌دهد) → تاریخچه repo حاوی هش رمز، سوابق مالی و مشتریان است.
- **B5 (Medium) — OTP به‌صورت cleartext در لاگ:** `labDbMiddleware.ts:448,569` کد OTP را با username/phone در console لاگ می‌کند؛ لاگ‌های PM2 (`logs/`) world-readable معمولاً افشاگر ثانیه‌ای 2FA هستند.
- **B6 (Medium) — refresh token در localStorage + تناقض «Zero localStorage»:** `ConcreteLabStorage.ts:91-95` در constructor `localStorage.clear()` می‌کند (side-effect مخرب روی سایر ابزارهای همان origin) ولی خودش refresh token را همان‌جا نگه می‌دارد (`:245-254`)؛ `logout` هم کلید باقی‌مانده `lab_session_token` را می‌خواند (`:136`).
- **B7 (Medium) — Source map سرور:** build در package.json `--sourcemap` تولید `dist/server.cjs.map` می‌کند؛ بلاک‌کننده `server.ts:234` فقط prefix `/server.cjs` مسیر request خام را چک می‌کند — بررسی کن `/assets/...map` یا resolve نرمالیزه‌شده راه فرار نباشد و `.map` عملاً public سرو نشود (در dist موجود است).
- **B8 (Low) — SESSION_SECRET حداقل ۱۶ کاراکتر:** `labDbServer.ts:60` — برای HMAC‌شناسه‌گذاری سشن ۳۲+ بایت تصادفی لازم است؛ مقدار کوتاه قابل brute-force آفلاین.

**معماری/داده:**
- **B9 (High) — sync کل‌مجموعه client-authoritative:** مسیر sync admin (`labDbMiddleware.ts:~587` + `syncFullDatabase`) هنوز کل آرایه‌ها (شامل profiles با منطق anti-wipe/per-hash carry-over صدها خطی) را از کلاینت می‌پذیرد؛ merge/replace ترکیبی = واگرایی دائمی و پنجره last-write-wins حتی با etag retry.
- **B10 (High) — media base64 داخل JSON DB** و جابه‌جایی آن روی sync/SSE؛ سقف body 5mb در برابر `client_max_body_size 10m` nginx (`nginx conf:37`) ناهماهنگ.
- **B11 (Medium) — state کامل in-process:** activeSessions/pendingOtp در RAM → هر restart PM2 (= max_memory_restart 400M با DB در RAM محتمل) همه سشن‌ها/OTP در جریان را می‌کشد؛ مقیاس افقی غیرممکن.
- **B12 (Medium) — Supabase فقط DDL رشته‌ای در `src/services/supabase.ts`** (کد مرده)؛ نبود schema validation (zod) روی payloadهای سرور.

**باگ‌های عملکردی:**
- **B13 (Medium) — readJsonBody تایم‌اوت ۱.۵ ثانیه با resolve({}):** `labDbMiddleware.ts:76-111` — شبکه شلوغ/بدنه بزرگ → handler با payload خالی اجرا می‌شود (write ناقص/ناموفق با ظاهر موفق).
- **B14 (Medium) — IDهای collision-prone:** `ConcreteLabStorage.ts:779,942,1090,1189,1272,1389` — `usr-/cust-/pay-/rep-/acc-${Date.now().slice(-4)}`؛ ثبت سریع متوالی برخورد قطعی.
- **B15 (Low) — SPA fallback روی API:** `app.get('*')` در prod (`server.ts:240-242`) مسیرهای ناشناخته `/api/...` را با HTML برمی‌گرداند (کلاینت JSON انتظار دارد).
- **B16 (Low) — SSE بدون auth:** `labDbMiddleware.ts:195-211` صرفاً version/timestamp لوگو می‌کند (کم‌خطر ولی metadata ریخت‌وپاش داده).
- **B17 (Low) — تکرار jalali/gregorian** بین `src/utils/jalali.ts` و سرور؛ `invoiceNo` مبتنی بر Date.now slice.

**عملیات/DX:**
- **B18 (Medium) — nginx:** `listen 443 ssl http2` deprecated؛ ssl paths کامنت (بدون certbot = redirect loop 80→443 بی‌سرور HTTPS)؛ `index.html` بدون `no-cache` (کانفیگ فقط immutable برای assets: خط ۷۵)؛ نبود rate-limit در لایه nginx.
- **B19 (Medium) — QA صفر:** lint = `tsc --noEmit`، بدون ESLint/Prettier/test runner/CI؛ تنها `smoke_test.cjs` و `tests/credential-repair.test.cjs` دستی؛ package name هنوز `react-example`؛ بدون engines؛ بدون env-validation (envalid/zod)؛ README/runbook نیست.
- **B20 (Medium) — God components:** AdminDashboard ~۳۷۰۰ خط، CustomerPortal ~۲۱۵۸، ConcreteLabStorage ۱۷۵۹؛ bundle سنگین landing (Three+docx+html2pdf) با code-splitting ناقص؛ پیام‌های خطای developer-facing انگلیسی به کاربر فارسی (مثل `labDbMiddleware.ts:720`).

### خواسته خروجی
1. برای هر مورد B1–B20: تأیید/رد/تکمیل با ارجاع خط، severity دقیق‌تر (CVSS-like)، و کد اصلاح آماده برای ۵ مورد برتر Phase 1.
2. موارد منسوخ بخش (الف) را چالش کن: آیا fixها واقعاً کامل‌اند؟ (مثلاً verify-report آیا enumeration-resistant است؟ PUBLIC_FULL_SYNC را چگونه حذف کنیم؟)
3. نقشه راه Phase 1 (امنیت/دیتالاس ≤۱ هفته) / Phase 2 (معماری: مهاجرت به Postgres/Supabase واقعی با plan بدون downtime، CRUD رکوردی + zod) / Phase 3 (مقیاس/DX/a11y/i18n/RTL).
4. جداگانه: ریسک حقوقی PII ایرانی در repo عمومی + قانون حفاظت داده؛ سازگاری QR public verification با حریم خصوصی.
5. چک‌لیست انتشار فوری (hotfix list) به ترتیب اجرای دستور.

قبل از پاسخ، ابهامات را بپرس؛ سپس گزارش کامل. بلوف نزن — فقط کد موجود ملاک است.

---

## پیوست — جدول خلاصه (وضعیت فعلی)

| # | دسته | یافته | شدت | نسبت به AUDIT_PROMPT.md |
|---|------|-------|-----|--------------------------|
| B1 | امنیت | Gemini در vite dev plugin بدون auth/ratelimit (منطق موازی) | Critical | جدید/به‌روز |
| B2 | امنیت | mustChangePassword فقط UI-enforced، نه سرور | High | جدید |
| B3 | امنیت | نبود CSP/HSTS + توکن در storage → XSS=account takeover | High | باقی‌مانده |
| B4 | داده | PII/رمز legacy hard-code + commit بودن data/ و backups/ | High | باقی‌مانده |
| B5 | امنیت | OTP cleartext در لاگ PM2 | Medium | جدید |
| B6 | باگ | localStorage.clear() در constructor + refresh در localStorage | Medium | باقی‌مانده |
| B7 | امنیت | سرو شدن احتمالی server.cjs.map | Medium | نیازمند تأیید |
| B8 | امنیت | SESSION_SECRET min 16 | Low | باقی‌مانده |
| B9 | معماری | whole-collection client-authoritative sync | High | باقی‌مانده |
| B10 | داده | media base64 در JSON + ناهماهنگی 5mb/10mb | High | باقی‌مانده |
| B11 | عملیات | state در RAM؛ restart = مرگ سشن/OTP/SSE | Medium | باقی‌مانده |
| B13 | باگ | readJsonBody timeout→empty payload | Medium | باقی‌مانده |
| B14 | باگ | ID slice(-4) collisions | Medium | باقی‌مانده |
| B18 | دیپلوی | nginx http2 deprecated/ssl comment/no-cache index | Medium | باقی‌مانده |
| B19 | QA | بدون ESLint/CI/test runner/env validation | Medium | باقی‌مانده |
| — | — | رفع‌شده: geminiGuard، guest leak، CORS، currentPassword، TTL NaN، trust proxy، server.cjs block | — | از لیست قدیمی حذف شد |
