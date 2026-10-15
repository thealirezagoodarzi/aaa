# آزما بتن پایش خاک و پی جهان بین — سامانه مدیریت آزمایشگاه

اپلیکیشن تک‌صفحه‌ای React/Vite با بک‌اند Express (توسعه: Vite middleware، تولید: `dist/server.cjs` با esbuild) و پایگاهداده فایل JSON روی سرور مرکزی.

## Quick Start (local development) — audit #95 preflight

**الزامات:** Node.js 20–22 (`engines: ">=20 <23"`)، npm 10+.

```bash
npm ci                 # نصب دقیق بر اساس package-lock.json
cp .env.example .env   # سپس مقادیر زیر را پر کنید — خالی بگذارید، کپی نکنید
npm run dev            # http://localhost:3000
```

متغیرهای ضروری در `.env` (همه با مقدار **خالی** در قالب شروع می‌شوند؛ هرگز از مقادیر نمونه/مشترک استفاده نکنید):

| متغیر | چرا / نحوه تولید |
|---|---|
| `SESSION_SECRET` | امضای HMAC سشن. در production بدون آن سرور بالا نمی‌آید. تولید: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_INITIAL_PASSWORD` | رمز اولین ورود مدیر (seed شدن در DB). قوی و یکتا؛ پس از اولین ورود حذفش کنید. |
| `GEMINI_API_KEY` | فقط برای اندپوینت‌های `/api/gemini/*`. از AI Studio بگیرید؛ در صورت عدم نیاز خالی بماند. |
| `ADMIN_BOOTSTRAP_TOKEN` | توکن بازیابی یک‌بارمصرف؛ تولید با همان دستور `randomBytes(32)`، پس از بازیابی حذف شود. |

Seed اولیه: با اولین اجرای سرور، `data/laboratory_db.json` ساخته/مهاجرت می‌شود و حساب admin با `ADMIN_INITIAL_PASSWORD` (اگر ست شده باشد) قابل ورود می‌گردد. اگر ست نشده باشد حساب admin تا ریست out-of-band غیرقابل‌ورود می‌ماند (fail-closed).

**امنیت محیط توسعه:** dev server عمداً فقط روی `localhost` bind می‌شود و `allowedHosts` محدود است (audit #95). برای دسترسی LAN صریحاً `DEV_HOST=0.0.0.0` و در صورت نیاز `DEV_ALLOWED_HOSTS=host1,host2` را در `.env` بگذارید — هرگز در شبکه عمومی/اداری این کار را نکنید.

## Scripts

```bash
npm run lint              # tsc --noEmit روی هر دو پروژه client + server (audit #92/#93)
npm run typecheck:server  # فقط پروژه سرور (tsconfig.server.json)
npm run build             # vite build → dist/ + esbuild → dist/server.cjs
npm start                 # اجرای production: node dist/server.cjs (PORT=3000 پیش‌فرض)
npm run test:credentials  # تست‌های repair اعتبار احراز هویت روی باندل واقعی
npm run format            # prettier روی src/ server/ shared/ (.prettierrc.json)
```

CI (GitHub Actions — `.github/workflows/ci.yml`): `npm ci` → type-check → build → credential tests + `nginx -t` گیت روی کانفیگ استقرار.

## Production deployment

- **VPS + PM2 + nginx:** مراحل کامل در [`deploy/deployment-checklist.md`](deploy/deployment-checklist.md) — شامل تنظیم `TRUST_PROXY=1` و `ALLOWED_ORIGINS` (در `ecosystem.config.cjs` هم declared هستند)، پیکربندی certbot و بررسی `max_memory_restart`.
- **Docker:** `docker build -t azmajahanbin-lab . && docker run -d -p 3000:3000 --env-file .env -v lab-data:/app/data azmajahanbin-lab` (اجرا با کاربر non-root، HEALTHCHECK روی `/api/health`، Node 22 pin شده).

نکات امنیتی:
- `.env` هرگز commit نمی‌شود (git-ignore شده)؛ template بدون secret واقعی است.
- در production سرور بدون `SESSION_SECRET` قوی شروع نمی‌کند.
- rate limiter پشت nginx مستلزم `TRUST_PROXY=1` است، در غیر این صورت IP کلاینت قابل جعل است.
- CORS fail-closed است: تا `ALLOWED_ORIGINS` ست نشود، درخواست‌های cross-origin رد می‌شوند.
