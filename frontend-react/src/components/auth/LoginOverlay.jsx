import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function LoginOverlay() {
  const { login, register } = useAuth();
  const { icon, cycleTheme } = useTheme();

  const [panel, setPanel] = useState("login"); // "login" | "register"
  const [showForgot, setShowForgot] = useState(false);

  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginStatus, setLoginStatus] = useState("");

  const [regName, setRegName] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regStatus, setRegStatus] = useState("");

  async function handleLogin(e) {
    e?.preventDefault();
    setLoginStatus("");
    try {
      await login(loginUser, loginPass);
    } catch (err) {
      setLoginStatus(err.message);
    }
  }

  async function handleRegister(e) {
    e?.preventDefault();
    setRegStatus("");
    try {
      await register(regName, regUser, regPass);
    } catch (err) {
      setRegStatus(err.message);
    }
  }

  return (
    <div id="login-overlay">
      <div className="login-card">
        <div className="login-card-header">
          <span className="wordmark">LifeLogger</span>
          <button className="login-theme-btn" onClick={cycleTheme} title="Switch theme">
            {icon}
          </button>
        </div>

        {panel === "login" ? (
          <form onSubmit={handleLogin}>
            <h2>Sign in</h2>
            <div className="field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
              />
            </div>
            <button type="submit" className="full">Sign in</button>
            {loginStatus && <p className="status error">{loginStatus}</p>}

            <div className="forgot-password-wrap">
              <button
                type="button"
                className="forgot-password-toggle"
                onClick={() => setShowForgot((v) => !v)}
              >
                Forgot password?
              </button>
              <div className={`forgot-password-panel${showForgot ? " open" : ""}`}>
                Password resets are handled by an admin. Contact your administrator to have your password reset.
              </div>
            </div>

            <div className="auth-switch">
              No account?{" "}
              <a onClick={() => { setPanel("register"); setLoginStatus(""); }}>Register</a>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <h2>Create account</h2>
            <div className="field">
              <label htmlFor="reg-name">Display name</label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                type="text"
                autoComplete="username"
                value={regUser}
                onChange={(e) => setRegUser(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={regPass}
                onChange={(e) => setRegPass(e.target.value)}
              />
            </div>
            <button type="submit" className="full">Create account</button>
            {regStatus && <p className="status error">{regStatus}</p>}

            <div className="auth-switch">
              Have an account?{" "}
              <a onClick={() => { setPanel("login"); setRegStatus(""); }}>Sign in</a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
