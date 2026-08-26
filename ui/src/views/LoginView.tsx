import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Radar } from "lucide-react";
import { useAuth } from "../auth";
import { ErrorBox, btnPrimary, inputCls } from "../components/ui";
import { usePageTitle } from "../theme";

export default function LoginView() {
  const { me, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  usePageTitle("Sign in");

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
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-[380px] rounded-2xl border border-line2 bg-gradient-to-b from-surface to-deep p-8 shadow-[var(--shadow)]">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-13 w-13 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent2 p-3.5 text-white shadow-[0_4px_14px_rgba(56,189,248,.35)]">
            <Radar size={30} />
          </span>
          <h1 className="mb-1 text-xl font-bold text-ink">Call-Centre Radar</h1>
          <p className="text-[13px] text-dim">Conversation intelligence for support teams</p>
        </div>
        <form onSubmit={submit} className="grid gap-3.5">
          <label className="grid gap-1.5 text-xs font-semibold text-dim">
            <span>Username</span>
            <input autoFocus className={inputCls} value={username} onChange={e => setUsername(e.target.value)}
              placeholder="admin" autoComplete="username" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-dim">
            <span>Password</span>
            <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" />
          </label>
          {error && <ErrorBox error={error} />}
          <button className={`${btnPrimary} w-full`} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-dim">
          Default credentials: <code>admin</code> / <code>admin123</code>
        </p>
      </div>
    </div>
  );
}