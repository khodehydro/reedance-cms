export function adminHtml() {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#121212">
  <meta name="color-scheme" content="dark">
  <title>داشبورد کاتالوگ · ری‌دنس</title>
  <link rel="stylesheet" href="/admin/app.css">
</head>
<body class="dash">
  <aside class="sidebar">
    <a class="brand" href="/admin">
      <img src="https://reedance.ir/media/reedance_logo.png" width="40" height="40" alt="">
      <span>ری‌دنس</span>
    </a>
    <p class="sidebar-kicker">مدیریت کاتالوگ</p>
    <nav>
      <button type="button" class="nav-btn is-active" data-panel="overview">نمای کلی</button>
      <button type="button" class="nav-btn" data-panel="languages">زبان‌ها</button>
      <button type="button" class="nav-btn" data-panel="songs">آهنگ‌ها</button>
      <button type="button" class="nav-btn" data-panel="publish">انتشار</button>
    </nav>
    <div class="sidebar-meta">
      <span class="pill"><span class="status-dot"></span> فقط فراداده</span>
      <p id="sidebar-revisions">draft — · published —</p>
      <p id="sidebar-key">key —</p>
    </div>
  </aside>
  <div class="stage">
    <header class="topbar">
      <div>
        <h1 id="page-title">نمای کلی</h1>
        <p class="muted" id="page-sub">زبان، عنوان و لینک هاست مالک — بدون فایل روی Cloudflare</p>
      </div>
      <p id="toast" class="toast" hidden></p>
    </header>
    <main>
      <section class="panel is-active" id="panel-overview">
        <div class="stats" id="stats"></div>
        <article class="card note">
          <span class="eyebrow"><span class="status-dot"></span> مرز انتشار</span>
          <h2>فایل روی هاست تو می‌ماند.</h2>
          <p>اول <code>.rdpack</code> را روی <strong>dl.reedance.ir</strong> بگذار، بعد <code>latest.json</code>، بعد اینجا Publish. Worker هیچ صوت، درس یا کاوری ذخیره نمی‌کند.</p>
        </article>
      </section>

      <section class="panel" id="panel-languages">
        <div class="split">
          <article class="card">
            <div class="card-head"><h2>فهرست زبان‌ها</h2><p class="muted">برای ویرایش روی ردیف بزن</p></div>
            <div class="table-wrap"><table id="languages"><thead><tr><th>کد</th><th>فارسی</th><th>English</th><th>ترتیب</th><th>وضعیت</th></tr></thead><tbody></tbody></table></div>
          </article>
          <form id="language-form" class="card form-card">
            <h2>افزودن / ویرایش زبان</h2>
            <label>کد <input name="code" required pattern="[a-z]{2,3}" placeholder="en"></label>
            <label>نام فارسی <input name="nameFa" required maxlength="128" placeholder="انگلیسی"></label>
            <label>نام انگلیسی <input name="nameEn" required maxlength="128" placeholder="English"></label>
            <label>ترتیب <input name="sortOrder" type="number" required value="1"></label>
            <label class="check"><input name="active" type="checkbox"> فعال در فهرست عمومی</label>
            <button class="button button-primary" type="submit">ذخیره زبان</button>
          </form>
        </div>
      </section>

      <section class="panel" id="panel-songs">
        <div class="split">
          <article class="card">
            <div class="card-head"><h2>آهنگ‌های پیش‌نویس</h2><p class="muted">URL باید روی dl.reedance.ir باشد</p></div>
            <div class="table-wrap"><table id="songs"><thead><tr><th>شناسه</th><th>زبان</th><th>عنوان</th><th>هنرمند</th><th>نمایش</th></tr></thead><tbody></tbody></table></div>
          </article>
          <form id="song-form" class="card form-card">
            <h2>افزودن / ویرایش آهنگ</h2>
            <label>songId <input name="songId" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="80"></label>
            <label>زبان مقصد <input name="targetLanguage" required pattern="[a-z]{2,3}" placeholder="en"></label>
            <label>عنوان <input name="title" required maxlength="256"></label>
            <label>هنرمند <input name="artist" required maxlength="256"></label>
            <label class="wide">manifestUrl <input name="manifestUrl" required maxlength="2048" placeholder="https://dl.reedance.ir/.../latest.json"></label>
            <label class="wide">coverUrl <input name="coverUrl" maxlength="2048" placeholder="https://dl.reedance.ir/art/cover.webp"></label>
            <div class="row2">
              <label>سطح <select name="level"><option value=""></option><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option></select></label>
              <label>مدت (ms) <input name="durationMs" type="number" min="1" max="86400000"></label>
            </div>
            <label>ترتیب <input name="sortOrder" type="number" required value="1"></label>
            <label class="check"><input name="visible" type="checkbox"> نمایش در کاتالوگ</label>
            <button class="button button-primary" type="submit">ذخیره آهنگ</button>
          </form>
        </div>
      </section>

      <section class="panel" id="panel-publish">
        <article class="card">
          <div class="card-head"><h2>پیش‌نمایش تغییرات</h2><p class="muted">تا Publish، اندروید snapshot قبلی را می‌بیند</p></div>
          <div id="preview" class="diff"></div>
        </article>
        <form id="publish-form" class="card publish-card">
          <label class="check">
            <input name="confirmHostFilesVerified" type="checkbox" required>
            تأیید می‌کنم <code>.rdpack</code> و <code>latest.json</code> روی هاست HTTPS خودم آپلود و خارج از Cloudflare بررسی شده‌اند.
          </label>
          <button class="button button-primary" type="submit">انتشار کاتالوگ امضاشده</button>
        </form>
      </section>
    </main>
  </div>
  <script src="/admin/app.js"></script>
</body>
</html>`;
}

export function adminCss() {
  return `:root{
  font-family:Vazirmatn,Tahoma,sans-serif;
  color-scheme:dark;
  --background:#121212;--ink:#f5f5f5;--muted:#b3b3b3;--accent:#9bc4ff;--on-accent:#121212;
  --surface:#1c1c1c;--surface-low:#181818;--surface-high:#282828;--surface-bright:#363636;
  --line:#393939;--outline:#737373;--ok:#7ddea0;--err:#ffb4ab;--sidebar:260px;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--background);color:var(--ink);min-height:100%}
button,input,select{font:inherit} button{cursor:pointer}
a{color:inherit;text-decoration:none}
h1,h2,h3,p{margin:0}
code{font-size:.92em;color:var(--accent)}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.dash{display:grid;grid-template-columns:var(--sidebar) minmax(0,1fr);min-height:100vh}
.sidebar{background:var(--surface-low);border-inline-end:1px solid var(--line);padding:22px 18px;display:flex;flex-direction:column;gap:18px}
.brand{display:inline-flex;align-items:center;gap:10px;font-weight:900;font-size:22px}
.brand img{border-radius:12px;width:40px;height:40px;object-fit:cover}
.sidebar-kicker{color:var(--accent);font-size:12px;font-weight:700}
.sidebar nav{display:grid;gap:6px}
.nav-btn{text-align:start;background:transparent;border:1px solid transparent;color:var(--muted);border-radius:12px;padding:11px 12px;font-weight:700}
.nav-btn:hover,.nav-btn.is-active{background:var(--surface-high);color:var(--ink);border-color:var(--line)}
.nav-btn.is-active{color:var(--accent)}
.sidebar-meta{margin-top:auto;display:grid;gap:8px;color:var(--muted);font-size:12px}
.pill,.eyebrow{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:12px;color:var(--accent)}
.pill,.eyebrow{border:1px solid var(--line);background:var(--surface-high);border-radius:999px;padding:5px 10px;width:max-content}
.status-dot{width:7px;height:7px;border-radius:50%;background:var(--accent)}
.stage{min-width:0}
.topbar{display:flex;justify-content:space-between;gap:16px;align-items:end;padding:22px 28px 0;border-bottom:1px solid var(--line);padding-bottom:18px}
.topbar h1{font-size:clamp(26px,3vw,40px);font-weight:900;letter-spacing:-.04em}
.muted,.lede{color:var(--muted);line-height:1.7}
main{padding:22px 28px 40px}
.panel{display:none} .panel.is-active{display:block}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:18px}
.stat b{display:block;font-size:28px;font-weight:900;margin-top:6px}
.stat span{color:var(--muted);font-size:13px;font-weight:700}
.card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:20px}
.card-head{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:14px}
.card h2{font-size:20px;font-weight:900}
.note h2{margin:10px 0 8px;font-size:28px;font-weight:900}
.split{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.8fr);gap:14px;align-items:start}
.form-card,.publish-card{display:grid;gap:11px}
label{display:grid;gap:6px;font-size:12px;color:var(--muted);font-weight:700}
input,select{background:var(--surface-low);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.wide{grid-column:1/-1}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.check{display:flex;align-items:center;gap:8px;flex-direction:row}
.button{display:inline-flex;justify-content:center;align-items:center;gap:8px;min-height:46px;border-radius:13px;padding:0 16px;font-weight:700;border:1px solid transparent}
.button-primary{background:var(--accent);color:var(--on-accent);border:0}
.button-primary:hover{filter:brightness(1.05)}
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}
th,td{padding:10px 8px;border-bottom:1px solid var(--line);text-align:start;font-size:13px}
th{color:var(--muted);font-weight:700}
tbody tr{cursor:pointer}
tbody tr:hover{background:var(--surface-high)}
.badge{display:inline-flex;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700}
.badge-on{background:#1d3b2a;color:var(--ok)}
.badge-off{background:var(--secondary-container,#2a2a2a);color:var(--muted)}
.diff{display:grid;gap:10px}
.diff-block{border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--surface-low)}
.diff-block h3{font-size:13px;color:var(--accent);margin-bottom:8px}
.diff-block li{margin:4px 18px;color:var(--muted)}
.toast{margin:0;padding:8px 12px;border-radius:12px;font-size:13px;font-weight:700;max-width:420px}
.toast.ok{background:#1d3b2a;color:var(--ok)}
.toast.err{background:#3a1d1d;color:var(--err)}
.login-body{min-height:100vh;display:grid;place-items:center;padding:24px}
.login-shell{width:min(440px,100%);display:grid;gap:18px;justify-items:center}
.login-card{width:100%;background:var(--surface);border:1px solid var(--line);border-radius:25px;padding:36px 22px;display:grid;justify-items:center;text-align:center;gap:10px}
.login-card form{width:min(100%,320px);display:grid;gap:12px;margin-top:10px;text-align:start}
.brand-mark{border-radius:16px}
.login-card h1{font-size:32px;font-weight:900}
.credit{color:var(--muted);font-size:12px}
.heart{color:var(--err)}
@media(max-width:900px){
  .dash{grid-template-columns:1fr}
  .sidebar{border-inline-end:0;border-bottom:1px solid var(--line)}
  .sidebar nav{grid-template-columns:repeat(4,minmax(0,1fr))}
  .stats,.split,.row2{grid-template-columns:1fr}
  main,.topbar{padding-inline:16px}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}`;
}

export function adminAppJs() {
  return `const toast = document.getElementById("toast");
const titles = { overview:"نمای کلی", languages:"زبان‌ها", songs:"آهنگ‌ها", publish:"انتشار" };
const subs = {
  overview:"خلاصهٔ پیش‌نویس و نسخهٔ منتشرشده",
  languages:"کد زبان پس از اولین انتشار قفل می‌شود",
  songs:"manifestUrl باید به latest.json روی هاست مالک ختم شود",
  publish:"اندروید تا Publish همان snapshot قبلی را می‌بیند"
};
let csrf = "";
let draftRevision = 0;
let lastLanguages = [];
let lastSongs = [];
function show(ok, text){
  toast.hidden = false;
  toast.className = "toast " + (ok ? "ok" : "err");
  toast.textContent = text;
}
async function api(path, options){
  options = options || {};
  const headers = Object.assign({"accept":"application/json"}, options.headers || {});
  if (options.body){ headers["content-type"]="application/json"; headers["x-csrf-token"]=csrf; }
  const res = await fetch(path, Object.assign({}, options, { headers: headers, credentials:"same-origin" }));
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { message: text }; }
  if (!res.ok) throw new Error(data.message || data.error || res.statusText);
  return data;
}
function badge(on){
  const span = document.createElement("span");
  span.className = "badge " + (on ? "badge-on" : "badge-off");
  span.textContent = on ? "فعال" : "خاموش";
  return span;
}
function fillTable(id, rows, cols){
  const tb = document.querySelector("#"+id+" tbody");
  tb.replaceChildren();
  rows.forEach(function(row){
    const tr = document.createElement("tr");
    cols.forEach(function(col){
      const td = document.createElement("td");
      if (col === "active" || col === "visible") td.appendChild(badge(!!row[col]));
      else td.textContent = String(row[col] ?? "");
      tr.appendChild(td);
    });
    tr.addEventListener("click", function(){ fillForm(id, row); });
    tb.appendChild(tr);
  });
}
function fillForm(kind, row){
  if (kind === "languages") {
    const f = document.getElementById("language-form");
    f.code.value = row.code; f.nameFa.value = row.nameFa; f.nameEn.value = row.nameEn;
    f.sortOrder.value = row.sortOrder; f.active.checked = !!row.active;
    showPanel("languages");
  } else {
    const f = document.getElementById("song-form");
    f.songId.value = row.songId; f.targetLanguage.value = row.targetLanguage;
    f.title.value = row.title; f.artist.value = row.artist;
    f.manifestUrl.value = row.manifestUrl || ""; f.coverUrl.value = row.coverUrl || "";
    f.level.value = row.level || ""; f.durationMs.value = row.durationMs || "";
    f.sortOrder.value = row.sortOrder; f.visible.checked = !!row.visible;
    showPanel("songs");
  }
}
function stat(label, value){
  const el = document.createElement("article");
  el.className = "stat";
  const s = document.createElement("span"); s.textContent = label;
  const b = document.createElement("b"); b.textContent = String(value);
  el.append(s, b); return el;
}
function diffList(title, items, pick){
  const box = document.createElement("div");
  box.className = "diff-block";
  const h = document.createElement("h3"); h.textContent = title;
  const ul = document.createElement("ul");
  if (!items.length) {
    const li = document.createElement("li"); li.textContent = "بدون تغییر"; ul.appendChild(li);
  } else {
    items.forEach(function(item){
      const li = document.createElement("li");
      li.textContent = pick(item);
      ul.appendChild(li);
    });
  }
  box.append(h, ul); return box;
}
function renderPreview(preview){
  const root = document.getElementById("preview");
  root.replaceChildren();
  const L = preview.languages || { added:[], removed:[], edited:[] };
  const S = preview.songs || { added:[], removed:[], edited:[] };
  root.appendChild(diffList("زبان‌های تازه‌فعال", L.added, function(x){ return x.code + " · " + x.nameFa; }));
  root.appendChild(diffList("زبان‌های حذف‌شده از فهرست", L.removed, function(x){ return x.code + " · " + x.nameFa; }));
  root.appendChild(diffList("ویرایش زبان", L.edited, function(x){ return x.id; }));
  root.appendChild(diffList("آهنگ‌های تازه‌نمایان", S.added, function(x){ return x.songId + " · " + x.title; }));
  root.appendChild(diffList("آهنگ‌های پنهان‌شده", S.removed, function(x){ return x.songId + " · " + x.title; }));
  root.appendChild(diffList("ویرایش آهنگ", S.edited, function(x){ return x.id; }));
}
function showPanel(name){
  document.querySelectorAll(".panel").forEach(function(p){ p.classList.toggle("is-active", p.id === "panel-"+name); });
  document.querySelectorAll(".nav-btn").forEach(function(b){ b.classList.toggle("is-active", b.getAttribute("data-panel") === name); });
  document.getElementById("page-title").textContent = titles[name];
  document.getElementById("page-sub").textContent = subs[name];
}
async function refresh(){
  const state = await api("/admin/v1/state");
  const languages = await api("/admin/v1/languages");
  const songs = await api("/admin/v1/songs");
  const preview = await api("/admin/v1/preview");
  draftRevision = state.draftRevision;
  lastLanguages = languages.languages || [];
  lastSongs = songs.songs || [];
  document.getElementById("sidebar-revisions").textContent = "draft " + state.draftRevision + " · published " + state.publishedRevision;
  document.getElementById("sidebar-key").textContent = "key " + (state.catalogKeyId || "—");
  const stats = document.getElementById("stats");
  stats.replaceChildren(
    stat("پیش‌نویس", state.draftRevision),
    stat("منتشرشده", state.publishedRevision),
    stat("زبان‌ها", lastLanguages.length),
    stat("آهنگ‌ها", lastSongs.length)
  );
  fillTable("languages", lastLanguages, ["code","nameFa","nameEn","sortOrder","active"]);
  fillTable("songs", lastSongs, ["songId","targetLanguage","title","artist","visible"]);
  renderPreview(preview);
}
function formPayload(form){
  const data = new FormData(form);
  const obj = {};
  data.forEach(function(v,k){ obj[k]=v; });
  if (form.active) obj.active = form.active.checked;
  if (form.visible) obj.visible = form.visible.checked;
  if (obj.sortOrder) obj.sortOrder = Number(obj.sortOrder);
  if (obj.durationMs) obj.durationMs = Number(obj.durationMs); else delete obj.durationMs;
  if (!obj.coverUrl) delete obj.coverUrl;
  if (!obj.level) delete obj.level;
  return obj;
}
document.querySelectorAll(".nav-btn").forEach(function(btn){
  btn.addEventListener("click", function(){ showPanel(btn.getAttribute("data-panel")); });
});
document.getElementById("language-form").addEventListener("submit", async function(e){
  e.preventDefault();
  try {
    const body = formPayload(e.target);
    await api("/admin/v1/languages/"+body.code, { method:"PUT", body: JSON.stringify(body) });
    show(true, "زبان ذخیره شد"); await refresh();
  } catch (err) { show(false, err.message); }
});
document.getElementById("song-form").addEventListener("submit", async function(e){
  e.preventDefault();
  try {
    const body = formPayload(e.target);
    await api("/admin/v1/songs/"+body.songId, { method:"PUT", body: JSON.stringify(body) });
    show(true, "آهنگ ذخیره شد"); await refresh();
  } catch (err) { show(false, err.message); }
});
document.getElementById("publish-form").addEventListener("submit", async function(e){
  e.preventDefault();
  try {
    const result = await api("/admin/v1/publish", {
      method:"POST",
      headers: { "if-match": '"draft-revision-'+draftRevision+'"' },
      body: JSON.stringify({ draftRevision: draftRevision, confirmHostFilesVerified: e.target.confirmHostFilesVerified.checked })
    });
    show(true, "منتشر شد · revision " + result.publishedRevision); await refresh();
  } catch (err) { show(false, err.message); }
});
(async function(){
  try {
    const boot = await api("/admin/v1/csrf");
    csrf = boot.csrfToken;
    await refresh();
  } catch (err) { show(false, err.message); }
})();`;
}
