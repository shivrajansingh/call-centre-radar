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
    <div className="page">
      {toasts.node}
      <div className="page-head">
        <div className="page-head-left">
          <Link to="/calls" className="btn ghost sm"><ArrowLeft size={14} /> Calls</Link>
          <div>
            <h1>
              <Link to={`/customers/${call.customer_id}`}>{call.customer_name}</Link>
              <span className="dim"> with </span>
              <Link to={`/agents/${call.agent_id}`}>{call.agent_name}</Link>
            </h1>
            <p className="page-sub">{fmtTime(call.started_at)} · {Math.round(call.duration_s ?? 0)}s · {call.sid}
              {call.session ? ` · session ${call.session}` : ""}</p>
          </div>
        </div>
        <div className="head-badges">
          {a && <ScoreBadge score={a.attention_score} />}
          {a && <ResBadge status={a.resolution} />}
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <h2>Summary</h2>
          {a ? (
            <>
              <p className="summary">{a.summary}</p>
              <div className="meta-row">
                <span className="meta-label">Intent</span>
                <b>{a.intent_label}</b>
                <Cite cite={a.intent_citation} onSeek={seek} />
              </div>
              <div className="meta-row">
                <span className="meta-label">Resolution</span>
                <ResBadge status={a.resolution} />
                <Cite cite={a.resolution_citation} onSeek={seek} />
              </div>
              <div className="meta-row">
                <span className="meta-label">Mood</span>
                <MoodBadge mood={a.mood_start} /> <span className="dim">→</span> <MoodBadge mood={a.mood_end} />
              </div>
            </>
          ) : (
            <AnalysisStatus call={call} onRefresh={reload} />
          )}
        </div>

        <div className="card">
          <h2>Mood timeline</h2>
          {a ? <MoodTimeline analysis={a} /> : <Empty message="Not available until the analysis completes" />}
        </div>

        <div className="card">
          <h2>Why it needs attention</h2>
          {a ? (
            <div className="reason-list">
              {(a.attention_reasons || []).map((r, i) => (
                <div key={i} className="reason-row">
                  <span className="reason-dot" />
                  <span className="reason">{r.reason}</span>
                  <Cite cite={r.citation} onSeek={seek} />
                </div>
              ))}
              {!a.attention_reasons?.length && <span className="dim small">No flagged reasons</span>}
            </div>
          ) : <Empty message="Not available until the analysis completes" />}
        </div>
      </div>

      {call.survey_ease != null || call.survey_partner != null || call.caller_mos != null ? (
        <div className="card survey-strip">
          <span className="meta-label">Customer survey</span>
          <span className="survey-item"><Star size={13} className="star-ic" /> Ease of connection <b>{call.survey_ease ?? "–"}/10</b></span>
          <span className="survey-item"><Star size={13} className="star-ic" /> Partner rating <b>{call.survey_partner ?? "–"}/10</b></span>
          <span className="survey-item">MOS <b>{call.caller_mos ?? "–"}</b></span>
        </div>
      ) : null}

      <TranscriptPlayer call={call} />

      {a && (
        <div className="card">
          <div className="card-head">
            <h2>QA review</h2>
            <span className="card-sub">manager review of this call</span>
          </div>
          <ReviewWidget sid={call.sid} reviews={call.reviews} myReview={myReview} meId={me?.id}
            onChanged={reload} toasts={toasts} />
        </div>
      )}

      {a && (
        <div className={`evidence-foot ${a.citations_verified >= 0.9 ? "good" : ""}`}>
          {a.citations_verified >= 0.9
            ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
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
    <span
      className={`cite ${cite.verified === false ? "unverified" : ""}`}
      title={`“${cite.quote}” @ ${t.toFixed(1)}s${cite.verified === false ? " — quote not verified against transcript" : ""}`}
      onClick={() => onSeek?.(t)}
    >
      @{t.toFixed(0)}s <q>{cite.quote.slice(0, 48)}{cite.quote.length > 48 ? "…" : ""}</q>
    </span>
  );
}

function MoodTimeline({ analysis }: { analysis: NonNullable<CallDetail["analysis"]> }) {
  const seek = makeSeeker();
  const tl = analysis.mood_timeline || [];
  const shift = analysis.mood_shift_t;
  const max = Math.max(1, ...tl.map(p => p.t), shift ?? 0);
  return (
    <div>
      <div className="mood-line">
        <MoodBadge mood={analysis.mood_start} />
        <span className="dim">→</span>
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
        <p className="small mood-shift-note">
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
    <div className="card">
      <div className="card-head">
        <h2>Recording & transcript</h2>
        <div className="player-state">
          <span className={`pulse ${playing ? "on" : ""}`}>{playing ? "Playing" : "Paused"}</span>
          <span className="dim small">{fmtClock(time)} / {fmtClock(call.duration_s ?? 0)}</span>
        </div>
      </div>
      <audio ref={audioRef} controls src={audioUrl(call.sid)} style={{ width: "100%" }} preload="metadata" />
      <div className="transcript">
        {turns.length === 0 && <Empty message="Transcript not ready yet" />}
        {turns.map((t, i) => (
          <div key={i} ref={i === activeIdx ? activeRef : undefined}
            className={`turn ${t.speaker} ${i === activeIdx ? "active" : ""}`}
            onClick={() => jump(t.start)}>
            <span className="ts">{t.start.toFixed(1)}s</span>
            <span className="spk">{t.speaker === "agent" ? "Agent" : "Caller"}</span>
            <span className="txt">{highlightWords(t, words, wordIdx)}</span>
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
    <div className="review-layout">
      <form onSubmit={submit} className="review-form">
        <div className="review-row">
          <span className="meta-label">Your rating</span>
          <StarRating value={stars} onChange={setStars} size={22} />
          <span className="dim small">{stars ? `${stars}/5` : "unrated"}</span>
        </div>
        <textarea rows={3} placeholder="Notes for the agent (optional)…" value={note}
          onChange={e => setNote(e.target.value)} />
        <button className="btn primary sm" disabled={busy || !canReview}>
          {busy ? "Saving…" : myReview ? "Update review" : "Save review"}
        </button>
      </form>
      <div className="review-list">
        {reviews.map(r => (
          <div key={r.id} className="review-item">
            <div className="review-item-head">
              <b>{r.user_name}</b>
              <StarRating value={r.stars} size={13} />
              <span className="dim small">{new Date(r.created_at * 1000).toLocaleString()}</span>
              {r.user_id === meId && (
                <button className="icon-btn sm" title="Delete review"
                  onClick={async () => {
                    try { await deleteReview(sid, r.id); toasts.ok("Review deleted"); onChanged(); }
                    catch (e) { toasts.err(String(e)); }
                  }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            {r.note && <p className="review-note">{r.note}</p>}
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
    "The pipeline hasn't reached this call yet. Run scripts/backfill.py (or backfill.py --uploads for uploaded calls) to process it.";
  if (tx && !an) {
    kind = "queued";
    icon = <Loader2 size={18} className="spin" />;
    title = anErr ? "Analysis failed — will be retried" : "Transcribed — awaiting analysis";
    detail = anErr ? (
      <>
        The analyzer errored on the last attempt: <code>{anErr}</code>. The pipeline retries
        automatically on the next run; transient gateway errors usually succeed on retry.
      </>
    ) : (
      <>
        Transcription is complete, but the analysis step hasn't finished yet. Re-run{" "}
        <code>scripts/backfill.py</code> to process this call — it will skip the transcription
        and only complete the analysis.
      </>
    );
  }
  if (tx && asrErr && !an) {
    kind = "failed";
    icon = <XCircle size={18} />;
    title = "Transcription failed";
    detail = <><code>{asrErr}</code> — the call will be retried on the next pipeline run.</>;
  }

  return (
    <div className={`status-box ${kind}`}>
      <span className="status-icon">{icon}</span>
      <div>
        <b>{title}</b>
        <p>{detail}</p>
        <div className="status-actions">
          <button className="btn ghost sm" onClick={onRefresh}><RefreshCw size={13} /> Refresh</button>
          {an && <span className="chip ok">analysis complete</span>}
        </div>
      </div>
    </div>
  );
}