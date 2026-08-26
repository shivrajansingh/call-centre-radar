import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PhoneCall, Star, ThumbsUp } from "lucide-react";
import { fetchCustomer, type CustomerDetail } from "../api";
import {
  Empty, ErrorBox, KpiCard, MoodBadge, ResBadge, ScoreBadge, Spinner,
} from "../components/ui";
import { usePageTitle } from "../theme";

const thCls = "whitespace-nowrap border-b border-line px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-dim";
const tdCls = "whitespace-nowrap border-b border-line px-3 py-2.5 align-middle";

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/customers" className="inline-flex items-center gap-1 rounded-md border border-line2 px-2.5 py-1 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent">
            <ArrowLeft size={14} /> Customers
          </Link>
          <div>
            <h1 className="text-[21px] font-bold tracking-tight text-ink">{cu.name}</h1>
            <p className="mt-0.5 text-[13px] text-dim">{s.call_count} calls in total</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiCard label="Total calls" value={s.call_count} icon={<PhoneCall size={16} />} />
        <KpiCard label="Resolution rate" value={ratePct != null ? `${ratePct}%` : "–"}
          sub={`${s.resolved_count} resolved · ${s.unresolved_count} unresolved`}
          icon={<ThumbsUp size={16} />} tone={rate != null && rate >= 0.8 ? "good" : rate != null && rate < 0.6 ? "bad" : "accent"} />
        <KpiCard label="Avg attention" value={s.avg_attention ?? "–"}
          sub="across all calls" icon={<ScoreBadge score={s.avg_attention} />} />
        <KpiCard label="Avg QA stars" value={s.avg_review_stars != null ? s.avg_review_stars.toFixed(1) : "–"}
          icon={<Star size={16} />} />
      </div>

      <div className="rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <h2 className="text-[15px] font-semibold text-ink">Call history</h2>
          <span className="text-xs text-dim">newest first</span>
        </div>
        {cu.calls.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
              <thead>
                <tr>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Agent</th>
                  <th className={thCls}>Intent</th>
                  <th className={thCls}>Mood</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Score</th>
                  <th className={thCls}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {cu.calls.map(c => (
                  <tr key={c.sid} className="cursor-pointer transition-colors hover:bg-hover" onClick={() => navigate(`/calls/${c.sid}`)}>
                    <td className={tdCls}><span className="text-dim">{c.started_at ? new Date(c.started_at).toLocaleDateString() : "–"}</span></td>
                    <td className={tdCls}>
                      <Link to={`/agents/${c.agent_id}`} className="text-dim hover:text-accent" onClick={e => e.stopPropagation()}>{c.agent_name}</Link>
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