import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function SettingsPage() {
  const { apiFetch, logout, updateUser, updateToken } = useAuth();
  const { icon, cycleTheme } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const [statusDN, setStatusDN] = useState({ msg: "", error: false });
  const [statusUN, setStatusUN] = useState({ msg: "", error: false });
  const [statusPW, setStatusPW] = useState({ msg: "", error: false });
  const [statusDel, setStatusDel] = useState({ msg: "", error: false });

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await apiFetch("/me");
        if (!res.ok) return;
        const u = await res.json();
        setDisplayName(u.display_name || "");
        setUsername(u.username || "");
        updateUser({ display_name: u.display_name, username: u.username, is_admin: u.is_admin });
      } catch (e) {}
    }
    loadProfile();
  }, []);

  async function saveDisplayName(e) {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) { setStatusDN({ msg: "Name cannot be empty.", error: true }); return; }
    setStatusDN({ msg: "", error: false });
    try {
      const res = await apiFetch("/me", { method: "PATCH", body: JSON.stringify({ display_name: name }) });
      if (!res.ok) throw new Error((await res.json()).detail);
      const u = await res.json();
      updateUser({ display_name: u.display_name });
      setStatusDN({ msg: "Saved.", error: false });
    } catch (e) {
      if (e.message !== "Unauthorized") setStatusDN({ msg: e.message, error: true });
    }
  }

  async function saveUsername(e) {
    e.preventDefault();
    const uname = username.trim();
    if (!uname) { setStatusUN({ msg: "Enter a username.", error: true }); return; }
    if (!usernamePassword) { setStatusUN({ msg: "Enter your current password.", error: true }); return; }
    setStatusUN({ msg: "", error: false });
    try {
      const res = await apiFetch("/me/username", {
        method: "PATCH",
        body: JSON.stringify({ username: uname, current_password: usernamePassword }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      const data = await res.json();
      updateToken(data.token);
      setUsernamePassword("");
      setStatusUN({ msg: "Username updated. You can keep using the app; other devices need to sign in again.", error: false });
    } catch (e) {
      if (e.message !== "Unauthorized") setStatusUN({ msg: e.message, error: true });
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (!pwCurrent) { setStatusPW({ msg: "Enter your current password.", error: true }); return; }
    if (pwNew.length < 6) { setStatusPW({ msg: "New password must be at least 6 characters.", error: true }); return; }
    if (pwNew !== pwNew2) { setStatusPW({ msg: "New passwords do not match.", error: true }); return; }
    setStatusPW({ msg: "", error: false });
    try {
      const res = await apiFetch("/me/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      const data = await res.json();
      setPwCurrent(""); setPwNew(""); setPwNew2("");
      setStatusPW({ msg: data.detail || "Password updated.", error: false });
    } catch (e) {
      if (e.message !== "Unauthorized") setStatusPW({ msg: e.message, error: true });
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    if (!deletePassword) { setStatusDel({ msg: "Enter your password to confirm.", error: true }); return; }
    if (!confirm("Delete your account and all logged time and labels? This cannot be undone.")) return;
    setStatusDel({ msg: "", error: false });
    try {
      const res = await apiFetch("/me/delete-account", {
        method: "POST",
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      logout();
    } catch (e) {
      if (e.message !== "Unauthorized") setStatusDel({ msg: e.message, error: true });
    }
  }

  return (
    <div className="settings-page">
      <header className="app-header">
        <div className="settings-header-left">
          <Link className="header-btn secondary sm" to="/" style={{ textDecoration: "none" }}>← Back</Link>
          <h1>Settings</h1>
        </div>
        <div className="header-actions">
          <button className="header-btn icon-only" onClick={cycleTheme} title="Switch theme">{icon}</button>
          <button className="header-btn" onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* Display name */}
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <div className="card-inner">
          <div className="section-label">Display name</div>
          <form onSubmit={saveDisplayName}>
            <div className="field">
              <label htmlFor="settings-display-name">Name shown in the app</label>
              <input
                id="settings-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <button type="submit" className="sm">Save</button>
            {statusDN.msg && <p className={`status${statusDN.error ? " error" : ""}`}>{statusDN.msg}</p>}
          </form>
        </div>
      </div>

      {/* Username */}
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <div className="card-inner">
          <div className="section-label">Username</div>
          <p className="settings-hint">Changing your username will invalidate sessions on other devices.</p>
          <form onSubmit={saveUsername}>
            <div className="field">
              <label htmlFor="settings-username">New username</label>
              <input
                id="settings-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="settings-username-password">Current password</label>
              <input
                id="settings-username-password"
                type="password"
                autoComplete="current-password"
                value={usernamePassword}
                onChange={(e) => setUsernamePassword(e.target.value)}
              />
            </div>
            <button type="submit" className="sm">Save</button>
            {statusUN.msg && <p className={`status${statusUN.error ? " error" : ""}`}>{statusUN.msg}</p>}
          </form>
        </div>
      </div>

      {/* Password */}
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <div className="card-inner">
          <div className="section-label">Password</div>
          <form onSubmit={savePassword}>
            <div className="field">
              <label htmlFor="settings-pw-current">Current password</label>
              <input
                id="settings-pw-current"
                type="password"
                autoComplete="current-password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="settings-pw-new">New password</label>
              <input
                id="settings-pw-new"
                type="password"
                autoComplete="new-password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="settings-pw-new2">Confirm new password</label>
              <input
                id="settings-pw-new2"
                type="password"
                autoComplete="new-password"
                value={pwNew2}
                onChange={(e) => setPwNew2(e.target.value)}
              />
            </div>
            <button type="submit" className="sm">Change password</button>
            {statusPW.msg && <p className={`status${statusPW.error ? " error" : ""}`}>{statusPW.msg}</p>}
          </form>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card settings-danger-card">
        <div className="card-inner">
          <div className="section-label">Danger zone</div>
          <p className="settings-hint">Deleting your account is permanent and cannot be undone. All your time logs and labels will be erased.</p>
          <form onSubmit={deleteAccount}>
            <div className="field">
              <label htmlFor="settings-delete-password">Confirm with your password</label>
              <input
                id="settings-delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <button type="submit" className="danger sm">Delete account</button>
            {statusDel.msg && <p className={`status${statusDel.error ? " error" : ""}`}>{statusDel.msg}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
