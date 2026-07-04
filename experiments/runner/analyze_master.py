import os
import json
import pandas as pd
import numpy as np
import scipy.stats as stats
import math

def cohens_d(x, y):
    n1, n2 = len(x), len(y)
    v1, v2 = np.var(x, ddof=1), np.var(y, ddof=1)
    sp = math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2))
    return (np.mean(x) - np.mean(y)) / sp if sp != 0 else 0.0

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "..", ".."))
    results_dir = os.path.join(project_root, "experiments", "results")
    
    master_csv_path = os.path.join(results_dir, "master_raw.csv")
    final_stats_path = os.path.join(results_dir, "final_stats.json")
    
    # 1. Build master dataset if needed, or just read it
    files = {
        "Gemini 2.5 Flash": "raw.jsonl",
        "Qwen 2.5 Coder 7B": "raw_qwen.jsonl",
        "Llama 3.1 8B": "raw_llama31_8b.jsonl",
        "Gemma 3 12B": "raw_gemma3_12b.jsonl",
        "Qwen 2.5 Coder 14B": "raw_qwen25_14b.jsonl"
    }
    
    all_data = []
    for model_name, filename in files.items():
        path = os.path.join(results_dir, filename)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Dataset not found: {path}")
        df_model = pd.read_json(path, lines=True)
        df_model['model_clean'] = model_name
        all_data.append(df_model)
        
    df = pd.concat(all_data, ignore_index=True)
    df['weighted_cost'] = df['tokens_in'] * 1 + df['tokens_out'] * 4
    
    # Add excluded_p30_qwen for convenience for anything needing simple raw filter (though we use exact logic below)
    df['excluded_p30_qwen'] = (df['model_clean'] == 'Qwen 2.5 Coder 7B') & \
                              (df['prompt_id'] == 'P30') & \
                              (df['condition'] == 'vanilla')
                              
    df.to_csv(master_csv_path, index=False)
    
    final_stats = {
        "global_stats": {
            "total_evaluations": len(df),
            "structural_pass_rate_overall": float(df['final_passed'].mean())
        },
        "models": {}
    }
    
    model_order = [
        "Gemini 2.5 Flash",
        "Qwen 2.5 Coder 14B",
        "Gemma 3 12B",
        "Llama 3.1 8B",
        "Qwen 2.5 Coder 7B"
    ]
    
    for model in model_order:
        df_m = df[df['model_clean'] == model].copy()
        
        # 1. Base / Raw Stats (no exclusions)
        summary_vanilla = df_m[df_m['condition'] == 'vanilla']
        summary_aether = df_m[df_m['condition'] == 'aether']
        
        pass_rate_vanilla = float(summary_vanilla['final_passed'].mean()) if len(summary_vanilla) > 0 else 1.0
        pass_rate_aether = float(summary_aether['final_passed'].mean()) if len(summary_aether) > 0 else 1.0
        g5_failures = int(df_m['g5_ts_errors'].sum())
        
        def get_means(subdf):
            if len(subdf) == 0: return {}
            return {
                "tokens_out_mean": float(subdf['tokens_out'].mean()),
                "tokens_out_sd": float(subdf['tokens_out'].std(ddof=1) if len(subdf) > 1 else 0.0),
                "tokens_in_mean": float(subdf['tokens_in'].mean()),
                "tokens_in_sd": float(subdf['tokens_in'].std(ddof=1) if len(subdf) > 1 else 0.0),
                "latency_ms_mean": float(subdf['latency_ms'].mean()),
                "latency_ms_sd": float(subdf['latency_ms'].std(ddof=1) if len(subdf) > 1 else 0.0),
                "weighted_cost_mean": float(subdf['weighted_cost'].mean()),
                "weighted_cost_sd": float(subdf['weighted_cost'].std(ddof=1) if len(subdf) > 1 else 0.0)
            }
            
        stats_raw = {
            "vanilla": get_means(summary_vanilla),
            "aether": get_means(summary_aether),
            "pass_rate_vanilla": pass_rate_vanilla,
            "pass_rate_aether": pass_rate_aether,
            "g5_failures": g5_failures,
            "raw_n_vanilla": len(summary_vanilla),
            "raw_n_aether": len(summary_aether)
        }
        
        # 2. Corrected / Exclusion Stats for hypothesis testing & entropy
        df_corr = df_m.copy()
        if model == "Qwen 2.5 Coder 7B":
            # Entire P30 prompt pair dropped for Wilcoxon matching paper prose
            df_corr = df_corr[df_corr['prompt_id'] != 'P30']
        elif model == "Llama 3.1 8B":
            # Single iter dropped for Llama 8B Aether overflow
            excl = (df_corr['prompt_id'] == 'P05') & (df_corr['condition'] == 'aether') & (df_corr['iteration'] == 2.0)
            df_corr = df_corr[~excl]
            
        stats_corr = {
            "vanilla": get_means(df_corr[df_corr['condition'] == 'vanilla']),
            "aether": get_means(df_corr[df_corr['condition'] == 'aether'])
        }
        
        # Percentage changes (using corrected basis to ensure internal consistency)
        if stats_corr["vanilla"].get("tokens_out_mean", 0.0) > 0:
            token_pct = (stats_corr["aether"]["tokens_out_mean"] - stats_corr["vanilla"]["tokens_out_mean"]) / stats_corr["vanilla"]["tokens_out_mean"] * 100
        else:
            token_pct = 0.0
            
        if stats_corr["vanilla"].get("weighted_cost_mean", 0.0) > 0:
            cost_pct = (stats_corr["aether"]["weighted_cost_mean"] - stats_corr["vanilla"]["weighted_cost_mean"]) / stats_corr["vanilla"]["weighted_cost_mean"] * 100
        else:
            cost_pct = 0.0
            
        stats_corr["token_pct_change"] = float(token_pct)
        stats_corr["cost_pct_change"] = float(cost_pct)
        
        # 3. Wilcoxon and Cohen's d (Prompt-Level Means on corrected data)
        pm = df_corr.groupby(['prompt_id', 'condition'])['tokens_out'].mean().unstack('condition').dropna()
        if len(pm) > 0:
            v = pm['vanilla'].values
            a = pm['aether'].values
            diffs = v - a
            nonzero = diffs[diffs != 0]
            if len(nonzero) >= 4:
                W, p = stats.wilcoxon(nonzero)
            else:
                W, p = 0.0, 1.0
            d_val = cohens_d(v, a)
            n_pairs = len(pm)
        else:
            W, p, d_val, n_pairs = 0.0, 1.0, 0.0, 0
            
        hypothesis = {
            "W": float(W),
            "p_value": float(p),
            "cohens_d": float(d_val),
            "n_pairs": int(n_pairs),
            "significant": bool(p < 0.05)
        }
        
        # 4. Entropy (CV per prompt, averaged) on corrected data
        grouped = df_corr.groupby(['prompt_id', 'condition'])['tokens_out']
        # std(ddof=1) / mean
        entropies = grouped.apply(lambda x: x.std(ddof=1) / x.mean() if x.mean() != 0 else 0.0)
        ent_df = entropies.unstack('condition')
        
        van_ent = float(ent_df['vanilla'].mean()) if 'vanilla' in ent_df.columns else None
        ae_ent = float(ent_df['aether'].mean()) if 'aether' in ent_df.columns else None
        
        if math.isnan(van_ent) if van_ent is not None else True: van_ent = None
        if math.isnan(ae_ent) if ae_ent is not None else True: ae_ent = None
        
        entropy = {
            "vanilla_cv": van_ent,
            "aether_cv": ae_ent,
            "direction": "increases" if (van_ent is not None and ae_ent is not None and ae_ent > van_ent) else "decreases" if (van_ent is not None and ae_ent is not None) else None
        }
        
        final_stats["models"][model] = {
            "raw": stats_raw,
            "corrected": stats_corr,
            "hypothesis": hypothesis,
            "entropy": entropy
        }
        
    with open(final_stats_path, "w", encoding="utf-8") as f:
        json.dump(final_stats, f, indent=2)
        
    print(f"Stats pipeline completed. Wrote {final_stats_path}")

if __name__ == "__main__":
    main()
