"""Evaluate the saved scholarship screening model and write a report.

Run from the project root:
    python evaluate_ml_model.py            # full report (includes 5-fold cross-validation)
    python evaluate_ml_model.py --quick    # skip cross-validation and permutation importance
    python evaluate_ml_model.py --open     # open the HTML report when done

What it does
- Loads models/scholarship_random_forest.joblib and isko.csv.
- Rebuilds the exact train/test split used by train_ml_model.py, so the
  test rows are ones the model never saw while training.
- Prints the confusion matrix and the standard metrics, and saves:
    reports/model_evaluation/evaluation_report.html  (open in any browser)
    reports/model_evaluation/metrics.json
    reports/model_evaluation/*.png                     (charts)

Note: this measures the Random Forest alone. The screening recommendation
shown in the app also applies fixed rules (exam pass mark, 4Ps, SPES, etc.)
and is always advisory.
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import webbrowser
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.base import clone  # noqa: E402
from sklearn.inspection import permutation_importance  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split  # noqa: E402

from app.services.ml_explainer import FEATURE_INFO  # noqa: E402
from app.services.ml_screening_service import (  # noqa: E402
    DEFAULT_CSV,
    FEATURES,
    load_saved_model,
    prepare_features,
)

PROJECT_ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = PROJECT_ROOT / "reports" / "model_evaluation"
CLASS_NAMES = ["Not qualified", "Qualified"]
BLUE, NAVY, GREEN, RED, AMBER = "#115df4", "#061f4e", "#13835f", "#c92e4b", "#e7a04a"


# --------------------------------------------------------------------- data

def load_split(artifact):
    """Recreate train_ml_model.py's split; returns X_train, X_test, y_train, y_test, X, y."""
    df = pd.read_csv(DEFAULT_CSV)
    X = prepare_features(df)
    y = df["ScholarshipQualified"].astype(str).str.strip().map({"No": 0, "Yes": 1}).astype(int)
    config = artifact.get("training_configuration", {})
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=config.get("test_size", 0.20),
        random_state=config.get("random_state", 42),
        stratify=y,
    )
    return X_train, X_test, y_train, y_test, X, y


def split_matches_training(artifact, X_train, X_test, accuracy):
    """True when the dataset/split is the one the model was trained with."""
    saved = artifact.get("metrics", {})
    same_sizes = saved.get("training_rows") == len(X_train) and saved.get("testing_rows") == len(X_test)
    same_accuracy = "accuracy" in saved and abs(float(saved["accuracy"]) - accuracy) < 1e-9
    return same_sizes and same_accuracy


# ------------------------------------------------------------------ metrics

def compute_metrics(model, X_test, y_test):
    probabilities = model.predict_proba(X_test)[:, list(model.classes_).index(1)]
    predictions = (probabilities >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, predictions, labels=[0, 1]).ravel()
    return {
        "confusion_matrix": {"true_negative": int(tn), "false_positive": int(fp), "false_negative": int(fn), "true_positive": int(tp)},
        "accuracy": accuracy_score(y_test, predictions),
        "balanced_accuracy": balanced_accuracy_score(y_test, predictions),
        "precision": precision_score(y_test, predictions, zero_division=0),
        "recall_sensitivity": recall_score(y_test, predictions, zero_division=0),
        "specificity": tn / (tn + fp) if (tn + fp) else 0.0,
        "f1_score": f1_score(y_test, predictions, zero_division=0),
        "roc_auc": roc_auc_score(y_test, probabilities),
        "average_precision": average_precision_score(y_test, probabilities),
        "log_loss": log_loss(y_test, probabilities, labels=[0, 1]),
        "brier_score": brier_score_loss(y_test, probabilities),
        "test_rows": int(len(y_test)),
        "test_qualified_share": float(np.mean(y_test)),
        "decision_threshold": 0.5,
    }, probabilities, predictions


def cross_validation(model, X, y, folds=5):
    """Retrain fresh copies with the same settings on 5 different splits."""
    scores = cross_validate(
        clone(model), X, y,
        cv=StratifiedKFold(n_splits=folds, shuffle=True, random_state=42),
        scoring={"accuracy": "accuracy", "precision": "precision", "recall": "recall", "f1": "f1", "roc_auc": "roc_auc"},
        n_jobs=-1,
    )
    return {
        name.removeprefix("test_"): {"mean": float(np.mean(values)), "std": float(np.std(values)), "folds": [float(v) for v in values]}
        for name, values in scores.items() if name.startswith("test_")
    }


def importances(model, X_test, y_test, with_permutation):
    rows = [{"feature": name, "label": FEATURE_INFO.get(name, (name,))[0], "impurity": float(value)}
            for name, value in zip(FEATURES, model.feature_importances_)]
    if with_permutation:
        result = permutation_importance(model, X_test, y_test, scoring="f1", n_repeats=10, random_state=42, n_jobs=-1)
        for row, mean, std in zip(rows, result.importances_mean, result.importances_std):
            row["permutation_f1_drop"] = float(mean)
            row["permutation_std"] = float(std)
    rows.sort(key=lambda row: row["impurity"], reverse=True)
    return rows


# ------------------------------------------------------------------- charts

def save_chart(fig, name):
    path = OUTPUT_DIR / name
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def chart_confusion(metrics):
    cm = metrics["confusion_matrix"]
    grid = np.array([[cm["true_negative"], cm["false_positive"]], [cm["false_negative"], cm["true_positive"]]])
    total = grid.sum()
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.imshow(grid, cmap="Blues")
    captions = [["Correct:\nnot qualified", "Wrongly called\nqualified"], ["Missed:\nwas qualified", "Correct:\nqualified"]]
    for i in range(2):
        for j in range(2):
            dark = grid[i, j] > grid.max() / 2
            ax.text(j, i, f"{grid[i, j]}\n{grid[i, j] / total:.1%}\n{captions[i][j]}", ha="center", va="center",
                    fontsize=9, color="white" if dark else NAVY, fontweight="bold")
    ax.set_xticks([0, 1], [f"Predicted\n{c}" for c in CLASS_NAMES])
    ax.set_yticks([0, 1], [f"Actual\n{c}" for c in CLASS_NAMES])
    ax.set_title("Confusion matrix (held-out test set)", color=NAVY, fontweight="bold")
    return save_chart(fig, "confusion_matrix.png")


def chart_roc(y_test, probabilities, auc):
    fpr, tpr, _ = roc_curve(y_test, probabilities)
    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    ax.plot(fpr, tpr, color=BLUE, lw=2.2, label=f"Random Forest (AUC = {auc:.3f})")
    ax.plot([0, 1], [0, 1], color="#9aaac0", ls="--", lw=1, label="Random guess")
    ax.set_xlabel("False positive rate"); ax.set_ylabel("True positive rate (recall)")
    ax.set_title("ROC curve", color=NAVY, fontweight="bold"); ax.legend(loc="lower right"); ax.grid(alpha=.25)
    return save_chart(fig, "roc_curve.png")


def chart_pr(y_test, probabilities, ap):
    precision, recall, _ = precision_recall_curve(y_test, probabilities)
    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    ax.plot(recall, precision, color=GREEN, lw=2.2, label=f"Average precision = {ap:.3f}")
    ax.axhline(float(np.mean(y_test)), color="#9aaac0", ls="--", lw=1, label="Share of qualified applicants")
    ax.set_xlabel("Recall"); ax.set_ylabel("Precision")
    ax.set_title("Precision–recall curve", color=NAVY, fontweight="bold"); ax.legend(loc="lower left"); ax.grid(alpha=.25)
    return save_chart(fig, "precision_recall_curve.png")


def chart_importance(rows):
    ordered = rows[::-1]
    fig, ax = plt.subplots(figsize=(6.4, 4.8))
    ax.barh([row["label"] for row in ordered], [row["impurity"] for row in ordered], color=BLUE)
    ax.set_xlabel("Importance (share of the model's decisions)")
    ax.set_title("Which inputs the model relies on", color=NAVY, fontweight="bold"); ax.grid(axis="x", alpha=.25)
    return save_chart(fig, "feature_importance.png")


def chart_probabilities(y_test, probabilities):
    fig, ax = plt.subplots(figsize=(6.4, 3.8))
    bins = np.linspace(0, 1, 21)
    ax.hist(probabilities[np.asarray(y_test) == 0], bins=bins, alpha=.75, color=RED, label="Actually not qualified")
    ax.hist(probabilities[np.asarray(y_test) == 1], bins=bins, alpha=.75, color=GREEN, label="Actually qualified")
    ax.axvline(.5, color=NAVY, ls="--", lw=1, label="Decision threshold (50%)")
    ax.set_xlabel("Predicted chance of qualifying"); ax.set_ylabel("Applicants")
    ax.set_title("How confident the model is", color=NAVY, fontweight="bold"); ax.legend()
    return save_chart(fig, "probability_distribution.png")


# ------------------------------------------------------------------- output

def print_report(metrics, cv, rows, report_text, matched):
    cm = metrics["confusion_matrix"]
    print("\n=== Confusion matrix (held-out test set) ===")
    print(f"{'':22}{'Pred: Not qualified':>22}{'Pred: Qualified':>18}")
    print(f"{'Actual: Not qualified':22}{cm['true_negative']:>22}{cm['false_positive']:>18}")
    print(f"{'Actual: Qualified':22}{cm['false_negative']:>22}{cm['true_positive']:>18}")
    print("\n=== Metrics ===")
    for key in ("accuracy", "balanced_accuracy", "precision", "recall_sensitivity", "specificity", "f1_score",
                "roc_auc", "average_precision", "log_loss", "brier_score"):
        print(f"{key:22}{metrics[key]:.4f}")
    print("\n=== Classification report ===\n" + report_text)
    if cv:
        print("=== 5-fold cross-validation (mean ± std) ===")
        for name, value in cv.items():
            print(f"{name:22}{value['mean']:.4f} ± {value['std']:.4f}")
    print("\n=== Feature importance ===")
    for row in rows:
        extra = f"   permutation F1 drop {row['permutation_f1_drop']:.4f}" if "permutation_f1_drop" in row else ""
        print(f"{row['label']:34}{row['impurity']:.4f}{extra}")
    if not matched:
        print("\nWARNING: this split does not reproduce the training run (isko.csv or settings changed).\n"
              "Some test rows may have been used for training, so these numbers may be optimistic. Retrain first.")


def image_tag(path, alt):
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f'<img src="data:image/png;base64,{data}" alt="{html.escape(alt)}">'


def write_html(artifact, metrics, cv, rows, report_text, charts, matched):
    cm = metrics["confusion_matrix"]
    pct = lambda value: f"{value * 100:.1f}%"
    cards = [
        ("Accuracy", pct(metrics["accuracy"]), "Share of all test applicants classified correctly."),
        ("Precision", pct(metrics["precision"]), "When the model says qualified, how often it is right."),
        ("Recall", pct(metrics["recall_sensitivity"]), "Share of truly qualified applicants the model finds."),
        ("Specificity", pct(metrics["specificity"]), "Share of not-qualified applicants correctly identified."),
        ("F1 score", pct(metrics["f1_score"]), "Balance of precision and recall."),
        ("ROC-AUC", f"{metrics['roc_auc']:.3f}", "1.0 = perfect ranking, 0.5 = random guessing."),
    ]
    cv_rows = "".join(
        f"<tr><td>{html.escape(name.replace('_', ' ').title())}</td><td>{value['mean']:.4f}</td><td>± {value['std']:.4f}</td>"
        f"<td>{' · '.join(f'{v:.3f}' for v in value['folds'])}</td></tr>"
        for name, value in (cv or {}).items()
    )
    importance_rows = "".join(
        f"<tr><td>{html.escape(row['label'])}</td><td>{row['impurity']:.4f}</td>"
        f"<td>{row.get('permutation_f1_drop', float('nan')):.4f}</td></tr>" for row in rows
    )
    warning = "" if matched else (
        '<div class="warn">This split does not reproduce the training run (isko.csv or settings changed). '
        "Some test rows may have been used in training, so these numbers may be optimistic. Retrain the model first.</div>")
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Model Evaluation Report</title>
<style>
:root {{ --navy:#061f4e; --blue:#115df4; --ink:#14264a; --muted:#536d94; --line:#dbe6f5; --canvas:#f4f8fe; }}
* {{ box-sizing:border-box; }} body {{ margin:0; background:var(--canvas); color:var(--ink); font:14px/1.5 Inter,"Segoe UI",sans-serif; }}
header {{ background:var(--navy); color:#fff; padding:28px 16px; }} header div, main {{ max-width:1100px; margin:0 auto; }}
header h1 {{ margin:0 0 4px; font-size:26px; }} header p {{ margin:0; color:#c7d7f1; }}
main {{ padding:20px 16px 48px; }} section {{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:18px; margin:0 0 16px; }}
h2 {{ margin:0 0 4px; font-size:17px; }} .sub {{ margin:0 0 14px; color:var(--muted); font-size:13px; }}
.cards {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; }}
.card {{ border:1px solid var(--line); border-radius:10px; padding:12px; }} .card b {{ display:block; font-size:24px; color:var(--blue); }}
.card small {{ color:var(--muted); }} .grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; }}
img {{ width:100%; max-width:620px; height:auto; display:block; margin:0 auto; }} table {{ width:100%; border-collapse:collapse; font-size:13px; }}
th, td {{ text-align:left; padding:7px 8px; border-bottom:1px solid var(--line); }} th {{ background:#eef5ff; }}
.cm td {{ text-align:center; font-weight:600; }} .cm .ok {{ background:#e6f4ee; color:#13835f; }} .cm .bad {{ background:#fdecef; color:#c92e4b; }}
pre {{ background:#f8fbff; border:1px solid var(--line); border-radius:8px; padding:12px; overflow:auto; }}
.warn {{ background:#fff4e5; border:1px solid #f0c27a; color:#7a4b00; border-radius:8px; padding:10px 12px; margin-bottom:16px; }}
.note {{ color:var(--muted); font-size:12.5px; }} .table-wrap {{ overflow-x:auto; }}
</style></head><body>
<header><div><h1>Scholarship screening model — evaluation</h1>
<p>Random Forest {html.escape(str(artifact.get('model_version', '')))} · trained {html.escape(str(artifact.get('trained_at_utc', 'unknown'))[:19])} UTC ·
dataset {html.escape(str(artifact.get('dataset', 'isko.csv')))} · report generated {datetime.now():%Y-%m-%d %H:%M}</p></div></header>
<main>{warning}
<section><h2>Summary</h2><p class="sub">Measured on {metrics['test_rows']:,} held-out applicants the model never saw during training
({metrics['test_qualified_share']:.1%} of them actually qualified). A prediction of 50% or more counts as "qualified".</p>
<div class="cards">{''.join(f'<div class="card">{t}<b>{v}</b><small>{d}</small></div>' for t, v, d in cards)}</div></section>
<section><h2>Confusion matrix</h2><p class="sub">Rows are the real outcome; columns are what the model predicted.</p>
<div class="grid"><div class="table-wrap"><table class="cm"><tr><th></th><th>Predicted not qualified</th><th>Predicted qualified</th></tr>
<tr><th>Actually not qualified</th><td class="ok">{cm['true_negative']}<br><small>true negatives</small></td><td class="bad">{cm['false_positive']}<br><small>false positives</small></td></tr>
<tr><th>Actually qualified</th><td class="bad">{cm['false_negative']}<br><small>false negatives (missed)</small></td><td class="ok">{cm['true_positive']}<br><small>true positives</small></td></tr></table>
<p class="note">False negatives are qualified applicants the model would under-rate; that's why every result stays advisory and is reviewed by staff.</p></div>
{image_tag(charts['confusion'], 'Confusion matrix chart')}</div></section>
<section><h2>Ranking quality</h2><p class="sub">How well the model's percentages separate qualified from not-qualified applicants, at every possible cut-off.</p>
<div class="grid">{image_tag(charts['roc'], 'ROC curve')}{image_tag(charts['pr'], 'Precision-recall curve')}</div>
<p class="note">Log loss {metrics['log_loss']:.4f} · Brier score {metrics['brier_score']:.4f} (lower is better; they measure how trustworthy the percentages are).</p></section>
<section><h2>Confidence distribution</h2><p class="sub">Predicted chance of qualifying for each test applicant, split by the real outcome.</p>{image_tag(charts['probabilities'], 'Probability distribution')}</section>
{f'<section><h2>5-fold cross-validation</h2><p class="sub">The same model settings retrained on five different splits of the full dataset. A small ± means results are stable.</p><div class="table-wrap"><table><tr><th>Metric</th><th>Mean</th><th>Spread</th><th>Per fold</th></tr>{cv_rows}</table></div></section>' if cv else ''}
<section><h2>What the model relies on</h2><p class="sub">Overall importance across all applicants. Permutation = how much F1 drops when that input is scrambled ({'not computed in quick mode' if 'permutation_f1_drop' not in rows[0] else 'higher means more important'}).</p>
<div class="grid">{image_tag(charts['importance'], 'Feature importance')}<div class="table-wrap"><table><tr><th>Input</th><th>Importance</th><th>Permutation F1 drop</th></tr>{importance_rows}</table></div></div>
<p class="note">Each applicant's profile in the app shows a personal breakdown: how much each of their own inputs raised or lowered their chance.</p></section>
<section><h2>Classification report</h2><pre>{html.escape(report_text)}</pre>
<p class="note">This evaluates the Random Forest alone. The app's screening recommendation also applies fixed rules (exam pass mark, 4Ps, SPES, scholars in family)
and is always advisory — final decisions are made by authorized LYDO officials.</p></section>
</main></body></html>"""
    path = OUTPUT_DIR / "evaluation_report.html"
    path.write_text(page, encoding="utf-8")
    return path


def main():
    parser = argparse.ArgumentParser(description="Evaluate the saved scholarship screening model.")
    parser.add_argument("--quick", action="store_true", help="skip cross-validation and permutation importance")
    parser.add_argument("--open", action="store_true", help="open the HTML report in your browser")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    model, artifact = load_saved_model()
    X_train, X_test, y_train, y_test, X, y = load_split(artifact)
    print(f"Model {artifact.get('model_version')} · {len(X_train):,} training rows · {len(X_test):,} test rows")

    metrics, probabilities, predictions = compute_metrics(model, X_test, y_test)
    matched = split_matches_training(artifact, X_train, X_test, metrics["accuracy"])
    report_text = classification_report(y_test, predictions, target_names=CLASS_NAMES, digits=4)
    if not args.quick:
        print("Running 5-fold cross-validation (retrains 5 models; may take a minute)...")
    cv = None if args.quick else cross_validation(model, X, y)
    rows = importances(model, X_test, y_test, with_permutation=not args.quick)

    charts = {
        "confusion": chart_confusion(metrics),
        "roc": chart_roc(y_test, probabilities, metrics["roc_auc"]),
        "pr": chart_pr(y_test, probabilities, metrics["average_precision"]),
        "importance": chart_importance(rows),
        "probabilities": chart_probabilities(y_test, probabilities),
    }
    print_report(metrics, cv, rows, report_text, matched)

    output = {
        "model_version": artifact.get("model_version"),
        "trained_at_utc": artifact.get("trained_at_utc"),
        "split_matches_training": matched,
        "metrics": metrics,
        "cross_validation": cv,
        "feature_importance": rows,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }
    (OUTPUT_DIR / "metrics.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    report = write_html(artifact, metrics, cv, rows, report_text, charts, matched)
    print(f"\nReport saved: {report}")
    if args.open:
        webbrowser.open(report.as_uri())


if __name__ == "__main__":
    main()
