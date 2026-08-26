import { useEffect, useState } from "react";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";

export function Spinner({ full }: { full?: boolean }) {
  return (
    <div className={full ? "spinner-full" : "spinner"}>
      <Loader2 className="spin" size={22} />
      <span>Loading…</span>
    </div>
  );
}

export function Empty({ message = "No data yet" }: { message?: string }) {
  return (
    <div className="empty">
      <Inbox size={28} />
      <span>{message}</span>
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div className="error-box">
      <AlertTriangle size={16} />
      <span>{error}</span>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="badge neutral">–</span>;
  const cls = score >= 70 ? "high" : score >= 30 ? "mid" : "low";
  return <span className={`badge ${cls}`}>{score}</span>;
}

export function ResBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge neutral">–</span>;
  return <span className={`badge ${status}`}>{status}</span>;
}

export const MOOD_COLORS: Record<string, string> = {
  positive: "#34d399", neutral: "#64748b", concerned: "#fbbf24",
  frustrated: "#fb923c", angry: "#f87171", anxious: "#a78bfa",
  unknown: "#64748b",
};

export function MoodBadge({ mood }: { mood: string | null | undefined }) {
  if (!mood) return <span className="badge neutral">–</span>;
  const color = MOOD_COLORS[mood] ?? "#64748b";
  return (
    <span className="badge" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {mood}
    </span>
  );
}

export function KpiCard({ label, value, sub, icon, tone }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  icon?: React.ReactNode; tone?: "accent" | "good" | "warn" | "bad";
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className={`kpi-icon ${tone ?? ""}`}>{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StarRating({ value, onChange, size = 18 }: {
  value: number; onChange?: (v: number) => void; size?: number;
}) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          className={`star ${i <= Math.round(value) ? "on" : ""} ${onChange ? "interactive" : ""}`}
          style={{ fontSize: size }}
          onClick={() => onChange?.(i)}
          disabled={!onChange}
          title={`${i} star${i > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

interface Toast { id: number; kind: "ok" | "err"; text: string }
let toastSeq = 0;
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (kind: "ok" | "err", text: string) => {
    const id = ++toastSeq;
    setToasts(t => [...t, { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };
  const ok = (text: string) => push("ok", text);
  const err = (text: string) => push("err", text);
  const node = (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
          <button onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}><X size={13} /></button>
        </div>
      ))}
    </div>
  );
  return { ok, err, node };
}