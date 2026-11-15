# استقرار CMS روی Cloudflare Free

این مخزن **سرویس production را deploy نمی‌کند**. دامنه، `database_id`، کلید Ed25519 کاتالوگ و هویت Access را فقط مالک از حساب خودش می‌گیرد و در چت/Git نمی‌گذارد.

```text
مالک → هاست شخصی: .rdpack + latest.json + cover
مالک → Cloudflare Access → Admin Worker (فرم/preview/publish)
                              ↓ D1 Free: draft metadata + signed snapshots
Android → Public Worker GET /v1/languages و /v1/languages/{code}/songs
Android ──────────────────────→ هاست شخصی (نه Cloudflare): latest.json → .rdpack
```

## ۱. حساب و محصولات رایگان

در [Cloudflare Dashboard](https://dash.cloudflare.com) با یک دامنهٔ **zone فعال**:

1. **Workers Free** — دو Worker جدا: `reedance-catalog-public` و `reedance-catalog-admin`
2. **D1 Free** — یک دیتابیس `reedance-catalog`
3. **Zero Trust / Access Free** — حداکثر ۵۰ کاربر؛ برای این CMS یک مدیر کافی است

R2، Images، KV، Pages، Supabase، Workers Paid لازم نیستند و نباید برای فایل بسته استفاده شوند.

ساب‌دامنه‌های پیشنهادی (zone باید روی Cloudflare باشد):

| نقش | مثال | Worker |
| --- | --- | --- |
| API عمومی | `catalog.example.com` | public |
| پنل مدیریت | `admin-catalog.example.com` | admin + Access روی کل دامنه |

دامنهٔ هاست فایل (`.rdpack` / `latest.json`) **خارج از این Workerها** می‌ماند و نباید پروکسی دانلود فایل به این Workerها باشد.

`workers.dev` برای تست public مجاز است. برای admin در `wrangler.admin.toml` مقدار `workers_dev = false` است؛ **به‌تنهایی preview/version URL را نمی‌بندد** — آن‌ها را هم با Access بپوشان یا غیرفعال کن.

## ۲. ساخت D1 و جایگزینی شناسه

از ریشهٔ همین مخزن:

```bash
npx wrangler d1 create reedance-catalog
```

خروجی یک `database_id` می‌دهد. همان را در **هر دو** فایل `wrangler.public.toml` و `wrangler.admin.toml` به‌جای `REPLACE_WITH_D1_DATABASE_ID` بگذار. این شناسه secret نیست ولی به حساب تو گره خورده.

Migration:

```bash
npx wrangler d1 migrations apply reedance-catalog --local --config wrangler.public.toml
npx wrangler d1 migrations apply reedance-catalog --remote --config wrangler.public.toml
```

ابتدا `--local` را با `npm test` و `wrangler dev` بسنج؛ `--remote` فقط پس از backup/آگاهی.

## ۳. کلید کاتالوگ (جدا از کلید Windows)

روی یک سیستم امن، **نه** روی لپ‌تاپ روزمرهٔ پر از chat log:

```bash
npm run gen:key
```

- PEM را با `npx wrangler secret put CATALOG_SIGNING_PKCS8 --config wrangler.admin.toml` بگذار.
- `catalogKeyId` را در `wrangler.admin.toml` → `CATALOG_KEY_ID` بگذار (`cat-` + حروف کوچک).
- `ed25519PublicKeyBase64url` را از کانال مستقل به بیلد Android بده (pin داخل APK).
- هرگز `cat-test-v1` و seed داخل `scripts/generate-catalog-fixture.mjs` را deploy نکن.
- کلید خصوصی `latest.json` (پیشوند `sig-`) را به Cloudflare نده.

Public Worker هیچ secret امضایی ندارد.

## ۴. متغیرهای admin

در `wrangler.admin.toml`:

- `ALLOWED_MANIFEST_HOSTS` / `ALLOWED_COVER_HOSTS` — hostnameهای هاست مالک، جدا از کاتالوگ و جدا از Android pin
- `SUPPORTED_LANGUAGE_CODES` — پیش‌فرض `en,es,ko`؛ `tr` را بدون هماهنگی قرارداد package فعال نکن
- `ADMIN_ORIGIN` — دقیقاً origin پنل، مثلاً `https://admin-catalog.example.com`
- `ACCESS_TEAM_DOMAIN` — مثل `yourteam.cloudflareaccess.com`
- `ACCESS_AUD` — Application Audience از تنظیم Access
- `ACCESS_ALLOWED_EMAILS` — ایمیل مدیر
- `ENVIRONMENT=production`

`.dev.vars` فقط برای لوکال است و gitignore شده.

## ۵. Cloudflare Access روی کل admin

1. Zero Trust → Access → Application → Self-hosted
2. Application domain: `admin-catalog.example.com` (و در صورت وجود `*.workers.dev` مربوط به admin / preview)
3. Policy: Allow فقط هویت مالک (یک ایمیل)
4. Bypass / Everyone را نگذار

بدون Access، admin در production **403 fail-closed** است. هدر دست‌ساز `Cf-Access-Authenticated-User-Email` پذیرفته نمی‌شود؛ JWT با issuer/audience/JWKS و ایمیل allowlist چک می‌شود.

## ۶. Route و Deploy

```bash
npx wrangler deploy --config wrangler.public.toml
npx wrangler deploy --config wrangler.admin.toml
```

در Dashboard برای هر Worker یک Custom Domain / Route بساز:

- `catalog.example.com/*` → public
- `admin-catalog.example.com/*` → admin

تست:

- از اینترنت: `GET https://catalog.example.com/v1/languages` بدون login — قبل از اولین publish باید `503` باشد، بعد از publish envelope امضاشده
- `POST` به public باید `405` باشد
- باز کردن admin بدون Access باید `403` باشد
- با هویت مدیر، فرم زبان/آهنگ دیده شود

## ۷. لوکال

```bash
cp .dev.vars.example .dev.vars
npm run gen:key   # PEM را در .dev.vars بگذار؛ برای تست قرارداد می‌توان از کلید fixture فقط در development استفاده کرد
npx wrangler d1 migrations apply reedance-catalog --local --config wrangler.public.toml
npm run dev:public   # :8787
npm run dev:admin    # :8788 — ALLOW_LOCAL_ADMIN=true فقط در development
npm test
```

`ALLOW_LOCAL_ADMIN=true` در `ENVIRONMENT=production` رد می‌شود.

## ۸. Backup و پایش

```bash
npx wrangler d1 export reedance-catalog --remote --output /secure-path/catalog-$(date -u +%Y%m%d).sql
```

خروجی را **خارج Git** نگه دار، همراه `published_revision`/ETag. کلید PKCS8 را جدا backup کن. restore قدیمی نباید revision دیده‌شدهٔ Android را پایین بیاورد.

Dashboard: Workers requests / D1 row reads-writes. سقف Free در [QUOTA.md](QUOTA.md) است. ارتقای خودکار به Paid نکن.
