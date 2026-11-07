"""Explain a single Random Forest prediction in plain language.

How it works (the "decision path" breakdown for tree ensembles):
every tree starts from the share of qualified applicants it saw in training
(the baseline). Each split the applicant passes through moves that share up
or down; the move is credited to the feature used by that split. Averaging
over all trees gives, per feature, how many percentage points it added or
removed. Baseline + all contributions equals the model's probability exactly,
so the reasons shown are the model's real reasoning, not a guess.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

import numpy as np

# Plain-language names and value formatting for every model feature.
FEATURE_INFO: dict[str, tuple[str, str]] = {
    "AcademicAverage": ("Academic average", "grade"),
    "MonthlyIncome": ("Monthly household income", "money"),
    "MSWDOPovertyEligible": ("Within MSWDO poverty threshold", "yesno"),
    "Household": ("Household size", "count"),
    "ChildrenCount": ("Children in household", "count"),
    "SeniorCount": ("Seniors in household", "count"),
    "PWDCount": ("PWDs in household", "count"),
    "SoloParent": ("Solo parent household", "yesno"),
    "Dependent": ("Number of dependents", "count"),
    "ExamPassed": ("Passed entrance exam (80%+)", "yesno"),
    "4psBeneficiaries": ("4Ps beneficiary", "yesno"),
    "SPESBeneficiaries": ("SPES beneficiary", "yesno"),
    "ScholarsInFamily": ("Another scholar in the family", "yesno"),
}


def format_value(feature: str, value: float) -> str:
    kind = FEATURE_INFO.get(feature, (feature, "count"))[1]
    if kind == "yesno":
        return "Yes" if value >= 0.5 else "No"
    if kind == "money":
        return f"₱{value:,.0f}"
    if kind == "grade":
        return f"{value:.2f}"
    return f"{value:g}"


@lru_cache(maxsize=4)
def _tree_tables(model_id: int, model) -> list[tuple[np.ndarray, ...]]:
    """Per tree: left/right children, split feature, threshold, P(qualified) per node."""
    tables = []
    for estimator in model.estimators_:
        tree = estimator.tree_
        values = tree.value[:, 0, :]
        totals = values.sum(axis=1, keepdims=True)
        totals[totals == 0] = 1
        qualified_index = list(model.classes_).index(1)
        share = (values / totals)[:, qualified_index]
        tables.append((tree.children_left, tree.children_right, tree.feature, tree.threshold, share))
    return tables


def explain_prediction(model, row, features: list[str]) -> dict[str, Any]:
    """Break one prediction into a baseline plus a contribution per feature.

    `row` is a one-row DataFrame (or 1-D array) in `features` order.
    Returns percentages (0-100) and contributions in percentage points.
    """
    x = np.asarray(getattr(row, "to_numpy", lambda **_: row)(dtype=float)).reshape(-1)
    totals = np.zeros(len(features))
    baseline = 0.0
    tables = _tree_tables(id(model), model)
    for left, right, feature, threshold, share in tables:
        node = 0
        baseline += share[0]
        while left[node] != -1:
            f = feature[node]
            child = left[node] if x[f] <= threshold[node] else right[node]
            totals[f] += share[child] - share[node]
            node = child
    count = len(tables)
    baseline_percent = float(baseline / count * 100)
    contributions = totals / count * 100

    items = [
        {
            "feature": name,
            "label": FEATURE_INFO.get(name, (name, ""))[0],
            "value": float(x[i]),
            "display_value": format_value(name, float(x[i])),
            "impact_points": round(float(contributions[i]), 2),
        }
        for i, name in enumerate(features)
    ]
    items.sort(key=lambda item: abs(item["impact_points"]), reverse=True)
    probability = baseline_percent + float(contributions.sum())
    return {
        "baseline_percent": round(baseline_percent, 2),
        "probability_percent": round(probability, 2),
        "contributions": items,
        "summary": reason_sentences(items, probability),
    }


def _sentence(item: dict[str, Any]) -> str:
    points = item["impact_points"]
    direction = "raised" if points > 0 else "lowered"
    return f"{item['label']}: {item['display_value']} — {direction} the qualification chance by {abs(points):.1f} points."


def reason_sentences(contributions: list[dict[str, Any]], probability: float) -> list[str]:
    """Plain-language reasons: what drove the leaning first, then what worked against it.

    Only factors that moved the prediction by at least 0.5 points are mentioned.
    """
    qualified = probability >= 50
    strong = [item for item in contributions if abs(item["impact_points"]) >= 0.5]
    toward = [item for item in strong if (item["impact_points"] > 0) == qualified][:3]
    against = [item for item in strong if (item["impact_points"] > 0) != qualified][:2]
    sentences = [
        f"The model estimates a {probability:.1f}% chance of qualifying, "
        f"so it leans {'qualified' if qualified else 'not qualified'}."
    ]
    sentences += [_sentence(item) for item in toward]
    if against:
        sentences.append("Working the other way:")
        sentences += [_sentence(item) for item in against]
    if len(sentences) == 1:
        sentences.append("No single factor moved the prediction much; it stayed close to the typical applicant.")
    return sentences
