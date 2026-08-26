The Call-Centre Radar
Problem statement
Every service business records its support calls “for quality purposes” — and then nobody listens to them. A support manager responsible for 300 calls a day can personally review perhaps five. The customer whose mood had turned by minute two, the call that sounded resolved but wasn’t, the question the agent had to ask three times, the complaint that came up nine times this week — all of it is sitting in the recordings, and none of it reaches anyone who could act. Companies pay heavily for “conversation intelligence” tools that promise exactly this. You are going to build one — starting from the raw recordings, exactly as they come off the phone system.

Your task
Build a call-centre analysis system with an admin dashboard over the call recordings provided to you. There are two halves to this.

First, turn the recordings into usable text. You get audio, not transcripts. Convert speech to text, work out who said what, and reconstruct each conversation turn by turn with timings.

Then, build the intelligence on top of it. Your dashboard must show:

Per customer: every customer by name, with their full call history, and for each call the recording and the transcript you produced.
Per call: the customer’s intent (what they wanted), their mood and the point in the call where it shifted, whether the issue was resolved, and a short summary (≤ 40 words).
Across all calls: which calls need a manager’s attention today, ranked; which issues are trending; and a per-agent view of call volumes, handle times and outcomes.
Every judgment must cite the moment in the call that justifies it — a timestamp, and the words spoken there. A claim with no evidence scores zero. Evidence that does not support the claim scores negative.

The data
You receive callradar-data.zip (already extracted inside the callradar-data folder)— 1,441 recorded support calls to a consumer bank:

In the zip	What it is
audio/<id></id>.mp3	The call recording, as it came off the phone system. Telephone quality, 8 kHz.
metadata/<id></id>.json	The call’s details: customer name, agent name, and timestamps.
Files are matched by call ID. Each recording has two channels: the left channel is the agent, the right channel is the customer.

Required output
You are building a product, not a report. Deliver two connected pieces:

An API that returns, for any call: the transcript your system produced with speakers and timings, the intent, the mood and the timestamp where it shifted, the resolution status, the summary (≤ 40 words), a needs-attention score (0–100), and the timestamps behind each judgment.
The dashboard UI on top of it: the customer list, each customer’s call history, and a per-call view with the playable recording, your transcript, the AI summary and the mood timeline — plus the ranked “needs a manager’s attention today” view across all calls.
How you store the analysis behind the API — database, files, cache — is your design decision. Do not re-transcribe on every request.

What to submit
Your code, in a Git repository with a README that lets us run the whole thing ourselves from scratch — including the step that turns the recordings into transcripts. Your running system, the API and the dashboard, ready to demonstrate live on calls we choose on the day.
