import { API, clearName, clearToken, getName, setName, setToken } from "./api.js";
import { setAdminNav } from "./theme.js";

let nav = {
  showApp() {},
  showLogin(_msg) {},
};

export function registerNav(handlers) {
  nav = handlers;
}

export function closeForgotPasswordPanel() {
  const panel = document.getElementById("forgot-pw-panel");
  const btn = document.getElementById("forgot-pw-toggle");
  if (panel) panel.classList.remove("open");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

export function toggleForgotPassword() {
  const panel = document.getElementById("forgot-pw-panel");
  const btn = document.getElementById("forgot-pw-toggle");
  if (!panel || !btn) return;
  const open = panel.classList.toggle("open");
  btn.setAttribute("aria-expanded", open ? "true" : "false");
}

export function showLoginPanel() {
  document.getElementById("register-panel").style.display = "none";
  document.getElementById("login-panel").style.display = "";
  document.getElementById("login-status").textContent = "";
}

export function showRegisterPanel() {
  closeForgotPasswordPanel();
  document.getElementById("login-panel").style.display = "none";
  document.getElementById("register-panel").style.display = "";
  document.getElementById("login-status").textContent = "";
}

export async function login() {
  const username = document.getElementById("login-user").value.trim();
  const password = document.getElementById("login-pass").value;
  const status = document.getElementById("login-status");
  status.textContent = "";
  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    const data = await res.json();
    setToken(data.token);
    setName(data.display_name);
    setAdminNav(!!data.is_admin);
    document.getElementById("login-pass").value = "";
    nav.showApp();
  } catch (e) {
    status.textContent = e.message;
  }
}

export async function register() {
  const display_name = document.getElementById("reg-name").value.trim();
  const username = document.getElementById("reg-user").value.trim();
  const password = document.getElementById("reg-pass").value;
  const status = document.getElementById("login-status");
  status.textContent = "";
  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, display_name, password }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail);
    }
    const data = await res.json();
    setToken(data.token);
    setName(data.display_name);
    setAdminNav(!!data.is_admin);
    document.getElementById("reg-pass").value = "";
    nav.showApp();
  } catch (e) {
    status.textContent = e.message;
  }
}

export async function logout() {
  await fetch(`${API}/logout`, { method: "POST", headers: authHeadersForLogout() }).catch(() => {});
  clearToken();
  clearName();
  setAdminNav(false);
  nav.showLogin();
}

function authHeadersForLogout() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("tl_token")}` };
}
