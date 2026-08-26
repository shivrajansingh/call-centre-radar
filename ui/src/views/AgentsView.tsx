import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { createAgent, fetchAgents, type AgentRow } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Modal, ScoreBadge, Spinner, StarRating, useToasts, inputCls, btnPrimary, btnCls } from "../components/ui";
import { usePageTitle } from "../theme";

const thCls = "whitespace-nowrap border-b border-line px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-dim";
const tdCls = "whitespace-nowrap border-b border-line px-3 py-2.5 align-middle";

export default function AgentsView() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const { me } = useAuth();
  const toasts = useToasts();
  const navigate = useNavigate();
  usePageTitle("Agents");

  useEffect(() => {
    fetchAgents().then(setAgents).catch(e => setErr(String(e))).finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter(a => a.name.toLowerCase().includes(q.toLowerCase()));
  const maxCalls = Math.max(1, ...agents.map(a => a.call_count));
  const isManager = me?.role === "manager" || me?.role === "admin";

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { id } = await createAgent(newName);
      toasts.ok("Agent registered");
      setShowModal(false);
      setNewName("");
      navigate(`/agents/${id}`);
    } catch (e2) { toasts.err(String(e2)); }
  };

  return (
    <div className="flex flex-col gap-4">
      {toasts.node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight text-ink">Agents</h1>
          <p className="mt-0.5 text-[13px] text-dim">{agents.length} agents · ranked by volume</p>
        </div>
        {isManager && (
          <button className={`${btnPrimary} px-3 py-1.5 text-xs`} onClick={() => setShowModal(true)}>
            <Plus size={15} /> Register agent
          </button>
        )}
      </div>

      {loading ? <Spinner /> : err ? <ErrorBox error={err} /> : (
        <div className="rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
          <div className="border-b border-line p-3">
            <div className="relative min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input placeholder="Search agents…" value={q} onChange={e => setQ(e.target.value)}
                className="w-full rounded-lg border border-line2 bg-[var(--input)] py-2 pl-9 pr-3 text-sm text-ink placeholder:text-dim/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15" />
            </div>
          </div>
          {filtered.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className={thCls}>Agent</th>
                    <th className={thCls}>Volume</th>
                    <th className={thCls}>Handle time</th>
                    <th className={thCls}>Resolution rate</th>
                    <th className={thCls}>Avg attention</th>
                    <th className={thCls}>Mood shifts</th>
                    <th className={thCls}>Avg QA stars</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.id} className="cursor-pointer transition-colors hover:bg-hover" onClick={() => navigate(`/agents/${a.id}`)}>
                      <td className={tdCls}><b className="text-ink">{a.name}</b></td>
                      <td className={tdCls}>
                        <div className="flex min-w-[130px] items-center gap-2">
                          <div className="h-1.5 min-w-1 overflow-hidden rounded-full bg-line">
                            <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                              style={{ width: `${Math.max(4, (a.call_count / maxCalls) * 100)}%` }} />
                          </div>
                          <span className="text-ink">{a.call_count}</span>
                        </div>
                      </td>
                      <td className={tdCls}><span className="text-ink">{a.avg_handle_time_s != null ? `${Math.round(a.avg_handle_time_s)}s` : "–"}</span></td>
                      <td className={tdCls}><span className="text-ink">{a.resolution_rate != null ? `${Math.round(a.resolution_rate * 100)}%` : "–"}</span></td>
                      <td className={tdCls}><ScoreBadge score={a.avg_attention_score} /></td>
                      <td className={tdCls}><span className="text-ink">{a.mood_shifts ?? "–"}</span></td>
                      <td className={tdCls}>{a.avg_review_stars != null ? <StarRating value={a.avg_review_stars} size={14} /> : <span className="text-dim">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <Modal title="Register an agent" onClose={() => setShowModal(false)}>
          <form onSubmit={add} className="grid gap-3.5">
            <label className="grid gap-1.5 text-xs font-semibold text-dim">
              <span>Full name</span>
              <input autoFocus className={inputCls} placeholder="e.g. Sam Carter" value={newName}
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