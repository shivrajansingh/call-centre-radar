import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { fetchCalls, fmtDay, fmtDur, fmtTime, type CallRow } from "../api";
import { Empty, ErrorBox, MoodBadge, ResBadge, ScoreBadge, Spinner, StarRating } from "../components/ui";
import { usePageTitle } from "../theme";

const PAGE = 25;

export default function CallsView() {
  usePageTitle("Calls");
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [resolution, setResolution] = useState(sp.get("resolution") ?? "");
  const [sort, setSort] = useState(sp.get("sort") ?? "recent");
  const [page, setPage] = useState(0);

  const fetchPage = (params: Record<string, string>, p: number) =>
    fetchCalls({
      ...params,
      limit: PAGE, offset: p * PAGE,
    }).then(c => ({ c, p }));

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (resolution) params.resolution = resolution;
    params.sort = sort;
    fetchPage(params, page)
      .then(({ c }) => { setCalls(c); setLoading(false); })
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
  const hasPrev = page > 0;
  const hasNext = calls.length === PAGE;

  const minScore = useMemo(() => {
    const v = sp.get("min_score");
    return v ? Number(v) : null;
  }, [sp]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Calls</h1>
          <p className="page-sub">{calls.length} shown · sorted by {sort === "attention" ? "attention score" : "recency"}</p>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-box">
            <Search size={15} />
            <input placeholder="Search customer, agent, intent, call ID…" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && applyFilters()} />
          </div>
          <select value={resolution} onChange={e => { setResolution(e.target.value); setPage(0); syncSp(); }}>
            <option value="">All resolutions</option>
            <option value="resolved">Resolved</option>
            <option value="partial">Partial</option>
            <option value="unresolved">Unresolved</option>
          </select>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(0); syncSp(); }}>
            <option value="recent">Newest first</option>
            <option value="attention">Highest attention</option>
          </select>
          {minScore != null && (
            <button className="chip chip-clear" onClick={() => { setSp({}, { replace: true }); }}>
              min score {minScore} ✕
            </button>
          )}
        </div>

        {loading ? <Spinner /> : err ? <ErrorBox error={err} /> : calls.length === 0 ? <Empty message="No calls match" /> : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Customer</th><th>Agent</th><th>Intent</th>
                <th>Status</th><th>Score</th><th>Mood</th><th>QA</th><th>Handle</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.sid} className="clickable" onClick={() => navigate(`/calls/${c.sid}`)}>
                  <td title={fmtTime(c.started_at)}>{fmtDay(c.started_at)}</td>
                  <td>
                    <Link to={`/customers/${c.customer_id}`} onClick={e => e.stopPropagation()}>{c.customer_name}</Link>
                  </td>
                  <td>
                    <Link to={`/agents/${c.agent_id}`} onClick={e => e.stopPropagation()}>{c.agent_name}</Link>
                  </td>
                  <td className="intent-cell">{c.intent_label ?? <StatusChip call={c} />}</td>
                  <td><ResBadge status={c.resolution} /></td>
                  <td><ScoreBadge score={c.attention_score} /></td>
                  <td><MoodBadge mood={c.mood_end ?? undefined} /></td>
                  <td>{c.avg_stars != null ? <StarRating value={c.avg_stars} size={14} /> : <span className="dim">–</span>}</td>
                  <td>{fmtDur(c.duration_s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="pager">
          <button className="btn ghost sm" disabled={!hasPrev} onClick={() => setPage(p => p - 1)}>
            <ChevronUp size={14} /> Prev
          </button>
          <span className="dim small">page {page + 1}</span>
          <button className="btn ghost sm" disabled={!hasNext} onClick={() => setPage(p => p + 1)}>
            Next <ChevronDown size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatusChip({ call }: { call: CallRow }) {
  if (call.asr_error && !call.analyzed_at) return <span className="chip failed" title={call.asr_error}>ASR failed</span>;
  if (call.transcribed_at && !call.analyzed_at)
    return <span className="chip pending" title={call.analysis_error ?? "analysis not completed"}>analysis pending</span>;
  if (!call.transcribed_at) return <span className="chip pending">awaiting pipeline</span>;
  return null;
}