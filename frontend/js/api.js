export const API = window.location.origin;

let onSessionExpired = () => {};

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

export function getToken() {
  return localStorage.getItem("tl_token");
}

export function setToken(t) {
  localStorage.setItem("tl_token", t);
}

export function clearToken() {
  localStorage.removeItem("tl_token");
}

export function getName() {
  return localStorage.getItem("tl_name") || "";
}

export function setName(n) {
  localStorage.setItem("tl_name", n);
}

export function clearName() {
  localStorage.removeItem("tl_name");
}

export function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

export async function apiFetch(url, opts = {}) {
  if (!opts.headers) opts.headers = authHeaders();
  const res = await fetch(url, opts);
  if (res.status === 401) {
    clearToken();
    clearName();
    onSessionExpired("Session expired. Please log in again.");
    throw new Error("Unauthorized");
  }
  return res;
}
