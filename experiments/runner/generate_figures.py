import os
import json
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

def main():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    results_dir = os.path.join(project_root, "experiments", "results")
    figures_dir = os.path.join(results_dir, "figures")
    os.makedirs(figures_dir, exist_ok=True)
    
    csv_path = os.path.join(results_dir, "master_raw.csv")
    stats_path = os.path.join(results_dir, "final_stats.json")
    
    with open(stats_path, "r", encoding="utf-8") as f:
        final_stats = json.load(f)
        
    df = pd.read_csv(csv_path)
    # The figures that use the raw dataframe for Seaborn plots (Fig 5 and Fig 7)
    # exclude ONLY the individual rows that represent true anomalies/overflows:
    # 1. Qwen 7B P30 Vanilla (4096 tokens)
    # 2. Llama 8B P05 Aether Iteration 2 (8192 tokens)
    excl_qwen = (df['model_clean'] == 'Qwen 2.5 Coder 7B') & (df['prompt_id'] == 'P30') & (df['condition'] == 'vanilla')
    excl_llama = (df['model_clean'] == 'Llama 3.1 8B') & (df['prompt_id'] == 'P05') & (df['condition'] == 'aether') & (df['iteration'] == 2.0)
    df_filtered = df[~(excl_qwen | excl_llama)].copy()
    
    # ---------------------------------------------------------
    # Configure Matplotlib Options
    # ---------------------------------------------------------
    plt.rcParams.update({
        'font.family': 'sans-serif',
        'font.sans-serif': ['DejaVu Sans', 'Liberation Sans', 'Arial'],
        'font.size': 11,
        'axes.labelsize': 12,
        'axes.titlesize': 13,
        'xtick.labelsize': 10,
        'ytick.labelsize': 10,
        'figure.titlesize': 15,
        'pdf.fonttype': 42,
        'ps.fonttype': 42
    })
    
    vanilla_color = "#2196F3"
    aether_color = "#FF5722"
    sig_color = "#4CAF50"
    nonsig_color = "#9E9E9E"
    
    models_spec = [
        {"clean_name": "Qwen 2.5 Coder 7B", "short": "Qwen-7B", "capacity": 7},
        {"clean_name": "Llama 3.1 8B", "short": "Llama-8B", "capacity": 8},
        {"clean_name": "Gemma 3 12B", "short": "Gemma-12B", "capacity": 12},
        {"clean_name": "Qwen 2.5 Coder 14B", "short": "Qwen-14B", "capacity": 14},
        {"clean_name": "Gemini 2.5 Flash", "short": "Gemini", "capacity": 100}
    ]

    # ---------------------------------------------------------
    # FIGURE 4: Capacity Curve (using final_stats.json)
    # ---------------------------------------------------------
    print("Generating Figure 4: Capacity Curve...")
    fig, ax = plt.subplots(figsize=(12, 8))
    
    xs, ys, labels, p_vals, n_vals = [], [], [], [], []
    for m in models_spec:
        st = final_stats["models"][m["clean_name"]]["hypothesis"]
        xs.append(m["capacity"])
        ys.append(st["cohens_d"])
        labels.append(m["short"])
        p_vals.append(st["p_value"])
        n_vals.append(st["n_pairs"])
        
    ax.axhline(0, color="#333333", linestyle="--", linewidth=2)
    ax.fill_between([5, 150], 0, 2.0, color="#E8F5E9", alpha=0.3, label="Funnel Effect Active\n(Aether reduces output)")
    ax.fill_between([5, 150], -0.6, 0, color="#FFEBEE", alpha=0.3, label="Overhead Dominant\n(Aether increases output)")
    
    for x, y, label, p, n in zip(xs, ys, labels, p_vals, n_vals):
        color = sig_color if p < 0.05 else nonsig_color
        ax.scatter(x, y, s=220, color=color, edgecolor="black", zorder=5)
        xytext = (12, -5) if y < 0 else (12, 5)
        if label == "Gemini":
            xytext = (-75, 10)
        ax.annotate(f"{label}\n(N={n})", (x, y), textcoords="offset points", xytext=xytext, fontsize=10, weight="bold")
        
    ax.axvspan(8, 12, color="#FFF9C4", alpha=0.65, zorder=0, label="Capacity Threshold Region (8B–12B)")
    ax.axvline(8,  color="#FBC02D", linestyle=":", linewidth=1.4, zorder=1)
    ax.axvline(12, color="#FBC02D", linestyle=":", linewidth=1.4, zorder=1)
    
    ax.set_xscale("log")
    ax.set_xlim(5, 150)
    ax.set_xticks(xs)
    ax.get_xaxis().set_major_formatter(matplotlib.ticker.ScalarFormatter())
    ax.set_xlabel("Model Capacity (Billion Parameters, log scale)", labelpad=10)
    ax.set_ylabel("Cohen's d (Vanilla − Aether output tokens)", labelpad=10)
    ax.set_title("Capacity Curve: Effect of Architectural Pre-Conditioning vs. Model Scale", pad=15)
    ax.set_ylim(-0.65, 1.85)
    
    ax.grid(axis='y', linestyle='-', alpha=0.2)
    sns.despine(ax=ax, top=True, right=True)
    ax.legend(loc="lower right", frameon=True, facecolor="white", edgecolor="lightgrey")
    
    plt.tight_layout()
    plt.savefig(os.path.join(figures_dir, "fig4_capacity_curve.png"), dpi=300)
    plt.close()

    # ---------------------------------------------------------
    # FIGURE 5: Output Token Distribution
    # ---------------------------------------------------------
    print("Generating Figure 5: Output Token Distribution...")
    fig, ax = plt.subplots(figsize=(14, 7))
    df_filtered["model_clean"] = pd.Categorical(
        df_filtered["model_clean"],
        categories=[m["clean_name"] for m in models_spec],
        ordered=True
    )
    
    sns.violinplot(
        data=df_filtered, x="model_clean", y="tokens_out", hue="condition",
        palette={"vanilla": vanilla_color, "aether": aether_color},
        split=True, inner=None, ax=ax, linewidth=1.2, density_norm="width", cut=0
    )
    
    sns.boxplot(
        data=df_filtered, x="model_clean", y="tokens_out", hue="condition",
        palette={"vanilla": vanilla_color, "aether": aether_color},
        width=0.15, ax=ax, showfliers=False,
        boxprops={'zorder': 2}, capprops={'zorder': 2}, whiskerprops={'zorder': 2},
        medianprops={'color': 'white', 'linewidth': 1.5, 'zorder': 3}
    )
    
    sig_labels = {m["clean_name"]: ("***" if final_stats["models"][m["clean_name"]]["hypothesis"]["p_value"] < 0.05 else "ns") for m in models_spec}
    for i, m in enumerate(models_spec):
        ax.text(i, 2800, sig_labels[m["clean_name"]], ha='center', va='bottom', fontsize=11, weight='bold', color='#333333')
        
    ax.set_xlabel("Model", labelpad=10)
    ax.set_ylabel("Output Tokens (tokens_out)", labelpad=10)
    ax.set_title("Distribution of Output Tokens: Vanilla vs. Aether Across Model Families", pad=15)
    ax.set_ylim(0, 3000)
    
    ax.annotate(
        "P05 Aether overflow\n(8,192 tokens; excluded)",
        xy=(1.05, 2950), xytext=(1.1, 2300),
        arrowprops=dict(facecolor='black', arrowstyle='->', lw=1.2, ls=':'),
        fontsize=9, weight='semibold', ha='center',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor='lightgrey', alpha=0.9)
    )
    
    ax.set_xticks(range(len(models_spec)))
    ax.set_xticklabels([m["short"] for m in models_spec])
    ax.grid(axis='y', linestyle='-', alpha=0.2)
    sns.despine(ax=ax, top=True, right=True)
    
    handles, labels = ax.get_legend_handles_labels()
    ax.legend(handles[0:2], ["Vanilla", "Aether"], title="Condition", loc="upper right")
    
    plt.tight_layout()
    plt.savefig(os.path.join(figures_dir, "fig5_tokens_boxplot.png"), dpi=300)
    plt.close()

    # ---------------------------------------------------------
    # FIGURE 6: Weighted Cost Comparison (using final_stats.json corrected stats)
    # ---------------------------------------------------------
    print("Generating Figure 6: Weighted Cost Comparison...")
    fig, ax = plt.subplots(figsize=(12, 7))
    
    shorts = [m["short"] for m in models_spec]
    means_vanilla, stds_vanilla = [], []
    means_aether, stds_aether = [], []
    pcts = []
    
    for m in models_spec:
        st = final_stats["models"][m["clean_name"]]["corrected"]
        means_vanilla.append(st["vanilla"]["weighted_cost_mean"])
        stds_vanilla.append(st["vanilla"]["weighted_cost_sd"])
        means_aether.append(st["aether"]["weighted_cost_mean"])
        stds_aether.append(st["aether"]["weighted_cost_sd"])
        pcts.append(st["cost_pct_change"])
        
    x = np.arange(len(shorts))
    width = 0.35
    
    rects1 = ax.bar(x - width/2, means_vanilla, width, yerr=stds_vanilla, label="Vanilla", color=vanilla_color, edgecolor="black", linewidth=0.8, capsize=5)
    rects2 = ax.bar(x + width/2, means_aether, width, yerr=stds_aether, label="Aether", color=aether_color, edgecolor="black", linewidth=0.8, capsize=5)
    
    def autolabel(rects):
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f'{int(height)}', xy=(rect.get_x() + rect.get_width()/2, height),
                        xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=9, weight='bold')
    autolabel(rects1)
    autolabel(rects2)
    
    for i in range(len(shorts)):
        pct = pcts[i]
        sign = "▲" if pct > 0 else "▼"
        color = "red" if pct > 0 else "green"
        y_pos = max(means_vanilla[i], means_aether[i]) + stds_vanilla[i] + 400
        ax.text(i, y_pos, f"{sign} {abs(pct):.0f}%", ha='center', va='bottom', color=color, weight='bold', fontsize=10)
        
    ax.set_xticks(x)
    ax.set_xticklabels(shorts)
    ax.set_xlabel("Model", labelpad=10)
    ax.set_ylabel("Weighted Cost (tokens_in + 4 × tokens_out)", labelpad=10)
    ax.set_title("Weighted API Cost: Vanilla vs. Aether Across Model Families", pad=15)
    ax.grid(axis='y', linestyle='-', alpha=0.2)
    sns.despine(ax=ax, top=True, right=True)
    ax.legend(title="Condition", loc="upper left")
    
    textstr = "Weighted Cost Formula:\ntokens_in × 1 + tokens_out × 4\n(reflects API pricing asymmetry)"
    props = dict(boxstyle='round', facecolor='white', edgecolor='lightgrey', alpha=0.9)
    ax.text(0.95, 0.95, textstr, transform=ax.transAxes, fontsize=10, verticalalignment='top', horizontalalignment='right', bbox=props)
    
    plt.tight_layout()
    plt.savefig(os.path.join(figures_dir, "fig6_weighted_cost_bar.png"), dpi=300)
    plt.close()

    # ---------------------------------------------------------
    # FIGURE 7: Domain Breakdown (Fixed Domain List)
    # ---------------------------------------------------------
    print("Generating Figure 7: Domain Breakdown...")
    domain_order = ["auth", "billing", "files", "notifications", "reports", "tasks", "teams"]
    domain_labels = ["Auth", "Billing", "Files", "Notif.", "Reports", "Tasks", "Teams"]

    fig, axes = plt.subplots(nrows=5, ncols=1, figsize=(12, 20), sharey=False)
    fig.subplots_adjust(hspace=0.35)

    for ax, m in zip(axes, models_spec):
        df_m = df_filtered[df_filtered["model_clean"] == m["clean_name"]]
        agg = (df_m.groupby(["domain", "condition"])["tokens_out"]
                   .agg(mean="mean", se=lambda x: x.sem())
                   .reset_index())
                   
        x = np.arange(len(domain_order))
        w = 0.38
        
        for offset, cond, color, label in [(-w/2, "vanilla", vanilla_color, "Vanilla"), (w/2, "aether", aether_color, "Aether")]:
            sub = agg[agg["condition"] == cond].set_index("domain")
            means = [sub.loc[d, "mean"] if d in sub.index else 0 for d in domain_order]
            ses   = [sub.loc[d, "se"]   if d in sub.index else 0 for d in domain_order]
            ax.bar(x + offset, means, w, color=color, label=label, yerr=ses, capsize=3,
                   error_kw={"elinewidth": 1.0, "ecolor": "#555555"}, edgecolor="white", linewidth=0.5, zorder=3)

        ax.set_title(m["short"], fontsize=11, weight="bold", pad=8)
        ax.set_xticks(x)
        # Rotate domain labels to avoid overlap
        ax.set_xticklabels(domain_labels, fontsize=9, rotation=30, ha="right")
        ax.set_ylabel("Mean Output Tokens (±SE)", fontsize=10)
        ax.grid(axis="y", linestyle="-", alpha=0.2)
        sns.despine(ax=ax, top=True, right=True)

        if m == models_spec[0]:
            ax.legend(title="Condition", fontsize=9, title_fontsize=9, loc="upper right", frameon=True, facecolor="white", edgecolor="lightgrey")

    fig.suptitle("Mean Output Tokens by Business Domain: Vanilla vs. Aether (all 5 models, ordered by capacity)", fontsize=13, weight="bold", y=1.02)
    plt.tight_layout()
    plt.savefig(os.path.join(figures_dir, "fig7_domain_breakdown.png"), dpi=300, bbox_inches="tight")
    plt.close()

    print("Generated all figures.")

if __name__ == "__main__":
    main()
