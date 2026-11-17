# قدم‌به‌قدم برای reedance.ir

وضعیت فعلی DNS:

- `dl.reedance.ir` → `130.185.79.172` (هاست فایل؛ درست است)
- `reedance.ir` → همان IP (سایت اصلی؛ برای CMS لازم نیست)
- هنوز `catalog` و `admin-catalog` نساز

## ۱. ابر نارنجیِ دانلود را خاموش کن

در همان جدول DNS روی ابر نارنجی **`dl.reedance.ir`** کلیک کن تا **خاکستری / DNS only** شود، بعد Save.

فایل `.rdpack` نباید از پروکسی Cloudflare رد شود. هشدار زرد روی `reedance.ir` را فعلاً نادیده بگیر.

## ۲. HTTPS واقعی روی سرور دانلود

روی همان سرور `130.185.79.172` برای `dl.reedance.ir` گواهی TLS بگذار (مثلاً Let’s Encrypt). بعد در مرورگر باز کن:

`https://dl.reedance.ir`

باید بدون هشدار گواهی باز شود. HTTP کافی نیست؛ اندروید فقط HTTPS می‌پذیرد.

## ۳. مطمئن شو zone فعال است

بالای داشبورد Cloudflare وضعیت `reedance.ir` باید **Active** باشد، نه Pending. اگر هنوز Active نیست، Nameserverهای Cloudflare را در nic.ir ست کن و صبر کن.

## ۴. روی کامپیوتر خودت وارد Cloudflare شو

در پوشهٔ همین مخزن:

```bash
npx wrangler login
```

مرورگر باز می‌شود؛ به همان حسابی که `reedance.ir` را دارد وصل کن.

## ۵. دیتابیس D1 بساز

```bash
npx wrangler d1 create reedance-catalog
```

از خروجی، `database_id` را کپی کن و در **هر دو** فایل بگذار:

- `wrangler.public.toml`
- `wrangler.admin.toml`

جای `REPLACE_WITH_D1_DATABASE_ID`.

بعد:

```bash
npx wrangler d1 migrations apply reedance-catalog --remote --config wrangler.public.toml
```

## ۶. کلید امضای کاتالوگ بساز

```bash
npm run gen:key
```

سه چیز می‌دهد:

1. `catalogKeyId` → در `wrangler.admin.toml` جای `cat-REPLACE_ME`
2. PEM خصوصی → در ترمینال:

```bash
npx wrangler secret put CATALOG_SIGNING_PKCS8 --config wrangler.admin.toml
```

کل PEM را پیست کن. در Git/چت نگذار.

3. `ed25519PublicKeyBase64url` → برای اندروید نگه دار (بعداً در APK pin می‌شود)

## ۷. دو Worker را deploy کن

```bash
npx wrangler deploy --config wrangler.public.toml
npx wrangler deploy --config wrangler.admin.toml
```

## ۸. دامنهٔ سفارشی Worker — بدون رکورد A

در داشبورد **نه** Add record. برو:

Workers & Pages → `reedance-catalog-public` → Settings → Domains & Routes → Add Custom Domain  
→ `catalog.reedance.ir`

Workers & Pages → `reedance-catalog-admin` → Settings → Domains & Routes → Add Custom Domain  
→ `admin-catalog.reedance.ir`

خود Cloudflare رکورد DNS را می‌سازد.

## ۹. Access فقط برای ادمین

Zero Trust → Access → Applications → Add an application → Self-hosted:

- Application domain: `admin-catalog.reedance.ir`
- Policy: Allow فقط ایمیل خودت

از تنظیمات Application این‌ها را بردار:

- Application Audience (**AUD**)
- تیم: چیزی شبیه `xxx.cloudflareaccess.com`

در `wrangler.admin.toml`:

- `ACCESS_TEAM_DOMAIN`
- `ACCESS_AUD`
- `ACCESS_ALLOWED_EMAILS`

دوباره:

```bash
npx wrangler deploy --config wrangler.admin.toml
```

در Access، preview/workers.dev مربوط به admin را هم بپوشان یا غیرفعال کن.

## ۱۰. تست

مرورگر عادی (بدون لاگین):

`https://catalog.reedance.ir/v1/languages`

باید **503** باشد (هنوز publish نشده). اگر HTML سایت یا timeout دیدی، Custom Domain اشتباه وصل شده.

`https://admin-catalog.reedance.ir/admin` باید صفحهٔ لاگین Access باشد، نه فرم باز.

## ۱۱. اولین محتوا

1. `.rdpack` را روی `https://dl.reedance.ir/...` بگذار  
2. بعد `latest.json` را در همان مسیر بگذار  
3. در پنل admin زبان/آهنگ/`manifestUrl` را ثبت کن و Publish بزن  

URL نمونه:

`https://dl.reedance.ir/reedance/en/quiet-step/latest.json`

## ۱۲. اندروید

بعد از publish، به ایجنت اندروید بده:

- `https://catalog.reedance.ir`
- `catalogKeyId`
- public key مرحلهٔ ۶
- allowlist هاست: `dl.reedance.ir`

متن کامل: [ANDROID_HANDOFF.md](ANDROID_HANDOFF.md)
