# CareDesk 🧑‍🤝‍🧑 — human + agent care coordination, on the same desk

> **WebMCP Challenge submission** — an app where a family caregiver and their AI agent
> coordinate a real evening-of-care for an aging parent: meds, supply checks,
> refills, pharmacy pickups. The agent uses **seven WebMCP tools** registered
> straight from the page; the **human confirms every consequential action**;
> every call shows in an always-visible **audit trail**; and the built-in
> **Red-Team Lab** runs the spec’s own prompt-injection attacks against the
> tools — live — and survives them.

## Why this is only possible with WebMCP

Today a caregiver has two bad options: use a portal alone (agent can't act on
site state) or "agent mode" that scrapes the DOM (fragile, no shared state, and
the agent acts in ways the human can't see). With WebMCP, the **site declares its
tools** (`document.modelContext.registerTool`), the agent acts through them with
typed schemas, and the human stays in the loop **on the same page** — the flow
"what was difficult or impossible before" judges ask for.

## The seven tools (one security pattern each)

| Tool | Read-only | Untrusted | Boundary | Spec pattern (§6) |
|---|---|---|---|---|
| `get_med_schedule` | ✅ `readOnlyHint` | | | shared state read |
| `check_supply` (bottle OCR) | ✅ | ✅ `untrustedContentHint` + spotlighting | | §6.4.3 untrusted annotation |
| `propose_refill` | | | proposes only | §6.3.2 mitigation |
| `confirm_action` | | | **human-only boundary** | §6.3.2.3 ambiguous-finalization fix |
| `book_pharmacy_pickup` | | | gated consequential | preview → human → execute |
| `get_audit_trail` | ✅ | | | transparency UI |
| `mark_med_taken` | | | proposes only | state change, human-confirmed |

Extra hardening beyond the draft spec (§6.4 TODOs — we implemented them):

- **Red-Team Lab (in the app)**: re-runs the spec’s own §6.3 attacks against
  our tools — tool poisoning, output injection, privacy profiling (§6.3.3),
  and self-confirming consequential actions — every one DEFENDED, visibly.
- **Strict inputSchemas**: `additionalProperties: false`, `maxLength` bounds, no
  over-parameterization (defeats §6.3.3 privacy profiling).
- **Spotlighting**: untrusted OCR text is wrapped in explicit delimiters
  (`❛❛ untrusted:bottle-label-ocr … ❛❛ end untrusted ❜❜`) so models/agent UIs
  can visibly mark the span (defeats §6.3.1.2 output injection).
- **AbortSignal plumbing** in every `execute()` (spec §3 pending-tool-executions).
- **Fail-closed proposals**: an unknown medicine returns `{queued:false}` — never
  a guess.
- **Bilingual**: EN/ES toggle in the header — because for millions of U.S.
  families, care happens in Spanish first.

## Run it

```sh
# any static server works
npx serve .          # or: python3 -m http.server 8488
# open Chrome 149+ with chrome://flags/#enable-webmcp-testing enabled
# … or open the URL inside ChatGPT's in-app browser (WebMCP native)
```

The header shows **WebMCP live · N tools registered** when tools bind. Then ask
your agent things like:

- *"Check Papá's evening meds and what needs a refill"* → `get_med_schedule` + `check_supply` + `propose_refill`
- *"Book the pharmacy pickup for tomorrow morning"* → `book_pharmacy_pickup` (queues, human confirms)- *"Mark the Lisinopril as taken"* → `mark_med_taken` (queues, human confirms)
- Then open **Red-Team Lab** and press *Run attacks* — see the spec’s §6 attacks fail against our defenses, live.
## Verified implementations note (our spec contribution)

While building against Chrome 151 with `#enable-webmcp-testing`, we found the
current implementation expects `executeTool(tool, inputArguments)` where
`inputArguments` is a **JSON string** (spec §3 models `inputArguments` as a
string; §4.2.6 shows passing an object). Our code passes JSON strings.
Filed for the editors' attention: [webmachinelearning/webmcp issues](https://github.com/webmachinelearning/webmcp/issues/).

## Demo

<video link — added at submission time>

## License

MIT — see [LICENSE](./LICENSE).