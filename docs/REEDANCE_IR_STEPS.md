# از صفر تا پنل مدیریت — بدون Zero Trust / بدون کارت

`reedance.ir` (لندینگ) و `dl.reedance.ir` (دانلود) را دست نزن.

Cloudflare Zero Trust برای پلن Free هم **کارت بانکی می‌خواهد** (معمولاً شارژ نمی‌کند). لازم نیست. پنل با یک **secret رایگان روی خود ورکر** قفل می‌شود.

آدرس پنل: **https://admin-catalog.reedance.ir/admin**

---

## ۱. مخزن روی کامپیوتر

Node ۲۰+. 

```bash
git clone -b arena/ba1b9c5d-reedance-cms https://github.com/khodehydro/reedance-cms.git
cd reedance-cms
```

## ۲. ورود Cloudflare (بدون Zero Trust)

```bash
npx wrangler login
```

همان حساب دامنه. صفحهٔ Zero Trust / payment را **Cancel** کن و ببند.

## ۳. دیتابیس D1 (رایگان Workers، کارت نمی‌خواهد)

```bash
npx wrangler d1 create reedance-catalog
```

`database_id` را در **هر دو** `wrangler.public.toml` و `wrangler.admin.toml` جای `REPLACE_WITH_D1_DATABASE_ID` بگذار.

```bash
npx wrangler d1 migrations apply reedance-catalog --remote --config wrangler.public.toml
```

## ۴. دو secret (در چت نفرست)

```bash
npm run gen:key
```

`catalogKeyId` را در `wrangler.admin.toml` جای `cat-REPLACE_ME`.

```bash
npx wrangler secret put CATALOG_SIGNING_PKCS8 --config wrangler.admin.toml
```

PEM کلید را پیست کن.

بعد یک رمز بلند (حداقل ۱۶ حرف) برای ورود پنل انتخاب کن و:

```bash
npx wrangler secret put ADMIN_SHARED_SECRET --config wrangler.admin.toml
```

`ACCESS_*` را خالی/REPLACE بگذار. Zero Trust نساز.

## ۵. Deploy ادمین

```bash
npx wrangler deploy --config wrangler.admin.toml
```

## ۶. دامنهٔ پنل — بدون رکورد A

Workers & Pages → **reedance-catalog-admin** → Custom Domain → `admin-catalog.reedance.ir`

به لندینگ و `dl` وصلش نکن.

## ۷. باز کردن پنل

https://admin-catalog.reedance.ir/admin

رمز همان `ADMIN_SHARED_SECRET` است. بعد فرم زبان/آهنگ/Publish می‌آید.

## ۸. API اندروید (بعد از پنل)

```bash
npx wrangler deploy --config wrangler.public.toml
```

Custom Domain: `catalog.reedance.ir`  
تست: `https://catalog.reedance.ir/v1/languages` → قبل از Publish باید **503** باشد.
