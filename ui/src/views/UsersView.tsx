import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { createUser, fetchUsers, updateUser, type UserRow } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Modal, Spinner, useToasts, inputCls, btnPrimary, btnCls } from "../components/ui";
import { usePageTitle } from "../theme";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "agent", label: "Agent" },
];

const thCls = "whitespace-nowrap border-b border-line px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-dim";
const tdCls = "whitespace-nowrap border-b border-line px-3 py-2.5 align-middle";

export default function UsersView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");
  const [busy, setBusy] = useState(false);
  const { me } = useAuth();
  const toasts = useToasts();
  usePageTitle("Users & roles");

  const load = useCallback(() => {
    fetchUsers().then(setUsers).catch(e => setErr(String(e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createUser(name, username, password, role);
      toasts.ok("User created");
      setShowModal(false);
      setName(""); setUsername(""); setPassword(""); setRole("manager");
      load();
    } catch (e2) { toasts.err(String(e2)); }
    finally { setBusy(false); }
  };

  const toggleActive = async (u: UserRow) => {
    try {
      await updateUser(u.id, { active: u.active ? 0 : 1 });
      toasts.ok(`${u.name} ${u.active ? "disabled" : "enabled"}`);
      load();
    } catch (e2) { toasts.err(String(e2)); }
  };

  const changeRole = async (u: UserRow, newRole: string) => {
    try {
      await updateUser(u.id, { role: newRole });
      toasts.ok(`${u.name} is now ${newRole}`);
      load();
    } catch (e2) { toasts.err(String(e2)); }
  };

  const resetPassword = async (u: UserRow) => {
    const pwd = window.prompt(`New password for ${u.username}:`);
    if (!pwd) return;
    try {
      await updateUser(u.id, { password: pwd });
      toasts.ok("Password updated");
    } catch (e2) { toasts.err(String(e2)); }
  };

  return (
    <div className="flex flex-col gap-4">
      {toasts.node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight text-ink">Users & roles</h1>
          <p className="mt-0.5 text-[13px] text-dim">admin · manager · agent — manage access to the system</p>
        </div>
        <button className={`${btnPrimary} px-3 py-1.5 text-xs`} onClick={() => setShowModal(true)}>
          <Plus size={15} /> New user
        </button>
      </div>

      {loading ? <Spinner /> : err ? <ErrorBox error={err} /> : users.length === 0 ? <Empty /> : (
        <div className="rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-[13.5px]">
              <thead>
                <tr>
                  <th className={thCls}>Name</th>
                  <th className={thCls}>Username</th>
                  <th className={thCls}>Role</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Created</th>
                  <th className={thCls}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="transition-colors hover:bg-hover">
                    <td className={tdCls}>
                      <span className="inline-flex items-center gap-2">
                        <UserRound size={15} className="text-dim" />
                        <b className="text-ink">{u.name}</b>
                        {u.id === me?.id && <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">you</span>}
                      </span>
                    </td>
                    <td className={tdCls}><span className="text-dim">{u.username}</span></td>
                    <td className={tdCls}>
                      <select value={u.role} disabled={u.id === me?.id}
                        onChange={e => changeRole(u, e.target.value)}
                        className="cursor-pointer rounded-md border border-line2 bg-[var(--input)] px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className={tdCls}>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${u.active ? "bg-good/15 text-[#6ee7b7]" : "bg-bad/15 text-[#fca5a5]"}`}>
                        {u.active ? "active" : "disabled"}
                      </span>
                    </td>
                    <td className={tdCls}><span className="text-xs text-dim">{u.created_at ? new Date(u.created_at * 1000).toLocaleDateString() : "–"}</span></td>
                    <td className={tdCls}>
                      <div className="flex gap-1.5">
                        <button className="grid h-6 w-6 place-items-center rounded-md border border-line text-dim transition-colors hover:border-accent hover:text-accent" title="Reset password" onClick={() => resetPassword(u)}>
                          <KeyRound size={14} />
                        </button>
                        <button className="grid h-6 w-6 place-items-center rounded-md border border-line text-dim transition-colors hover:border-accent hover:text-accent" title={u.active ? "Disable" : "Enable"}
                          onClick={() => toggleActive(u)}>
                          <ShieldCheck size={14} />
                        </button>
                        {u.id !== me?.id && (
                          <button className="grid h-6 w-6 place-items-center rounded-md border border-line text-dim transition-colors hover:border-bad hover:text-bad" title="Disable account" onClick={() => toggleActive(u)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title="Create a user" onClose={() => setShowModal(false)}>
          <form onSubmit={add} className="grid gap-3.5">
            <label className="grid gap-1.5 text-xs font-semibold text-dim">
              <span>Full name</span>
              <input autoFocus className={inputCls} placeholder="e.g. Dana Price" value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-dim">
              <span>Username</span>
              <input className={inputCls} placeholder="dana" value={username} onChange={e => setUsername(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-dim">
              <span>Password</span>
              <input type="password" className={inputCls} placeholder="min 6 characters" value={password}
                onChange={e => setPassword(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-dim">
              <span>Role</span>
              <select className="cursor-pointer rounded-lg border border-line2 bg-[var(--input)] px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2.5">
              <button type="button" className={btnCls} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={btnPrimary} disabled={busy || !name || !username || password.length < 6}>
                {busy ? "Creating…" : "Create user"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}