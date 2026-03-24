import { createContext, useCallback, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem("tl_token"));
  const [user, setUser] = useState(() => {
    const name = localStorage.getItem("tl_name");
    return name ? { display_name: name } : null;
  });
  const navigate = useNavigate();

  function persistToken(t) {
    setTokenState(t);
    if (t) localStorage.setItem("tl_token", t);
    else localStorage.removeItem("tl_token");
  }

  function persistUser(u) {
    setUser(u);
    if (u) localStorage.setItem("tl_name", u.display_name);
    else localStorage.removeItem("tl_name");
  }

  const apiFetch = useCallback(
    async (url, opts = {}) => {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      };
      const res = await fetch(url, { ...opts, headers });
      if (res.status === 401) {
        persistToken(null);
        persistUser(null);
        navigate("/");
        throw new Error("Unauthorized");
      }
      return res;
    },
    [token, navigate]
  );

  async function login(username, password) {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail || "Login failed");
    }
    const data = await res.json();
    persistToken(data.token);
    persistUser({ display_name: data.display_name, username: data.username, is_admin: data.is_admin });
    return data;
  }

  async function register(display_name, username, password) {
    const res = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name, username, password }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail || "Registration failed");
    }
    const data = await res.json();
    persistToken(data.token);
    persistUser({ display_name: data.display_name, username: data.username, is_admin: data.is_admin });
    return data;
  }

  async function logout() {
    if (token) {
      await fetch("/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    persistToken(null);
    persistUser(null);
    navigate("/");
  }

  function updateUser(updates) {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("tl_name", next.display_name);
      return next;
    });
  }

  function updateToken(t) {
    persistToken(t);
  }

  return (
    <AuthContext.Provider value={{ token, user, apiFetch, login, register, logout, updateUser, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
