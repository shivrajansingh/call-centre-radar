import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, BarChart3, Clock, Star, ThumbsUp, TrendingUp, Users,
} from "lucide-react";
import {
  fetchAttention, fetchKpis, fetchTrending,
  type AttentionCall, type Kpis, type TrendIssue,
} from "../api";
import { Empty, KpiCard, MoodBadge, ResBadge, ScoreBadge, Spinner, ErrorBox } from "../components/ui";
import { usePageTitle } from "../theme";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

const MOOD_FILL: Record<string, string> = {
  positive: "#34d399", neutral: "#64748b", concerned: "#fbbf24",
  frustrated: "#fb923c", angry: "#f87171", anxious: "#a78bfa",
};

export default function DashboardView() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [attention, setAttention] = useState<AttentionCall[]>([]);
  const [trending, setTrending] = useState<TrendIssue[]>([]);
  const [err, setErr] = useState("");
  usePageTitle("Operations dashboard");

  useEffect(() => {
    Promise.all([fetchKpis(), fetchAttention(), fetchTrending()])
      .then(([k, a, t]) => { setKpis(k); setAttention(a); setTrending(t); })
      .catch(e => setErr(String(e)));
  }, []);

  if (err) return <ErrorBox error={err} />;
  if (!kpis) return <Spinner full />;

  const analyzed = kpis.analyzed || 0;
  const resolved = kpis.resolution_split.resolved || 0;
  const unresolved = kpis.resolution_split.unresolved || 0;
  const resolutionRate = analyzed ? Math.round((resolved / analyzed) * 100) : 0;
  const moodData = Object.entries(kpis.mood_distribution).map(([name, value]) => ({ name, value }));
  const resData = [
    { name: "Resolved", value: resolved },
    { name: "Partial", value: kpis.resolution_split.partial || 0 },
    { name: "Unresolved", value: unresolved },
  ].filter(d => d.value > 0);
  const critical = kpis.avg_attention?.critical ?? 0;
  const reviewAvg = kpis.reviews?.avg_stars;
  const tooltipStyle = { background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight text-ink">Operations dashboard</h1>
          <p className="mt-0.5 text-[13px] text-dim">Live view across all {kpis.total_calls} recorded calls</p>
        </div>
        <div className="flex items-center gap-2.5">
          {critical > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-bad">
              <span className="pulse-dot h-2 w-2 rounded-full bg-bad" />
              {critical} critical
            </span>
          )}
          <Link to="/calls" className="rounded-md border border-line2 px-2.5 py-1 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent">All calls →</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiCard label="Total calls" value={kpis.total_calls}
          sub={`${kpis.transcribed} transcribed · ${analyzed} analyzed`} icon={<Activity size={16} />} />
        <KpiCard label="Resolution rate" value={`${resolutionRate}%`}
          sub={`${resolved} resolved · ${unresolved} unresolved`} icon={<ThumbsUp size={16} />}
          tone={resolutionRate >= 80 ? "good" : resolutionRate >= 60 ? "accent" : "bad"} />
        <KpiCard label="Avg handle time" value={kpis.avg_handle_time_s != null ? `${Math.round(kpis.avg_handle_time_s)}s` : "–"}
          sub="across analyzed calls" icon={<Clock size={16} />} />
        <KpiCard label="Avg survey rating" value={kpis.avg_survey_ease != null ? kpis.avg_survey_ease.toFixed(1) : "–"}
          sub={kpis.avg_survey_partner != null ? `partner ${kpis.avg_survey_partner.toFixed(1)}` : ""}
          icon={<Star size={16} />} tone={reviewAvg ? "good" : "accent"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">Calls over time</h2>
            <span className="text-xs text-dim">last 14 days · unresolved overlay</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={kpis.calls_over_time}>
              <defs>
                <linearGradient id="gCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,.25)" />
              <XAxis dataKey="day" tickFormatter={d => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                tick={{ fill: "var(--dim)", fontSize: 11 }} stroke="rgba(100,116,139,.25)" />
              <YAxis tick={{ fill: "var(--dim)", fontSize: 11 }} stroke="rgba(100,116,139,.25)" width={28} />
              <Tooltip contentStyle={tooltipStyle}
                labelFormatter={(d: unknown) => new Date(Number(d)).toLocaleDateString()} />
              <Area type="monotone" dataKey="count" stroke="#38bdf8" fill="url(#gCount)" strokeWidth={2} />
              <Area type="monotone" dataKey="unresolved" stroke="#f87171" fill="none" strokeWidth={2} strokeDasharray="4 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">Resolution split</h2>
            <span className="text-xs text-dim">analyzed calls</span>
          </div>
          {resData.length ? (
            <div className="flex items-center gap-2.5">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie data={resData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82}
                    paddingAngle={3} stroke="none">
                    {resData.map(d => (
                      <Cell key={d.name} fill={d.name === "Resolved" ? "#34d399" : d.name === "Partial" ? "#fbbf24" : "#f87171"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid gap-1.5 text-[13px] text-ink">
                {resData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full"
                      style={{ background: d.name === "Resolved" ? "#34d399" : d.name === "Partial" ? "#fbbf24" : "#f87171" }} />
                    <span>{d.name}</span>
                    <b className="ml-2">{d.value}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty message="No analyzed calls yet" />}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-bad/12 text-bad"><AlertTriangle size={15} /></span>
              Needs a manager's attention
            </h2>
            <Link to="/calls?sort=attention" className="rounded-md border border-line2 px-2.5 py-1 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent">View all →</Link>
          </div>
          <div className="grid gap-2">
            {attention.slice(0, 8).map(c => (
              <Link to={`/calls/${c.sid}`} key={c.sid}
                className="flex items-start gap-3 rounded-lg border border-line bg-deep p-3 transition-colors hover:border-accent hover:bg-hover">
                <ScoreBadge score={c.recency_weighted_score} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-ink">
                    <b>{c.customer_name}</b>
                    <span className="text-dim">· {c.agent_name}</span>
                    <ResBadge status={c.resolution} />
                  </div>
                  <div className="mt-0.5 text-xs text-dim">{c.intent_label}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(c.attention_reasons || []).slice(0, 2).map((r, i) => (
                      <span key={i} className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{r.reason}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <MoodBadge mood={c.mood_shift_to ?? undefined} />
                  <span className="text-xs text-dim">{c.started_at ? new Date(c.started_at).toLocaleDateString() : ""}</span>
                </div>
              </Link>
            ))}
            {!attention.length && <Empty message="No calls need attention — all clear" />}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/12 text-accent"><TrendingUp size={15} /></span>
              Trending issues
            </h2>
            <span className="text-xs text-dim">clustered by intent</span>
          </div>
          <div className="grid gap-2.5">
            {trending.slice(0, 10).map(t => (
              <div key={t.label} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{t.label}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                      style={{ width: `${Math.min(100, (t.count / (trending[0]?.count || 1)) * 100)}%` }} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end text-xs text-dim">
                  <b className="text-sm text-ink">{t.count}</b>
                  <span className={t.unresolved_rate > 0.3 ? "text-warn" : ""}>{Math.round(t.unresolved_rate * 100)}% open</span>
                </div>
              </div>
            ))}
            {!trending.length && <Empty />}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/12 text-accent"><Users size={15} /></span>
              Customer mood mix
            </h2>
            <span className="text-xs text-dim">end-of-call mood</span>
          </div>
          {moodData.length ? (
            <div className="flex items-end gap-4">
              {moodData.map(m => (
                <div key={m.name} className="mood-cell">
                  <div className="mood-bar" style={{
                    height: `${Math.max(8, (m.value / Math.max(...moodData.map(x => x.value))) * 100)}%`,
                    background: MOOD_FILL[m.name] ?? "#64748b",
                  }} />
                  <MoodBadge mood={m.name} />
                  <span className="text-xs text-dim">{m.value}</span>
                </div>
              ))}
            </div>
          ) : <Empty message="No mood data" />}
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/12 text-accent"><BarChart3 size={15} /></span>
              Quick stats
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line">
            {[
              ["Avg attention score", kpis.avg_attention?.score ?? "–"],
              ["Critical calls (≥70)", <span key="c" className={critical ? "text-warn" : ""}>{critical}</span>],
              ["QA reviews filed", kpis.reviews?.count ?? 0],
              ["Avg QA stars", kpis.reviews?.avg_stars != null ? kpis.reviews.avg_stars.toFixed(1) : "–"],
              ["Survey (ease of connection)", kpis.avg_survey_ease != null ? kpis.avg_survey_ease.toFixed(1) : "–"],
              ["Processing errors", <span key="e" className={kpis.errors ? "text-warn" : ""}>{kpis.errors}</span>],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-2 bg-deep px-3 py-2.5">
                <span className="text-xs text-dim">{label}</span>
                <b className="text-[13px] text-ink">{value}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}