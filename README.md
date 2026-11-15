# Reedance CMS — کاتالوگ فراداده روی Cloudflare Free

Workers Free + یک D1 Free + Access Free برای **زبان‌ها و فهرست آهنگ یک زبان**. فایل درس/صوت/کاور/`.rdpack`/`latest.json` اینجا ذخیره، آپلود، پروکسی یا cache نمی‌شود.

قرارداد: [`contracts/catalog/v1`](contracts/catalog/v1/) مطابق [CATALOG_V1](https://github.com/khodehydro/reedance/blob/arena/e6a6294d-reedance/docs/architecture/CATALOG_V1.md). فرمت بستهٔ Windows (`contracts/v1`) دست نخورده است.

**این مخزن سرویس production را روشن نمی‌کند.** دامنه، `database_id` و کلید واقعی را مالک بیرون Git می‌سازد.

## معماری

```text
Admin Worker (Access) ──D1── signed snapshots
Public Worker GET /v1/languages
              GET /v1/languages/{code}/songs
Android ──HTTPS── owner host: latest.json → .rdpack
```

| Worker | مسیر | Auth |
| --- | --- | --- |
| public | فقط دو GET بالا | هیچ |
| admin | `/admin` فرم + `/admin/v1/*` | Cloudflare Access؛ CSRF + Origin |

## توسعه

```bash
npm test
```

بدون وابستگی npm. Node ≥ ۲۰. `npm test` وجود CMS را روی Cloudflare اثبات نمی‌کند.

لوکال Cloudflare:

```bash
cp .dev.vars.example .dev.vars
npm run gen:key
npx wrangler d1 migrations apply reedance-catalog --local --config wrangler.public.toml
npm run dev:public
npm run dev:admin
```

## استقرار

۱. [docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md) — D1، دو Worker، Access، secret، دامنه  
۲. [docs/OWNER_PUBLISH.md](docs/OWNER_PUBLISH.md) — ترتیب pack → latest → ردیف CMS → publish  
۳. [docs/ANDROID_HANDOFF.md](docs/ANDROID_HANDOFF.md) — متن آماده برای ایجنت Android  
۴. [docs/QUOTA.md](docs/QUOTA.md) — سقف Free و خطای 1027

کلید تست `cat-test-v1` و میزبان `example.invalid` در production رد می‌شوند.
