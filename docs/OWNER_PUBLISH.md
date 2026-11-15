# راهنمای انتشار برای مالک

Cloudflare **هاست فایل نیست**. ترتیب الزامی:

1. در Windows، `.rdpack` immutable و `latest.json` امضاشده بساز (کلید `sig-`، نه کلید کاتالوگ).
2. روی هاست HTTPS خودت **اول pack** را آپلود کن و اندازه/SHA-256 را از همان URL بسنج.
3. بعد `latest.json` را در مسیر ثابت بگذار و امضا/شناسه را بیرون Cloudflare چک کن.
4. کاور عمومی اختیاری را جدا روی همان هاست/هاست تصویریِ ازپیش‌مجاز بگذار.
5. در admin CMS فقط این فیلدها را پر کن:
   - زبان: `code, nameFa, nameEn, sortOrder, active`
   - آهنگ: `songId, targetLanguage, title, artist, manifestUrl, coverUrl?, level?, durationMs?, sortOrder, visible`
6. Preview را ببین. تیک «فایل‌ها روی هاست خودم تأیید شده‌اند» را بزن و Publish کن.

Worker هیچ `HEAD`/`GET` به هاست محتوا نمی‌زند و فایل قبول نمی‌کند.

## قواعد پایدار

- بعد از **اولین publish**، `code` و `songId` و `targetLanguage` و `manifestUrl` قفل‌اند.
- برای آپدیت همان آهنگ: نسخهٔ بالاتر pack را روی هاست بگذار، `latest.json` همان URL را عوض کن. ردیف CMS لازم نیست عوض شود.
- برای آهنگ تازه: ردیف جدید + publish. Android بدون APK جدید، پس از refresh/TTL حداکثر ۵ دقیقه، کارت را می‌بیند — اگر زبان/کلید/schema از قبل پشتیبانی شود.
- حذف از فهرست = `visible=0` یا `active=0` و publish دوباره. پیشرفت/بستهٔ نصب‌شده پاک نمی‌شود.
- `example.invalid` و `cat-test-v1` فقط تست‌اند.

## URL مجاز

- HTTPS، بدون userinfo/query/fragment/port/IP
- path فقط segmentهای `[A-Za-z0-9._~-]+`
- manifest به `/latest.json` ختم شود
- cover به `.jpg` / `.png` / `.webp`
- hostname باید در allowlist Worker **و** APK باشد؛ از خود کاتالوگ خوانده نمی‌شود
