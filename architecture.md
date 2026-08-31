# CareDesk Architecture — for Agents for Humans (AWS Strands)

```mermaid
flowchart TB
    subgraph Caregiver["👨‍👩‍👦 Human caregiver"]
        UI["CareDesk web UI\n(one shared desk)"]
        CONF["Confirm / Dismiss cards"]
        AUDIT["Audit trail (visible)"]
    end

    subgraph Agent["🤖 CareAgent — Strands Agents SDK (Python)"]
        LOOP["Agent loop\nBedrock LLM"]
        T1["tool: get_med_schedule"]
        T2["tool: check_supply (OCR, untrusted)"]
        T3["tool: propose_refill"]
        T4["tool: book_pharmacy_pickup"]
        T5["tool: mark_med_taken"]
        T6["tool: get_audit_trail"]
    end

    subgraph WebMCP["🌐 WebMCP tool layer (document.modelContext)"]
        REG["document.modelContext.registerTool ×7"]
        EXEC["host-gated executeTool"]
        ANN["annotations: readOnlyHint · untrustedContentHint"]
    end

    subgraph Security["🛡️ §6 mitigations implemented"]
        SPOT["Spotlighting of untrusted OCR"]
        GATE["Metadata/schema intake gate"]
        BOUND["Human confirmation boundary"]
    end

    subgraph AWS["☁️ AWS (deployment option)"]
        BED["Amazon Bedrock (agent model)"]
        CORE["AgentCore Runtime (optional)"]
        S3["S3 / DynamoDB — care history"]
    end

    UI -->|natural language| LOOP
    LOOP --> T1 & T2 & T3 & T4 & T5 & T6
    T1 & T2 & T3 & T4 & T5 & T6 --> REG
    REG --> EXEC["browser executes tool in page"] --> UI
    T2 --> SPOT
    T3 & T4 & T5 --> BOUND --> CONF --> UI
    T1 & T2 & T6 --> GATE
    LOOP & REG -.-> ANN
    LOOP -.-> BED
    CORE -.-> LOOP
    S3 -.-> T6
```

## Two integration faces, one product

- **WebMCP face** (browser-native): the site registers 7 tools; any WebMCP host
  (ChatGPT in-app browser, Chrome agent) calls them. Human confirms on the page.
- **Strands face** (this hackathon): the same tool surface wrapped as
  Strands Agents SDK tools (Python). The Strands agent runs the loop with
  Amazon Bedrock; the WebMCP layer stays the actuation surface inside the site.
  The caregiver experiences ONE desk; the agent runtime is swappable.

## Security posture (spec §6)

1. Spotlighted untrusted spans (OCR) — §6.4.3.
2. Metadata/schema intake gate — §6.3.1.1 + §6.3.3.
3. Human confirmation boundary — §6.3.2.3. Consequential tools **queue**; only
   the human card confirms; every step audited.