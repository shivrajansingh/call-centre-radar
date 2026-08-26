import { useEffect, useState } from "react";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";

export function Spinner({ full }: { full?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 text-dim ${full ? "min-h-[60vh]" : "py-10"}`}>
      <Loader2 size={22} className="animate-spin" />
      <span>Loading…</span>
    </div>
  );
}

export function Empty({ message = "No data yet" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-dim text-[13px]">
      <Inbox size={28} />
      <span>{message}</span>
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2.5 text-[13px] text-bad">
      <AlertTriangle size={16} className="shrink-0" />
      <span>{error}</span>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <Badge>–</Badge>;
  const cls = score >= 70 ? "bg-bad/15 text-[#fca5a5]" : score >= 30 ? "bg-warn/15 text-[#fcd34d]" : "bg-good/15 text-[#6ee7b7]";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{score}</span>;
}

export function ResBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>–</Badge>;
  const cls = status === "resolved" ? "bg-good/15 text-[#6ee7b7]"
    : status === "unresolved" ? "bg-bad/15 text-[#fca5a5]"
    : status === "partial" ? "bg-warn/15 text-[#fcd34d]" : "";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{status}</span>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-line px-2.5 py-0.5 text-[11px] font-bold text-dim">{children}</span>;
}

export const MOOD_COLORS: Record<string, string> = {
  positive: "#34d399", neutral: "#64748b", concerned: "#fbbf24",
  frustrated: "#fb923c", angry: "#f87171", anxious: "#a78bfa",
  unknown: "#64748b",
};

export function MoodBadge({ mood }: { mood: string | null | undefined }) {
  if (!mood) return <Badge>–</Badge>;
  const color = MOOD_COLORS[mood] ?? "#64748b";
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize"
      style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {mood}
    </span>
  );
}

export function KpiCard({ label, value, sub, icon, tone }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  icon?: React.ReactNode; tone?: "accent" | "good" | "warn" | "bad";
}) {
  const toneCls = tone === "good" ? "bg-good/12 text-good" : tone === "warn" ? "bg-warn/12 text-warn"
    : tone === "bad" ? "bg-bad/12 text-bad" : "bg-accent/12 text-accent";
  return (
    <div className="min-w-0 rounded-xl border border-line bg-gradient-to-b from-surface to-deep p-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-dim">{label}</span>
        {icon && <span className={`grid h-7 w-7 place-items-center rounded-lg ${toneCls}`}>{icon}</span>}
      </div>
      <div className="mt-1.5 text-[26px] font-extrabold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-dim">{sub}</div>}
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
    <div className="anim-fade fixed inset-0 z-[90] grid place-items-center bg-black/70 backdrop-blur-sm"
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`anim-pop w-[420px] max-w-[calc(100vw-40px)] rounded-2xl border border-line2 bg-surface2 p-5 shadow-[var(--shadow)] ${wide ? "w-[560px]" : ""}`}>
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <button className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface2 text-dim transition-colors hover:border-accent hover:text-accent" onClick={onClose}>
            <X size={16} />
          </button>
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
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          className={`leading-none ${i <= Math.round(value) ? "text-warn drop-shadow-[0_0_8px_rgba(251,191,36,.4)]" : "text-line2"} ${onChange ? "cursor-pointer transition-transform hover:scale-125" : "cursor-default"}`}
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
    <div className="fixed bottom-5 right-5 z-[100] grid gap-2">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex min-w-[240px] max-w-[380px] items-center gap-2.5 rounded-xl border border-line2 bg-surface2 px-3.5 py-2.5 text-[13px] shadow-[var(--shadow)] ${t.kind === "ok" ? "border-l-good border-l-4" : "border-l-bad border-l-4"}`}>
          {t.text}
          <button className="ml-auto text-dim hover:text-ink" onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
  return { ok, err, node };
}

export const inputCls = "w-full rounded-lg border border-line2 bg-[var(--input)] px-3 py-2 text-sm text-ink placeholder:text-dim/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";
export const btnCls = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line2 bg-surface2 px-4 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-45 disabled:cursor-not-allowed";
export const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-accent2 px-4 py-2 text-[13.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed";
export const btnSm = "px-2.5 py-1 text-xs rounded-md";
export const btnGhost = "bg-transparent";