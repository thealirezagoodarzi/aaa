# پرامپت ممیزی — دور سوم (راستی‌آزمایی گزارش AI قبلی، ۲۰۲۶-۰۹-۲۷)

> ورودی این دور = گزارشی که یک هوش مصنوعی دیگر (دور قبل) درباره سامانه آزمایشگاه بتن نوشت.
> من همه بندهای آن گزارش را روی **کد فعلی مخزن** راستی‌آزمایی کردم:
> - حدود نیمی از یافته‌ها **درست و تأییدشده** هستند (با شماره خط در ادامه).
> - چند یافته **منسوخ** شده‌اند (در کد با برچسب SECURITY FIX #2/#4/#5/#6 رفع شده‌اند).
> - چند یافته **نادرست یا اغراق‌آمیز** هستند (ادعاهای کرش 500، CSRF/CORS-bypass، Last-Write-Wins فاجعه‌بار، ابهام کلید توکن).
> متن زیر را از بخش «متن پرامپت» کپی کنید و به AI بعدی بدهید.

---

## متن پرامپت (از اینجا به بعد کپی کنید)

تو یک تیم ارشد «معمار نرم‌افزار + امنیت OWASP + Node/Express + React/Vite + SRE» هستی. مخزن SPA مدیریت آزمایشگاه مرکزی بتن (azmajahanbin.ir) را بررسی می‌کنی. یک گزارش ممیزی قبلی درباره این پروژه نوشته شده که برخی بندهایش منسوخ و برخی نادرست هستند. وظیفه تو سه چیز است:
(1) یافته‌های T را عمیق تحلیل کن و کد اصلاح آماده بده؛ (2) یافته‌های R را چالش کن و نقص‌هایشان را برطرف و تکمیل کن؛ (3) یافته‌های F را صریحاً تأیید یا رد کن — بلوف نزن، فقط کد موجود ملاک است. در پایان نقشه راه Phase 1/2/3 و چک‌لیست hotfix ترتیب‌دار بده.

### معرفی مختصر
- فرانت React 19 + Vite 6 (~۳۶هزار خط TSX)، بک‌اند Express (`server.ts` + `server/labDbMiddleware.ts` + `server/labDbServer.ts`)
- «دیتابیس»: تک‌فایل JSON `data/laboratory_db.json` (کش in-memory، write اتمی tmp+rename، mutex ترتیبی withDbWrite، etag per-collection + 409، بکاپ چرخشی)
- Auth: scrypt + HMAC session token + refresh token + OTP (بدون gateway پیامک)؛ Realtime: SSE؛ AI: `/api/gemini/*`؛ دیپلوی: PM2 fork instances=1 + nginx

### الف) یافته‌های منسوخ — گزارش قبلی این‌ها را به‌غلط «باز» اعلام کرده؛ وضعیت رفع را تأیید/رد کن
1. **Gemini بدون auth/rate-limit:** در `server.ts:85-111` حالا `geminiGuard` (احراز هویت + محدودسازی per-IP) روی هر دو endpoint نشسته — ادعای «هر فرد ناشناس می‌تواند بسوزاند» برای prod درست نیست (ولی ببند بخش T1 را بخوان).
2. **افشای کل reports/media برای مهمان در GET /api/lab-data:** `sanitizeDatabaseState` (`labDbServer.ts:561`، منطق :607-650) برای visitor حداقل‌سازی می‌کند و استعلام گواهی به `POST /api/lab-data/verify-report` تک‌رکوردی + rate-limited (`labDbMiddleware.ts:272`) منتقل شده. ⚠️ اما escape hatch `PUBLIC_FULL_SYNC=1` همان رفتار نشت را برمی‌گرداند — ارزیابی کن حذفش کنیم یا نه.
3. **CORS بازتاب‌محور:** `labDbMiddleware.ts:160-185` — در production با `ALLOWED_ORIGINS` خالی، origin دلخواه + credentials **رد** می‌شود (ادعای «عملاً معادل باز بودن کامل CORS» منسوخ است).
4. **تغییر رمز بدون رمز فعلی:** مسیر update-profile (`labDbMiddleware.ts:717-757`) وجود `currentPassword` را الزام می‌کند.

### ب) یافته‌های تأییدشده (T) — با ارجاع خط راستی‌آزمایی‌شده؛ عمیق تحلیل و کد اصلاح بده
- **T1 (Critical) — دوشاخه‌شدن API میان dev/prod + حفره امنیتی Gemini در vite:** `vite.config.ts:22-160` پلاگین موازی `geminiApiPlugin` دارد که **هیچ geminiGuard/session/rate-limit ندارد** (برخلاف server.ts) و هیچ type-validation هم روی `concreteGrade/slump/...` نمی‌کند (template interpolation مستقیم داخل پرامپت → prompt injection از ورودی). همین plugin روت‌های `/api/lab-data` را هم در dev شخصاً پیاده می‌کند → رفتار dev ≠ prod و drift امنیتی دائمی. راه‌حل مورد انتظار: حذف کامل منطق business از vite.config و استفاده از `server.proxy` به یک سرور واحد.
- **T2 (High) — اجبار تغییر رمز فقط سمت UI:** فلگ `mustChangePassword` از سرور می‌آید (`labDbMiddleware.ts:427,532`) ولی فقط `src/App.tsx:152` آن را gate می‌کند؛ هیچ middleware سروری وجود ندارد که با سشنِ دارای این فلگ، عملیات حساس (sync-collection، update-profile، …) را بلاک کند → با call مستقیم API، حساب با رمز legacy/ضعیف کاملاً قابل استفاده است.
- **T3 (High) — نبود CSP/HSTS/helmet در کل استک:** grep در `server.ts`، `labDbMiddleware.ts`، `deploy/nginx-azmajahanbin.conf` و `index.html`: هیچ `Content-Security-Policy` یا `Strict-Transport-Security` وجود ندارد؛ در حالی که refresh token در `localStorage.lab_refresh_token` است (`ConcreteLabStorage.ts:245-254`) → یک XSS = حساب‌ربایی پایدار (sessionStorage تنها توکن لحظه‌ای را حفظ می‌کند).
- **T4 (High) — PII و رمز پیش‌فرض در سورس و تاریخچه Git:** `LEGACY_DEFAULT_PASSWORD='Ag12258'` hard-code در `server/labDbServer.ts`؛ نام/موبایل مدیر (`09131703177`) در `labDbServer.ts`، `labDbMiddleware.ts`، `src/services/initialData.ts`، `LoginView.tsx`، `Navbar.tsx` و ... تکرار شده؛ `git ls-files data/` تأیید می‌کند `data/laboratory_db.json` و `data/backups/*.json` (حاوی هش رمز، صورتحساب و موبایل مشتریان) **track شده‌اند** و `.gitignore` فقط ۷ کاراکتر است. سناریوی حمله: هر کسی به repo دسترسی پیدا کند، کل داده عملیاتی + رمز legacy را دارد.
- **T5 (Medium) — OTP cleartext در لاگ:** `labDbMiddleware.ts:448` و `:569` کد فعال OTP را با username/phone در console لاگ می‌کنند؛ لاگ PM2 روی VPS معمولاً world-readable است → افشای ثانیه‌ای عامل دوم 2FA.
- **T6 (Medium) — معماری تک‌فایل JSON + media base64:** کل رکوردها و تصاویر آزمون به‌صورت base64 داخل همان JSON؛ هر write = serialize کل state؛ سقف body اکسپرس `5mb` (`server.ts:58`) در برابر `client_max_body_size 10m` nginx (خط ۳۷ کانفیگ) ناهماهنگ → خطاهای 413 و تخریب تدریجی performance.
- **T7 (Medium) — sync کل‌مجموعه client-authoritative:** `persistCollection('profiles', this.state.profiles)` و امثال آن (`ConcreteLabStorage.ts:655,770,792,...`) — هر ویرایش کوچک، کل آرایه را به سرور می‌فرستد؛ etag/409 پنجره را تنگ کرده (بخش R3) ولی الگوی صحیح CRUD رکوردی + zod نیست.
- **T8 (Medium) — تک‌نخی بودن state:** `ecosystem.config.cjs:11` با کامنت صریح instances=1 چون activeSessions/pendingOtp/SSE در RAM هستند؛ `max_memory_restart: '400M'` (:19) یعنی restart محتمل = مرگ همه سشن‌ها و OTPهای معلق. مقیاس افقی غیرممکن.
- **T9 (Medium) — ID collision:** الگوی `usr-/cust-/pay-/rep-/acc-/inv-/cal-${Date.now().toString().slice(-4)}` در `ConcreteLabStorage.ts:779,942,1090,1189,1272,1389,1416,1453,1487` — ۴ رقم آخر timestamp؛ ثبت متوالی سریع یا دو تب همزمان برخورد قطعی تولید می‌کند.
- **T10 (Medium) — `localStorage.clear()` در constructor:** `ConcreteLabStorage.ts:92` هنگام مقدارسازی کلاس، کل localStorage دامنه را پاک می‌کند (و سپس فقط توکن سشن sessionStorage را back-fill می‌کند :91-95) → عارضه جانبی مخرب روی هر ابزار/تب دیگر همان origin؛ در `:136` fallback خواندن `localStorage.getItem('lab_session_token')` هم با کلید واقعی `azma_session_token` (**sessionStorage**، خطوط 91/155/157) متفاوت است — بررسی کن آیا این fallback واقعاً کلید منسوخ قدیمی است یا باگ.
- **T11 (Low-Medium) — واحدهای پولی مبهم در پرامپت Gemini:** `server.ts:185-188` مبالغ را با برچسب «IRR / Toman» به مدل می‌دهد؛ مدل نمی‌تواند تشخیص واحد دهد → خروجی مالی تحریف‌شده. واحد canonical (ریال) + تبدیل display مشخص شود.
- **T12 (Medium) — God components:** `AdminDashboard.tsx` = ۳۷۰۷ خط، `CustomerPortal.tsx` = ۲۱۶۶ خط (تأیید با wc -l)؛ نقض SRP، رندر سنگین، تست‌ناپذیری.
- **T13 (Medium) — QA تقریباً صفر:** بدون ESLint/Prettier/test runner/CI؛ lint = `tsc --noEmit`؛ package name هنوز `react-example`؛ بدون engines و env-validation؛ README/runbook نیست.
- **T14 (Medium) — nginx:** `listen 443 ssl http2` (deprecated در nginx جدید، خطوط ۲۳-۲۴)، مسیرهای ssl کامنت‌شده (۲۸-۲۹)، نبود no-cache برای index.html، نبود rate-limit لایه edge.

### ج) یافته‌های درستِ ناقص یا اغراق‌آمیز (R) — بازبینی و تکمیل کن
- **R1 — Mock SMS:** ادعا می‌کند «در صورت عدم دسترسی مدیر به SSH، ورود متوقف می‌شود». دقیق بررسی کن: OTP از طریق لاگ/console به‌صورت دستی (manual relay) به کاربر می‌رسد؛ خود lockout رخ می‌دهد یا فقط اصطکاک عملیاتی؟ سناریوی بازیابی قفل‌شدن admin را طراحی کن (break-glass).
- **R2 — تزریق پارامتر نامعتبر = کرش 500 اکسپرس:** صریحاً تأیید/رد کن. `(concreteGrade || 'C25').replace(...)` روی رشته کار می‌کند؛ اگر آبجکت/عدد ارسال شود چه؟ در هر دو پیاده‌سازی (`server.ts` و `vite.config.ts`) try/catch فراگیر وجود دارد؟ خطای 500 با stacktrace نشت می‌کند؟
- **R3 — «Auto-retry روی 409 فاجعه‌بار last-write-wins است»:** `ConcreteLabStorage.ts:594-615` retry پس از 409 اول `fetchFromServer(false)` (reload state مرجع) و سپس merge محلی انجام می‌دهد — ادعای LWW کامل احتمالاً اغراق است. نقاط ضعف واقعی را پیدا کن: race بین reload و retry، نبود عملیات field-level، overwrite همزمان رکوردهای مختلف یک collection.

### د) خواسته خروجی
1. برای هر T1–T14 و R1–R3: تأیید/رد با ارجاع فایل:خط، severity دقیق (CVSS-like)، سناریو بروز.
2. کد اصلاح آماده (diff کامل) برای ۵ اولویت Phase 1: T1 (حذف geminiApiPlugin/one-server)، T2 (middleware اجبار تغییر رمز سروری)، T3 (helmet+CSP+HSTS در express و nginx)، T4 (git-filter-repo برای data/ + چرخش رمز legacy + انتقال PII به env)، T9/T5 (UUID + حذف OTP از لاگ).
3. نقشه راه: Phase 1 امنیت/dیتالاس ≤۱ هفته / Phase 2 مهاجرت به Postgres یا Supabase واقعی (CRUD رکوردی + zod + media object-storage/base64-file) / Phase 3 مقیاس (stateless سشن JWT/JTI در Redis، PM2 cluster، SSE pub/sub)، DX، a11y/RTL.
4. تحلیل حقوقی: PII ایرانی در repo + قانون حفاظت داده؛ سازگاری QR public verification با حریم خصوصی.
5. چک‌لیست hotfix به ترتیب اجرای دستور (با فرمان‌های واقعی shell).

قبل از پاسخ، ابهامات را بپرس؛ سپس گزارش کامل. فقط کد موجود ملاک است.

---

## پیوست — جدول راستی‌آزمایی دستی گزارش AI قبلی

| بند گزارش قبلی | حکم من | شواهد |
|---|---|---|
| الف-1 Gemini بدون auth/ratelimit | **منسوخ (prod)** / درست برای dev | `server.ts:90-111` geminiGuard ✓ ولی `vite.config.ts:22-160` بدون هیچ گاردی |
| الف-1 کرش 500 با concreteGrade نامعتبر | **نادرست/بی‌شواهد** | try/catch + coerce رشته؛ باید در R2 بازبینی شود |
| الف-2 افشای داده مهمان | **منسوخ** | sanitizeDatabaseState + verify-report تک‌رکوردی؛ ⚠️ PUBLIC_FULL_SYNC |
| الف-3 CORS بازتاب + credentials | **منسوخ در prod** | `labDbMiddleware.ts:160-185` رد صریح |
| الف-4 تغییر رمز بدون رمز فعلی | **منسوخ** | `labDbMiddleware.ts:717-757` |
| الف-5 Ag12258/PII/data در git | **تأیید** | `git ls-files data/` → db + backups track؛ .gitignore ≈ خالی |
| الف-6 OTP mock در console.log | **تأیید** (+ ادعای lockout نیازمند بازبینی) | `labDbMiddleware.ts:448,569` |
| الف-7 توکن در storage + نبود CSP | **تأیید** | `ConcreteLabStorage.ts:245-254`؛ grep CSP → صفر |
| ب-1 JSON تک‌فایل/I/O | **تأیید** | write اتمی کل state |
| ب-2 base64 در DB + 413 | **تأیید** | 5mb express vs 10m nginx |
| ب-3 whole-array + LWW فاجعه‌بار | **نصفه‌درست** | persistCollection کل‌آرایه ✓؛ retry 409 با reload ✓ → اغراق |
| ب-4 PM2 single-instance/in-memory | **تأیید** | ecosystem.config.cjs:11,19 |
| ج-1 دوشاخگی vite/server | **تأیید + تشدید** | فقط drift نیست: حفره امنیتی واقعی در dev |
| ج-2 ID slice(-4) | **تأیید** | ۹ نقطه در ConcreteLabStorage.ts |
| ج-3 localStorage.clear + ابهام کلید | **تأیید (خط ۹۲)** / کلید: دو کلید مجزا (sessionStorage azma_*, legacy lab_* fallback خط ۱۳۶) |
| ج-4 واحد IRR/Toman | **تأیید** | server.ts:185-188 |
| ج-5 God components | **تأیید** | 3707 / 2166 خط (wc -l) |
