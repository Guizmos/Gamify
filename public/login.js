const u = document.getElementById("u");
const p = document.getElementById("p");
const btn = document.getElementById("btn");
const msg = document.getElementById("msg");

btn.addEventListener("click", async () => {
  msg.textContent = "…";
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ username: u.value.trim(), password: p.value })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Erreur login");
    window.location.href = "/";
  } catch (e) {
    msg.textContent = e.message;
  }
});
