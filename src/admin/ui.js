export function adminHtml() {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Reedance Catalog Admin</title>
  <link rel="stylesheet" href="/admin/app.css">
</head>
<body>
  <header class="top">
    <div>
      <p class="eyebrow">Cloudflare Free · metadata only</p>
      <h1>مدیریت کاتالوگ ری‌دنس</h1>
    </div>
    <div class="meta" id="state"></div>
  </header>
  <main>
    <p class="banner">این CMS فقط زبان، عنوان، هنرمند و URLهای <code>latest.json</code> / کاور روی <strong>هاست مالک</strong> را نگه می‌دارد. هیچ فایل صوتی، درس، کاور، <code>.rdpack</code> یا کلید بسته اینجا آپلود یا پروکسی نمی‌شود.</p>
    <section>
      <h2>زبان‌ها</h2>
      <form id="language-form" class="card grid">
        <label>code <input name="code" required pattern="[a-z]{2,3}" placeholder="en"></label>
        <label>nameFa <input name="nameFa" required maxlength="128" placeholder="انگلیسی"></label>
        <label>nameEn <input name="nameEn" required maxlength="128" placeholder="English"></label>
        <label>sortOrder <input name="sortOrder" type="number" required value="1"></label>
        <label class="check"><input name="active" type="checkbox"> active</label>
        <button type="submit">ذخیره زبان</button>
      </form>
      <div class="table-wrap"><table id="languages"><thead><tr><th>code</th><th>FA</th><th>EN</th><th>order</th><th>active</th></tr></thead><tbody></tbody></table></div>
    </section>
    <section>
      <h2>آهنگ‌ها</h2>
      <form id="song-form" class="card grid">
        <label>songId <input name="songId" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="80"></label>
        <label>targetLanguage <input name="targetLanguage" required pattern="[a-z]{2,3}"></label>
        <label>title <input name="title" required maxlength="256"></label>
        <label>artist <input name="artist" required maxlength="256"></label>
        <label class="wide">manifestUrl <input name="manifestUrl" required maxlength="2048" placeholder="https://host/path/latest.json"></label>
        <label class="wide">coverUrl <input name="coverUrl" maxlength="2048" placeholder="https://host/art/cover.webp"></label>
        <label>level <select name="level"><option value=""></option><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option></select></label>
        <label>durationMs <input name="durationMs" type="number" min="1" max="86400000"></label>
        <label>sortOrder <input name="sortOrder" type="number" required value="1"></label>
        <label class="check"><input name="visible" type="checkbox"> visible</label>
        <button type="submit">ذخیره آهنگ</button>
      </form>
      <div class="table-wrap"><table id="songs"><thead><tr><th>id</th><th>lang</th><th>title</th><th>visible</th></tr></thead><tbody></tbody></table></div>
    </section>
    <section>
      <h2>پیش‌نمایش و انتشار</h2>
      <pre id="preview" class="card"></pre>
      <form id="publish-form" class="card">
        <label class="check">
          <input name="confirmHostFilesVerified" type="checkbox" required>
          تأیید می‌کنم <code>.rdpack</code> و <code>latest.json</code> (و کاور در صورت وجود) روی هاست HTTPS خودم آپلود، هش و امضا شده‌اند و Cloudflare هیچ فایلی ندارد.
        </label>
        <button type="submit">Publish signed catalog</button>
      </form>
      <p id="status" class="status"></p>
    </section>
  </main>
  <script src="/admin/app.js"></script>
</body>
</html>`;
}

export function adminCss() {
  return `:root { --bg:#f4f7fb; --ink:#102033; --muted:#5b6b80; --line:#d7e1ee; --card:#fff; --accent:#1d4f91; --ok:#0f7b4c; }
*{box-sizing:border-box} body{margin:0;font:15px/1.6 ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--ink)}
.top{display:flex;justify-content:space-between;gap:1rem;padding:1.25rem 1.5rem;background:#102033;color:#fff}
.eyebrow{margin:0;letter-spacing:.08em;text-transform:uppercase;font-size:11px;opacity:.75}
h1{margin:.15rem 0 0;font-size:1.35rem} h2{margin:0 0 .75rem}
main{max-width:1100px;margin:0 auto;padding:1.25rem}
.banner,.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1rem 1.1rem}
.banner{margin-bottom:1rem} section{margin:1.25rem 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.7rem}
.wide{grid-column:1/-1} label{display:flex;flex-direction:column;gap:.25rem;font-size:12px;color:var(--muted)}
input,select,button{font:inherit;padding:.55rem .65rem;border:1px solid var(--line);border-radius:10px}
button{background:var(--accent);color:#fff;border:0;cursor:pointer;font-weight:600}
.check{flex-direction:row;align-items:center;gap:.5rem}
.table-wrap{overflow:auto;margin-top:.75rem}
table{width:100%;border-collapse:collapse;background:var(--card)}
th,td{border-bottom:1px solid var(--line);padding:.45rem .5rem;text-align:start;font-size:13px}
.meta{font-size:12px;opacity:.9} pre{white-space:pre-wrap;word-break:break-word;min-height:6rem}
.status{min-height:1.5rem;color:var(--ok)} .err{color:#9f1239}`;
}

export function adminAppJs() {
  return `const status = document.getElementById("status");
let csrf = "";
let draftRevision = 0;
function show(ok, text){ status.className = "status" + (ok ? "" : " err"); status.textContent = text; }
async function api(path, options={}){
  const headers = Object.assign({"accept":"application/json"}, options.headers||{});
  if (options.body){ headers["content-type"]="application/json"; headers["x-csrf-token"]=csrf; }
  const res = await fetch(path, Object.assign({}, options, { headers, credentials:"same-origin" }));
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!res.ok) throw new Error(data.message || data.error || res.statusText);
  return data;
}
function fillTable(id, rows, cols){
  const tb = document.querySelector("#"+id+" tbody");
  tb.replaceChildren();
  for (const row of rows){
    const tr = document.createElement("tr");
    for (const col of cols){
      const td = document.createElement("td");
      td.textContent = String(row[col] ?? "");
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
}
async function refresh(){
  const [state, languages, songs, preview] = await Promise.all([
    api("/admin/v1/state"), api("/admin/v1/languages"), api("/admin/v1/songs"), api("/admin/v1/preview")
  ]);
  draftRevision = state.draftRevision;
  document.getElementById("state").textContent = "draft " + state.draftRevision + " · published " + state.publishedRevision + " · " + state.catalogKeyId;
  fillTable("languages", languages.languages, ["code","nameFa","nameEn","sortOrder","active"]);
  fillTable("songs", songs.songs, ["songId","targetLanguage","title","visible"]);
  document.getElementById("preview").textContent = JSON.stringify(preview, null, 2);
}
function formPayload(form){
  const data = new FormData(form);
  const obj = {};
  for (const [k,v] of data.entries()) obj[k]=v;
  if ("active" in obj || form.active) obj.active = form.active.checked;
  if ("visible" in obj || form.visible) obj.visible = form.visible.checked;
  if (obj.sortOrder) obj.sortOrder = Number(obj.sortOrder);
  if (obj.durationMs) obj.durationMs = Number(obj.durationMs); else delete obj.durationMs;
  if (!obj.coverUrl) delete obj.coverUrl;
  if (!obj.level) delete obj.level;
  return obj;
}
document.getElementById("language-form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  try {
    const body = formPayload(e.target);
    await api("/admin/v1/languages/"+body.code, { method:"PUT", body: JSON.stringify(body) });
    show(true, "زبان ذخیره شد"); await refresh();
  } catch (err) { show(false, err.message); }
});
document.getElementById("song-form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  try {
    const body = formPayload(e.target);
    await api("/admin/v1/songs/"+body.songId, { method:"PUT", body: JSON.stringify(body) });
    show(true, "آهنگ ذخیره شد"); await refresh();
  } catch (err) { show(false, err.message); }
});
document.getElementById("publish-form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  try {
    const result = await api("/admin/v1/publish", {
      method:"POST",
      headers: { "if-match": '"draft-revision-'+draftRevision+'"' },
      body: JSON.stringify({ draftRevision, confirmHostFilesVerified: e.target.confirmHostFilesVerified.checked })
    });
    show(true, "منتشر شد · revision " + result.publishedRevision); await refresh();
  } catch (err) { show(false, err.message); }
});
(async ()=>{
  try {
    const boot = await api("/admin/v1/csrf");
    csrf = boot.csrfToken;
    await refresh();
  } catch (err) { show(false, err.message); }
})();`;
}
