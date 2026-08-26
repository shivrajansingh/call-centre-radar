import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PhoneCall, Star, ThumbsUp, Users } from "lucide-react";
import { usePageTitle } from "../theme";
import { fetchCustomer, type CustomerDetail } from "../api";
import { Empty, ErrorBox, KpiCard, MoodBadge, ResBadge, ScoreBadge, Spinner } from "../components/ui";

export default function CustomerView() {
  const { id = "" } = useParams();
  const cid = Number(id);
  const navigate = useNavigate();
  const [cu, setCu] = useState<CustomerDetail | null>(null);
  const [err, setErr] = useState("");
  usePageTitle(cu ? `Customer: ${cu.name}` : null);

  const load = useCallback(() => {
    fetchCustomer(cid).then(setCu).catch(e => setErr(String(e)));
  }, [cid]);
  useEffect(() => { load(); }, [load]);

  if (err) return <ErrorBox error={err} />;
  if (!cu) return <Spinner full />;

  const s = cu.stats;
  const known = (s.resolved_count ?? 0) + (s.unresolved_count ?? 0);
  const rate = known ? (s.resolved_count ?? 0) / known : null;
  const ratePct = rate != null ? Math.round(rate * 100) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-left">
          <Link to="/customers" className="btn ghost sm"><ArrowLeft size={14} /> Customers</Link>
          <div>
            <h1>{cu.name}</h1>
            <p className="page-sub">{s.call_count} calls in total</p>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total calls" value={s.call_count} icon={<PhoneCall size={16} />} />
        <KpiCard label="Resolution rate" value={ratePct != null ? `${ratePct}%` : "–"}
          sub={`${s.resolved_count} resolved · ${s.unresolved_count} unresolved`}
          icon={<ThumbsUp size={16} />} tone={rate != null && rate >= 0.8 ? "good" : rate != null && rate < 0.6 ? "bad" : "accent"} />
        <KpiCard label="Avg attention" value={s.avg_attention ?? "–"}
          sub="across all calls" icon={<ScoreBadge score={s.avg_attention} />} />
        <KpiCard label="Avg QA stars" value={s.avg_review_stars != null ? s.avg_review_stars.toFixed(1) : "–"}
          icon={<Star size={16} />} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Call history</h2>
          <span className="card-sub">newest first</span>
        </div>
        {cu.calls.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Agent</th><th>Intent</th><th>Mood</th>
                <th>Status</th><th>Score</th><th>Summary</th><th></th>
              </tr>
            </thead>
            <tbody>
              {cu.calls.map(c => (
                <tr key={c.sid} className="clickable" onClick={() => navigate(`/calls/${c.sid}`)}>
                  <td>{c.started_at ? new Date(c.started_at).toLocaleDateString() : "–"}</td>
                  <td><Link to={`/agents/${c.agent_id}`} onClick={e => e.stopPropagation()}>{c.agent_name}</Link></td>
                  <td className="intent-cell">{c.intent_label ?? <span className="dim">–</span>}</td>
                  <td><MoodBadge mood={c.mood_end ?? undefined} /></td>
                  <td><ResBadge status={c.resolution} /></td>
                  <td><ScoreBadge score={c.attention_score} /></td>
                  <td className="why">{c.summary ?? ""}</td>
                  <td><Users size={14} className="dim" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}