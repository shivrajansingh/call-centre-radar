import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Radar } from "lucide-react";
import { useAuth } from "../auth";
import { ErrorBox } from "../components/ui";
import { usePageTitle } from "../theme";

export default function LoginView() {
  usePageTitle("Sign in");
  const { me, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-icon lg"><Radar size={30} /></span>
          <h1>Call-Centre Radar</h1>
          <p>Conversation intelligence for support teams</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label>
            <span>Username</span>
            <input autoFocus value={username} onChange={e => setUsername(e.target.value)}
              placeholder="admin" autoComplete="username" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" />
          </label>
          {error && <ErrorBox error={error} />}
          <button className="btn primary block" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="login-hint">Default credentials: <code>admin</code> / <code>admin123</code></p>
      </div>
    </div>
  );
}