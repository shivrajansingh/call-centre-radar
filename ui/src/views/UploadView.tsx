import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileAudio, UploadCloud, X } from "lucide-react";
import { uploadCall } from "../api";
import { ErrorBox, useToasts } from "../components/ui";
import { usePageTitle } from "../theme";

function isValidJson(s: string) {
  try { JSON.parse(s); return true; } catch { return false; }
}

export default function UploadView() {
  usePageTitle("Upload recordings");
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
    <div className="page">
      {toasts.node}
      <div className="page-head">
        <div>
          <h1>Upload recordings</h1>
          <p className="page-sub">Audio is stored and queued; the transcription pipeline picks it up next run</p>
        </div>
      </div>

      <div className="upload-grid">
        <div className="card">
          <div
            className={`dropzone ${drag ? "drag" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud size={34} />
            <b>Drop call recordings here</b>
            <span className="dim small">or click to browse · MP3, stereo (agent left, caller right)</span>
            <input ref={inputRef} type="file" multiple accept="audio/*,.mp3" hidden
              onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {files.length > 0 && (
            <div className="file-list">
              {files.map((f, i) => (
                <div key={i} className="file-row">
                  <FileAudio size={16} />
                  <span className="file-name">{f.name}</span>
                  <span className="dim small">{Math.round(f.size / 1024)} KB</span>
                  <button className="icon-btn sm" onClick={() => setFiles(x => x.filter((_, j) => j !== i))}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form className="modal-form" onSubmit={e => { e.preventDefault(); void upload(); }}>
            <div className="form-2col">
              <label>
                <span>Caller name (optional)</span>
                <input placeholder="Jane Doe" value={callerName} onChange={e => setCallerName(e.target.value)} />
              </label>
              <label>
                <span>Agent name (optional)</span>
                <input placeholder="Sam Carter" value={agentName} onChange={e => setAgentName(e.target.value)} />
              </label>
            </div>
            <label>
              <span>Metadata JSON (optional)</span>
              <textarea rows={4} placeholder='{"session": "…", "start_time_ms": …, "labels": {"caller_mos": …}}'
                value={metadata} onChange={e => setMetadata(e.target.value)} />
            </label>
            {metaInvalid && <ErrorBox error="metadata must be valid JSON" />}
            <button className="btn primary block" disabled={busy || files.length === 0 || metaInvalid}>
              {busy ? "Uploading…" : `Upload ${files.length ? `(${files.length} file${files.length > 1 ? "s" : ""})` : ""}`}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>What happens next</h2>
          <ol className="steps">
            <li><b>Queued</b> — the recording is stored and the call record is created.</li>
            <li><b>Transcribed</b> — run <code>scripts/backfill.py --uploads</code> to transcribe and analyze.</li>
            <li><b>Reviewed</b> — the call appears in the dashboard with transcript, mood and verdicts.</li>
          </ol>
          {done.length > 0 && (
            <div className="done-box">
              <CheckCircle2 size={16} />
              <div>
                <b>{done.length} call{done.length > 1 ? "s" : ""} queued</b>
                {done.map(d => (
                  <div key={d.sid} className="dim small">
                    {d.sid} — <button className="link-btn" onClick={() => navigate(`/calls/${d.sid}`)}>view call →</button>
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