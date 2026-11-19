# از صفر تا پنل مدیریت — reedance.ir

دست نزن:

- `reedance.ir` — لندینگ (Workers/Pages)
- `dl.reedance.ir` — هاست دانلود

پنل اینجاست: **`https://admin-catalog.reedance.ir/admin`**

API اندروید جداست: `https://catalog.reedance.ir` (بعد از پنل)

---

## ۱. روی کامپیوتر Node و مخزن

Node ۲۰ یا بالاتر. بعد:

```bash
git clone -b arena/ba1b9c5d-reedance-cms https://github.com/khodehydro/reedance-cms.git
cd reedance-cms
```

## ۲. ورود به همان حساب Cloudflare

```bash
npx wrangler login
```

باید همان حسابی باشد که دامنهٔ `reedance.ir` در آن است.

## ۳. دیتابیس D1

```bash
npx wrangler d1 create reedance-catalog
```

از خروجی `database_id` را کپی کن. در **هر دو** فایل `wrangler.public.toml` و `wrangler.admin.toml` جای `REPLACE_WITH_D1_DATABASE_ID` بگذار.

```bash
npx wrangler d1 migrations apply reedance-catalog --remote --config wrangler.public.toml
```

## ۴. کلید امضای کاتالوگ

```bash
npm run gen:key
```

- `catalogKeyId` → در `wrangler.admin.toml` جای `cat-REPLACE_ME`
- PEM را در چت نگذار. در ترمینال:

```bash
npx wrangler secret put CATALOG_SIGNING_PKCS8 --config wrangler.admin.toml
```

کل بلوک `BEGIN PRIVATE KEY` تا `END` را پیست کن.
- `ed25519PublicKeyBase64url` را برای اندروید ذخیره کن.

## ۵. تیم Zero Trust بساز

Dashboard → **Zero Trust** (یک‌بار Free را فعال کن و نام تیم را بساز).

آدرس تیم می‌شود چیزی مثل `reedance.cloudflareaccess.com`.  
همین را در `wrangler.admin.toml` بگذار:

`ACCESS_TEAM_DOMAIN = "reedance.cloudflareaccess.com"`

`ACCESS_ALLOWED_EMAILS` را ایمیل همان حساب Cloudflare خودت بگذار.

## ۶. اپلیکیشن Access برای پنل

Zero Trust → Access → Applications → Add → **Self-hosted**:

- Application name: `Reedance Catalog Admin`
- Public hostname: `admin-catalog.reedance.ir`
- Path خالی
- Policy: **Allow** → Include → Emails → ایمیل خودت

Save. از صفحهٔ Application مقدار **Application Audience (AUD)** را کپی کن و در toml:

`ACCESS_AUD = "...."`

## ۷. Deploy ورکر ادمین

```bash
npx wrangler deploy --config wrangler.admin.toml
```

این ورکر `workers.dev` عمومی ندارد.

## ۸. دامنهٔ پنل را به ورکر وصل کن

Dashboard → Workers & Pages → **reedance-catalog-admin** → Settings → Domains & Routes → **Add Custom Domain**

دامنه: `admin-catalog.reedance.ir`

رکورد A دستی نساز. به `reedance.ir` و `dl.reedance.ir` وصلش نکن.

## ۹. باز کردن پنل

در مرورگر:

**https://admin-catalog.reedance.ir/admin**

باید صفحهٔ لاگین Cloudflare Access بیاید. با همان ایمیل Allow وارد شو. بعد فرم زبان/آهنگ/Publish ظاهر می‌شود.

اگر `403` دیدی: AUD / تیم / ایمیل را چک کن و دوباره `npx wrangler deploy --config wrangler.admin.toml`.

## ۱۰. بعد از بالا آمدن پنل (API اندروید)

```bash
npx wrangler deploy --config wrangler.public.toml
```

Custom Domain برای `reedance-catalog-public`: `catalog.reedance.ir`

تست: `https://catalog.reedance.ir/v1/languages` باید قبل از Publish مقدار **503** بدهد.
