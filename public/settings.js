const msg = document.getElementById("msg");

const logoutBtn = document.getElementById("btn-logout");

const enabled = document.getElementById("tg-enabled");
const token = document.getElementById("tg-token");
const chat = document.getElementById("tg-chat");
const save = document.getElementById("tg-save");
const test = document.getElementById("tg-test");
const tgCard = document.getElementById("tg-card");

// --- NEW: Telegram message card ---
const tgMsgCard = document.getElementById("tg-msg-card");
const tgTemplate = document.getElementById("tg-template");
const tgTplSave = document.getElementById("tg-template-save");
const tgTplReset = document.getElementById("tg-template-reset");
const tgTplMsg = document.getElementById("tg-template-msg");

const DEFAULT_TG_TEMPLATE =
  "🎮 Nouveau jeu : {name}\n🕹 Plateforme : {platform}\n📦 Taille : {size_gb} Go\n📁 Dossier : {folder}";

function setTplMsg(t) {
  if (tgTplMsg) tgTplMsg.textContent = t || "";
}

function showHideTelegramMessageCard() {
  if (!tgMsgCard) return;
  tgMsgCard.style.display = enabled?.checked ? "" : "none";
}

function applyTelegramUiState() {
  const isOn = !!enabled?.checked;

  // griser la carte
  if (tgCard) tgCard.classList.toggle("is-disabled", !isOn);

  // bloquer les champs + boutons (mais PAS le toggle)
  if (token) token.disabled = !isOn;
  if (chat) chat.disabled = !isOn;
  if (save) save.disabled = !isOn;
  if (test) test.disabled = !isOn;

  // NEW: affiche/masque la carte message
  showHideTelegramMessageCard();
}

async function requireAdmin() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();

  if (!data.ok) {
    location.href = "/login.html";
    return null;
  }

  if (data.user.role !== "admin") {
    if (msg) msg.textContent = "Accès interdit (admin uniquement).";
    if (save) save.disabled = true;
    if (test) test.disabled = true;
    if (enabled) enabled.disabled = true;
    if (token) token.disabled = true;
    if (chat) chat.disabled = true;
    if (tgCard) tgCard.classList.add("is-disabled");

    // NEW: bloque aussi la carte message
    if (tgMsgCard) tgMsgCard.style.display = "none";

    return null;
  }

  return data.user;
}

async function loadTelegram() {
  const res = await fetch("/api/admin/telegram");
  const data = await res.json();

  if (!data.ok) {
    if (msg) msg.textContent = data.error || "Erreur chargement Telegram";
    return;
  }

  if (enabled) enabled.checked = !!data.telegram_enabled;
  if (token) token.value = data.telegram_bot_token || "";
  if (chat) chat.value = data.telegram_chat_id || "";

  // NEW: template
  if (tgTemplate) tgTemplate.value = (data.telegram_message_template || DEFAULT_TG_TEMPLATE);

  applyTelegramUiState();
}

/**
 * ✅ Persist uniquement l'état ON/OFF
 * (ne touche pas au token/chat => pas de wipe accidentel)
 */
async function saveTelegramEnabledOnly() {
  if (!enabled) return;

  try {
    const res = await fetch("/api/admin/telegram", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_enabled: enabled.checked
      })
    });

    const data = await res.json();
    if (!data.ok && msg) msg.textContent = "KO: " + (data.error || "Erreur");
  } catch (e) {
    console.error(e);
    if (msg) msg.textContent = "KO: sauvegarde toggle";
  }
}

if (enabled) {
  enabled.addEventListener("change", async () => {
    applyTelegramUiState();
    await saveTelegramEnabledOnly();
  });
}

if (save) {
  save.addEventListener("click", async () => {
    if (msg) msg.textContent = "Enregistrement…";

    const res = await fetch("/api/admin/telegram", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_enabled: !!enabled?.checked,
        telegram_bot_token: (token?.value || "").trim(),
        telegram_chat_id: (chat?.value || "").trim()
      })
    });

    const data = await res.json();
    if (msg) msg.textContent = data.ok ? "OK ✅" : ("KO: " + (data.error || "Erreur"));
  });
}

if (test) {
  test.addEventListener("click", async () => {
    // si désactivé, on évite un test inutile
    if (!enabled?.checked) {
      if (msg) msg.textContent = "Telegram est désactivé.";
      return;
    }

    if (msg) msg.textContent = "Test…";

    const g = await fetch("/api/games?limit=1").then(r => r.json());
    if (!g.ok || !g.games?.length) {
      if (msg) msg.textContent = "Aucun jeu pour tester.";
      return;
    }

    const id = g.games[0].id;
    const res = await fetch(`/api/games/${id}/notify`, { method: "POST" });
    const data = await res.json();

    if (msg) msg.textContent = data.ok ? "Test envoyé ✅" : ("Test KO: " + (data.error || "Erreur"));
  });
}

// --- NEW: save / reset telegram template ---
if (tgTplSave) {
  tgTplSave.addEventListener("click", async () => {
    if (!enabled?.checked) {
      setTplMsg("Active Telegram pour modifier le message 🙂");
      return;
    }

    setTplMsg("Enregistrement…");

    const template = String(tgTemplate?.value || "").trim() || DEFAULT_TG_TEMPLATE;

    try {
      const res = await fetch("/api/admin/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_message_template: template
        })
      });

      const data = await res.json().catch(() => ({}));
      setTplMsg(data.ok ? "OK ✅" : ("KO: " + (data.error || "Erreur")));
    } catch (e) {
      console.error(e);
      setTplMsg("KO: erreur réseau");
    }
  });
}

if (tgTplReset) {
  tgTplReset.addEventListener("click", () => {
    if (tgTemplate) tgTemplate.value = DEFAULT_TG_TEMPLATE;
    setTplMsg("Réinitialisé (pense à enregistrer) 😉");
  });
}

// --- Users admin UI ---
const usersMsg = document.getElementById("users-msg");

const uUsername = document.getElementById("u-username");
const uPassword = document.getElementById("u-password");
const uRole = document.getElementById("u-role");
const uAdd = document.getElementById("u-add");
const uListBtn = document.getElementById("u-list");

// modal
const usersModal = document.getElementById("users-modal");
const usersList = document.getElementById("users-list");

function setUsersMsg(t){ if (usersMsg) usersMsg.textContent = t || ""; }

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, x => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[x]));
}

async function apiJson(url, opts){
  const r = await fetch(url, opts);
  const data = await r.json().catch(()=> ({}));
  if (!r.ok || data.ok === false) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

function openUsersModal(){
  if (!usersModal) return;
  usersModal.classList.add("is-open");
  usersModal.setAttribute("aria-hidden", "false");
}

function closeUsersModal(){
  if (!usersModal) return;
  usersModal.classList.remove("is-open");
  usersModal.setAttribute("aria-hidden", "true");
}

if (usersModal) {
  usersModal.querySelectorAll("[data-close='1']").forEach(el => {
    el.addEventListener("click", closeUsersModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && usersModal.classList.contains("is-open")) closeUsersModal();
  });
}

async function loadUsersIntoModal(){
  if (!usersList) return;
  usersList.innerHTML = `<p class="muted" style="margin:0;">Chargement…</p>`;

  const data = await apiJson("/api/admin/users");
  const users = data.users || [];

  if (!users.length) {
    usersList.innerHTML = `<p class="muted" style="margin:0;">Aucun user.</p>`;
    return;
  }

  usersList.innerHTML = users.map(u => `
    <div class="user-row" data-user-id="${u.id}">
      <div class="user-left">
        <div class="user-name">
          ${esc(u.username)}
          ${u.role === "admin" ? '<span class="badge ok">admin</span>' : '<span class="badge">user</span>'}
        </div>
        <div class="user-meta muted">Créé: ${esc(u.created_at || "")}</div>
      </div>

      <div class="user-actions">
        <input class="u-newpass" type="password" placeholder="Nouveau mot de passe" />
        <button class="btn btn-ghost icon-only u-savepass" type="button" title="Changer mot de passe">
          <span class="material-symbols-rounded">key</span>
        </button>
        <button class="btn btn-ghost icon-only u-del" type="button" title="Supprimer">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>
    </div>
  `).join("");

  // handlers
  usersList.querySelectorAll(".u-savepass").forEach(btn => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".user-row");
      const id = row?.dataset?.userId;
      const input = row?.querySelector(".u-newpass");
      const pw = String(input?.value || "").trim();

      if (!pw || pw.length < 6) {
        setUsersMsg("Mot de passe trop court (min 6).");
        return;
      }

      try{
        setUsersMsg("Enregistrement mot de passe…");
        await apiJson(`/api/admin/users/${id}/password`, {
          method:"PUT",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ password: pw })
        });
        input.value = "";
        setUsersMsg("Mot de passe modifié ✅");
      }catch(e){
        setUsersMsg("KO: " + e.message);
      }
    });
  });

  usersList.querySelectorAll(".u-del").forEach(btn => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".user-row");
      const id = row?.dataset?.userId;
      const name = row?.querySelector(".user-name")?.textContent?.trim() || "ce user";

      if (!confirm(`Supprimer ${name} ?`)) return;

      try{
        setUsersMsg("Suppression…");
        await apiJson(`/api/admin/users/${id}`, { method:"DELETE" });
        setUsersMsg("Supprimé ✅");
        await loadUsersIntoModal();
      }catch(e){
        setUsersMsg("KO: " + e.message);
      }
    });
  });
}

if (uListBtn) {
  uListBtn.addEventListener("click", async () => {
    try{
      openUsersModal();
      await loadUsersIntoModal();
    }catch(e){
      setUsersMsg("KO: " + e.message);
    }
  });
}

if (uAdd) {
  uAdd.addEventListener("click", async () => {
    const username = String(uUsername?.value || "").trim();
    const password = String(uPassword?.value || "").trim();
    const role = String(uRole?.value || "user");

    if (!username) return setUsersMsg("Username requis.");
    if (!password || password.length < 6) return setUsersMsg("Mot de passe trop court (min 6).");

    try{
      setUsersMsg("Création…");
      await apiJson("/api/admin/users", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ username, password, role })
      });

      uUsername.value = "";
      uPassword.value = "";
      uRole.value = "user";

      setUsersMsg("User ajouté ✅");
      // si modal ouvert -> refresh
      if (usersModal?.classList.contains("is-open")) {
        await loadUsersIntoModal();
      }
    }catch(e){
      setUsersMsg("KO: " + e.message);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login.html";
  });
}

(async () => {
  const u = await requireAdmin();
  if (!u) return;
  await loadTelegram();
})();
