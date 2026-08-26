import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { createAgent, fetchAgents, type AgentRow } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Modal, ScoreBadge, Spinner, StarRating, useToasts } from "../components/ui";
import { usePageTitle } from "../theme";

export default function AgentsView() {
  usePageTitle("Agents");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const { me } = useAuth();
  const toasts = useToasts();
  const navigate = useNavigate();

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
    <div className="page">
      {toasts.node}
      <div className="page-head">
        <div>
          <h1>Agents</h1>
          <p className="page-sub">{agents.length} agents · ranked by volume</p>
        </div>
        {isManager && (
          <button className="btn primary sm" onClick={() => setShowModal(true)}><Plus size={15} /> Register agent</button>
        )}
      </div>

      {loading ? <Spinner /> : err ? <ErrorBox error={err} /> : (
        <div className="card">
          <div className="search-box">
            <Search size={15} />
            <input placeholder="Search agents…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {filtered.length === 0 ? <Empty /> : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Agent</th><th>Volume</th><th>Handle time</th><th>Resolution rate</th>
                  <th>Avg attention</th><th>Mood shifts</th><th>Avg QA stars</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="clickable" onClick={() => navigate(`/agents/${a.id}`)}>
                    <td><b>{a.name}</b></td>
                    <td>
                      <div className="vol-cell">
                        <div className="bar" style={{ width: `${(a.call_count / maxCalls) * 100}%` }} />
                        <span>{a.call_count}</span>
                      </div>
                    </td>
                    <td>{a.avg_handle_time_s != null ? `${Math.round(a.avg_handle_time_s)}s` : "–"}</td>
                    <td>{a.resolution_rate != null ? `${Math.round(a.resolution_rate * 100)}%` : "–"}</td>
                    <td><ScoreBadge score={a.avg_attention_score} /></td>
                    <td>{a.mood_shifts ?? "–"}</td>
                    <td>{a.avg_review_stars != null ? <StarRating value={a.avg_review_stars} size={14} /> : <span className="dim">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <Modal title="Register an agent" onClose={() => setShowModal(false)}>
          <form onSubmit={add} className="modal-form">
            <label>
              <span>Full name</span>
              <input autoFocus placeholder="e.g. Sam Carter" value={newName}
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