const statusEl = document.getElementById("status");
const cardSizeEl = document.getElementById("card-size");
const gridEl = document.getElementById("grid");
const scanBtn = document.getElementById("btn-scan");
const archiveBtn = document.getElementById("btn-archive");
const sortBtn = document.getElementById("btn-sort");
const searchEl = document.getElementById("search");
const logoutBtn = document.getElementById("btn-logout");
const settingsBtn = document.getElementById("btn-settings");
const themeToggleBtn = document.getElementById("theme-toggle");
const searchToggleBtn = document.getElementById("btn-search-toggle");
const topbarEl = document.querySelector(".topbar");

function toggleMobileSearch(){
  if (!topbarEl) return;
  topbarEl.classList.toggle("search-open");
  if (topbarEl.classList.contains("search-open")) {
    setTimeout(() => searchEl?.focus(), 0);
  }
}

if (searchToggleBtn) {
  searchToggleBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMobileSearch();
  });
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const mode = loadTheme();
    const eff = effectiveTheme(mode);
    const next = (eff === "light") ? "dark" : "light";
    setTheme(next);
  });
}

let currentUser = null;
let isAdmin = false;

let showArchive = false;
let sortMode = "name_asc";

let platformFilter = localStorage.getItem("gamify_platform_filter") || "";

function getPreferredSystemTheme(){
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(mode) {
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-dark");
  if (mode === "light") root.classList.add("theme-light");
  if (mode === "dark") root.classList.add("theme-dark");
}

function loadTheme() {
  return localStorage.getItem("gamify_theme") || "system";
}

function setTheme(mode){
  localStorage.setItem("gamify_theme", mode);
  applyTheme(mode);
  updateThemeToggleIcon();
}

function effectiveTheme(mode){
  if (mode === "system") return getPreferredSystemTheme();
  return mode;
}

function updateThemeToggleIcon(){
  const ico = document.getElementById("theme-toggle-ico");
  if (!ico) return;

  const mode = loadTheme();
  const eff = effectiveTheme(mode);

  ico.textContent = (eff === "light") ? "light_mode" : "dark_mode";
}

(function initTheme(){
  const mode = loadTheme();
  applyTheme(mode);
  updateThemeToggleIcon();

  const mq = window.matchMedia?.("(prefers-color-scheme: light)");
  if (mq && mq.addEventListener) mq.addEventListener("change", updateThemeToggleIcon);
})();


function esc(str){
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

function badge(text, cls=""){ return `<span class="badge ${cls}">${esc(text)}</span>`; }

function platformLabel(p){
  return (!p || p === "Autre") ? "PC" : p;
}

function formatGB(bytes){
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  const gb = n / (1024 ** 3);
  return gb >= 100 ? gb.toFixed(0) : gb.toFixed(1);
}

function applyCardSize(px){
  const v = Number(px) || 220;

  document.documentElement.style.setProperty("--card-min", `${v}px`);

  const minW = 180, maxW = 320;
  const t = Math.max(0, Math.min(1, (v - minW) / (maxW - minW)));
  const ratio = 1.05 + t * (1.40 - 1.05);

  const coverH = Math.round(v * ratio);
  document.documentElement.style.setProperty("--cover-h", `${coverH}px`);
}


(function initCardSize(){
  if (!cardSizeEl) return;

  const saved = Number(localStorage.getItem("gamify_card_size")) || 220;
  cardSizeEl.value = String(saved);
  applyCardSize(saved);

  cardSizeEl.addEventListener("input", () => {
    const v = Number(cardSizeEl.value);
    applyCardSize(v);
    localStorage.setItem("gamify_card_size", String(v));
  });
})();

async function ensureLoggedIn() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();

  if (!data.ok) {
    window.location.href = "/login.html";
    return null;
  }

  currentUser = data.user;
  isAdmin = currentUser.role === "admin";

  const scanBtn     = document.getElementById("btn-scan");
  const archiveBtn  = document.getElementById("btn-archive");
  const settingsBtn = document.getElementById("btn-settings");
  const sortBtn     = document.getElementById("btn-sort");
  const logoutBtn   = document.getElementById("btn-logout");

  if (scanBtn)     scanBtn.style.display     = isAdmin ? "" : "none";
  if (archiveBtn)  archiveBtn.style.display  = isAdmin ? "" : "none";
  if (settingsBtn) settingsBtn.style.display = isAdmin ? "" : "none";

  if (sortBtn)   sortBtn.style.display   = "";
  if (logoutBtn) logoutBtn.style.display = "";

  return currentUser;
}

async function getSettings() {
  const res = await fetch("/api/settings");
  return await res.json();
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login.html";
  });
}

/* ------------------------------ MENU + MODAL ------------------------------ */

let openMenuEl = null;

function closeMenu() {
  if (openMenuEl) {
    openMenuEl.classList.remove("open");
    openMenuEl = null;
  }
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".card-menu")) closeMenu();
});

const platformMenuBtn = document.getElementById("platform-menu-btn");
const platformMenu    = document.getElementById("platform-menu");

if (platformMenuBtn && platformMenu) {
  platformMenuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (openMenuEl && openMenuEl !== platformMenu) {
      openMenuEl.classList.remove("open");
    }

    const nowOpen = !platformMenu.classList.contains("open");
    platformMenu.classList.toggle("open", nowOpen);
    openMenuEl = nowOpen ? platformMenu : null;
  });

  platformMenu.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", async (e) => {
      e.preventDefault();
      platformFilter = item.dataset.platform || "";
      localStorage.setItem("gamify_platform_filter", platformFilter);
      closeMenu();
      await loadGames();
    });
  });
}

/* ------------------------------ POSTER MODAL ------------------------------ */

function ensurePosterModal() {
  let modal = document.getElementById("poster-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "poster-modal";
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal__backdrop" data-close></div>
    <div class="modal__panel" role="dialog" aria-modal="true">
      <div class="modal__head">
        <div>
          <div class="modal__title">Choisir une pochette</div>
          <div class="modal__sub muted" id="poster-sub">Recherche IGDB</div>
        </div>
        <button class="btn btn-ghost icon-only" type="button" data-close title="Fermer">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <div class="modal__body">
        <div class="poster-search">
          <span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input id="poster-q" type="text" placeholder="Rechercher sur IGDB..." />
          <button id="poster-go" class="btn btn-primary" type="button">Rechercher</button>
        </div>

        <div id="poster-results" class="poster-results"></div>
      </div>

      <div class="modal__foot">
        <button class="btn btn-ghost" type="button" data-close>Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target.matches("[data-close]")) {
      modal.classList.remove("open");
      document.body.classList.remove("modal-open");
    }
  });

  return modal;
}

/* ------------------------------ GAME DETAILS MODAL ------------------------------ */

let gamesById = new Map();

function ensureGameModal() {
  let modal = document.getElementById("game-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "game-modal";
  modal.className = "modal game-modal";
  modal.innerHTML = `
    <div class="modal__backdrop" data-close></div>

    <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="game-modal-title">
      <div class="modal__head">
        <div>
          <div class="modal__title" id="game-modal-title">Détails du jeu</div>
          <div class="modal__sub muted" id="game-modal-sub"></div>
        </div>
        <button class="btn btn-ghost icon-only" type="button" data-close title="Fermer">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <div class="modal__body">
        <div class="game-modal__content">
          <div class="game-modal__cover" id="game-modal-cover"></div>

          <div class="game-modal__info">
            <div class="game-modal__name" id="game-modal-name"></div>

            <div class="game-modal__badges" id="game-modal-badges"></div>

            <div class="game-modal__grid" id="game-modal-grid"></div>

            <div class="game-modal__actions" id="game-modal-actions"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) {
      modal.classList.remove("open");
      document.body.classList.remove("modal-open");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) {
      modal.classList.remove("open");
      document.body.classList.remove("modal-open");
    }
  });

  return modal;
}

function openGameModal(game) {
  const modal = ensureGameModal();

  const sub = modal.querySelector("#game-modal-sub");
  const cover = modal.querySelector("#game-modal-cover");
  const name = modal.querySelector("#game-modal-name");
  const badges = modal.querySelector("#game-modal-badges");
  const grid = modal.querySelector("#game-modal-grid");
  const actions = modal.querySelector("#game-modal-actions");

  const title = game.display_name || "Jeu";
  const platform = platformLabel(game.platform);
  const sizeGb = formatGB(game.folder_size_bytes);

  sub.textContent = platform + (sizeGb ? ` • ${sizeGb} Go` : "");
  name.textContent = title;

  cover.innerHTML = game.igdb_cover_url
    ? `<img
        src="${esc(game.igdb_cover_url)}"
        alt=""
        style="
          width:100%;
          height:100%;
          display:block;
          object-fit: cover;        /* image pleine */
          object-position: center;  /* centrée */
        "
      >`
    : `<div class="cover-placeholder">no cover</div>`;


  const archivedBadge = (game.is_deleted || game.is_archived) ? badge("Archivé", "warn") : "";
  const sizeBadge = sizeGb ? badge(`${sizeGb} Go`) : "";
  badges.innerHTML = `
    ${badge(platform)}
    ${sizeBadge}
    ${archivedBadge}
    ${isAdmin ? badge("Notif: " + (game.notif_status || "n/a"), (game.notif_status === "sent" ? "ok" : "warn")) : ""}
    ${isAdmin ? badge("IGDB: " + (game.igdb_status || "n/a"), (game.igdb_status === "matched" ? "ok" : "warn")) : ""}
  `;

  const rows = [];
  rows.push(["Nom", esc(game.display_name || "")]);
  rows.push(["Plateforme", esc(platform)]);
  if (sizeGb) rows.push(["Taille", esc(`${sizeGb} Go`)]);
  if (game.igdb_url) rows.push(["IGDB", `<a class="link" href="${esc(game.igdb_url)}" target="_blank" rel="noreferrer">Ouvrir</a>`]);

  grid.innerHTML = rows.map(([k, v]) => `
    <div class="game-row">
      <div class="game-key">${k}</div>
      <div class="game-val">${v}</div>
    </div>
  `).join("");


  modal.dataset.igdbLoaded = "0";
  actions.innerHTML = ""; 
  modal.classList.add("open");
  document.body.classList.add("modal-open");
  enrichWithIgdb(game.id);
}

async function enrichWithIgdb(gameId) {
  const modal = document.getElementById("game-modal");
  if (!modal || !modal.classList.contains("open")) return;

  if (modal.dataset.igdbLoaded === "1") return;
  modal.dataset.igdbLoaded = "1";

  const grid = modal.querySelector("#game-modal-grid");
  const actions = modal.querySelector("#game-modal-actions");

  const loader = document.createElement("div");
  loader.className = "muted";
  loader.style.marginTop = "10px";
  loader.textContent = "Récupération des infos IGDB…";
  actions.appendChild(loader);

  try {
    const res = await fetch(`/api/games/${gameId}/igdb-details`);
    const data = await res.json();

    loader.remove();

    if (!data.ok || !data.igdb) return;

    const ig = data.igdb;

    const extra = [];
    if (ig.summary) extra.push(["Résumé", esc(ig.summary)]);
    if (ig.first_release_date) {
      const d = new Date(Number(ig.first_release_date) * 1000);
      if (!Number.isNaN(d.getTime())) extra.push(["Sortie", esc(d.toLocaleDateString("fr-FR"))]);
    }
    if (ig.genres?.length) extra.push(["Genres", esc(ig.genres.join(", "))]);
    if (ig.platforms?.length) extra.push(["Plateformes IGDB", esc(ig.platforms.join(", "))]);
    if (ig.companies?.length) extra.push(["Studios", esc(ig.companies.join(", "))]);
    if (typeof ig.rating === "number") extra.push(["Note", esc(`${ig.rating.toFixed(0)}%`)]);

    if (extra.length) {
      grid.insertAdjacentHTML("beforeend", extra.map(([k, v]) => {
        const isSummary = (k === "Résumé");
        return `
          <div class="game-row ${isSummary ? "game-row--summary" : ""}">
            <div class="game-key">${k}</div>
            <div class="game-val ${isSummary ? "game-val--wrap" : ""}"
                style="${isSummary ? "white-space:normal; overflow:visible; text-overflow:unset; text-align:left; line-height:1.45;" : ""}">
              ${v}
            </div>
          </div>
        `;
      }).join(""));
    }

    if (ig.screenshots?.length) {
      grid.insertAdjacentHTML("beforeend", `
        <div class="game-shots" style="
          margin-top: 10px;
          display: grid;
          gap: 10px;
          justify-items: center;
        ">
          ${ig.screenshots.map(u => `
            <img
              src="${esc(u)}"
              alt=""
              loading="lazy"
              style="
                max-width: 100%;
                height: auto;
                display: block;
                border-radius: 14px;
                border: 1px solid rgba(255,255,255,0.10);
              "
            >
          `).join("")}
        </div>
      `);
    }


    if (ig.igdb_url) {
      actions.insertAdjacentHTML("afterbegin", `
        <a class="btn btn-primary" href="${esc(ig.igdb_url)}" target="_blank" rel="noreferrer">
          <span class="material-symbols-rounded">open_in_new</span>
          <span class="btn-text">IGDB</span>
        </a>
      `);
    }

  } catch (e) {
    loader.remove();
    console.error("IGDB enrich error:", e);
  }
}

async function openPosterPicker(gameId, currentName) {
  const modal = ensurePosterModal();
  const qInput = modal.querySelector("#poster-q");
  const goBtn = modal.querySelector("#poster-go");
  const results = modal.querySelector("#poster-results");
  const sub = modal.querySelector("#poster-sub");

  qInput.value = currentName || "";
  results.innerHTML = "";
  sub.textContent = "Recherche IGDB";

  modal.dataset.gameId = String(gameId);
  modal.classList.add("open");
  document.body.classList.add("modal-open");

  async function runSearch() {
    const q = qInput.value.trim();
    if (!q) return;

    results.innerHTML = `<div class="muted">Recherche en cours…</div>`;
    sub.textContent = `Résultats pour : ${q}`;

    const url = new URL(`/api/games/${gameId}/igdb-search`, window.location.origin);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "10");

    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) {
      results.innerHTML = `<div class="muted">Erreur: ${esc(data.error || "IGDB")}</div>`;
      return;
    }

    if (!data.hits?.length) {
      results.innerHTML = `<div class="muted">Aucun résultat.</div>`;
      return;
    }

    results.innerHTML = data.hits.map(h => {
      const cover = h.cover_url
        ? `<img src="${esc(h.cover_url)}" alt="">`
        : `<div class="poster-cover placeholder">no cover</div>`;

      const igdbLink = h.igdb_url ? `<a class="poster-link" href="${esc(h.igdb_url)}" target="_blank" rel="noreferrer">IGDB</a>` : "";

      return `
        <button class="poster-item" type="button"
          data-igdb-id="${esc(h.igdb_id)}"
          data-slug="${esc(h.slug || "")}"
          data-cover="${esc(h.cover_url || "")}"
          data-url="${esc(h.igdb_url || "")}">
          <div class="poster-cover">${cover}</div>
          <div class="poster-meta">
            <div class="poster-name">${esc(h.name)}</div>
            <div class="poster-actions">${igdbLink}<span class="poster-apply">Appliquer</span></div>
          </div>
        </button>
      `;
    }).join("");

    results.querySelectorAll(".poster-item").forEach(btn => {
      btn.addEventListener("click", async () => {
        const igdb_id = Number(btn.dataset.igdbId);
        const slug = btn.dataset.slug || null;
        const cover_url = btn.dataset.cover || null;
        const igdb_url = btn.dataset.url || null;

        results.innerHTML = `<div class="muted">Application…</div>`;

        const applyRes = await fetch(`/api/games/${gameId}/igdb-apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ igdb_id, slug, cover_url, igdb_url })
        });

        const applyData = await applyRes.json().catch(() => ({}));
        if (!applyData.ok) {
          results.innerHTML = `<div class="muted">Erreur: ${esc(applyData.error || "apply")}</div>`;
          return;
        }

        modal.classList.remove("open");
        document.body.classList.remove("modal-open");
        statusEl.textContent = "Pochette mise à jour ✅";
        await loadGames();
      });
    });
  }

  goBtn.onclick = runSearch;
  qInput.onkeydown = (e) => { if (e.key === "Enter") runSearch(); };

  runSearch();
}

/* ------------------------------ RENDER ------------------------------ */

function render(games){
  gridEl.innerHTML = games.map(g => {
    const notifCls = g.notif_status === "sent" ? "ok" : "warn";
    const igdbCls  = g.igdb_status === "matched" ? "ok" : "warn";

    const coverHtml = g.igdb_cover_url
      ? `<img src="${esc(g.igdb_cover_url)}" alt="" loading="lazy">`
      : `<div class="cover-placeholder">no cover</div>`;

    const archivedBadge = (g.is_deleted || g.is_archived) ? badge("Archivé", "warn") : "";

    const sizeGb = formatGB(g.folder_size_bytes);
    const sizeBadge = sizeGb ? badge(`${sizeGb} Go`) : "";

    return `
      <article class="card">
        <div class="cover" data-open-game="${g.id}" title="Voir les détails">
          ${coverHtml}

          ${isAdmin ? `
            <div class="card-menu" data-menu="${g.id}">
              <button class="menu-btn" type="button" title="Options" data-menu-btn="${g.id}">
                <span class="material-symbols-rounded">more_vert</span>
              </button>
              <div class="menu-pop">
                <button class="menu-item" type="button" data-action="poster" data-id="${g.id}">
                  <span class="material-symbols-rounded">image</span>
                  Poster
                </button>
                <button class="menu-item" type="button" data-action="archive" data-id="${g.id}">
                  <span class="material-symbols-rounded">archive</span>
                  ${ (g.is_archived ? "Désarchiver" : "Archiver") }
                </button>
              </div>
            </div>
          ` : ``}
        </div>

        <div class="meta">
          <p class="title">${esc(g.display_name)}</p>

          <div class="row" style="align-items:center; justify-content:space-between;">
            <div class="row" style="margin:0;">
              ${badge(platformLabel(g.platform))}
              ${sizeBadge}
              ${archivedBadge}
            </div>

            ${isAdmin ? `
              <button class="mini" data-notify="${g.id}" title="Renvoyer notif Telegram">
                <span class="material-symbols-rounded">notifications</span>
              </button>
            ` : ``}
          </div>

          ${isAdmin ? `
            <div class="row">
              ${badge("Notif: " + g.notif_status, notifCls)}
              ${badge("IGDB: " + g.igdb_status, igdbCls)}
            </div>
          ` : ``}
        </div>
      </article>
    `;
  }).join("");

  if (isAdmin) {
    gridEl.querySelectorAll("[data-notify]").forEach(btn=>{
      btn.addEventListener("click", (e)=>{
        e.preventDefault();
        notifyGame(Number(btn.dataset.notify));
      });
    });

    gridEl.querySelectorAll("[data-menu-btn]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const id = btn.dataset.menuBtn;
        const wrap = gridEl.querySelector(`.card-menu[data-menu="${id}"]`);
        if (!wrap) return;

        if (openMenuEl && openMenuEl !== wrap) openMenuEl.classList.remove("open");

        const nowOpen = !wrap.classList.contains("open");
        wrap.classList.toggle("open", nowOpen);
        openMenuEl = nowOpen ? wrap : null;
      });
    });

    gridEl.querySelectorAll(".menu-item[data-action]").forEach(item => {
      item.addEventListener("click", async (e) => {
        e.preventDefault();
        const action = item.dataset.action;
        const id = Number(item.dataset.id);

        closeMenu();

        if (action === "poster") {
          const cardTitle = item.closest(".card")?.querySelector(".title")?.textContent || "";
          await openPosterPicker(id, cardTitle);
        }
        if (action === "archive") {
          await fetch(`/api/games/${id}/archive`, { method: "POST" });
          await loadGames();
          return;
        }
      });
    });
  }
}

if (gridEl) {
  gridEl.addEventListener("click", (e) => {
    if (e.target.closest(".card-menu")) return;
    if (e.target.closest("button")) return;

    const cover = e.target.closest("[data-open-game]");
    if (!cover) return;

    const id = Number(cover.dataset.openGame);
    const game = gamesById.get(id);
    if (!game) return;

    openGameModal(game);
  });
}

async function notifyGame(id){
  try{
    const res = await fetch(`/api/games/${id}/notify`, { method:"POST" });
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || "Erreur notif");
    statusEl.textContent = "Notif envoyée ✅";
    await loadGames();
  }catch(e){
    statusEl.textContent = "Notif KO";
    console.error(e);
  }
}

async function loadGames(){
  const q = (searchEl?.value || "").trim();
  statusEl.textContent = "Chargement…";

  const url = new URL("/api/games", window.location.origin);
  if (q) url.searchParams.set("search", q);
  if (platformFilter) url.searchParams.set("platform", platformFilter);
  url.searchParams.set("limit", "300");
  if (showArchive) url.searchParams.set("archive_only", "1");
  url.searchParams.set("sort", sortMode);

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    statusEl.textContent = "API injoignable";
    console.error("fetch /api/games failed:", e);
    return;
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    const txt = await res.text().catch(() => "");
    statusEl.textContent = "Erreur API (réponse non JSON)";
    console.error("API /games non-JSON:", res.status, txt);
    return;
  }

  if (!data.ok) {
    statusEl.textContent = "Erreur API";
    console.error("API /games error:", data);
    return;
  }

  statusEl.textContent = showArchive
    ? `${data.count} jeux archivés`
    : `${data.count} jeux présents`;

  gamesById = new Map((data.games || []).map(g => [Number(g.id), g]));
  render(data.games);
}

async function scan(){
  if (!scanBtn) return;

  scanBtn.disabled = true;
  statusEl.textContent = "Scan en cours…";

  try{
    const s = await getSettings();
    const watched = s?.watchedFolders || [];

    if (!watched.length) {
      statusEl.textContent = "⚠️ Aucun dossier surveillé.";
      return;
    }

    const res = await fetch("/api/scan", { method:"POST" });

    if (!res.ok) {
      const txt = await res.text();
      statusEl.textContent = `Scan KO (${res.status})`;
      console.error("Scan error:", res.status, txt);
      return;
    }

    const data = await res.json();
    statusEl.textContent = `Scan OK: +${data.createdGames?.length ?? 0} (errors=${data.errors?.length ?? 0})`;
    if (data.errors?.length) console.warn("Scan errors:", data.errors);

    await loadGames();
  }catch(e){
    statusEl.textContent = "Scan KO (exception)";
    console.error("Scan exception:", e);
  }finally{
    scanBtn.disabled = false;
  }
}

function setBtnText(btn, text) {
  if (!btn) return;
  const span = btn.querySelector(".btn-text");
  if (span) span.textContent = text;
  else btn.textContent = text;
}

function updateArchiveBtn() {
  if (!archiveBtn) return;
  archiveBtn.classList.toggle("active", showArchive);
}

function updateSortBtn() {
  if (!sortBtn) return;
  sortBtn.classList.toggle("active", sortMode === "name_desc");
  setBtnText(sortBtn, sortMode === "name_asc" ? "A→Z" : "Z→A");
}

if (archiveBtn) {
  archiveBtn.addEventListener("click", async () => {
    showArchive = !showArchive;
    updateArchiveBtn();
    await loadGames();
  });
}

if (sortBtn) {
  sortBtn.addEventListener("click", async () => {
    sortMode = (sortMode === "name_asc") ? "name_desc" : "name_asc";
    updateSortBtn();
    await loadGames();
  });
}

if (scanBtn) scanBtn.addEventListener("click", scan);

let t;
if (searchEl) {
  searchEl.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(loadGames, 250);
  });
}

updateArchiveBtn();
updateSortBtn();

ensureLoggedIn().then(u => {
  if (!u) return;
  loadGames();

(async () => {
  const el = document.getElementById("app-version");
  if (!el) return;

  try {
    const r = await fetch("/api/version");
    const data = await r.json();
    if (data?.ok && data.version) el.textContent = `v${data.version}`;
  } catch {
  }
})();

});
