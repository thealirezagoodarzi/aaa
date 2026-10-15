# پرامپت تحلیل و ممیزی کد — سامانه آزمایشگاه بتن (azmajahanbin.ir)

> این پرامپت را برای یک مدل هوش مصنوعی متخصص Code Review / Security Audit بفرستید.
> مبنای آن، بررسی کامل و خط‌به‌خط مخزن زیر است. هیچ کدی تغییر نکرده؛ فقط مشکلات استخراج شده‌اند.

---

## متن پرامپت (از اینجا به بعد کپی کنید)

ت تو یک تیم ارشد متشکل از «معمار نرم‌افزار»، «متخصص امنیت اپلیکیشن (OWASP)»، «متخصص Node/Express»، «متخصص React/Vite» و «SRE مسئول دیپلوی روی VPS» هستی. وظیفه تو بررسی عمیق پروژه زیر و ارائه گزارش problems به همراه راه‌حل قابل‌اجرا برای هر مورد است. برای هر آیتم: سطح ریسک (Critical/High/Medium/Low)، فایل و شماره خط تقریبی، شرح مشکل، سناریو بروز مشکل، و پیشنهاد اصلاح (با کد نمونه) بده. در پایان، نقشه راه اولویت‌بندی‌شده (Phase 1/2/3) ارائه بده.

### معرفی پروژه
وب‌اپلیکیشن SPA مدیریت «آزمایشگاه مرکزی بتن» با سه نقش کاربری (admin تک‌نفره / operator / customer) + صفحات عمومی (لندینگ، استعلام گواهی با QR، درخواست آزمون).
- فرانت‌اند: React 19 + Vite 6 + Tailwind CSS 4 + Three.js + Recharts + Framer Motion (~36,000 خط TSX/TS در `src/`)
- بک‌اند: Express روی `server.ts` (در حالت production استاتیک `dist/` را سرو می‌کند، در dev Vite middleware)
- «دیتابیس»: **فایل JSON** در `data/laboratory_db.json` با موتور دستی در `server/labDbServer.ts` (2129 خط): کش in-memory، write اتمی tmp+rename، mutex ترتیبی `withDbWrite`، نسخه‌گذاری per-collection (etag/etags) با تشخیص تضاد 409، بکاپ چرخشی در `data/backups/`، بازیابی از بکاپ در صورت corruption
- احراز هویت: لاگین با scrypt سمت سرور + HMAC-signed session token (جدا‌سازی‌شده با jti و revocation) + refresh token + OTP دو مرحله‌ای (SMS **وصل نیست** — کد فقط در لاگ سرور چاپ می‌شود و دستی ارسال می‌گردد)
- Realtime: Server-Sent Events (`/api/lab-data/events`) + polling fallback
- AI: دو اندپوینت `/api/gemini/*` که با `@google/genai` (کلید از env) خروجی JSON تولید می‌کنند
- Supabase: فقط DDL/اسکیمای SQL به‌صورت رشته در `src/services/supabase.ts` موجود است؛ **هیچ اتصال واقعی برقرار نیست** (کد مرده)
- دیپلوی: PM2 (`ecosystem.config.cjs`: fork, instances=1, PORT=5000) + nginx reverse proxy (`deploy/nginx-azmajahanbin.conf`) روی VPS

### ساختار کلیدی
```
server.ts                    # اکسپرس، health، gemini، static/SPA fallback
server/labDbMiddleware.ts    # تمام route های API احراز هویت/CRUD (977 خط)
server/labDbServer.ts        # موتور DB فایل JSON + اعتبارنامه‌ها + سشن + OTP (2129 خط)
src/services/ConcreteLabStorage.ts  # «استوریج» سمت کلاینت: fetch/SSE/etag/retry (1734 خط)
src/components/admin/AdminDashboard.tsx (3715 خط!) ، CustomerPortal.tsx (2158) و ...
data/laboratory_db.json      # دیتابیس واقعی (در git هم commit شده!)
tests/credential-repair.test.cjs ، smoke_test.cjs
.env.example ، ecosystem.config.cjs ، deploy/nginx-azmajahanbin.conf
```

### شواهد و نکاتی که خودم استخراج کرده‌ام (باید همه را تأیید/رد/تکمیل کنی)

**۱) معماری و داده**
- «دیتابیس» فایل JSON با state کامل in-process است → مقیاس‌ناپذیر، بدون تراکنش، بدون query; کل دیتابیس در هر `GET /api/lab-data` سریالایز و منتقل می‌شود (با بزرگ‌شدن media/photos بحرانی می‌شود).
- اتوماسیون write تنها داخل **یک پروسه** معتبر است؛ هرگونه افقی‌کردن (cluster/PM2 instances>1/دو سرور) باعث گم‌شدن write و بی‌اعتبارشدن سشن‌ها (activeSessions در RAM) می‌شود. محدودیت instances=1 در ecosystem مستند ولی شکننده است.
- `syncFullDatabase` (admin-only) رفتار ترکیبی عجیب دارد: برخی مجموعه‌ها merge و برخی replace (فقط اگر incoming غیرخالی باشد) — امکان «عدم حذف» رکورد و واگرایی دائمی کلاینت/سرور.
- الگوی همگام‌سازی کلاینت: «read entire state → mutate in memory → persistCollection(کل آرایه)» = last-write-wins در سطح مجموعه با etag؛ retry خودکار پس از 409 می‌تواند write کاربر دیگر را بازنویسی کند (survive of whole-array overwrite).
- `media` (عکس‌های base64 آزمون‌ها) داخل همان JSON ذخیره و روی SSE/sync جابه‌جا می‌شود → رشد انفجاری فایل DB، حافظه، پهنای باند؛ سقف 5mb body.
- نبود schema validation قوی سمت سرور روی بیشتر payloadها (هر آبجکت دلخواه می‌تواند در reports/customers ذخیره شود).

**۲) امنیت**
- مسیر جایگزین API در حالت **dev**: `vite.config.ts` خودش `handleLabDataApi` و منطق Gemini را در `configureServer` mount می‌کند → **دو پیاده‌سازی موازی** (server.ts و vite.config.ts) که حتماً drift می‌کند؛ در dev باید فقط از یکی استفاده شود.
- CORS: بازتاب origin درخواست وقتی `ALLOWED_ORIGINS` تنظیم نشده (پیش‌فرض خالی در .env.example) + `Access-Control-Allow-Credentials: true` → عملاً `*` با credentials برای همه originهای API احراز هویت‌شونده.
- Rate limiting in-memory و صرفاً per-IP از `X-Forwarded-For` **قابل جعل** (nginx مقدار را prepend می‌کند اما سرور `trust proxy` تنظیم نکرده و اولین مقدار را می‌خواند) + bypass با IPv6/چرخش IP؛ bucketها هم DoS حافظه‌ای کوچک دارند.
-OTP در production فقط در console.log چاپ می‌شود (بدون gateway) — عملاً 2FA زنجیره‌ای انسانی/آفلاین است؛ tempToken در حافظه process و با ری‌استارت از بین می‌رود.
- رمز عبور **plaintext** در بدنه JSON از کلاینت به سرور می‌رود (روی HTTPS قابل قبول است) ولی: لاگ nginx، error messageها، و هر proxy میانی ریسک‌اند؛ همچنین `authenticateUser` چند normalize مختلف روی رمز امتحان می‌کند (سطح حمل slightly up).
- `LEGACY_DEFAULT_PASSWORD = 'Ag12258'` و موبایل واقعی مدیر `09131703177` و نام کامل شخص حقیقی **hard-code در سورس ریپو public/GitHub** — افشای PII و هدف phishing.
- `reset-bootstrap-password` با ADMIN_BOOTSTRAP_TOKEN + force=true حساس‌ترین endpoint است؛ timingSafeEqual درست استفاده شده ولی token در env می‌ماند (راهنما می‌گوید بعد از recovery حذف شود — تضمینی نیست)؛ rate limit روی این مسیر وجود ندارد.
- اندپوینت‌های `/api/gemini/*` **بدون احراز هویت و بدون rate limit** هستند → هر بازدیدکننده عمومی می‌تواند با هزینه کلید Gemini شما تعداد نامحدود فراخوانی کند (prompt injection هم ممکن: ورودی‌ها مستقیم در prompt قرار می‌گیرند و `${concreteGrade.replace(...)}` بدون type-check می‌تواند 500 بدهد).
- خروجی AI مستقیم در UI رندر می‌شود؛ اگر جایی `dangerouslySetInnerHTML` (PrintContractModal) یا متن فارسی AI بدون sanitize نمایش داده شود، XSS دومین‌order.
- توکن سشن در `sessionStorage` و refresh token در `localStorage` → XSS = حساب‌ربایی کامل؛ CSP完全没有 (no Content-Security-Policy نه در nginx نه در متا). HSTS هم در کانفیگ nginx نیست؛ redirect 80→443 خوب است اما ssl paths کامنت‌اند (اگر certbot اجرا نشود سایت روی HTTP بالا می‌آید؟ در عمل بلادرنگ loop).
- `sanitizeDatabaseState` برای بازدیدکننده guest: **همه reports تأییدشده + media + calibrations + اسامی/ID کارکنان** را به هر نفر بدون لاگین می‌دهد (استعلام گواهی عمومی بهانه‌اش است) → افشای انبوه داده مشتریان/پروژه‌ها با یک درخواست ساده؛ بهتر بود فقط lookup by certificate code مجاز باشد.
- نقش‌ها سمت سرور روی `role` قفل‌شده‌اند (sole admin invariant) اما `update-profile` با «self» بر اساس تطابق username/customerId کار می‌کند و `registerCustomerAccount`/`addProfileServer` اعتبارسنجی فیلد کمی دارند (مثلاً یک operator می‌تواند profile دیگری با customerId مشترک را ویرایش کند).
- `profiles` sync توسط admin: کل آرایه پروفایل‌ها از کلاینت پذیرفته و فقط با منطق پیچیده carry-over هش‌ها حفظ می‌شود؛ صدها خط کد «anti-wipe» نشانه design fault است — مسیر نباید client-authoritative باشد.
- لاگ‌ها: `console.error(err.message)` در پاسخ API برگردانده می‌شود (اطلاعات داخلی).
- `.gitignore` فقط dist/ را نادیده می‌گیرد؛ **`data/laboratory_db.json` و بکاپ‌ها commit شده‌اند** (حاوی هش رمز، سوابق مالی، اطلاعات مشتریان) — حتی اگر repo خصوصی باشد ریسک نشت از history.
- `SESSION_SECRET` min 16 کاراکتر (ضعیف؛ 32+ بایت تصادفی توصیه شود) و در dev random در هر restart.
- نبود helmet (HSTS/CSP/COOP...) — هدرها دستی و ناقص‌اند؛ `X-Frame-Options: DENY` فقط روی API، nginx روی همه صفحات SAMEORIGIN (تناقض).
- express 4.x قدیمی؛ وابستگی‌های امنیتی باید دوره‌ای audit شوند (امروز clean ولی CI ندارد).

**۳) باگ‌های عملکردی/منطقی**
- `getClientIp` بدون `app.set('trust proxy')` — پشت nginx، rate-limit و لاگ‌ها روی IP اشتباه.
- `readJsonBody` تایم‌اوت 1.5s با resolve({}) — درخواست کند/بزرگ می‌تواند بدن خالی بگیرد و handler با payload ناقص اجرا شود (یا double-read با express.json).
- در `server.ts` حالت production، `app.get('*')` همه چیز را به index.html می‌دهد؛ 404 واقعی API فقط داخل middleware lab-data وجود دارد؛ مسیرهای `/api/unknown` به SPA fallback می‌افتند (JSON انتظار می‌رود HTML برمی‌گردد).
- `smoke_test.cjs` خودش تست می‌کند `/server.cjs.map` — یعنی **source map سرور در dist عمومی سرو می‌شود** (مسیر server.cjs بلاک شده ولی .map نه؟ بررسی کن) → افشای منطق داخلی/ساختار env.
- `logout` کلاینت: `this.getSessionToken?.() || localStorage.getItem('lab_session_token')` در حالی که توکن اصلی در `sessionStorage.azma_session_token` است — کلید نامتعارف/باقی‌مانده؛ `localStorage.clear()` در constructor همه داده‌های سایر ابزارهای همان origin را پاک می‌کند (side-effect مخرب) و refresh token در `localStorage.lab_refresh_token` نگه داشته می‌شود که با ادعای «Zero localStorage» در تضاد است.
- `normalizeStoredPassword`/`repairCorruptedCredentials`/`enforceSoleAdminRules`/`resolveCredential` — لایه‌های متعدد heuristic درباره شکل هش (32hex salt/128hex digest، placeholderها، legacy shapes)؛ کامنت‌ها اعتراف می‌کنند چند regression «hijack-grade» قبلاً رخ داده (wipe شدن credential، endless repair loop). این ماشین-حالتِ ضمنی باید با حذف مسیر «client sends profiles array» منسوخ شود.
- `hashPassword` اگر ورودی از قبل `scrypt:` باشد عیناً برمی‌گرداند (accepting attacker-controlled hash shape در بعضی مسیرها).
- `addDispatch` عمومی: اعتبارسنجی name/phone هست ولی فیلدهای دلخواه دیگر (آبجکت کامل client) ذخیره می‌شوند؛ no captcha، no honeypot.
- تاریخ جلالی: پیاده‌سازی duplicate (src/utils/jalali.ts و gregorianToJalali در سرور) — drift محتمل؛ `invoiceNo` با slice(-4) Date.now (تصادم).
- `acc-${Date.now().toString().slice(-4)}` و `cust-${Date.now().slice(-4)}` — برخورد ID در ثبت سریع متوالی قطعی است.
- SSE: heartbeat 20s ولی اتصال اولیه بدون auth؛ هر کسی می‌تواند stream رویدادها را گوش دهد (متادیتای version/timestamp).
- Client `fetchFromServer` در هر focus/visibility/full-sync کل دیتابیس را می‌گیرد (پهنای باند، flicker)؛ interval تمیز نمی‌شود (memory leak در SPA بدون clearInterval).
- `updateUserPassword` سرور فقط با userId بدون الزام current password (اگر admin نباشد self است — ولی self-change باید رمز فعلی بخواهد؛ الان هر توکن معتبر = تغییر رمز دلخواه آن کاربر؛ combined with XSS = escalate).
- Force password change gate روی `mustChangePassword` سمت کلاینت اعمال می‌شود (App.tsx) — سرور در صورت دورزدن UI، API را با همان سشن weak-password باز می‌گذارد (نباید enforcement سمت سرور باشد؟).
- نبود تست واحد برای منطق کسب‌وکار کلاینت؛ دو اسکریپت تست دستی (smoke/credential-repair) بدون test runner/CI.
- TypeScript lint فقط `tsc --noEmit`؛ هیچ ESLint/Prettier ندارید؛ `any` فراوان (state.profiles: any[]).
- `package.json`: نام react-example، بدون script تست، بدون engines، `canvas-confetti/html2pdf/docx/qrcode.react` همه client-side bundle سنگین (Three.js + docx + html2pdf) → LCP landing page؛ lazy-loading/kod-splitting ناقص (vite.config را بررسی کن).
- `index.html` 6KB inline meta/JSON-LD — SEO oke ولی محتوای demo («AI Studio») باقی مانده؟ بررسی کن.
- `metadata.json` و assets تصاویر ~8MB در src (logo.jpg 696KB در root public هم هست) — بهینه‌سازی تصویر/WebP انجام نشده.
- i18n: `src/utils/i18n.ts` — بررسی کن همه متن‌ها coverage دارند و اعداد فارسی/انگلیسی در فرم‌ها/PDFها یکدست‌اند.
- PDF/DOCX generation سمت کلاینت (html2pdf/print) — فونت فارسی، RTL، page-break، و صحت عدد/ریال/تومان را دقیق چک کن (اشتباه واحد پول در financial endpoints: IRR/Toman مخلوط در prompt).
- `financial-summary` با `totalIncome - totalExpense` اگر NaN باشد رشته `NaN` به AI می‌رود؛ هیچ type coercion/validation روی اعداد نیست.
- زمان‌بندی (تأییدشده): `labDbServer.ts:84` — `Number(process.env.SESSION_TTL_HOURS || 7*24)`؛ اگر env مقدار نامعتبر مثل 'abc' داشته باشد → `SESSION_TTL_MS = NaN` → همه توکن‌ها `exp: NaN` و عملاً نامعتبر/بدون انقضا (باید clamp شود). همین الگو در PORT درست پیاده شده ولی اینجا نه.
- `restoreNamedBackup` regex文件名 guard خوب است؛ اما `restoreFromBackup`/`sync` هر JSON با profiles آرایه را می‌پذیرد (seed مجدد هش‌های قدیمی/placeholder).
- `getDatabaseState()` در GET /api/lab-data بدون auth نرخ‌گیری ندارد و کل state را serialize می‌کند → دامپ آسان داده عمومی‌شده.
- npm scripts: `dev` عملاً prod-ish نیست؛ build هم vite هم esbuild؛ عدم شفافیت کدام env در کدام حالت.
- ecosystem: logs در `logs/` تعریف ولی پوشه ساخته نمی‌شود؟ max_memory_restart 400M با کش کل DB در RAM پر خطر؛ restart = قطع SSE همه کاربران و از دست رفتن pendingOtp/activeSessions (کاربران mid-login می‌افتند).
- nginx: `proxy_read_timeout 24h` برای events خوب؛ ولی upgrade header در /api (SSE لازم ندارد، websocket نیست) بی‌ضرر؛ gzip on json; cache-control برای index.html ست نشده (risk stale SPA after deploy — hashed assets ok, اما index.html باید no-cache باشد); `client_max_body_size 10m` > body limit 5mb سرور (ناهماهنگ); upstream بدون next_upstream/health check؛ بدون rate-limit در layer nginx؛ http2 روی listen قدیمی (`listen 443 ssl http2` deprecated در nginx جدید → `http2 on`).
- SSL paths کامنت‌اند — اگر certbot اجرا نشود، serve روی 443 fail می‌کند و redirect 80 loop می‌سازد (301 به https بدون سرور https!).
- مانیتورینگ/لاگ‌سنترالیزه/APM/null؛ alerting روی disk-full (DB file write اتمی با ENOSYS/ENOSPC فقط console.error و fallback direct write که data loss می‌دهد).
- backup: copyFileSync از DB live — race با rename اتمی (کم ولی ممکن)؛ retention 48×~size؛ بدون restore drill؛ export دستی admin.
- seed/production parity: `initial_seed_data.json` اختیاری؛ اگر seed با admin واقعی merge شود رفتار مبهم.
- دسترس‌پذیری (a11y) و RTL: font/line-height/focus-visible در Tailwind v4؛ contrast رنگ‌های brand؛ بررسی ARIA در modalها (useModalBack هست).
- UX: پیام‌های خطای فارسی/انگلیسی مخلوط در API (some English developer strings like 'collection name and data array are required' directly surfaced to users).
- URL routing: App.tsx state-based views؟ deep-linking و back-button و navigationHistory.ts را بررسی کن.
- PrintCertificate/QR verifier: استعلام گواهی سمت کلاینت روی `reportNo` انجام می‌شود (`CertificateVerifierWidget.tsx`) و چون کل reports تأییدشده از API مهمان در دسترس است، شناسه‌ها قابل حدس/sequential‌اند → ترکیب با مورد افشای داده guest، عملاً IDOR ساختاری.
- Customer portal payments (CustomerPaymentModal) — هیچ پرداخت آنلاین واقعی نیست؛ فقط ثبت manual؛ مغایرت مالی.
- SMS tab (AdminSmsManagementTab) — لاگ SMS در DB؛ بدون gateway.
- Timezones: همه `new Date().toISOString()` سرور UTC/محلی VPS؛ نمایش جلالی سمت کلاینت؛ سازگاری سال تحویل.
- اعداد: `Number(...)||0` پراکنده؛ parseFloat با جداکننده فارسی «٬»؛ round کردن ریال.

**۴) کیفیت کد و نگهداری**
- God-components: AdminDashboard 3715 خط، CustomerPortal 2158، ConcreteLabStorage 1734 — تفکیک کن (feature-slice, hooks, store).
- تکرار logic بین client storage و server (validation، jalali، digits conversion، sanitize) — منبع حقیقت یکی شود.
- کامنت‌های «FIX #1/#1.1/#1.4...» ده‌ها patch روی patch — نشانه debt؛ refactor بنیادی: **API CRUD رکورد-به-رکورد با اعتبارسنجی zod** به‌جای whole-collection sync.
- نبود error boundary، نبود loading/empty states یکنواخت، نبود logging استاندارد سمت کلاینت.
-环境变量: هیچ type-safe env validation (مثل envalid/zod) در startup نیست.
- README/deploy runbook وجود ندارد (فقط کامنت فایل‌ها)؛ onboarding صفر.
- Git hygiene: dist/ و data/ commit شده؛ branchهای multi-PR با نام‌های تصادفی؛ هیچ CI/CD.

### خواسته خروجی
گزارش را با همین دسته‌بندی بده و هرچه می‌توانی با ارجاع فایل/خط مستند کن:
1. **امنیت** (احراز هویت/مجوزها، افشای داده، تزریق، DoS، مدیریت راز، transport،供应链) با CVSS-like severity
2. **معماری و داده** (انتخاب DB، همزمانی، consistency، migration path به Postgres/Supabase واقعی با downtime-less plan)
3. **باگ‌های عملکردی** (هر مورد با repro scenario)
4. **کارایی و مقیاس** (bundle size، TTI landing، payload sync، SSE fan-out، caching، indexها)
5. **قابلیت اعتماد عملیاتی/SRE** (PM2، nginx، backup/restore drill، monitoring، zero-downtime deploy، secrets)
6. **کیفیت کد/تست/DX** (lint، types، test pyramid، CI)
7. **UI/UX و دسترس‌پذیری و i18n/RTL**
8. **سازگاری حقوقی** (PII ایرانی، قانون حفاظت داده، لاگ مالی، حریم‌خصوصی QR public verification)
9. **نقشه راه اصلاح** سه‌فازی: Phase 1 (Critical امنیتی/دیتا-لاس، ≤1 هفته)، Phase 2 (معماری/باگ‌ها، 2-6 هفته)، Phase 3 (مقیاس/DX/a11y)
10. برای ۵ مورد برتر Phase 1، **کد اصلاح آماده** بنویس.

قبل از پاسخ، اگر ابهامی داری لیست سوالاتت را بپرس؛ سپس گزارش کامل را تولید کن. اگر بخشی از موارد بالا نادرست یا منسوخ است، با دلیل رد کن (لطفاً بلوف نزن؛ فقط بر اساس کدی که می‌بینم).

---
---

## پیوست الف — خلاصه یافته‌های من (برای对照 با پاسخ AI)

| # | دسته | یافته | شدت |
|---|------|-------|-----|
| 1 | امنیت | اندپوینت‌های `/api/gemini/*` بدون auth/rate-limit → سوءاستفاده از کلید Gemini + هزینه | Critical |
| 2 | امنیت/داده | `GET /api/lab-data` برای guest بدون لاگین: همه reports تأییدشده، media، اسامی کارکنان | Critical |
| 3 | امنیت | CORS reflect-origin + Allow-Credentials وقتی ALLOWED_ORIGINS خالی است (پیش‌فرض!) | High |
| 4 | امنیت | Rate-limit قابل‌جعل پشت nginx (بدون trust proxy) + in-memory | High |
| 5 | امنیت | تغییر رمز بدون پرسیدن رمز فعلی (self-service) | High |
| 6 | امنیت | Source map سرور (`server.cjs.map`) احتمالاً عمومی سرو می‌شود | Medium |
| 7 | امنیت | PII + شماره مدیر + legacy password در سورس hard-code | Medium |
| 8 | داده | commit بودن `data/laboratory_db.json` + backups در Git | High |
| 9 | داده | عکس base64 در JSON DB → رشد/DoS/قطع sync | High |
| 10 | داده | whole-collection sync + auto-retry = پنجره از‌دست‌رفتن write | High |
| 11 | عملیات | restart PM2 = کشتن OTP/سشن‌ها/SSE همه کاربران | Medium |
| 12 | عملیات | OTP واقعی ارسال نمی‌شود (manual relay از log) | High (فرایندی) |
| 13 | باگ | `localStorage.clear()` در constructor + تناقض sessionStorage/localStorage توکن | Medium |
| 14 | باگ | `SESSION_TTL_HOURS` نامعتبر → NaN | Low |
| 15 | باگ | IDهای collision-prone (`slice(-4)`) | Medium |
| 16 | QA | نبود ESLint/تست خودکار/CI؛ lint=tsc فقط | Medium |
| 17 | معماری | منطق موازی API در vite.config.ts و server.ts | High |
| 18 | معماری | Supabase DDL کد مرده؛ «Layer-2 interface» بدون implementation | Medium |
| 19 | UX | پیام‌های خطای developer-facing انگلیسی به کاربر فارسی | Low |
| 20 | Deploy | ناهماهنگی body-size nginx(10m)/express(5mb)؛ http2 deprecated؛ index.html بدون no-cache | Medium |
