import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Loader2, RefreshCw, ShieldAlert, Star, Trash2, XCircle } from "lucide-react";
import {
  audioUrl, deleteReview, fetchCall, fmtTime, postReview,
  type CallDetail, type Citation,
} from "../api";
import { useAuth } from "../auth";
import { usePageTitle } from "../theme";
import {
  Empty, ErrorBox, MoodBadge, MOOD_COLORS, ResBadge, ScoreBadge, Spinner, StarRating, useToasts,
} from "../components/ui";

const cardCls = "rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]";
const metaLabel = "min-w-[72px] text-[11px] font-semibold uppercase tracking-wider text-dim";

export default function CallView() {
  const { sid = "" } = useParams();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [err, setErr] = useState("");
  const { me } = useAuth();
  const toasts = useToasts();
  usePageTitle(call ? `${call.customer_name} · ${call.sid}` : null);

  const reload = useCallback(() => {
    fetchCall(sid).then(setCall).catch(e => setErr(String(e)));
  }, [sid]);

  useEffect(() => { reload(); }, [reload]);

  if (err) return <ErrorBox error={err} />;
  if (!call) return <Spinner full />;

  const a = call.analysis;
  const myReview = call.reviews.find(r => r.user_id === me?.id);
  const seek = makeSeeker();

  return (
    <div className="flex flex-col gap-4">
      {toasts.node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/calls" className="inline-flex items-center gap-1 rounded-md border border-line2 px-2.5 py-1 text-xs font-semibold text-dim transition-colors hover:border-accent hover:text-accent">
            <ArrowLeft size={14} /> Calls
          </Link>
          <div className="min-w-0">
            <h1 className="text-[21px] font-bold tracking-tight text-ink [overflow-wrap:anywhere]">
              <Link to={`/customers/${call.customer_id}`} className="hover:text-accent">{call.customer_name}</Link>
              <span className="font-normal text-dim"> with </span>
              <Link to={`/agents/${call.agent_id}`} className="hover:text-accent">{call.agent_name}</Link>
            </h1>
            <p className="mt-0.5 text-[13px] text-dim">
              {fmtTime(call.started_at)} · {Math.round(call.duration_s ?? 0)}s · {call.sid}
              {call.session ? ` · session ${call.session}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a && <ScoreBadge score={a.attention_score} />}
          {a && <ResBadge status={a.resolution} />}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className={cardCls}>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Summary</h2>
          {a ? (
            <>
              <p className="mb-3 leading-relaxed text-ink">{a.summary}</p>
              <div className="flex flex-wrap items-center gap-2 border-t border-line py-1.5">
                <span className={metaLabel}>Intent</span>
                <b className="text-[13.5px] text-ink">{a.intent_label}</b>
                <Cite cite={a.intent_citation} onSeek={seek} />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line py-1.5">
                <span className={metaLabel}>Resolution</span>
                <ResBadge status={a.resolution} />
                <Cite cite={a.resolution_citation} onSeek={seek} />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line py-1.5">
                <span className={metaLabel}>Mood</span>
                <MoodBadge mood={a.mood_start} /> <span className="text-dim">→</span> <MoodBadge mood={a.mood_end} />
              </div>
            </>
          ) : <AnalysisStatus call={call} onRefresh={reload} />}
        </div>

        <div className={cardCls}>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Mood timeline</h2>
          {a ? <MoodTimeline analysis={a} /> : <Empty message="Not available until the analysis completes" />}
        </div>

        <div className={cardCls}>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Why it needs attention</h2>
          {a ? (
            <div className="grid gap-2">
              {(a.attention_reasons || []).map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-deep px-2.5 py-2 text-[13px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                  <span className="text-ink">{r.reason}</span>
                  <Cite cite={r.citation} onSeek={seek} />
                </div>
              ))}
              {!a.attention_reasons?.length && <span className="text-xs text-dim">No flagged reasons</span>}
            </div>
          ) : <Empty message="Not available until the analysis completes" />}
        </div>
      </div>

      {call.survey_ease != null || call.survey_partner != null || call.caller_mos != null ? (
        <div className={`${cardCls} flex flex-wrap items-center gap-4`}>
          <span className={metaLabel}>Customer survey</span>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-dim">
            <Star size={13} className="text-warn" /> Ease of connection <b className="text-ink">{call.survey_ease ?? "–"}/10</b>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-dim">
            <Star size={13} className="text-warn" /> Partner rating <b className="text-ink">{call.survey_partner ?? "–"}/10</b>
          </span>
          <span className="text-[13px] text-dim">MOS <b className="text-ink">{call.caller_mos ?? "–"}</b></span>
        </div>
      ) : null}

      <TranscriptPlayer call={call} />

      {a && (
        <div className={cardCls}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">QA review</h2>
            <span className="text-xs text-dim">manager review of this call</span>
          </div>
          <ReviewWidget sid={call.sid} reviews={call.reviews} myReview={myReview} meId={me?.id}
            onChanged={reload} toasts={toasts} />
        </div>
      )}

      {a && (
        <div className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${a.citations_verified >= 0.9 ? "border-good/25 bg-good/8 text-good" : "border-bad/25 bg-bad/8 text-bad"}`}>
          {a.citations_verified >= 0.9 ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
          <span>
            Evidence integrity: {Math.round((a.citations_verified ?? 0) * 100)}% of citations verified verbatim
            against the transcript{a.model ? ` · model ${a.model}` : ""}.
          </span>
        </div>
      )}
    </div>
  );
}

function makeSeeker() {
  return (t: number) => {
    const el = document.querySelector<HTMLAudioElement>("audio");
    if (!el) return;
    if (el.fastSeek) el.fastSeek(t); else el.currentTime = t;
    void el.play();
  };
}

export function Cite({ cite, onSeek }: { cite?: Citation | null; onSeek?: (t: number) => void }) {
  if (!cite || !cite.quote) return null;
  const t = cite.t_start ?? 0;
  return (
    <button
      type="button"
      className={`ml-auto inline-block max-w-[55%] cursor-pointer truncate align-bottom text-xs text-accent underline decoration-dotted underline-offset-2 hover:underline ${cite.verified === false ? "text-bad" : ""}`}
      title={`“${cite.quote}” @ ${t.toFixed(1)}s${cite.verified === false ? " — quote not verified against transcript" : ""}`}
      onClick={() => onSeek?.(t)}
    >
      @{t.toFixed(0)}s “{cite.quote.slice(0, 48)}{cite.quote.length > 48 ? "…" : ""}”
    </button>
  );
}

function MoodTimeline({ analysis }: { analysis: NonNullable<CallDetail["analysis"]> }) {
  const seek = makeSeeker();
  const tl = analysis.mood_timeline || [];
  const shift = analysis.mood_shift_t;
  const max = Math.max(1, ...tl.map(p => p.t), shift ?? 0);
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <MoodBadge mood={analysis.mood_start} />
        <span className="text-dim">→</span>
        <MoodBadge mood={analysis.mood_end} />
      </div>
      <div className="timeline">
        <div className="timeline-bar" />
        {tl.map((p, i) => (
          <button key={i} className="tl-dot" title={`${p.mood} @ ${p.t.toFixed(1)}s — click to hear`}
            style={{ left: `${(p.t / max) * 100}%`, background: MOOD_COLORS[p.mood] ?? "#64748b" }}
            onClick={() => seek(p.t)} />
        ))}
        {shift != null && (
          <button className="tl-shift" style={{ left: `${(shift / max) * 100}%` }}
            title={`mood shifted ${analysis.mood_shift_from} → ${analysis.mood_shift_to} @ ${shift.toFixed(1)}s — click to hear`}
            onClick={() => seek(shift)}>⚡</button>
        )}
      </div>
      {shift != null && analysis.mood_shift_citation && (
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-dim">
          Shift to <MoodBadge mood={analysis.mood_shift_to ?? undefined} /> at {shift.toFixed(0)}s:
          <Cite cite={analysis.mood_shift_citation} onSeek={seek} />
        </p>
      )}
    </div>
  );
}

function TranscriptPlayer({ call }: { call: CallDetail }) {
  const seek = makeSeeker();
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const turns = call.turns;
  const words = call.words;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const h = () => setTime(el.currentTime);
    const p = () => setPlaying(!el.paused);
    el.addEventListener("timeupdate", h);
    el.addEventListener("play", p);
    el.addEventListener("pause", p);
    return () => { el.removeEventListener("timeupdate", h); el.removeEventListener("play", p); el.removeEventListener("pause", p); };
  }, [call.sid]);

  const activeIdx = turns.findIndex(t => time >= t.start && time < t.end);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  const wordIdx = useMemo(() => {
    let lo = 0, hi = words.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid].start <= time) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }, [time, words]);

  const jump = (t: number) => { seek(t); setTime(t); };

  return (
    <div className={cardCls}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">Recording & transcript</h2>
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${playing ? "text-good" : "text-dim"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${playing ? "pulse-dot bg-good" : "bg-line2"}`} />
            {playing ? "Playing" : "Paused"}
          </span>
          <span className="text-xs text-dim">{fmtClock(time)} / {fmtClock(call.duration_s ?? 0)}</span>
        </div>
      </div>
      <audio ref={audioRef} controls src={audioUrl(call.sid)} preload="metadata" />
      <div className="transcript">
        {turns.length === 0 && <Empty message="Transcript not ready yet" />}
        {turns.map((t, i) => (
          <div key={i} ref={i === activeIdx ? activeRef : undefined}
            className={`flex cursor-pointer gap-2.5 rounded-lg border px-2.5 py-1.5 text-[13.5px] leading-relaxed transition-colors ${t.speaker} ${i === activeIdx ? "active" : ""}`}
            onClick={() => jump(t.start)}>
            <span className="shrink-0 pt-0.5 text-[11px] text-dim">{t.start.toFixed(1)}s</span>
            <span className={`w-[58px] shrink-0 pt-0.5 text-[11.5px] font-semibold ${t.speaker === "agent" ? "text-accent" : "text-good"}`}>
              {t.speaker === "agent" ? "Agent" : "Caller"}
            </span>
            <span className="whitespace-pre-wrap text-ink">{highlightWords(t, words, wordIdx)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function highlightWords(turn: any, words: any[], activeWord: number) {
  const startIdx = words.findIndex(w => w.start >= turn.start && w.end <= turn.end + 0.01);
  if (startIdx === -1) return turn.text;
  let text = "";
  for (let i = startIdx; i < words.length; i++) {
    const w = words[i];
    if (w.start > turn.end + 0.01) break;
    text += (activeWord === i ? `«${w.text}»` : ` ${w.text}`);
  }
  return text.trim();
}

function fmtClock(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function ReviewWidget({ sid, reviews, myReview, meId, onChanged, toasts }: {
  sid: string; reviews: CallDetail["reviews"]; myReview?: CallDetail["reviews"][number];
  meId?: number; onChanged: () => void;
  toasts: ReturnType<typeof useToasts>;
}) {
  const [stars, setStars] = useState(myReview?.stars ?? 0);
  const [note, setNote] = useState(myReview?.note ?? "");
  const [busy, setBusy] = useState(false);
  const canReview = meId !== undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stars < 1) { toasts.err("Pick a star rating"); return; }
    setBusy(true);
    try {
      await postReview(sid, stars, note);
      toasts.ok("Review saved");
      onChanged();
    } catch (err) {
      toasts.err(String(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={submit} className="grid content-start gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-dim">Your rating</span>
          <StarRating value={stars} onChange={setStars} size={22} />
          <span className="text-xs text-dim">{stars ? `${stars}/5` : "unrated"}</span>
        </div>
        <textarea rows={3} placeholder="Notes for the agent (optional)…" value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full resize-y rounded-lg border border-line2 bg-[var(--input)] px-3 py-2 text-sm text-ink placeholder:text-dim/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15" />
        <button className="inline-flex w-fit items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-accent2 px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed"
          disabled={busy || !canReview}>
          {busy ? "Saving…" : myReview ? "Update review" : "Save review"}
        </button>
      </form>
      <div className="grid content-start gap-2">
        {reviews.map(r => (
          <div key={r.id} className="rounded-lg border border-line bg-deep px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[13px] text-ink">{r.user_name}</b>
              <StarRating value={r.stars} size={13} />
              <span className="ml-auto text-xs text-dim">{new Date(r.created_at * 1000).toLocaleString()}</span>
              {r.user_id === meId && (
                <button className="grid h-6 w-6 place-items-center rounded-md border border-line text-dim transition-colors hover:border-bad hover:text-bad" title="Delete review"
                  onClick={async () => {
                    try { await deleteReview(sid, r.id); toasts.ok("Review deleted"); onChanged(); }
                    catch (e) { toasts.err(String(e)); }
                  }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            {r.note && <p className="mt-1.5 text-[13px] text-dim">{r.note}</p>}
          </div>
        ))}
        {!reviews.length && <Empty message="No QA reviews yet" />}
      </div>
    </div>
  );
}

function AnalysisStatus({ call, onRefresh }: { call: CallDetail; onRefresh: () => void }) {
  const tx = call.transcribed_at != null;
  const an = call.analyzed_at != null;
  const asrErr = call.asr_error;
  const anErr = call.analysis_error;

  let kind: "queued" | "awaiting" | "failed" = "awaiting";
  let icon: React.ReactNode = <Clock size={18} />;
  let title = "Awaiting transcription";
  let detail: React.ReactNode =
    "The pipeline hasn't reached this call yet. Uploads are processed automatically in the background.";
  if (tx && !an) {
    kind = "queued";
    icon = <Loader2 size={18} className="animate-spin" />;
    title = anErr ? "Analysis failed — will be retried" : "Transcribed — awaiting analysis";
    detail = anErr ? (
      <>
        The analyzer errored on the last attempt: <code>{anErr}</code>. The pipeline retries
        automatically on the next run; transient gateway errors usually succeed on retry.
      </>
    ) : (
      <>
        Transcription is complete, but the analysis step hasn't finished yet — it will be
        completed automatically in the background.
      </>
    );
  }
  if (tx && asrErr && !an) {
    kind = "failed";
    icon = <XCircle size={18} />;
    title = "Transcription failed";
    detail = <><code>{asrErr}</code> — the call will be retried on the next pipeline run.</>;
  }

  const tone = kind === "queued" ? "border-warn/30 bg-warn/8 text-warn"
    : kind === "failed" ? "border-bad/30 bg-bad/8 text-bad"
    : "border-accent/30 bg-accent/8 text-accent";

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 text-[13.5px] ${tone}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <b className="mb-0.5 block text-ink">{title}</b>
        <p className="m-0 text-xs text-dim">{detail}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-line2 bg-surface2 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            onClick={onRefresh}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>
    </div>
  );
}