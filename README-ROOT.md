# CareDesk — one build, two faces (WebMCP × Strands)

> **Care coordination where the human caregiver and their AI agent share one desk.**
>
> - **WebMCP Challenge (OpenAI × Chrome)** — the browser-native face: 7 tools
>   registered via `document.modelContext.registerTool`; human confirms every
>   consequential action; Red-Team Lab proves §6 defenses live.
>   Live: https://josecortesmadrid.github.io/caredesk-webmcp/
>
> - **Agents for Humans (AWS Strands)** — the agent-runtime face: the same tool
>   surface wrapped by a **Strands Agents SDK** (Python) agent on **Amazon
>   Bedrock**, the caregiver experiencing one seamless desk.
>   Track: **Everyday Agents**.

## Core idea

Care for an aging parent is dozens of small, repetitive, judgment-heavy tasks:
check the evening meds, notice the supply is low, order the refill, book the
pickup, mark the dose taken. Today the caregiver does it alone, or hands it to a
chatbot that can't see site state and can't be audited.

CareDesk lets the **website declare** its tools (WebMCP), the agent act through
them with **typed schemas + security annotations**, and the human stay in the
loop with **exact previews and one-tap confirm** — all on one page, fully
audited, in **English or Spanish**.

## What's implemented here

- 7 WebMCP tools with per-tool security annotations (`readOnlyHint`,
  `untrustedContentHint`), closed JSON Schemas, AbortSignal plumbing.
- **Red-Team Lab**: the spec's own §6.3 attacks (tool poisoning, output
  injection, privacy profiling, self-confirmation) run live in-app against
  the tools — all **DEFENDED**.
- Human confirmation boundary + always-visible audit trail (spec §6.3.2.3 fix).
- Spec contribution: documented Chrome 151 `inputArguments` string-vs-object
  divergence (see README sections on the implementation finding).

## Repository layout

```
app/            static SPA: index.html + tools.js + app.js + i18n.js + security.js
architecture.md Strands/AWS architecture (Agents for Humans view)
verify_caredesk.py  e2e checks of the tool layer
evals.py        Devpost-rubric self-scoring
video-script.md demo script (works for both challenges)
```

- Live app: https://josecortesmadrid.github.io/caredesk-webmcp/
- License: MIT

## For Agents for Humans judges

See [architecture.md](architecture.md) — the Strands Agents SDK face wraps the
same tool surface over Amazon Bedrock, track: **Everyday Agents** (caregiver
busywork, exactly the brief's "only surfaces when there's a real decision").