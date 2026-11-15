# دستور کار ایجنت Android — اتصال به کاتالوگ Cloudflare

این متن را **کامل** به ایجنت مخزن [`khodehydro/reedance-android`](https://github.com/khodehydro/reedance-android/tree/arena/f7c293e1-reedance-android) بده. CMS در [`khodehydro/reedance-cms`](https://github.com/khodehydro/reedance-cms) پیاده شده است. قرارداد هنجاری از [`khodehydro/reedance` شاخهٔ `arena/e6a6294d-reedance`](https://github.com/khodehydro/reedance/tree/arena/e6a6294d-reedance): `docs/architecture/CATALOG_V1.md`, `ANDROID_AGENT.md`, `contracts/catalog/v1/`.

---

> در مخزن بومیِ موجود `khodehydro/reedance-android` کار کن؛ پروژه را از صفر نساز. CMS Cloudflare **فقط فرادادهٔ امضاشده** می‌دهد. فایل `.rdpack` / `latest.json` / کاور را مستقیم از **هاست مالک** بگیر، نه از Worker.
>
> ## مبدأ قرارداد و CMS
>
> - Schema و fixture: کپی در CMS `contracts/catalog/v1/` و اصل در reedance `contracts/catalog/v1/`.
> - Public Worker (GET-only، بدون auth):
>   - `GET {CATALOG_BASE}/v1/languages` → envelope `kind=languages`
>   - `GET {CATALOG_BASE}/v1/languages/{code}/songs` → envelope `kind=songs` فقط همان زبان
> - `{code}` = `^[a-z]{2,3}$`، یک segment. Query/pagination/POST/PUT/DELETE نیست. سقف ۱۰۰ آهنگ در زبان، ۳۲ زبان، envelope ≤۱۹۲KiB، payload decoded ≤۱۲۸KiB.
> - قبل از اولین publish سرور `503` می‌دهد نه فهرست خالی. زبانِ منتشر/فعال‌نشده `404`. زبان فعال بدون آهنگ **آرایهٔ خالی امضاشده** است.
> - `Content-Type: application/json; charset=utf-8`
> - `ETag: "sha256-<hex of envelope response bytes>"`
> - `Cache-Control: public, max-age=60, s-maxage=300, must-revalidate`
> - `Cache-Control: no-cache` روی درخواست دستی = Worker از D1 می‌خواند (نه فقط لبه).
> - Worker هرگز pack/cover/lesson را پروکسی نمی‌کند. `coverUrl` یک URL است.
>
> `CATALOG_BASE` را حدس نزن. مالک بعد از deploy دامنهٔ واقعی (`https://catalog.<دامنه>`) را جدا می‌دهد. `example.invalid` و `workers.dev` را در **release** pin نکن.
>
> ## امضا — قبل از parse payload
>
> Envelope فقط سه کلید: `catalogKeyId`, `payload`, `signature` (additionalProperties ممنوع).
>
> ```
> payloadBytes = Base64URL-decode(payload)   // بدون padding، canonical
> signature    = Base64URL-decode(signature) // دقیقاً ۶۴ بایت
> message      = UTF8("REEDANCE-CATALOG-V1\n") || UTF8(catalogKeyId) || UTF8("\n") || payloadBytes
> Ed25519.verify(pinnedPublicRaw32, signature, message)
> ```
>
> - `catalogKeyId` الگوی `^cat-[a-z0-9-]+$`، جدا از `signatureKeyId` بسته (`sig-`).
> - Public key raw32 را در APK pin کن؛ از شبکه/CMS دانلود نکن.
> - `cat-test-v1` + `ed25519PublicKeyBase64url` در `contracts/catalog/v1/fixtures/public-key.test.json` **فقط test/debug**. Release اگر keyId تست یا URL `.invalid` باشد باید fail شود.
> - UTF-8 strict بدون BOM، JSON بدون duplicate key / NaN / field ناشناخته. Schema به‌تنهایی کافی نیست.
>
> Payload زبان‌ها: `catalogVersion=1`, `kind=languages`, `revision`, `publishedAt`, `languages[{code,nameFa,nameEn}]` — **بدون `songs`**.
> Payload آهنگ‌ها: `kind=songs`, `language` برابر path, `songs[{songId,targetLanguage,title,artist,manifestUrl, coverUrl?, level?, durationMs?}]`.
> `targetLanguage == language == path`. `songId` سراسری یکتا. URLها HTTPS canonical، host از **allowlist داخل APK** (نه از کاتالوگ)، بدون userinfo/query/fragment/port/IP، path segmentهای `[A-Za-z0-9._~-]+`, manifest با basename `latest.json`, cover `.jpg|.png|.webp`.
>
> ## ضد rollback و کش آفلاین
>
> برای **هر endpoint جدا** (languages و هر `songs/{code}`) در storage خصوصی پایدار نگه دار: بزرگ‌ترین `revision` معتبر + SHA-256 بایت‌های decoded payload + خود envelope تأییدشده + ETag.
>
> - revision پایین‌تر را رد کن.
> - همان revision با payload متفاوت را رد کن.
> - شبکه/۵۰۳/۱۰۲۷/امضای خراب → آخرین cache **معتبر** + نصب‌های Room + هشدار «فهرست به‌روز نیست». هرگز به `[]` یا `catalog_preview.json` سقوط نکن.
> - ۳۰۴ فقط اگر body محلی از پیش تأییدشده داری؛ وگرنه GET بدون شرط یا خطا.
> - Startup **منتظر شبکه نماند**. زبان‌ها حداکثر روزی یک‌بار / تغییر تنظیمات؛ آهنگ زبان فعلی حداکثر هر ۶ ساعت یا ورود فعال یا دکمهٔ بازخوانی (`no-cache`).
>
> Fixture r1→r2: بعد از publish `new-track`، بدون rebuild APK، کارت تازه فقط در `en` ظاهر شود؛ `es` خالی امضاشده بماند. فایل‌ها: `songs-en-r1-*.test.json`, `songs-en-r2-*.test.json`, `songs-es-r1-*.test.json`, `languages-*.test.json`.
>
> ## اتصال به کد موجود (snapshot بررسی‌شده)
>
> | فایل فعلی | کار |
> | --- | --- |
> | `data/LocalContentRepository.kt` امروز `catalog_preview.json` می‌خواند | `RemoteCatalogRepository`: دو GET بالا، verify، cache پایدار، merge با نصب‌های `VERIFIED`/`LOCAL_PASSWORD` از Room. Preview/bundled فقط legacy/debug |
> | `data/AppModel.kt` کاتالوگ را یک‌بار محلی load می‌کند | startup محلی؛ refresh ناهمگام بر اساس `settings.targetLanguage`؛ Flow خطا/stale |
> | `install/PackInstallWorker.kt` فقط `songId` | URL/زبان را از snapshot امضاشدهٔ persistشده resolve کن، نه از input WorkManager و نه از UI |
> | `install/PackInstaller.kt` از `pack_distribution.json.songs` | config همراه APK فقط: `catalogBaseUrl`, `catalogKeyId`, catalog public raw32, publisher `sig-` public, host allowlist ثابت. `latest.json` و `.rdpack` از هاست مالک با HTTPS/allowlist/redirect همان origin. `PackVerifier.manifest` با expected song/lang. حفظ hash/GCM/`enc-main`/ZIP/schema/نصب اتمیک |
> | `ui/Catalog.kt` CoverImage فقط drawable | `coverUrl` اختیاری مستقیم از هاست مالک با سقف بایت/ابعاد؛ خراب = placeholder، مانع نصب نشود |
> | `data/Settings.kt` زبان‌های `en/es/ko/tr` | UI ∩ index معتبر ∩ `SUPPORTED_TARGET_LANGUAGES`. زبان ناشناخته hide. **`tr` را از CMS publish نکن** تا schema `contracts/v1` (هنوز en/es/ko) و Windows هماهنگ شوند |
>
> مسیر `LOCAL_PASSWORD` را با `VERIFIED` شبکه اشتباه نگیر. AES تست را در APK تزریق نکن. `gulum-2` bundled اثبات شبکه نیست.
>
> ## آنچه CMS نمی‌دهد
>
> Lyric، lesson، صوت، بایت تصویر، URL دارای توکن، کلید AES، `signatureKeyId` بسته، خرید/اشتراک. افزودن آهنگ سازگار برای زبان pin‌شده بدون APK است؛ کلید/زبان/schema تازه ممکن است APK بخواهد.
>
> ## آزمون حداقلی قبل از برداشتن release guard
>
> 1. JVM: verify fixture envelopes، tamper، padded Base64URL، duplicate key، URL tricks، rollback، ۳۰۴ با/بدون cache، 503→cache.
> 2. r1→r2 بدون rebuild.
> 3. آفلاین پس از cache معتبر؛ quota 1027 شبیه‌سازی‌شده.
> 4. نصب واقعی از `latest.json` هاست مالک با کلید `sig-` جدا.
> 5. Gradle/lint/device؛ `docs/RELEASE.md` را بدون کلید/URL واقعی باز نکن.
>
> مرجع CMS: `docs/DEPLOY-CLOUDFLARE.md` در reedance-cms. این اتصال تا وقتی دامنه و public key production pin نشده‌اند **deployشده برای کاربر نهایی نیست**.
