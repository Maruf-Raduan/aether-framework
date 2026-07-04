# Aether Framework: Architectural & Flow Diagrams

This file presents the raw Mermaid.js diagrams describing the framework design, experimental pipeline, and prompt comparison.

---

## Figure 1: Aether Framework Conformance-Gated Loop

```mermaid
graph TD
    classDef blue fill:#E3F2FD,stroke:#2196F3,stroke-width:2px;
    classDef purple fill:#F3E5F5,stroke:#9C27B0,stroke-width:2px;
    classDef orange fill:#FFF3E0,stroke:#FF9800,stroke-width:2px;
    classDef grey fill:#ECEFF1,stroke:#607D8B,stroke-width:2px;
    classDef green fill:#E8F5E9,stroke:#4CAF50,stroke-width:2px;
    classDef red fill:#FFEBEE,stroke:#F44336,stroke-width:2px;
    classDef pass fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px;
    classDef fail fill:#FFCDD2,stroke:#C62828,stroke-width:2px;

    Req[Feature Request]:::blue
    
    subgraph AetherPath["Aether Conformance-Gated Path"]
        Contract["<b>Architectural Contract</b><br/>• module.contract.ts (boundaries, allowed imports, auth)<br/>• ai-context.md (rules, scope)"]:::orange
        Assembler[Prompt Assembler]:::purple
        ModelAeth[LLM Model Generate]:::green
        EngineAeth["G-Suite Rule Engine"]:::red
        PassAeth[PASS<br/>Output recorded]:::pass
        FailAeth[FAIL<br/>Retry max 3]:::fail
    end

    subgraph VanillaPath["Vanilla Baseline Path"]
        NoContract["<b>No Contract Context</b><br/>• Standard developer prompting<br/>• No boundaries or rules injected"]:::grey
        ModelVan[LLM Model Generate]:::green
        EngineVan["G-Suite Rule Engine"]:::red
        PassVan[PASS<br/>Output recorded]:::pass
        FailVan[FAIL]:::fail
    end

    Req --> Contract
    Req --> NoContract
    Contract --> Assembler
    Assembler --> ModelAeth
    ModelAeth --> EngineAeth
    EngineAeth -->|All rules pass| PassAeth
    EngineAeth -->|Any rule fails| FailAeth
    FailAeth -->|Inject error hint| Assembler

    NoContract --> ModelVan
    ModelVan --> EngineVan
    EngineVan -->|All rules pass| PassVan
    EngineVan -->|Any rule fails| FailVan
```

---

## Figure 2: End-to-End Experimental Pipeline

```mermaid
graph LR
    classDef stage fill:#F5F5F5,stroke:#333,stroke-width:2px;
    classDef fork fill:#FFF3E0,stroke:#FF5722,stroke-width:2px;
    
    P["<b>30 Prompts</b><br/>7 domains, 3 complexities<br/>(n=1 Gemini / n=10 local models)"]:::stage
    Fork{"Condition Fork"}:::fork
    V[Vanilla Condition<br/>no contract]:::stage
    A[Aether Condition<br/>contract injected]:::stage
    M["<b>5 LLMs (7B → Gemini)</b><br/>Each model evaluated<br/>under both conditions"]:::stage
    G[G-Suite Rule Engine]:::stage
    C[Metrics Collection]:::stage
    S[Statistical Analysis<br/>Wilcoxon, Cohen's d, CV]:::stage
    
    P --> Fork
    Fork -->|Vanilla| V
    Fork -->|Aether| A
    V --> M
    A --> M
    M --> G
    G --> C
    C --> S
```

---

## Figure 3: Vanilla vs. Aether Prompting Comparison (P30 Case)

```mermaid
graph TD
    subgraph Vanilla["Standard Prompting (Vanilla)"]
        V_Prompt["<b>Input:</b><br/>'Implement DELETE /files/:id route'"]
        V_Arrow[Generate]
        V_Out["<b>Generated Output (Architectural Drift):</b><br/>✗ import { Pool } from 'pg' (raw driver dependency)<br/>✗ direct DB pool instantiation (violates repository pattern boundary)<br/>✗ mock filesystem structures<br/>✗ server bootstrap boilerplate<br/>✗ 4,096 tokens (P30: CONTEXT OVERFLOW)"]
        
        V_Prompt --> V_Arrow --> V_Out
    end

    subgraph Aether["Aether Contract-Injected Prompting"]
        A_Prompt["<b>Input:</b><br/>Contract context + DELETE route spec"]
        A_Arrow[Generate]
        A_Out["<b>Generated Output:</b><br/>✓ import { fileRepository } from '../lib/files'<br/>✓ requireUser() enforced (G2 pass)<br/>✓ Single handler function (no boilerplate)<br/>✓ 214 tokens (P30: RESOLVED)"]
        
        A_Prompt --> A_Arrow --> A_Out
    end
    
    classDef red fill:#FFEBEE,stroke:#F44336,stroke-width:2px;
    classDef green fill:#E8F5E9,stroke:#4CAF50,stroke-width:2px;
    class V_Out red;
    class A_Out green;
```

*\*Note: Illustrated output represents qualitative generation patterns; formal G-Suite evaluation recorded 95.1% overall structural pass rate.*
