import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { createUser, fetchUsers, updateUser, type UserRow } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Modal, Spinner, useToasts } from "../components/ui";
import { usePageTitle } from "../theme";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "agent", label: "Agent" },
];

export default function UsersView() {
  usePageTitle("Users & roles");
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
    <div className="page">
      {toasts.node}
      <div className="page-head">
        <div>
          <h1>Users & roles</h1>
          <p className="page-sub">admin · manager · agent — manage access to the system</p>
        </div>
        <button className="btn primary sm" onClick={() => setShowModal(true)}><Plus size={15} /> New user</button>
      </div>

      {loading ? <Spinner /> : err ? <ErrorBox error={err} /> : users.length === 0 ? <Empty /> : (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <span className="user-cell">
                      <UserRound size={15} />
                      <b>{u.name}</b>
                      {u.id === me?.id && <span className="chip">you</span>}
                    </span>
                  </td>
                  <td>{u.username}</td>
                  <td>
                    <select value={u.role} disabled={u.id === me?.id}
                      onChange={e => changeRole(u, e.target.value)} className="role-select">
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.active ? "resolved" : "unresolved"}`}>
                      {u.active ? "active" : "disabled"}
                    </span>
                  </td>
                  <td className="dim small">{u.created_at ? new Date(u.created_at * 1000).toLocaleDateString() : "–"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn sm" title="Reset password" onClick={() => resetPassword(u)}>
                        <KeyRound size={14} />
                      </button>
                      <button className="icon-btn sm" title={u.active ? "Disable" : "Enable"}
                        onClick={() => toggleActive(u)}>
                        <ShieldCheck size={14} />
                      </button>
                      {u.id !== me?.id && (
                        <button className="icon-btn sm danger" title="Disable account" onClick={() => toggleActive(u)}>
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
      )}

      {showModal && (
        <Modal title="Create a user" onClose={() => setShowModal(false)}>
          <form onSubmit={add} className="modal-form">
            <label>
              <span>Full name</span>
              <input autoFocus placeholder="e.g. Dana Price" value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label>
              <span>Username</span>
              <input placeholder="dana" value={username} onChange={e => setUsername(e.target.value)} />
            </label>
            <label>
              <span>Password</span>
              <input type="password" placeholder="min 6 characters" value={password}
                onChange={e => setPassword(e.target.value)} />
            </label>
            <label>
              <span>Role</span>
              <select value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" disabled={busy || !name || !username || password.length < 6}>
                {busy ? "Creating…" : "Create user"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}