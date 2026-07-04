import os
import json

def main():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    results_dir = os.path.join(project_root, "experiments", "results")
    figures_dir = os.path.join(results_dir, "figures")
    
    stats_path = os.path.join(results_dir, "final_stats.json")
    with open(stats_path, "r", encoding="utf-8") as f:
        stats = json.load(f)
        
    out_path = os.path.join(figures_dir, "publication_tables.tex")
    
    model_order = [
        ("Gemini 2.5 Flash", "100B+"),
        ("Qwen 2.5 Coder 14B", "14B"),
        ("Gemma 3 12B", "12B"),
        ("Llama 3.1 8B", "8B"),
        ("Qwen 2.5 Coder 7B", "7B")
    ]
    
    # Pre-compute min/max for cost highlights in Table 3
    costs = []
    for m, _ in model_order:
        raw = stats["models"][m]["raw"]
        costs.append(raw["vanilla"]["weighted_cost_mean"])
        costs.append(raw["aether"]["weighted_cost_mean"])
    min_cost = min(costs)
    max_cost = max(costs)
    
    tex = []
    tex.append(r"% =========================================================")
    tex.append(r"%  LaTeX Tables for Elsevier JSS Submission")
    tex.append(r"%  File: publication_tables.tex")
    tex.append(r"% =========================================================")
    tex.append(r"")
    tex.append(r"\usepackage{booktabs}")
    tex.append(r"\usepackage{colortbl}")
    tex.append(r"\usepackage{xcolor}")
    tex.append(r"")
    
    # Table 1: Benchmark Dataset (Updated prose in the caption? Actually it's just the table body)
    tex.append(r"% --- Table 1: Benchmark Dataset ---")
    tex.append(r"\begin{table*}[htbp]")
    tex.append(r"\centering")
    tex.append(r"\small")
    tex.append(r"\setlength{\tabcolsep}{4pt}")
    tex.append(r"\caption{Benchmark Dataset consisting of 30 enterprise backend routing scenarios across multiple business domains and complexity levels.}")
    tex.append(r"\label{tab:dataset}")
    tex.append(r"\resizebox{\linewidth}{!}{")
    tex.append(r"\begin{tabular}{llllll}")
    tex.append(r"\toprule")
    tex.append(r"\textbf{Prompt ID} & \textbf{Domain} & \textbf{Route} & \textbf{HTTP Method} & \textbf{Complexity} & \textbf{Description} \\")
    tex.append(r"\midrule")
    tex.append(r"P01 & Auth & \texttt{/auth/register} & POST & Low & Create a user registration route that validates email, hashes the password, a... \\")
    tex.append(r"P02 & Auth & \texttt{/auth/login} & POST & Low & Create a login route that takes email and password, looks up the user, and re... \\")
    tex.append(r"P03 & Auth & \texttt{/auth/logout} & POST & Low & Create a logout route that invalidates the current session and clears the coo... \\")
    tex.append(r"P04 & Tasks & \texttt{/tasks} & GET & Low & Create a list-tasks route that returns all tasks for the current user's team,... \\")
    tex.append(r"P05 & Tasks & \texttt{/tasks} & POST & Medium & Create a create-task route that accepts { title, description, assigneeId }, v... \\")
    tex.append(r"P06 & Tasks & \texttt{/tasks/\:id/status} & PATCH & Medium & Create a status-update route that transitions a task between 'todo', 'in\_prog... \\")
    tex.append(r"P07 & Tasks & \texttt{/tasks/\:id/assign} & POST & Medium & Create an assign-task route that takes assigneeId, verifies the assignee is a... \\")
    tex.append(r"P08 & Tasks & \texttt{/tasks/\:id} & DELETE & Medium & Create a soft-delete route for tasks. The task must remain in the database wi... \\")
    tex.append(r"P09 & Tasks & \texttt{/tasks/\:id/archive} & POST & Medium & Create an archive route that moves finished tasks older than 30 days to an ar... \\")
    tex.append(r"P10 & Tasks & \texttt{/tasks/\:id/history} & GET & Medium & Create a route that returns the audit-log history of a single task (status ch... \\")
    tex.append(r"P11 & Tasks & \texttt{/tasks/\:id/transfer-team} & POST & High & Create a route that transfers a task from one team to another. Both teams mus... \\")
    tex.append(r"P12 & Tasks & \texttt{/tasks/bulk} & PATCH & High & Create a bulk-update route that accepts an array of {id, patch} objects, vali... \\")
    tex.append(r"P13 & Billing & \texttt{/billing/subscriptions} & POST & Medium & Create a route that creates a Stripe subscription for the current user, stori... \\")
    tex.append(r"P14 & Billing & \texttt{/billing/summary} & GET & Medium & Create a loader route that returns a billing summary for the current user: cu... \\")
    tex.append(r"P15 & Billing & \texttt{/billing/webhook} & POST & High & Create a Stripe webhook handler that verifies the signature, parses the event... \\")
    tex.append(r"P16 & Auth & \texttt{/auth/refresh} & POST & Medium & Create a token-refresh route that exchanges a refresh token for a new access ... \\")
    tex.append(r"P17 & Auth & \texttt{/auth/password-reset/request} & POST & Medium & Create a password-reset-request route that emails a one-time reset link. Alwa... \\")
    tex.append(r"P18 & Auth & \texttt{/auth/password-reset/confirm} & POST & Medium & Create a password-reset-confirm route that consumes a one-time token, sets th... \\")
    tex.append(r"P19 & Teams & \texttt{/teams} & POST & Medium & Create a route that creates a new team, with the caller as the owner. Owner i... \\")
    tex.append(r"P20 & Teams & \texttt{/teams/\:id/invite} & POST & Medium & Create an invite-member route that generates a single-use invite token, email... \\")
    tex.append(r"P21 & Teams & \texttt{/teams/\:id/members/\:userId} & DELETE & Medium & Create a remove-member route. The owner cannot be removed. After removal, all... \\")
    tex.append(r"P22 & Teams & \texttt{/teams/\:id} & PATCH & Low & Create a route to rename a team. Only admins may call it. \\")
    tex.append(r"P23 & Notifications & \texttt{/notifications/send} & POST & Medium & Create a route that sends a notification to a list of user ids. The notificat... \\")
    tex.append(r"P24 & Notifications & \texttt{/notifications} & GET & Low & Create a route that lists the current user's notifications, paginated, with u... \\")
    tex.append(r"P25 & Notifications & \texttt{/notifications/\:id/read} & POST & Low & Create a mark-as-read route. Idempotent --- calling twice must not error. \\")
    tex.append(r"P26 & Reports & \texttt{/reports/team-velocity} & GET & High & Create a route that returns the team's task velocity over the last 30 days: t... \\")
    tex.append(r"P27 & Reports & \texttt{/reports/billing-forecast} & GET & High & Create a route that returns a 3-month billing forecast based on current subsc... \\")
    tex.append(r"P28 & Files & \texttt{/files/upload} & POST & High & Create a file-upload route that accepts a multipart form, validates size and ... \\")
    tex.append(r"P29 & Files & \texttt{/files/\:id} & GET & Medium & Create a download route that streams a file from object storage. Caller must ... \\")
    tex.append(r"P30 & Files & \texttt{/files/\:id} & DELETE & Medium & Create a soft-delete route for files. Removes the row, deletes the underlying... \\")
    tex.append(r"\bottomrule")
    tex.append(r"\end{tabular}")
    tex.append(r"}")
    tex.append(r"\end{table*}")
    tex.append(r"")
    
    # Table 2: Model Specifications
    tex.append(r"% --- Table 2: Model Specifications ---")
    tex.append(r"\begin{table*}[htbp]")
    tex.append(r"\centering")
    tex.append(r"\caption{Specifications and execution environment characteristics of the evaluated large language models (LLMs), ordered by parameter scale descending.}")
    tex.append(r"\label{tab:models}")
    tex.append(r"\resizebox{\linewidth}{!}{")
    tex.append(r"\begin{tabular}{lllllll}")
    tex.append(r"\toprule")
    tex.append(r"\textbf{Model} & \textbf{Parameters} & \textbf{Type} & \textbf{Quantization} & \textbf{Deployment} & \textbf{Repetitions ($n$)} & \textbf{Context Window} \\")
    tex.append(r"\midrule")
    tex.append(r"Gemini 2.5 Flash & \(\sim\)100B+ & Closed-weight & Full precision & Google API & 1 & 1M tokens \\")
    tex.append(r"Qwen 2.5 Coder 14B & 14B & Open-weight & Q4\_K\_M & Local (Ollama) & 10 & 8192 tokens \\")
    tex.append(r"Gemma 3 12B & 12B & Open-weight & Q4\_K\_M & Local (Ollama) & 10 & 8192 tokens \\")
    tex.append(r"Llama 3.1 8B & 8B & Open-weight & Q4\_K\_M & Local (Ollama) & 10 & 8192 tokens \\")
    tex.append(r"Qwen 2.5 Coder 7B & 7B & Open-weight & Q4\_K\_M & Local (Ollama) & 10 & 8192 tokens \\")
    tex.append(r"\bottomrule")
    tex.append(r"\end{tabular}")
    tex.append(r"}")
    tex.append(r"\end{table*}")
    tex.append(r"")
    
    # Table 3: Summary Stats
    tex.append(r"% --- Table 3: Summary Statistics (Mean ± SD) ---")
    tex.append(r"\begin{table*}[htbp]")
    tex.append(r"\centering")
    tex.append(r"\caption{Summary performance metrics (Mean \(\pm\) SD) for each model under the Vanilla baseline and Aether framework conditions, ordered by capacity descending. Cells representing global minimum weighted cost are highlighted in green, and global maximum in red. All values wrapped in math mode to prevent compilation warnings.}")
    tex.append(r"\label{tab:summary_stats}")
    tex.append(r"\resizebox{\linewidth}{!}{")
    tex.append(r"\begin{tabular}{llllll}")
    tex.append(r"\toprule")
    tex.append(r"\textbf{Model} & \textbf{Condition} & \textbf{Output Tokens} & \textbf{Latency (ms)} & \textbf{Total Tokens} & \textbf{Weighted Cost} \\")
    tex.append(r"\midrule")
    
    for m, _ in model_order:
        if m in ["Llama 3.1 8B", "Qwen 2.5 Coder 7B"]:
            src = stats["models"][m]["corrected"]
        else:
            src = stats["models"][m]["raw"]
            
        for cond, c_name in [("vanilla", "Vanilla"), ("aether", "Aether")]:
            m_stat = src[cond]
            to_m, to_s = m_stat["tokens_out_mean"], m_stat["tokens_out_sd"]
            lat_m, lat_s = m_stat["latency_ms_mean"], m_stat["latency_ms_sd"]
            # Total tokens = in + out
            tt_m = m_stat["tokens_in_mean"] + to_m
            # Since standard deviation of sum is not just sum of standard deviations, we'll approximate or use raw in+out if available. 
            # We didn't compute total_tokens_sd in json. We'll use a conservative approx or just what the old table had.
            # Actually, total_tokens = tokens_in + tokens_out. Let's compute it properly or just sum SDs as a proxy if we must. 
            # In the old table, Qwen 7B Vanilla total tokens SD was 164.95, out was 160.52. Very close.
            tt_s = m_stat["tokens_in_sd"] + to_s
            cost_m, cost_s = m_stat["weighted_cost_mean"], m_stat["weighted_cost_sd"]
            
            cost_cell = f"\\(${cost_m:.2f} \\pm {cost_s:.2f}\\)"
            if abs(cost_m - min_cost) < 0.01:
                cost_cell = r"\cellcolor{green!20}" + cost_cell
            elif abs(cost_m - max_cost) < 0.01:
                cost_cell = r"\cellcolor{red!20}" + cost_cell
                
            tex.append(f"{m} & {c_name} & \\({to_m:.2f} \\pm {to_s:.2f}\\) & \\({lat_m:.2f} \\pm {lat_s:.2f}\\) & \\({tt_m:.2f} \\pm {tt_s:.2f}\\)* & {cost_cell} \\\\")
            
    tex.append(r"\bottomrule")
    tex.append(r"\end{tabular}")
    tex.append(r"}")
    tex.append(r"\begin{flushleft}")
    tex.append(r"\footnotesize{*Total tokens standard deviation is approximated. Llama 3.1 8B and Qwen 2.5 Coder 7B values reflect exclusion-corrected means (see Methodology, Context Overflow Exclusions); all other models report unadjusted raw means as no exclusions apply.}")
    tex.append(r"\end{flushleft}")
    tex.append(r"\end{table*}")
    tex.append(r"")
    
    # Table 4: Statistical Tests
    tex.append(r"% --- Table 4: Statistical Test Results ---")
    tex.append(r"\begin{table*}[htbp]")
    tex.append(r"\centering")
    tex.append(r"\caption{Hypothesis testing and effect size measures comparing prompt-level average output token length under Aether vs. Vanilla, ordered descending by model parameters. Significant models (\(p < 0.05\)) are highlighted in green, non-significant in grey.}")
    tex.append(r"\label{tab:statistics}")
    tex.append(r"\resizebox{\linewidth}{!}{")
    tex.append(r"\begin{tabular}{lllllllll}")
    tex.append(r"\toprule")
    tex.append(r"\textbf{Model} & \textbf{Params} & \textbf{N Pairs} & \textbf{W Stat} & \textbf{$p$-value} & \textbf{Significant} & \textbf{Cohen's $d$} & \textbf{Effect Size} & \textbf{Direction} \\")
    tex.append(r"\midrule")
    
    for m, cap in model_order:
        hyp = stats["models"][m]["hypothesis"]
        n_pairs = hyp["n_pairs"]
        w = hyp["W"]
        p = hyp["p_value"]
        d = hyp["cohens_d"]
        sig = hyp["significant"]
        
        sig_str = r"\cellcolor{green!15}Yes" if sig else r"\cellcolor{black!10}No"
        effect = "Large" if abs(d) >= 0.8 else "Medium" if abs(d) >= 0.5 else "Small" if abs(d) >= 0.2 else "Negligible"
        if d > 0:
            dir_str = r"\textcolor{green}{Aether reduces $\blacktriangledown$}"
        elif d < -0.2:
            dir_str = r"\textcolor{red}{Aether increases $\blacktriangle$}"
        else:
            dir_str = r"\textcolor{gray}{Negligible / No effect $\approx$}"
            
        tex.append(f"{m} & {cap} & {n_pairs} & {w:.1f} & {p:.6e} & {sig_str} & {d:.4f} & {effect} & {dir_str} \\\\")
        
    tex.append(r"\bottomrule")
    tex.append(r"\end{tabular}")
    tex.append(r"}")
    tex.append(r"\end{table*}")
    tex.append(r"")
    
    # Table 5: Qualitative Code Example (Updated footer for N=2451)
    tex.append(r"% --- Table 5: Qualitative Code Example ---")
    tex.append(r"\begin{table*}[htbp]")
    tex.append(r"\centering")
    tex.append(r"\caption{Side-by-side comparison of generated implementations for prompt P30 (DELETE /files/:id), demonstrating qualitative architectural drift patterns in Vanilla vs. target conformance in Aether.}")
    tex.append(r"\label{tab:code_example}")
    tex.append(r"\begin{tabular}{p{0.48\textwidth} | p{0.48\textwidth}}")
    tex.append(r"\toprule")
    tex.append(r"\textbf{Vanilla Generation --- P30 (DELETE /files/:id)} & \textbf{Aether Generation --- P30 (DELETE /files/:id)} \\")
    tex.append(r"\midrule")
    tex.append(r"\begin{minipage}[t]{0.48\textwidth}")
    tex.append(r"\scriptsize")
    tex.append(r"\begin{verbatim}")
    tex.append(r"// Vanilla -- Architectural Drift")
    tex.append(r"import { Pool } from 'pg';")
    tex.append(r"// <- raw driver (drift pattern)")
    tex.append(r"import express from 'express';")
    tex.append(r"")
    tex.append(r"const db = new Pool({")
    tex.append(r"  // <- direct inst. (drift pattern)")
    tex.append(r"  connectionString: process.env.DB")
    tex.append(r"});")
    tex.append(r"")
    tex.append(r"// Mock filesystem structure")
    tex.append(r"// <- boilerplate (drift pattern)")
    tex.append(r"const mockFiles: Record<string, {")
    tex.append(r"  id: string; ownerId: string;")
    tex.append(r"}> = {};")
    tex.append(r"")
    tex.append(r"export async function deleteFile(")
    tex.append(r"  req: express.Request,")
    tex.append(r"  res: express.Response")
    tex.append(r") {")
    tex.append(r"  // No auth check present")
    tex.append(r"  // <- missing guard (drift pattern)")
    tex.append(r"  const { id } = req.params;")
    tex.append(r"  const result = await db.query(")
    tex.append(r"    // <- raw SQL (drift pattern)")
    tex.append(r"    'DELETE FROM files WHERE id=$1',")
    tex.append(r"    [id]")
    tex.append(r"  );")
    tex.append(r"  // ... 600+ more tokens")
    tex.append(r"}")
    tex.append(r"\end{verbatim}")
    tex.append(r"\end{minipage}")
    tex.append(r"&")
    tex.append(r"\begin{minipage}[t]{0.48\textwidth}")
    tex.append(r"\scriptsize")
    tex.append(r"\begin{verbatim}")
    tex.append(r"// AETHER -- Conformant Output")
    tex.append(r"import { requireUser } // Auth import")
    tex.append(r"  from '../lib/auth';")
    tex.append(r"import { fileRepository } // G1 Pass")
    tex.append(r"  from '../lib/files';")
    tex.append(r"")
    tex.append(r"export async function deleteFile(")
    tex.append(r"  req: express.Request,")
    tex.append(r"  res: express.Response")
    tex.append(r") {")
    tex.append(r"  const user = requireUser(req);")
    tex.append(r"  // G2 Pass")
    tex.append(r"")
    tex.append(r"  await fileRepository // G1 Pass")
    tex.append(r"    .deleteById(req.params.id, user.id);")
    tex.append(r"")
    tex.append(r"  res.status(204).send(); // Clean")
    tex.append(r"}")
    tex.append(r"// 214 tokens total")
    tex.append(r"\end{verbatim}")
    tex.append(r"\end{minipage} \\")
    tex.append(r"\bottomrule")
    tex.append(r"\end{tabular}")
    tex.append(r"\begin{flushleft}")
    
    total_evals = stats["global_stats"]["total_evaluations"]
    
    tex.append(f"\\footnotesize{{Note: Inline annotations indicate qualitative architectural drift patterns. Total evaluated samples N={total_evals}.}}")
    tex.append(r"\end{flushleft}")
    tex.append(r"\end{table*}")
    
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(tex) + "\n")
        
    print(f"Generated publication_tables.tex at {out_path}")

if __name__ == "__main__":
    main()
