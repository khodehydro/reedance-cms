export function unlockHtml(error = "") {
  const err = error
    ? `<p class="status err">${error.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</p>`
    : "";
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ورود مدیریت کاتالوگ</title>
  <link rel="stylesheet" href="/admin/app.css">
</head>
<body>
  <main>
    <h1>ورود پنل کاتالوگ</h1>
    <p class="banner">Zero Trust لازم نیست. رمز همان مقدار <code>ADMIN_SHARED_SECRET</code> در wrangler است؛ حداقل ۱۶ حرف، بدون فاصلهٔ اضافه.</p>
    ${err}
    <form class="card" method="post" action="/admin/v1/unlock">
      <label>رمز ادمین <input type="password" name="secret" required minlength="16" autocomplete="current-password"></label>
      <button type="submit">ورود</button>
    </form>
  </main>
</body>
</html>`;
}
