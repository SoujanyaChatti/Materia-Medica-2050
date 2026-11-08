"""Top-10 risk chart for slide 6, drawn from outputs/risk.csv (score, score_lo, score_hi).
Whiskers sit under each bar (score range across 3 climate models, SSP2-4.5); the bracket repeats it.
Usage: python deck/scripts/top10.py outputs/risk.csv data/curated/species.csv deck/assets/top10.png"""
import sys
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.patches import Patch

risk, species, out = sys.argv[1:4]
r = pd.read_csv(risk).sort_values("rank").head(10)
sp = pd.read_csv(species).set_index("slug")
SHORT = {"Cretan mountain tea / ironwort": "Cretan mountain tea", "Wild peonies of Greece": "Wild peonies (pooled)",
         "Prickly juniper (eastern)": "Prickly juniper"}
COL = {"certain": "#17322A", "probable": "#7FA383", "disputed": "#B4532A"}
TEXT, MUTED, GRID = "#1E2A26", "#5F6B66", "#D9DFD8"
plt.rcParams["font.family"] = "Helvetica Neue"
fig, ax = plt.subplots(figsize=(7.3, 4.0), dpi=300)
fig.patch.set_alpha(0); ax.set_facecolor("none")
labels = []
for y, (_, x) in enumerate(r.iterrows()):
    conf = sp.loc[x["slug"], "identification_confidence"]
    name = sp.loc[x["slug"], "common_name_en"]
    labels.append(f"{y + 1}   {SHORT.get(name, name)}")
    sc, lo, hi = x["score"], x["score_lo"], x["score_hi"]
    ax.barh(y - 0.08, sc, height=0.56, color=COL[conf], zorder=2)
    wy = y + 0.31   # whisker just below the bar
    ax.plot([lo, hi], [wy, wy], color=MUTED, lw=1.2, solid_capstyle="butt", zorder=3)
    ax.plot([lo, lo], [wy - 0.07, wy + 0.07], color=MUTED, lw=1.2, zorder=3)
    ax.plot([hi, hi], [wy - 0.07, wy + 0.07], color=MUTED, lw=1.2, zorder=3)
    t = ax.text(max(sc, hi) + 0.012, y - 0.02, f"{sc:.2f}", va="center", ha="left", color=TEXT, fontsize=9.5, fontweight="bold")
    t2 = ax.annotate(f"({lo:.2f}–{hi:.2f})", xy=(1, 0.5), xycoords=t, xytext=(4, 0), textcoords="offset points",
                     va="center", ha="left", color=TEXT, fontsize=8.5)
    ax.annotate(conf, xy=(1, 0.5), xycoords=t2, xytext=(5, 0), textcoords="offset points", va="center", ha="left",
                color=MUTED, fontsize=8.5, style="italic")
ax.set_yticks(range(len(labels)), labels, fontsize=10, color=TEXT)
ax.invert_yaxis()
ax.set_xlim(0, 0.98); ax.set_xticks([0, 0.2, 0.4, 0.6, 0.8])
ax.tick_params(axis="x", colors=MUTED, labelsize=8.5, length=0); ax.tick_params(axis="y", length=0, pad=6)
ax.xaxis.grid(True, color=GRID, linewidth=0.7, zorder=0)
for s in ax.spines.values(): s.set_visible(False)
ax.axvline(0, color=MUTED, linewidth=0.8, zorder=1)
ax.set_xlabel("Risk score (0–1)", color=MUTED, fontsize=8.5)
ax.legend(handles=[Patch(color=COL[k], label=k.capitalize()) for k in COL], loc="lower right", frameon=False, fontsize=9,
          ncol=3, bbox_to_anchor=(1.0, -0.26), handlelength=1.0, labelcolor=TEXT)
fig.tight_layout(pad=0.3)
fig.savefig(out, transparent=True)
print("wrote", out)
