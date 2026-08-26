import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, PhoneCall, Star, TrendingDown } from "lucide-react";
import { usePageTitle } from "../theme";
import { fetchAgent, type AgentDetail } from "../api";
import {
  Empty, ErrorBox, KpiCard, MoodBadge, ResBadge, ScoreBadge, Spinner,
} from "../components/ui";

export default function AgentView() {
  const { id = "" } = useParams();
  const aid = Number(id);
  const navigate = useNavigate();
  const [ag, setAg] = useState<AgentDetail | null>(null);
  const [err, setErr] = useState("");
  usePageTitle(ag ? `Agent: ${ag.name}` : null);

  const load = useCallback(() => {
    fetchAgent(aid).then(setAg).catch(e => setErr(String(e)));
  }, [aid]);
  useEffect(() => { load(); }, [load]);

  if (err) return <ErrorBox error={err} />;
  if (!ag) return <Spinner full />;

  const s = ag.stats;
  const ratePct = s.resolution_rate != null ? Math.round(s.resolution_rate * 100) : null;
  const moodShiftRate = s.call_count ? Math.round((s.mood_shifts / s.call_count) * 100) : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-left">
          <Link to="/agents" className="btn ghost sm"><ArrowLeft size={14} /> Agents</Link>
          <div>
            <h1>{ag.name}</h1>
            <p className="page-sub">{s.call_count} calls handled</p>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Calls handled" value={s.call_count} icon={<PhoneCall size={16} />} />
        <KpiCard label="Avg handle time" value={s.avg_handle_time_s != null ? `${Math.round(s.avg_handle_time_s)}s` : "–"}
          icon={<Clock size={16} />} />
        <KpiCard label="Resolution rate" value={ratePct != null ? `${ratePct}%` : "–"}
          sub={`${s.resolved_count} resolved · ${s.unresolved_count} unresolved`}
          icon={<Star size={16} />} tone={s.resolution_rate != null && s.resolution_rate >= 0.8 ? "good" : s.resolution_rate != null && s.resolution_rate < 0.6 ? "bad" : "accent"} />
        <KpiCard label="Mood-shift rate" value={`${moodShiftRate}%`}
          sub={`${s.mood_shifts} calls turned negative`} icon={<TrendingDown size={16} />}
          tone={moodShiftRate > 25 ? "bad" : moodShiftRate > 10 ? "warn" : "good"} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Calls handled</h2>
          <span className="card-sub">avg attention {s.avg_attention ?? "–"} · avg QA {s.avg_review_stars != null ? s.avg_review_stars.toFixed(1) : "–"}</span>
        </div>
        {ag.calls.length === 0 ? <Empty /> : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Customer</th><th>Intent</th><th>Mood</th>
                <th>Status</th><th>Score</th><th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {ag.calls.map(c => (
                <tr key={c.sid} className="clickable" onClick={() => navigate(`/calls/${c.sid}`)}>
                  <td>{c.started_at ? new Date(c.started_at).toLocaleDateString() : "–"}</td>
                  <td><Link to={`/customers/${c.customer_id}`} onClick={e => e.stopPropagation()}>{c.customer_name}</Link></td>
                  <td className="intent-cell">{c.intent_label ?? <span className="dim">–</span>}</td>
                  <td><MoodBadge mood={c.mood_end ?? undefined} /></td>
                  <td><ResBadge status={c.resolution} /></td>
                  <td><ScoreBadge score={c.attention_score} /></td>
                  <td className="why">{c.summary ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}