export const API = import.meta.env.VITE_API_URL ?? "/api";

let _token: string | null = localStorage.getItem("radar_token");

export function setToken(t: string | null) {
  _token = t;
  if (t) localStorage.setItem("radar_token", t);
  else localStorage.removeItem("radar_token");
}
export const getToken = () => _token;

async function handle(res: Response, path: string) {
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event("radar:logout"));
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${path}: ${res.status} ${msg.slice(0, 160)}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: _token ? { Authorization: `Bearer ${_token}` } : {},
  });
  return handle(res, path);
}

async function send<T>(path: string, method: string, body?: FormData | URLSearchParams | string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
      ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
    },
    body: body as BodyInit,
  });
  return handle(res, path);
}

// ---------- types ----------

export interface Citation {
  t_start?: number;
  t_end?: number;
  quote: string;
  verified?: boolean;
  time_corrected?: boolean;
}
export interface AttentionReason { reason: string; citation: Citation }
export interface Analysis {
  intent_label: string;
  intent_citation: Citation;
  mood_start: string;
  mood_end: string;
  mood_timeline: { t: number; mood: string }[];
  mood_shift_t: number | null;
  mood_shift_from: string;
  mood_shift_to: string;
  mood_shift_citation: Citation | null;
  resolution: string;
  resolution_citation: Citation;
  summary: string;
  attention_score: number;
  attention_reasons: AttentionReason[];
  citations_verified: number;
  model?: string;
}
export interface Review {
  id: number;
  sid: string;
  stars: number;
  note: string;
  created_at: number;
  user_name: string;
  user_id: number;
}
export interface CallRow {
  sid: string; started_at: number | null; duration_s: number | null; session?: string;
  survey_ease: number | null; survey_partner: number | null; caller_mos: number | null;
  source?: string;
  transcribed_at?: number | null; analyzed_at?: number | null;
  asr_error?: string | null; analysis_error?: string | null;
  customer_name: string; customer_id: number;
  agent_name: string; agent_id: number;
  intent_label: string | null; resolution: string | null;
  attention_score: number | null; mood_start?: string; mood_end?: string;
  citations_verified?: number; summary?: string | null; mood_shift_t?: number | null;
  review_count?: number | null; avg_stars?: number | null;
}
export interface CallDetail extends CallRow {
  analysis?: Analysis;
  turns: { speaker: string; start: number; end: number; text: string }[];
  words: { speaker: string; start: number; end: number; text: string }[];
  reviews: Review[];
}
export interface CustomerRow {
  id: number; name: string; call_count: number; last_call_at: number | null;
  avg_attention: number | null; unresolved_count: number | null; avg_review_stars: number | null;
}
export interface CustomerDetail {
  id: number; name: string; name_key: string; created_at: number | null;
  stats: {
    call_count: number; avg_handle_time_s: number | null; avg_attention: number | null;
    unresolved_count: number; resolved_count: number; avg_review_stars: number | null;
  };
  calls: CallRow[];
}
export interface AttentionCall {
  sid: string; started_at: number | null; duration_s: number | null;
  survey_ease: number | null; survey_partner: number | null;
  customer_name: string; agent_name: string; intent_label: string;
  resolution: string; attention_score: number;
  attention_reasons: AttentionReason[]; summary: string;
  mood_shift_t: number | null; mood_shift_to: string | null;
  recency_weighted_score: number;
}
export interface TrendIssue {
  label: string; count: number; unresolved: number;
  unresolved_rate: number; examples: { sid: string; started_at: number | null }[];
}
export interface AgentRow {
  id: number; name: string; call_count: number; avg_handle_time_s: number | null;
  avg_attention_score: number | null; mood_shifts: number | null;
  resolution_rate: number | null; avg_review_stars: number | null;
}
export interface AgentDetail {
  id: number; name: string; name_key: string; created_at: number | null;
  stats: {
    call_count: number; avg_handle_time_s: number | null; avg_attention: number | null;
    resolved_count: number; unresolved_count: number; mood_shifts: number;
    avg_review_stars: number | null; resolution_rate: number | null;
  };
  calls: CallRow[];
}
export interface Kpis {
  total_calls: number; transcribed: number; analyzed: number; errors: number;
  avg_handle_time_s: number | null; avg_survey_ease: number | null; avg_survey_partner: number | null;
  resolution_split: Record<string, number>;
  mood_distribution: Record<string, number>;
  avg_attention: { score: number | null; critical: number };
  calls_over_time: { day: number; count: number; unresolved: number }[];
  reviews: { count: number; avg_stars: number | null };
}
export interface UserRow {
  id: number; name: string; username: string; role: string; active: number;
  agent_id: number | null; agent_name: string | null; created_at: number | null;
}
export interface Me { id: number; name: string; username: string; role: string }
export interface Health { status: string; calls: number; transcribed: number; analyzed: number }

// ---------- endpoints ----------

export const fetchHealth = () => get<Health>("/health");
export const fetchKpis = (days = 14) => get<Kpis>(`/kpis?days=${days}`);

export const login = (username: string, password: string) =>
  send<{ token: string; user: Me }>("/auth/login", "POST",
    new URLSearchParams({ username, password })).then(r => {
    setToken(r.token);
    return r.user;
  });
export const fetchMe = () => get<Me>("/auth/me");

export const fetchCalls = (params: Record<string, string | number | undefined> = {}) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return get<{ calls: CallRow[] }>(`/calls?${qs}`).then(r => r.calls);
};
export const fetchCall = (sid: string) => get<CallDetail>(`/calls/${sid}`);
export const postReview = (sid: string, stars: number, note: string) =>
  send<{ ok: boolean }>(`/calls/${sid}/reviews`, "POST", new URLSearchParams({ stars: String(stars), note }));
export const deleteReview = (sid: string, rid: number) =>
  send<{ ok: boolean }>(`/calls/${sid}/reviews/${rid}`, "DELETE");

export const fetchCustomers = () => get<{ customers: CustomerRow[] }>("/customers").then(r => r.customers);
export const fetchCustomer = (id: number) => get<CustomerDetail>(`/customers/${id}`);
export const createCustomer = (name: string) =>
  send<{ id: number }>("/customers", "POST", new URLSearchParams({ name }));

export const fetchAttention = () =>
  get<{ reference_day: number; calls: AttentionCall[] }>("/attention").then(r => r.calls);
export const fetchTrending = () => get<{ issues: TrendIssue[] }>("/trending").then(r => r.issues);

export const fetchAgents = () => get<{ agents: AgentRow[] }>("/agents").then(r => r.agents);
export const fetchAgent = (id: number) => get<AgentDetail>(`/agents/${id}`);
export const createAgent = (name: string) =>
  send<{ id: number }>("/agents", "POST", new URLSearchParams({ name }));

export const fetchUsers = () => get<{ users: UserRow[] }>("/users").then(r => r.users);
export const createUser = (name: string, username: string, password: string, role: string) =>
  send<{ id: number }>("/users", "POST",
    new URLSearchParams({ name, username, password, role }));
export const updateUser = (id: number, patch: { active?: number; password?: string; role?: string }) => {
  const sp = new URLSearchParams();
  if (patch.active !== undefined) sp.set("active", String(patch.active));
  if (patch.password) sp.set("password", patch.password);
  if (patch.role) sp.set("role", patch.role);
  return send<{ ok: boolean }>(`/users/${id}`, "PATCH", sp);
};

export const uploadCall = (file: File, extra: { caller_name?: string; agent_name?: string; metadata?: string }) => {
  const fd = new FormData();
  fd.append("audio", file);
  if (extra.caller_name) fd.append("caller_name", extra.caller_name);
  if (extra.agent_name) fd.append("agent_name", extra.agent_name);
  if (extra.metadata) fd.append("metadata", extra.metadata);
  return send<{ sid: string; status: string }>("/ingest", "POST", fd);
};

export const audioUrl = (sid: string) => `${API}/audio/${sid}.mp3`;

export const fmtTime = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleString() : "–";
export const fmtDay = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleDateString() : "–";
export const fmtDur = (s: number | null | undefined) =>
  s == null ? "–" : `${Math.round(s)}s`;