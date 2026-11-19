export function unlockHtml(error = "") {
  const err = error
    ? `<p class="toast err" role="alert">${error.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</p>`
    : "";
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#121212">
  <meta name="color-scheme" content="dark">
  <title>ورود · ری‌دنس</title>
  <link rel="stylesheet" href="/admin/app.css">
</head>
<body class="login-body">
  <main class="login-shell">
    <section class="login-card">
      <img class="brand-mark" src="https://reedance.ir/media/reedance_logo.png" width="58" height="58" alt="">
      <span class="eyebrow"><span class="status-dot"></span> پنل کاتالوگ</span>
      <h1>ورود به ری‌دنس</h1>
      <p class="lede">رمز همان <code>ADMIN_SHARED_SECRET</code> است. حداقل ۱۶ حرف، بدون فاصلهٔ اضافه.</p>
      ${err}
      <form method="post" action="/admin/v1/unlock">
        <label>رمز ادمین <input type="password" name="secret" required minlength="16" autocomplete="current-password"></label>
        <button class="button button-primary" type="submit">ورود به داشبورد</button>
      </form>
    </section>
    <p class="credit" lang="en" dir="ltr">developed with <span class="heart">❤️</span> by <strong>HYDRO team</strong></p>
  </main>
</body>
</html>`;
}
