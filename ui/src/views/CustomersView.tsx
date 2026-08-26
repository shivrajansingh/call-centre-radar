import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { createCustomer, fetchCustomers, type CustomerRow } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Modal, ScoreBadge, Spinner, StarRating, useToasts } from "../components/ui";
import { usePageTitle } from "../theme";

export default function CustomersView() {
  usePageTitle("Customers");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const { me } = useAuth();
  const toasts = useToasts();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers().then(setCustomers).catch(e => setErr(String(e))).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => customers.filter(c => c.name.toLowerCase().includes(q.toLowerCase())),
    [customers, q]
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { id } = await createCustomer(newName);
      toasts.ok("Customer registered");
      setShowModal(false);
      setNewName("");
      navigate(`/customers/${id}`);
    } catch (e2) { toasts.err(String(e2)); }
  };

  const isManager = me?.role === "manager" || me?.role === "admin";

  return (
    <div className="page">
      {toasts.node}
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p className="page-sub">{customers.length} customers · {filtered.length} shown</p>
        </div>
        {isManager && (
          <button className="btn primary sm" onClick={() => setShowModal(true)}><Plus size={15} /> Register customer</button>
        )}
      </div>

      {loading ? <Spinner /> : err ? <ErrorBox error={err} /> : (
        <div className="card">
          <div className="search-box">
            <Search size={15} />
            <input placeholder="Search customers…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {filtered.length === 0 ? <Empty message="No customers" /> : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Customer</th><th>Calls</th><th>Unresolved</th><th>Avg attention</th>
                  <th>Avg QA stars</th><th>Last call</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                    <td><Link to={`/customers/${c.id}`} onClick={e => e.stopPropagation()}>{c.name}</Link></td>
                    <td><b>{c.call_count}</b></td>
                    <td>{c.unresolved_count ? <span className="text-warn">{c.unresolved_count}</span> : 0}</td>
                    <td><ScoreBadge score={c.avg_attention} /></td>
                    <td>{c.avg_review_stars != null ? <StarRating value={c.avg_review_stars} size={14} /> : <span className="dim">–</span>}</td>
                    <td className="dim">{c.last_call_at ? new Date(c.last_call_at).toLocaleDateString() : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <Modal title="Register a customer" onClose={() => setShowModal(false)}>
          <form onSubmit={add} className="modal-form">
            <label>
              <span>Full name</span>
              <input autoFocus placeholder="e.g. Jane Doe" value={newName}
                onChange={e => setNewName(e.target.value)} />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" disabled={!newName.trim()}>Register</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}