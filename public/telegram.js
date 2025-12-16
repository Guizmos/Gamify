const enabled = document.getElementById("enabled");
const token = document.getElementById("token");
const chat = document.getElementById("chat");
const save = document.getElementById("save");
const msg = document.getElementById("msg");

async function mustAdmin() {
  const me = await fetch("/api/auth/me");
  const data = await me.json();
  if (!data.ok) location.href = "/login.html";
  if (data.user.role !== "admin") {
    msg.textContent = "Accès admin requis";
    save.disabled = true;
  }
}

async function load() {
  const res = await fetch("/api/admin/telegram");
  const data = await res.json();
  if (!data.ok) {
    location.href = "/login.html";
    return;
  }
  enabled.checked = !!data.telegram_enabled;
  token.value = data.telegram_bot_token || "";
  chat.value = data.telegram_chat_id || "";
}

save.addEventListener("click", async () => {
  msg.textContent = "Enregistrement…";
  const res = await fetch("/api/admin/telegram", {
    method: "PUT",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({
      telegram_enabled: enabled.checked,
      telegram_bot_token: token.value.trim(),
      telegram_chat_id: chat.value.trim(),
    })
  });
  const data = await res.json();
  msg.textContent = data.ok ? "OK ✅" : ("KO: " + (data.error || "Erreur"));
});

(async () => {
  await mustAdmin();
  await load();
})();
