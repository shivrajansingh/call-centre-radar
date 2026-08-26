import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { createCustomer, fetchCustomers, type CustomerRow } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Modal, ScoreBadge, Spinner, StarRating, useToasts, inputCls, btnPrimary, btnCls } from "../components/ui";
import { usePageTitle } from "../theme";

const thCls = "whitespace-nowrap border-b border-line px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-dim";
const tdCls = "whitespace-nowrap border-b border-line px-3 py-2.5 align-middle";

export default function CustomersView() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const { me } = useAuth();
  const toasts = useToasts();
  const navigate = useNavigate();
  usePageTitle("Customers");

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
    <div className="flex flex-col gap-4">
      {toasts.node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight text-ink">Customers</h1>
          <p className="mt-0.5 text-[13px] text-dim">{customers.length} customers · {filtered.length} shown</p>
        </div>
        {isManager && (
          <button className={`${btnPrimary} px-3 py-1.5 text-xs`} onClick={() => setShowModal(true)}>
            <Plus size={15} /> Register customer
          </button>
        )}
      </div>

      {loading ? <Spinner /> : err ? <ErrorBox error={err} /> : (
        <div className="rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
          <div className="border-b border-line p-3">
            <div className="relative min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input placeholder="Search customers…" value={q} onChange={e => setQ(e.target.value)}
                className="w-full rounded-lg border border-line2 bg-[var(--input)] py-2 pl-9 pr-3 text-sm text-ink placeholder:text-dim/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15" />
            </div>
          </div>
          {filtered.length === 0 ? <Empty message="No customers" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Calls</th>
                    <th className={thCls}>Unresolved</th>
                    <th className={thCls}>Avg attention</th>
                    <th className={thCls}>Avg QA stars</th>
                    <th className={thCls}>Last call</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="cursor-pointer transition-colors hover:bg-hover" onClick={() => navigate(`/customers/${c.id}`)}>
                      <td className={tdCls}>
                        <Link to={`/customers/${c.id}`} className="font-medium text-ink hover:text-accent" onClick={e => e.stopPropagation()}>{c.name}</Link>
                      </td>
                      <td className={tdCls}><b className="text-ink">{c.call_count}</b></td>
                      <td className={tdCls}>{c.unresolved_count ? <span className="font-semibold text-warn">{c.unresolved_count}</span> : <span className="text-dim">0</span>}</td>
                      <td className={tdCls}><ScoreBadge score={c.avg_attention} /></td>
                      <td className={tdCls}>{c.avg_review_stars != null ? <StarRating value={c.avg_review_stars} size={14} /> : <span className="text-dim">–</span>}</td>
                      <td className={tdCls} title={c.last_call_at ? new Date(c.last_call_at).toLocaleString() : ""}>
                        <span className="text-dim">{c.last_call_at ? new Date(c.last_call_at).toLocaleDateString() : "–"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <Modal title="Register a customer" onClose={() => setShowModal(false)}>
          <form onSubmit={add} className="grid gap-3.5">
            <label className="grid gap-1.5 text-xs font-semibold text-dim">
              <span>Full name</span>
              <input autoFocus className={inputCls} placeholder="e.g. Jane Doe" value={newName}
                onChange={e => setNewName(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2.5">
              <button type="button" className={btnCls} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={btnPrimary} disabled={!newName.trim()}>Register</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}