<div align="center">
  <h1>🌌 Aether Framework</h1>
  <h3>Empirical Study Replication Package</h3>
  
  <p>
    <b>Conformance-Gated Generation for Enterprise Code Synthesis:<br>
    An Empirical Study of Model-Dependent Effects Across LLM Families</b>
  </p>

  <p>
    <a href="#-overview-of-findings">Findings</a> •
    <a href="#-repository-structure">Structure</a> •
    <a href="#-reproduction-instructions">Reproduction</a> •
    <a href="#-license--citation">Citation</a>
  </p>
</div>

---

This repository contains the **official replication package** for the Aether Framework empirical study. 

It includes the complete source code for the Aether architectural engine, the benchmark dataset of 30 enterprise backend routing scenarios, all raw evaluation logs across five evaluated large language models, and the automated statistical analysis scripts used to generate the findings reported in the paper.

## 📊 Overview of Findings

The Aether Framework enforces architectural conformance by injecting a strict, machine-readable contract into the LLM prompt before code generation, followed by AST-based evaluation (the G-Suite rule engine). 

Our empirical evaluation of **2,451 generations** across five models reveals a pronounced **Capacity Threshold Effect**:

- **Large Models ($\ge$ 12B)**: Aether functions as a highly effective **token funnel**, reducing output token volume by 34%–52% while maintaining architectural correctness, leading to significant inference cost reductions.
- **Small Models ($\le$ 8B)**: The effect degrades, resulting in increased verbosity, generation entropy, and a reliability trade-off for mid-capacity models.

## 📂 Repository Structure

- **`src/`**: The core source code for the Aether Framework MVP. This includes the AST-parser, the G-Suite rule engine, and the orchestration loop for context injection.
- **`experiments/prompts/`**: The benchmark dataset containing the 30 enterprise feature prompts used in the evaluation.
- **`experiments/runner/`**: The execution pipeline and statistical analysis scripts (`generate_tables.py`, etc.).
- **`experiments/results/`**: The core data artifacts from the evaluation:
  - **`runs*/` directories**: Individual subdirectories for each model (e.g., `runs/` for Gemini, `runs_qwen/` for Qwen 7B, `runs_gemma3_12b/` etc.), housing the raw JSON trace for all 2,451 evaluations.
  - **`*.jsonl` & `master_raw.csv`**: The aggregated output logs and token data used by the statistical runner.
  - **`figures/`**: The generated data tables and diagrams used in the manuscript.
- **`paper/`**: The LaTeX source code for the manuscript.

---

## 🛠️ Reproduction Instructions

To reproduce the statistical findings, generate the tables, and evaluate the dataset yourself, follow these steps:

### 1. Installation
Clone the repository and install both the Node.js and Python dependencies:

```bash
# Install Node dependencies (for the Aether TypeScript engine)
npm install

# Install Python dependencies (for statistical analysis and table generation)
pip install -r requirements.txt
```

### 2. Verify the Framework
You can run the internal TypeScript typechecker to verify the Aether AST-engine is sound:

```bash
npm run typecheck
```

### 3. Regenerate Results & Tables
To parse the raw JSON logs and recreate the statistical tables (Wilcoxon signed-rank tests, Cohen's $d$, and capacity threshold analysis) found in the paper, execute the runner script:

```bash
python experiments/runner/generate_tables.py
```

This will re-calculate all statistics from the raw evaluation logs and output the resulting LaTeX tables directly into `experiments/results/figures/publication_tables.tex`.

---

## 📄 License & Citation

This project is open-sourced under the MIT License. If you utilize the Aether Framework or the 30-prompt enterprise benchmark dataset in your research, please cite the accompanying paper.

```bibtex
% Citation details will be updated upon publication
```
