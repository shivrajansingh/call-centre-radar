import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, PhoneCall, Star, TrendingDown } from "lucide-react";
import { fetchAgent, type AgentDetail } from "../api";
import {
  Empty, ErrorBox, KpiCard, MoodBadge, ResBadge, ScoreBadge, Spinner,
} from "../components/ui";
import { usePageTitle } from "../theme";

const thCls = "whitespace-nowrap border-b border-line px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-dim";
const tdCls = "whitespace-nowrap border-b border-line px-3 py-2.5 align-middle";

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/agents" className="inline-flex items-center gap-1 rounded-md border border-line2 px-2.5 py-1 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent">
            <ArrowLeft size={14} /> Agents
          </Link>
          <div>
            <h1 className="text-[21px] font-bold tracking-tight text-ink">{ag.name}</h1>
            <p className="mt-0.5 text-[13px] text-dim">{s.call_count} calls handled</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
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

      <div className="rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <h2 className="text-[15px] font-semibold text-ink">Calls handled</h2>
          <span className="text-xs text-dim">avg attention {s.avg_attention ?? "–"} · avg QA {s.avg_review_stars != null ? s.avg_review_stars.toFixed(1) : "–"}</span>
        </div>
        {ag.calls.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
              <thead>
                <tr>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Intent</th>
                  <th className={thCls}>Mood</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Score</th>
                  <th className={thCls}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {ag.calls.map(c => (
                  <tr key={c.sid} className="cursor-pointer transition-colors hover:bg-hover" onClick={() => navigate(`/calls/${c.sid}`)}>
                    <td className={tdCls}><span className="text-dim">{c.started_at ? new Date(c.started_at).toLocaleDateString() : "–"}</span></td>
                    <td className={tdCls}>
                      <Link to={`/customers/${c.customer_id}`} className="font-medium text-ink hover:text-accent" onClick={e => e.stopPropagation()}>{c.customer_name}</Link>
                    </td>
                    <td className={`${tdCls} max-w-[220px]`}>
                      <span className="block truncate text-ink" title={c.intent_label ?? undefined}>{c.intent_label ?? <span className="text-dim">–</span>}</span>
                    </td>
                    <td className={tdCls}><MoodBadge mood={c.mood_end ?? undefined} /></td>
                    <td className={tdCls}><ResBadge status={c.resolution} /></td>
                    <td className={tdCls}><ScoreBadge score={c.attention_score} /></td>
                    <td className={`${tdCls} max-w-[300px]`}>
                      <span className="block truncate text-dim" title={c.summary ?? undefined}>{c.summary ?? ""}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}