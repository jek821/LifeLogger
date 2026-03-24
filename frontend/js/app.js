import { API, apiFetch, getName, getToken, setName, setSessionExpiredHandler } from "./api.js";
import {
  login,
  logout,
  register,
  registerNav,
  showLoginPanel,
  showRegisterPanel,
  submitChangePassword,
  toggleForgotPassword,
} from "./auth.js";
import { addLabel, deleteLabel, loadLabels } from "./labels.js";
import {
  addManualEntry,
  deleteHistEvent,
  loadHistory,
  saveEdit,
  showEditForm,
  toggleAddForm,
} from "./history.js";
import { applyTheme, cycleTheme, setAdminNav } from "./theme.js";
import { queryStats, switchTab } from "./stats.js";
import { loadActiveEvent, startEvent, stopEvent, stopTimerTick } from "./timer.js";
import { toggleAccordion } from "./ui.js";

function showLogin(msg) {
  showLoginPanel();
  document.getElementById("login-overlay").classList.remove("hidden");
  document.getElementById("app").style.display = "none";
  stopTimerTick();
  if (msg) document.getElementById("login-status").textContent = msg;
}

function showApp() {
  document.getElementById("login-overlay").classList.add("hidden");
  document.getElementById("app").style.display = "flex";
  const name = getName();
  document.getElementById("user-name-display").textContent = name ? `${name}'s Log` : "My Log";
  document.title = name ? `${name}'s Life Logger` : "Life Logger";
  initApp();
}

async function initApp() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll("input[type='date']").forEach((el) => {
    el.value = today;
  });
  await Promise.all([loadLabels(), loadActiveEvent()]);
}

registerNav({ showApp, showLogin });

setSessionExpiredHandler((msg) => {
  showLogin(msg);
});

document.getElementById("login-user").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
document.getElementById("login-pass").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
document.getElementById("reg-pass").addEventListener("keydown", (e) => {
  if (e.key === "Enter") register();
});
document.getElementById("new-label").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addLabel();
});

applyTheme(localStorage.getItem("tl_theme") || "dark");

if (getToken()) {
  apiFetch(`${API}/me`)
    .then(async (res) => {
      if (res.ok) {
        const u = await res.json();
        setName(u.display_name);
        setAdminNav(!!u.is_admin);
        showApp();
      } else showLogin();
    })
    .catch((e) => {
      if (e.message !== "Unauthorized") showLogin();
    });
} else {
  showLogin();
}

Object.assign(window, {
  cycleTheme,
  toggleForgotPassword,
  showRegisterPanel,
  showLoginPanel,
  login,
  register,
  logout,
  stopEvent,
  toggleAccordion,
  addLabel,
  loadHistory,
  toggleAddForm,
  addManualEntry,
  switchTab,
  queryStats,
  submitChangePassword,
  deleteLabel,
  startEvent,
  showEditForm,
  saveEdit,
  deleteHistEvent,
});
