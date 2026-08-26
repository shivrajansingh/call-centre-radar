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
  usePageTitle("Operations dashboard");
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [attention, setAttention] = useState<AttentionCall[]>([]);
  const [trending, setTrending] = useState<TrendIssue[]>([]);
  const [err, setErr] = useState("");

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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Operations dashboard</h1>
          <p className="page-sub">Live view across all {kpis.total_calls} recorded calls</p>
        </div>
        <div className="page-head-right">
          <span className={`pulse ${critical ? "on" : ""}`}>
            <AlertTriangle size={14} /> {critical} critical
          </span>
          <Link to="/calls" className="btn ghost sm">All calls →</Link>
        </div>
      </div>

      <div className="kpi-grid">
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

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Calls over time</h2>
            <span className="card-sub">last 14 days · unresolved overlay</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={kpis.calls_over_time}>
              <defs>
                <linearGradient id="gCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tickFormatter={d => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                tick={{ fill: "#64748b", fontSize: 11 }} stroke="#1e293b" />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} stroke="#1e293b" width={28} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d: unknown) => new Date(Number(d)).toLocaleDateString()} />
              <Area type="monotone" dataKey="count" stroke="#38bdf8" fill="url(#gCount)" strokeWidth={2} />
              <Area type="monotone" dataKey="unresolved" stroke="#f87171" fill="none" strokeWidth={2} strokeDasharray="4 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Resolution split</h2>
            <span className="card-sub">analyzed calls</span>
          </div>
          {resData.length ? (
            <div className="donut-wrap">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie data={resData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82}
                    paddingAngle={3} stroke="none">
                    {resData.map(d => (
                      <Cell key={d.name} fill={d.name === "Resolved" ? "#34d399" : d.name === "Partial" ? "#fbbf24" : "#f87171"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-legend">
                {resData.map(d => (
                  <div key={d.name}>
                    <span className="dot" style={{ background: d.name === "Resolved" ? "#34d399" : d.name === "Partial" ? "#fbbf24" : "#f87171" }} />
                    <span>{d.name}</span>
                    <b>{d.value}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty message="No analyzed calls yet" />}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2><span className="head-ico warn"><AlertTriangle size={15} /></span> Needs a manager's attention</h2>
            <Link to="/calls?sort=attention" className="btn ghost sm">View all →</Link>
          </div>
          <div className="attention-list">
            {attention.slice(0, 8).map(c => (
              <Link to={`/calls/${c.sid}`} key={c.sid} className="attention-row">
                <div className="attention-score">
                  <ScoreBadge score={c.recency_weighted_score} />
                </div>
                <div className="attention-body">
                  <div className="attention-title">
                    <b>{c.customer_name}</b>
                    <span className="dim">· {c.agent_name}</span>
                    <ResBadge status={c.resolution} />
                  </div>
                  <div className="attention-intent">{c.intent_label}</div>
                  <div className="attention-why">
                    {(c.attention_reasons || []).slice(0, 2).map((r, i) => (
                      <span key={i} className="chip">{r.reason}</span>
                    ))}
                  </div>
                </div>
                <div className="attention-meta">
                  <MoodBadge mood={c.mood_shift_to ?? undefined} />
                  <span className="dim small">{new Date(c.started_at ?? 0).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
            {!attention.length && <Empty message="No calls need attention — all clear" />}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2><span className="head-ico"><TrendingUp size={15} /></span> Trending issues</h2>
            <span className="card-sub">clustered by intent</span>
          </div>
          <div className="trend-list">
            {trending.slice(0, 10).map(t => (
              <div key={t.label} className="trend-row">
                <div className="trend-main">
                  <span className="trend-label">{t.label}</span>
                  <div className="trend-bar"><div style={{ width: `${Math.min(100, (t.count / (trending[0]?.count || 1)) * 100)}%` }} /></div>
                </div>
                <div className="trend-meta">
                  <b>{t.count}</b>
                  <span className={t.unresolved_rate > 0.3 ? "text-warn" : ""}>{Math.round(t.unresolved_rate * 100)}% open</span>
                </div>
              </div>
            ))}
            {!trending.length && <Empty />}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2><span className="head-ico"><Users size={15} /></span> Customer mood mix</h2>
            <span className="card-sub">end-of-call mood</span>
          </div>
          <div className="mood-strip">
            {moodData.length ? moodData.map(m => (
              <div key={m.name} className="mood-cell">
                <div className="mood-bar" style={{ height: `${Math.max(8, (m.value / Math.max(...moodData.map(x => x.value))) * 100)}%`, background: MOOD_FILL[m.name] ?? "#64748b" }} />
                <MoodBadge mood={m.name} />
                <span className="dim small">{m.value}</span>
              </div>
            )) : <Empty message="No mood data" />}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2><span className="head-ico"><BarChart3 size={15} /></span> Quick stats</h2>
          </div>
          <div className="quick-stats">
            <div><span>Avg attention score</span><b>{kpis.avg_attention?.score ?? "–"}</b></div>
            <div><span>Critical calls (≥70)</span><b className="text-warn">{critical}</b></div>
            <div><span>QA reviews filed</span><b>{kpis.reviews?.count ?? 0}</b></div>
            <div><span>Avg QA stars</span><b>{kpis.reviews?.avg_stars != null ? kpis.reviews.avg_stars.toFixed(1) : "–"}</b></div>
            <div><span>Survey (ease of connection)</span><b>{kpis.avg_survey_ease != null ? kpis.avg_survey_ease.toFixed(1) : "–"}</b></div>
            <div><span>Processing errors</span><b className={kpis.errors ? "text-warn" : ""}>{kpis.errors}</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}