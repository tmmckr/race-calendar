import { firebaseConfig, ADMIN_UID, SITE } from "./firebase-config.js";

/* ============================================================
   Konstanten
   ============================================================ */
const FIREBASE_VERSION = "11.0.2";
const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("DEIN");

const TYPES = {
  "5k":         { label: "5K",            km: 5 },
  "10k":        { label: "10K",           km: 10 },
  "hm":         { label: "Halbmarathon",  km: 21.0975 },
  "marathon":   { label: "Marathon",      km: 42.195 },
  "ultra":      { label: "Ultra",         km: null },
  "trail":      { label: "Trail",         km: null },
  "sprint-tri": { label: "Sprint-Triathlon", km: 25.75 },
  "olympic-tri":{ label: "Olymp. Triathlon", km: 51.5 },
  "ironman703": { label: "Ironman 70.3",  km: 113 },
  "ironman":    { label: "Ironman",       km: 226 },
  "hyrox":      { label: "Hyrox",         km: 8 },
  "other":      { label: "Sonstiges",     km: null },
};

const STATUS_LABEL = { registered: "Angemeldet", wishlist: "Wunschliste", done: "Absolviert" };

const fmtMonth = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
const fmtMonShort = new Intl.DateTimeFormat("de-DE", { month: "short" });
const fmtWeekday = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const fmtLong = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/* ============================================================
   State
   ============================================================ */
const state = {
  events: [],
  filter: "upcoming",
  view: "list",
  calMonth: startOfMonth(today()),
  isAdmin: false,
  editingId: null,
};
let store;

/* ============================================================
   Hilfsfunktionen
   ============================================================ */
const $ = (sel) => document.querySelector(sel);

function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function toISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function daysUntil(s) { return Math.round((parseDate(s) - today()) / 86400000); }
function isPast(s) { return daysUntil(s) < 0; }

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function safeUrl(u) {
  try { const url = new URL(u); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
function km(ev) {
  const n = Number(ev.distance);
  if (n > 0) return n;
  return TYPES[ev.type]?.km ?? null;
}
function fmtKm(n) { return n == null ? "–" : n.toLocaleString("de-DE", { maximumFractionDigits: n < 30 ? 1 : 0 }); }

/** Effektiver Status: angemeldet + Datum vorbei = absolviert */
function effStatus(ev) {
  if (ev.status === "registered" && isPast(ev.date)) return "done";
  return ev.status;
}

function countdownText(s) {
  const d = daysUntil(s);
  if (d === 0) return { big: "Heute", small: "Race Day! 🔥" };
  if (d === 1) return { big: "Morgen", small: "" };
  if (d < 0) return { big: `${-d}`, small: "Tage her" };
  if (d < 70) return { big: `${d}`, small: d === 1 ? "Tag" : "Tage" };
  const w = Math.round(d / 7);
  return { big: `${w}`, small: "Wochen" };
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ============================================================
   Datenspeicher: Demo (localStorage) oder Firebase
   ============================================================ */
function demoStore() {
  const KEY = "race-calendar-demo";
  const listeners = [];
  const y = today().getFullYear();
  const seed = [
    { name: "Halbmarathon Bremen", date: `${y + 1}-03-22`, type: "hm", status: "registered", location: "Bremen", url: "https://example.com", notes: "Ziel: Sub 1:50" },
    { name: "Ironman 70.3 Kraichgau", date: "2027-05-23", type: "ironman703", status: "registered", location: "Kraichgau", url: "https://example.com", notes: "" },
    { name: "Hamburg Marathon", date: `${y + 1}-04-25`, type: "marathon", status: "registered", location: "Hamburg", url: "", notes: "Erster Marathon!" },
    { name: "Berlin Marathon", date: `${y + 1}-09-26`, type: "marathon", status: "wishlist", location: "Berlin", url: "", notes: "Lotterie" },
    { name: "Ironman Hamburg", date: `${y + 2}-06-06`, type: "ironman", status: "wishlist", location: "Hamburg", url: "", notes: "" },
    { name: "Silvesterlauf", date: `${y}-12-31`, type: "10k", status: "registered", location: "", url: "", notes: "" },
    { name: "Stadtlauf", date: `${y}-09-14`, type: "10k", status: "registered", location: "", url: "", result: "47:31", notes: "" },
  ];
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
  if (!Array.isArray(data)) data = seed.map((e, i) => ({ ...e, id: "demo" + i }));
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
    listeners.forEach((cb) => cb([...data]));
  };
  return {
    subscribe(cb) { listeners.push(cb); cb([...data]); },
    async add(ev) { data.push({ ...ev, id: "d" + Date.now() }); save(); },
    async update(id, ev) { data = data.map((e) => (e.id === id ? { ...e, ...ev } : e)); save(); },
    async remove(id) { data = data.filter((e) => e.id !== id); save(); },
    async login() {},
    async logout() {},
    onAuth(cb) { cb({ uid: "demo" }); },
  };
}

async function firebaseStore() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-auth.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  const col = fs.collection(db, "events");

  return {
    subscribe(cb) {
      fs.onSnapshot(
        fs.query(col, fs.orderBy("date")),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => { console.error(err); toast("Events konnten nicht geladen werden."); }
      );
    },
    add(ev) { return fs.addDoc(col, { ...ev, createdAt: fs.serverTimestamp() }); },
    update(id, ev) { return fs.updateDoc(fs.doc(db, "events", id), ev); },
    remove(id) { return fs.deleteDoc(fs.doc(db, "events", id)); },
    login(email, pw) { return au.signInWithEmailAndPassword(auth, email, pw); },
    logout() { return au.signOut(auth); },
    onAuth(cb) { au.onAuthStateChanged(auth, cb); },
  };
}

/* ============================================================
   Rendering
   ============================================================ */
function render() {
  renderHero();
  renderTabs();
  if (state.view === "list") renderList(); else renderCalendar();
  $("#add-btn").hidden = !state.isAdmin;
}

function renderHero() {
  const handle = (SITE.instagram || "").replace(/^@/, "");
  $("#site-handle").innerHTML = handle
    ? `<a href="https://instagram.com/${encodeURIComponent(handle)}" target="_blank" rel="noopener" style="text-decoration:none">@${esc(handle)}</a>`
    : "";
  $("#site-name").textContent = SITE.name;
  $("#site-tagline").textContent = SITE.tagline;
  $("#footer-name").textContent = `© ${today().getFullYear()} ${SITE.name} made by Timo Maecker`;
  document.title = SITE.name;

  const upcomingReg = state.events
    .filter((e) => e.status === "registered" && !isPast(e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = upcomingReg[0];
  const nr = $("#next-race");
  if (next) {
    const c = countdownText(next.date);
    nr.hidden = false;
    nr.innerHTML = `
      <div>
        <div class="label">Nächstes Rennen</div>
        <div class="name">${esc(next.name)}</div>
        <div class="meta">${esc(fmtLong.format(parseDate(next.date)))}${next.location ? " · " + esc(next.location) : ""}</div>
      </div>
      <div class="count"><b>${esc(c.big)}</b><span>${esc(c.small)}</span></div>`;
    nr.onclick = () => openDetail(next.id);
  } else {
    nr.hidden = true;
  }

  const wish = state.events.filter((e) => e.status === "wishlist" && !isPast(e.date)).length;
  const done = state.events.filter((e) => effStatus(e) === "done");
  const plannedKm = upcomingReg.reduce((s, e) => s + (km(e) || 0), 0);
  $("#stats").innerHTML = [
    [upcomingReg.length, "Angemeldet"],
    [wish, "Wunschliste"],
    [done.length, "Absolviert"],
    [fmtKm(Math.round(plannedKm)), "Wettkampf-km geplant"],
  ].map(([n, l]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("");
}

function renderTabs() {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.filter === state.filter));
  document.querySelectorAll("#view-toggle button").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  $("#list-view").hidden = state.view !== "list";
  $("#calendar-view").hidden = state.view !== "calendar";
}

function filtered() {
  const f = state.filter;
  let list = state.events.filter((e) => {
    const s = effStatus(e);
    if (f === "upcoming") return !isPast(e.date);
    if (f === "registered") return s === "registered";
    if (f === "wishlist") return s === "wishlist" && !isPast(e.date);
    if (f === "done") return s === "done";
    return true;
  });
  list.sort((a, b) => a.date.localeCompare(b.date));
  if (f === "done") list.reverse();
  return list;
}

function cardHTML(ev) {
  const s = effStatus(ev);
  const d = parseDate(ev.date);
  const t = TYPES[ev.type] || TYPES.other;
  const c = countdownText(ev.date);
  const side = s === "done"
    ? (ev.result ? `<div class="result">${esc(ev.result)}</div>` : `<div class="countdown">✓<small>Finisher</small></div>`)
    : `<div class="countdown">${esc(c.big)}<small>${esc(c.small)}</small></div>`;
  return `
    <article class="card ${s}" data-id="${esc(ev.id)}" tabindex="0">
      <div class="date-block">
        <div class="m">${esc(fmtMonShort.format(d).replace(".", ""))}</div>
        <div class="d">${d.getDate()}</div>
        <div class="w">${esc(fmtWeekday.format(d))}</div>
      </div>
      <div class="card-main">
        <div class="card-title">${esc(ev.name)}</div>
        <div class="card-meta">
          <span class="chip">${esc(t.label)}</span>
          <span class="chip status-${s}">${esc(STATUS_LABEL[s])}</span>
          ${ev.location ? `<span class="place">📍 ${esc(ev.location)}</span>` : ""}
        </div>
      </div>
      <div class="card-side">${side}</div>
    </article>`;
}

function renderList() {
  const list = filtered();
  const el = $("#list-view");
  if (!list.length) {
    const msg = {
      upcoming: ["Noch keine Rennen geplant", "Bald geht's los 🏃"],
      registered: ["Keine Anmeldungen", "Zeit, sich irgendwo anzumelden!"],
      wishlist: ["Wunschliste ist leer", "Träume groß."],
      done: ["Noch keine Finishes", "Das erste kommt bestimmt."],
    }[state.filter];
    el.innerHTML = `<div class="empty"><b>${msg[0]}</b>${msg[1]}</div>`;
    return;
  }
  let html = "", lastMonth = "";
  for (const ev of list) {
    const m = fmtMonth.format(parseDate(ev.date));
    if (m !== lastMonth) {
      const count = list.filter((e) => fmtMonth.format(parseDate(e.date)) === m).length;
      html += `<div class="month"><h3>${esc(m)}</h3><small>${count} ${count === 1 ? "Event" : "Events"}</small></div>`;
      lastMonth = m;
    }
    html += cardHTML(ev);
  }
  el.innerHTML = html;
}

function renderCalendar() {
  const m = state.calMonth;
  const first = startOfMonth(m);
  const offset = (first.getDay() + 6) % 7; // Montag = 0
  const start = new Date(first); start.setDate(1 - offset);
  const todayISO = toISO(today());

  // Im Kalender alle Events zeigen (unabhängig vom Tab), außer vergangene Wünsche
  const visible = state.events.filter((e) => !(e.status === "wishlist" && isPast(e.date)));
  const byDate = {};
  visible.forEach((e) => (byDate[e.date] ||= []).push(e));

  let cells = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = toISO(d);
    const out = d.getMonth() !== m.getMonth();
    if (i >= 35 && out) break; // keine leere 6. Zeile
    const evs = byDate[iso] || [];
    cells += `<div class="cal-day ${out ? "out" : ""} ${iso === todayISO ? "today" : ""}">
      <span class="num">${d.getDate()}</span>
      ${evs.map((e) => `<button class="pill ${effStatus(e)}" data-id="${esc(e.id)}" title="${esc(e.name)}">${esc(e.name)}</button>`).join("")}
    </div>`;
  }

  const monthEvents = visible
    .filter((e) => { const d = parseDate(e.date); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); })
    .sort((a, b) => a.date.localeCompare(b.date));

  $("#calendar-view").innerHTML = `
    <div class="cal-head">
      <h3>${esc(fmtMonth.format(m))}</h3>
      <div class="cal-nav">
        <button class="icon-btn" data-cal="-1" aria-label="Vorheriger Monat">‹</button>
        <button class="icon-btn" data-cal="0" aria-label="Heute">•</button>
        <button class="icon-btn" data-cal="1" aria-label="Nächster Monat">›</button>
      </div>
    </div>
    <div class="cal-grid">${cells}</div>
    <div class="legend">
      <span><i style="background:var(--volt)"></i>Angemeldet</span>
      <span><i style="background:var(--wish)"></i>Wunschliste</span>
      <span><i style="background:var(--done)"></i>Absolviert</span>
    </div>
    <div class="cal-list">${monthEvents.length ? monthEvents.map(cardHTML).join("") : `<div class="empty"><b>Keine Events in diesem Monat</b></div>`}</div>`;
}

/* ============================================================
   Detail & Formular
   ============================================================ */
function openDetail(id) {
  const ev = state.events.find((e) => e.id === id);
  if (!ev) return;
  const s = effStatus(ev);
  const t = TYPES[ev.type] || TYPES.other;
  const c = countdownText(ev.date);
  const url = safeUrl(ev.url);
  $("#detail-body").innerHTML = `
    <div class="detail-top">
      <div class="detail-date">${esc(fmtLong.format(parseDate(ev.date)))}</div>
      <button class="icon-btn" data-close aria-label="Schließen">✕</button>
    </div>
    <div class="detail-name">${esc(ev.name)}</div>
    <div class="card-meta">
      <span class="chip">${esc(t.label)}</span>
      <span class="chip status-${s}">${esc(STATUS_LABEL[s])}</span>
    </div>
    <div class="detail-grid">
      <div><small>${s === "done" ? "Ergebnis" : "Countdown"}</small><b>${esc(s === "done" ? (ev.result || "Finisher ✓") : `${c.big} ${c.small}`)}</b></div>
      <div><small>Distanz</small><b>${esc(fmtKm(km(ev)))} km</b></div>
      ${ev.location ? `<div><small>Ort</small><b>${esc(ev.location)}</b></div>` : ""}
      ${s !== "done" && ev.result ? `<div><small>Ziel</small><b>${esc(ev.result)}</b></div>` : ""}
    </div>
    ${ev.notes ? `<p class="detail-notes">${esc(ev.notes)}</p>` : ""}
    <div class="detail-actions">
      ${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">Zur Event-Website ↗</a>` : ""}
      <button class="btn" id="ics-btn">📅 In meinen Kalender</button>
      ${state.isAdmin ? `<button class="btn" id="edit-from-detail">Bearbeiten</button>` : ""}
    </div>`;
  const dlg = $("#detail-dialog");
  dlg.showModal();
  $("#ics-btn").onclick = () => downloadICS(ev);
  const eb = $("#edit-from-detail");
  if (eb) eb.onclick = () => { dlg.close(); openForm(ev.id); };
}

function openForm(id = null) {
  const form = $("#event-form");
  form.reset();
  state.editingId = id;
  const ev = id ? state.events.find((e) => e.id === id) : null;
  $("#form-title").textContent = ev ? "Event bearbeiten" : "Neues Event";
  $("#delete-btn").hidden = !ev;
  if (ev) {
    for (const k of ["name", "date", "type", "location", "distance", "url", "result", "notes"]) {
      if (form.elements[k]) form.elements[k].value = ev[k] ?? "";
    }
    form.elements.status.value = ev.status;
  } else {
    form.elements.type.value = "hm";
  }
  $("#event-dialog").showModal();
  if (!ev) form.elements.name.focus();
}

async function submitForm(e) {
  e.preventDefault();
  const f = e.target;
  const data = {
    name: f.name.value.trim(),
    date: f.date.value,
    type: f.type.value,
    status: f.status.value,
    location: f.location.value.trim(),
    distance: f.distance.value ? Number(f.distance.value) : null,
    url: f.url.value.trim(),
    result: f.result.value.trim(),
    notes: f.notes.value.trim(),
  };
  if (!data.name || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return toast("Bitte Name und Datum angeben.");
  const btn = f.querySelector("[type=submit]");
  btn.disabled = true;
  try {
    if (state.editingId) await store.update(state.editingId, data);
    else await store.add(data);
    $("#event-dialog").close();
    toast(state.editingId ? "Gespeichert ✓" : "Event hinzugefügt 🎉");
  } catch (err) {
    console.error(err);
    toast("Speichern fehlgeschlagen – bist du eingeloggt?");
  } finally {
    btn.disabled = false;
  }
}

async function deleteCurrent() {
  if (!state.editingId || !confirm("Dieses Event wirklich löschen?")) return;
  try {
    await store.remove(state.editingId);
    $("#event-dialog").close();
    toast("Gelöscht");
  } catch (err) {
    console.error(err);
    toast("Löschen fehlgeschlagen.");
  }
}

function downloadICS(ev) {
  const start = ev.date.replace(/-/g, "");
  const endD = parseDate(ev.date); endD.setDate(endD.getDate() + 1);
  const end = toISO(endD).replace(/-/g, "");
  const clean = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Race Calendar//DE", "BEGIN:VEVENT",
    `UID:${ev.id}@race-calendar`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${clean(ev.name)}`, ev.location ? `LOCATION:${clean(ev.location)}` : "",
    safeUrl(ev.url) ? `URL:${safeUrl(ev.url)}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${ev.name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ============================================================
   Auth
   ============================================================ */
function updateAuthUI(user) {
  state.isAdmin = DEMO || (!!user && (ADMIN_UID.startsWith("DEIN") || user.uid === ADMIN_UID));
  $("#admin-info").textContent = !DEMO && user ? "Eingeloggt" : "";
  $("#auth-btn").title = user && !DEMO ? "Ausloggen" : "Login";
  render();
}

async function handleAuthClick() {
  if (DEMO) return toast("Im Demo-Modus kannst du direkt bearbeiten.");
  if (state.user) {
    await store.logout();
    toast("Ausgeloggt");
  } else {
    $("#login-dialog").showModal();
  }
}

async function submitLogin(e) {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector("[type=submit]");
  btn.disabled = true;
  try {
    await store.login(f.email.value.trim(), f.password.value);
    $("#login-dialog").close();
    f.reset();
    toast("Willkommen zurück 👋");
  } catch (err) {
    console.error(err);
    toast("Login fehlgeschlagen.");
  } finally {
    btn.disabled = false;
  }
}

/* ============================================================
   Events verdrahten
   ============================================================ */
function bind() {
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-filter]");
    if (!b) return;
    state.filter = b.dataset.filter;
    if (state.view === "calendar") state.view = "list";
    render();
  });
  $("#view-toggle").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-view]");
    if (!b) return;
    state.view = b.dataset.view;
    render();
  });

  document.addEventListener("click", (e) => {
    const cal = e.target.closest("[data-cal]");
    if (cal) {
      const dir = Number(cal.dataset.cal);
      state.calMonth = dir === 0
        ? startOfMonth(today())
        : new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + dir, 1);
      renderCalendar();
      return;
    }
    const close = e.target.closest("[data-close]");
    if (close) { close.closest("dialog").close(); return; }
    const item = e.target.closest(".card[data-id], .pill[data-id]");
    if (item) openDetail(item.dataset.id);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".card[data-id]")) openDetail(e.target.dataset.id);
  });

  // Klick auf den Hintergrund schließt Dialoge
  document.querySelectorAll("dialog").forEach((d) =>
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); })
  );

  $("#add-btn").addEventListener("click", () => openForm());
  $("#event-form").addEventListener("submit", submitForm);
  $("#delete-btn").addEventListener("click", deleteCurrent);
  $("#auth-btn").addEventListener("click", handleAuthClick);
  $("#login-form").addEventListener("submit", submitLogin);

  // Typen ins Dropdown
  $("#type-select").innerHTML = Object.entries(TYPES)
    .map(([k, t]) => `<option value="${k}">${esc(t.label)}${t.km ? ` (${fmtKm(t.km)} km)` : ""}</option>`)
    .join("");

  // Login direkt per URL: deine-seite.web.app/#admin
  if (location.hash === "#admin" && !DEMO) setTimeout(() => !state.user && $("#login-dialog").showModal(), 400);
}

/* ============================================================
   Start
   ============================================================ */
async function init() {
  bind();
  $("#demo-banner").hidden = !DEMO;
  try {
    store = DEMO ? demoStore() : await firebaseStore();
  } catch (err) {
    console.error(err);
    toast("Firebase konnte nicht geladen werden – Demo-Modus aktiv.");
    store = demoStore();
  }
  store.onAuth((user) => { state.user = DEMO ? null : user; updateAuthUI(user); });
  store.subscribe((events) => { state.events = events; render(); });
}

init();
