import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileAudio, UploadCloud, X } from "lucide-react";
import { uploadCall } from "../api";
import { ErrorBox, useToasts, btnPrimary, inputCls } from "../components/ui";
import { usePageTitle } from "../theme";

function isValidJson(s: string) {
  try { JSON.parse(s); return true; } catch { return false; }
}

export default function UploadView() {
  const [files, setFiles] = useState<File[]>([]);
  const [callerName, setCallerName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [metadata, setMetadata] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ sid: string }[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toasts = useToasts();
  const navigate = useNavigate();
  usePageTitle("Upload recordings");
  const metaInvalid = metadata.trim() !== "" && !isValidJson(metadata);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const audios = Array.from(list).filter(f => f.name.toLowerCase().endsWith(".mp3") || f.type.startsWith("audio"));
    if (!audios.length) { toasts.err("Only audio files are supported"); return; }
    setFiles(f => [...f, ...audios]);
  };

  const upload = async () => {
    setBusy(true);
    const results: { sid: string }[] = [];
    for (const f of files) {
      try {
        const r = await uploadCall(f, { caller_name: callerName, agent_name: agentName, metadata: metadata || undefined });
        results.push({ sid: r.sid });
        toasts.ok(`${f.name} queued (${r.sid})`);
      } catch (e) {
        toasts.err(`${f.name}: ${e}`);
      }
    }
    setDone(results);
    setBusy(false);
    setFiles([]);
    setCallerName(""); setAgentName(""); setMetadata("");
  };

  return (
    <div className="flex flex-col gap-4">
      {toasts.node}
      <div>
        <h1 className="text-[21px] font-bold tracking-tight text-ink">Upload recordings</h1>
        <p className="mt-0.5 text-[13px] text-dim">Audio is stored and queued; the transcription pipeline picks it up next run</p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div
            className={`mb-4 grid cursor-pointer place-items-center gap-1.5 rounded-xl border-2 border-dashed px-5 py-10 text-center text-dim transition-colors ${drag ? "border-accent bg-accent/5" : "border-line2 hover:border-accent hover:bg-accent/5"}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud size={34} className="text-accent" />
            <b className="text-ink">Drop call recordings here</b>
            <span className="text-xs text-dim">or click to browse · MP3, stereo (agent left, caller right)</span>
            <input ref={inputRef} type="file" multiple accept="audio/*,.mp3" hidden
              onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {files.length > 0 && (
            <div className="mb-4 grid gap-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg border border-line bg-deep px-3 py-2">
                  <FileAudio size={16} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{f.name}</span>
                  <span className="shrink-0 text-xs text-dim">{Math.round(f.size / 1024)} KB</span>
                  <button className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line text-dim transition-colors hover:border-bad hover:text-bad"
                    onClick={() => setFiles(x => x.filter((_, j) => j !== i))}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form className="grid gap-3.5" onSubmit={e => { e.preventDefault(); void upload(); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-semibold text-dim">
                <span>Caller name (optional)</span>
                <input className={inputCls} placeholder="Jane Doe" value={callerName} onChange={e => setCallerName(e.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-dim">
                <span>Agent name (optional)</span>
                <input className={inputCls} placeholder="Sam Carter" value={agentName} onChange={e => setAgentName(e.target.value)} />
              </label>
            </div>
            <label className="grid gap-1.5 text-xs font-semibold text-dim">
              <span>Metadata JSON (optional)</span>
              <textarea rows={4} className={`${inputCls} resize-y`} placeholder='{"session": "…", "start_time_ms": …, "labels": {"caller_mos": …}}'
                value={metadata} onChange={e => setMetadata(e.target.value)} />
            </label>
            {metaInvalid && <ErrorBox error="metadata must be valid JSON" />}
            <button className={`${btnPrimary} w-full`} disabled={busy || files.length === 0 || metaInvalid}>
              {busy ? "Uploading…" : `Upload ${files.length ? `(${files.length} file${files.length > 1 ? "s" : ""})` : ""}`}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">What happens next</h2>
          <ol className="grid list-decimal gap-2.5 pl-5 text-[13px] leading-relaxed text-dim">
            <li><b className="text-ink">Queued</b> — the recording is stored and the call record is created.</li>
            <li><b className="text-ink">Transcribed</b> — run <code>scripts/backfill.py --uploads</code> to transcribe and analyze.</li>
            <li><b className="text-ink">Reviewed</b> — the call appears in the dashboard with transcript, mood and verdicts.</li>
          </ol>
          {done.length > 0 && (
            <div className="mt-4 flex gap-2.5 rounded-lg border border-good/25 bg-good/8 p-3 text-good">
              <CheckCircle2 size={16} className="shrink-0" />
              <div>
                <b className="text-[13px]">{done.length} call{done.length > 1 ? "s" : ""} queued</b>
                {done.map(d => (
                  <div key={d.sid} className="text-xs">
                    {d.sid} — <button className="text-xs text-good underline underline-offset-2" onClick={() => navigate(`/calls/${d.sid}`)}>view call →</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}