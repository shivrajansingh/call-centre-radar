import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { fetchCalls, fmtDay, fmtDur, fmtTime, type CallRow } from "../api";
import { Empty, ErrorBox, MoodBadge, ResBadge, ScoreBadge, Spinner, StarRating } from "../components/ui";
import { usePageTitle } from "../theme";

const PAGE = 25;
const thCls = "whitespace-nowrap border-b border-line px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-dim";
const tdCls = "whitespace-nowrap border-b border-line px-3 py-2.5 align-middle";

export default function CallsView() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [resolution, setResolution] = useState(sp.get("resolution") ?? "");
  const [sort, setSort] = useState(sp.get("sort") ?? "recent");
  const [page, setPage] = useState(0);
  usePageTitle("Calls");

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (resolution) params.resolution = resolution;
    params.sort = sort;
    fetchCalls({ ...params, limit: PAGE, offset: page * PAGE })
      .then(c => { setCalls(c); setLoading(false); })
      .catch(e => { setErr(String(e)); setLoading(false); });
  }, [q, resolution, sort, page]);

  const syncSp = () => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (resolution) next.set("resolution", resolution);
    next.set("sort", sort);
    setSp(next, { replace: true });
  };
  const applyFilters = () => { setPage(0); syncSp(); };
  const minScore = sp.get("min_score");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight text-ink">Calls</h1>
          <p className="mt-0.5 text-[13px] text-dim">{calls.length} shown · sorted by {sort === "attention" ? "attention score" : "recency"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input placeholder="Search customer, agent, intent, call ID…" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && applyFilters()}
              className="w-full rounded-lg border border-line2 bg-[var(--input)] py-2 pl-9 pr-3 text-sm text-ink placeholder:text-dim/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15" />
          </div>
          <select value={resolution} onChange={e => { setResolution(e.target.value); setPage(0); syncSp(); }}
            className="cursor-pointer rounded-lg border border-line2 bg-[var(--input)] px-2.5 py-2 text-[13px] text-ink focus:border-accent focus:outline-none">
            <option value="">All resolutions</option>
            <option value="resolved">Resolved</option>
            <option value="partial">Partial</option>
            <option value="unresolved">Unresolved</option>
          </select>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(0); syncSp(); }}
            className="cursor-pointer rounded-lg border border-line2 bg-[var(--input)] px-2.5 py-2 text-[13px] text-ink focus:border-accent focus:outline-none">
            <option value="recent">Newest first</option>
            <option value="attention">Highest attention</option>
          </select>
          {minScore && (
            <button className="rounded-full border border-line2 px-2.5 py-1 text-[11px] text-dim hover:border-bad hover:text-bad"
              onClick={() => setSp({}, { replace: true })}>
              min score {minScore} ✕
            </button>
          )}
        </div>

        {loading ? <Spinner /> : err ? <div className="p-4"><ErrorBox error={err} /></div>
          : calls.length === 0 ? <Empty message="No calls match" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
              <thead>
                <tr>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Agent</th>
                  <th className={thCls}>Intent</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Score</th>
                  <th className={thCls}>Mood</th>
                  <th className={thCls}>QA</th>
                  <th className={`${thCls} text-right`}>Handle</th>
                </tr>
              </thead>
              <tbody>
                {calls.map(c => (
                  <tr key={c.sid} className="cursor-pointer transition-colors hover:bg-hover" onClick={() => navigate(`/calls/${c.sid}`)}>
                    <td className={tdCls} title={fmtTime(c.started_at)}>{fmtDay(c.started_at)}</td>
                    <td className={tdCls}>
                      <Link to={`/customers/${c.customer_id}`} className="font-medium text-ink hover:text-accent" onClick={e => e.stopPropagation()}>{c.customer_name}</Link>
                    </td>
                    <td className={tdCls}>
                      <Link to={`/agents/${c.agent_id}`} className="text-dim hover:text-accent" onClick={e => e.stopPropagation()}>{c.agent_name}</Link>
                    </td>
                    <td className={`${tdCls} max-w-[240px]`}>
                      {c.intent_label
                        ? <span className="block truncate text-ink" title={c.intent_label}>{c.intent_label}</span>
                        : <StatusChip call={c} />}
                    </td>
                    <td className={tdCls}><ResBadge status={c.resolution} /></td>
                    <td className={tdCls}><ScoreBadge score={c.attention_score} /></td>
                    <td className={tdCls}><MoodBadge mood={c.mood_end ?? undefined} /></td>
                    <td className={tdCls}>{c.avg_stars != null ? <StarRating value={c.avg_stars} size={14} /> : <span className="text-dim">–</span>}</td>
                    <td className={`${tdCls} text-right`}>{fmtDur(c.duration_s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-center gap-3.5 border-t border-line p-3">
          <button className="inline-flex items-center gap-1 rounded-md border border-line2 px-2.5 py-1 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronUp size={14} /> Prev
          </button>
          <span className="text-xs text-dim">page {page + 1}</span>
          <button className="inline-flex items-center gap-1 rounded-md border border-line2 px-2.5 py-1 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={calls.length < PAGE} onClick={() => setPage(p => p + 1)}>
            Next <ChevronDown size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatusChip({ call }: { call: CallRow }) {
  const cls = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold";
  if (call.asr_error && !call.analyzed_at) return <span className={`${cls} border border-bad/30 bg-bad/10 text-bad`} title={call.asr_error}>ASR failed</span>;
  if (call.transcribed_at && !call.analyzed_at)
    return <span className={`${cls} border border-warn/30 bg-warn/10 text-warn`} title={call.analysis_error ?? "analysis not completed"}>analysis pending</span>;
  if (!call.transcribed_at) return <span className={`${cls} border border-warn/30 bg-warn/10 text-warn`}>awaiting pipeline</span>;
  return null;
}