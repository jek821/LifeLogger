import { API, apiFetch, clearName, clearToken, getToken, setName, setSessionExpiredHandler, setToken } from "./api.js";
import { applyTheme, cycleTheme, setAdminNav } from "./theme.js";

function redirectHome() {
  window.location.href = "/";
}

if (!getToken()) {
  redirectHome();
}

setSessionExpiredHandler(() => {
  clearToken();
  clearName();
  redirectHome();
});

applyTheme(localStorage.getItem("tl_theme") || "dark");

document.getElementById("settings-theme-btn").addEventListener("click", () => cycleTheme());

document.getElementById("settings-logout").addEventListener("click", async () => {
  await fetch(`${API}/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
  }).catch(() => {});
  clearToken();
  clearName();
  redirectHome();
});

async function loadProfile() {
  const res = await apiFetch(`${API}/me`);
  if (!res.ok) {
    redirectHome();
    return;
  }
  const u = await res.json();
  document.getElementById("settings-display-name").value = u.display_name || "";
  document.getElementById("settings-username").value = u.username || "";
  setName(u.display_name);
  setAdminNav(!!u.is_admin);
}

function setStatus(id, msg, isError) {
  const el = document.getElementById(id);
  el.className = isError ? "status error" : "status";
  el.textContent = msg || "";
}

document.getElementById("btn-save-display-name").addEventListener("click", async () => {
  const display_name = document.getElementById("settings-display-name").value.trim();
  setStatus("status-display-name", "", false);
  if (!display_name) {
    setStatus("status-display-name", "Name cannot be empty.", true);
    return;
  }
  try {
    const res = await apiFetch(`${API}/me`, {
      method: "PATCH",
      body: JSON.stringify({ display_name }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    const u = await res.json();
    setName(u.display_name);
    setStatus("status-display-name", "Saved.");
  } catch (e) {
    if (e.message === "Unauthorized") return;
    setStatus("status-display-name", e.message, true);
  }
});

document.getElementById("btn-save-username").addEventListener("click", async () => {
  const username = document.getElementById("settings-username").value.trim();
  const current_password = document.getElementById("settings-username-password").value;
  setStatus("status-username", "", false);
  if (!username) {
    setStatus("status-username", "Enter a username.", true);
    return;
  }
  if (!current_password) {
    setStatus("status-username", "Enter your current password.", true);
    return;
  }
  try {
    const res = await apiFetch(`${API}/me/username`, {
      method: "PATCH",
      body: JSON.stringify({ username, current_password }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    const data = await res.json();
    setToken(data.token);
    document.getElementById("settings-username-password").value = "";
    setStatus("status-username", "Username updated. You can keep using the app; other devices need to sign in again.");
  } catch (e) {
    if (e.message === "Unauthorized") return;
    setStatus("status-username", e.message, true);
  }
});

document.getElementById("btn-save-password").addEventListener("click", async () => {
  const cur = document.getElementById("settings-pw-current").value;
  const nw = document.getElementById("settings-pw-new").value;
  const nw2 = document.getElementById("settings-pw-new2").value;
  setStatus("status-password", "", false);
  if (!cur) {
    setStatus("status-password", "Enter your current password.", true);
    return;
  }
  if (nw.length < 6) {
    setStatus("status-password", "New password must be at least 6 characters.", true);
    return;
  }
  if (nw !== nw2) {
    setStatus("status-password", "New passwords do not match.", true);
    return;
  }
  try {
    const res = await apiFetch(`${API}/me/change-password`, {
      method: "POST",
      body: JSON.stringify({ current_password: cur, new_password: nw }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    const data = await res.json();
    document.getElementById("settings-pw-current").value = "";
    document.getElementById("settings-pw-new").value = "";
    document.getElementById("settings-pw-new2").value = "";
    setStatus("status-password", data.detail || "Password updated.");
  } catch (e) {
    if (e.message === "Unauthorized") return;
    setStatus("status-password", e.message, true);
  }
});

document.getElementById("btn-delete-account").addEventListener("click", async () => {
  const password = document.getElementById("settings-delete-password").value;
  setStatus("status-delete", "", false);
  if (!password) {
    setStatus("status-delete", "Enter your password to confirm.", true);
    return;
  }
  if (
    !confirm(
      "Delete your account and all logged time and labels? This cannot be undone."
    )
  ) {
    return;
  }
  try {
    const res = await apiFetch(`${API}/me/delete-account`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    clearToken();
    clearName();
    window.location.href = "/";
  } catch (e) {
    if (e.message === "Unauthorized") return;
    setStatus("status-delete", e.message, true);
  }
});

loadProfile().catch(() => redirectHome());
