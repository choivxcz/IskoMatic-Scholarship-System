"""Generate the synthetic training dataset (isko.csv).

Run from the project root:
    python generate_dataset.py                 # writes isko.csv (10,000 students)
    python generate_dataset.py --rows 20000 --out other.csv

Every value here is simulated. No real applicant data is used.

How each student is made
------------------------
1. Profile: age and year level, academic average, household (size, children,
   seniors, PWDs, dependents, solo parent), monthly income, and an entrance
   exam (total items and score). Ranges follow the original isko.csv.
2. Program flags: 4Ps, SPES, and whether the family already has a scholar.
3. MSWDO poverty flag: calculated with the same formula the app uses
   (app.services.ml_screening_service.mswd_threshold), never drawn at random,
   so training data and live screening always agree.

How "ScholarshipQualified" is decided
-------------------------------------
A student is labeled qualified only when BOTH are true:

  a) They pass every eligibility rule (the same rules the app applies):
     exam score >= 80% of the items, academic average above 75,
     not a 4Ps beneficiary, not an SPES beneficiary, no scholar in the family.

  b) Their rubric score, plus reviewer variation, reaches the cutoff.
     The rubric is the weighted criteria table below (from the project's
     original scoring script). Reviewer variation is random noise with a
     standard deviation of REVIEWER_SD points: it stands in for the
     judgement differences between real evaluators, so the label is not a
     perfect formula of the inputs. The cutoff is set so that about
     QUALIFIED_SHARE of eligible students qualify.

Students who fail any rule are always labeled "No", so the label never
contradicts the eligibility rules.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from app.services.ml_screening_service import EXAM_PASSING_RATE, mswd_threshold

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_OUT = PROJECT_ROOT / "isko.csv"

ROWS = 10_000
SEED = 2026
QUALIFIED_SHARE = 0.50   # share of eligible students labeled qualified
REVIEWER_SD = 7.0        # reviewer variation, in rubric points (0-100 scale)

# Rubric weights (percent of the total score).
WEIGHTS = {
    "AcademicAverage": 13.64,
    "MonthlyIncome": 18.18,
    "MSWDOPovertyEligible": 18.18,
    "Household": 4.55,
    "ChildrenCount": 9.09,
    "SeniorCount": 9.09,
    "PWDCount": 9.09,
    "SoloParent": 4.55,
    "Dependent": 9.09,
    "ExamPassed": 4.55,
}

COLUMNS = [
    "Age", "GradeLevel", "AcademicAverage", "MonthlyIncome", "Household", "Dependent",
    "ChildrenCount", "SeniorCount", "PWDCount", "4psBeneficiaries", "SPESBeneficiaries",
    "SoloParent", "ScholarsInFamily", "MSWDOPovertyEligible", "ExamTotalItems", "ExamScore",
    "ExamPassed", "ScholarshipQualified",
]

GRADE_LEVELS = ["1st Yr College", "2nd Yr College", "3rd Yr College", "4th Yr College"]


def rubric_score(df: pd.DataFrame) -> pd.Series:
    """Weighted rubric score from 0 to 100 (higher = stronger case)."""
    threshold = df["_threshold"]
    income = df["MonthlyIncome"]
    below = 0.5 + 0.5 * (threshold - income) / threshold
    above = 0.5 * (1 - (income - threshold) / threshold).clip(0, 1)
    parts = {
        "AcademicAverage": ((df["AcademicAverage"] - 75) / 25).clip(0, 1),
        "MonthlyIncome": np.where(income <= threshold, below, above).clip(0, 1),
        "MSWDOPovertyEligible": (df["MSWDOPovertyEligible"] == "Yes").astype(float),
        "Household": ((df["Household"] - 1) / 7).clip(0, 1),
        "ChildrenCount": (df["ChildrenCount"] / 5).clip(0, 1),
        "SeniorCount": (df["SeniorCount"] / 2).clip(0, 1),
        "PWDCount": (df["PWDCount"] / 2).clip(0, 1),
        "SoloParent": (df["SoloParent"] == "Yes").astype(float),
        "Dependent": (df["Dependent"] / 7).clip(0, 1),
        "ExamPassed": (df["ExamPassed"] == "Yes").astype(float),
    }
    total = sum(WEIGHTS.values())
    return sum(parts[name] * weight for name, weight in WEIGHTS.items()) / total * 100


def yes_no(flags) -> np.ndarray:
    return np.where(flags, "Yes", "No")


def generate(n: int = ROWS, seed: int = SEED, qualified_share: float = QUALIFIED_SHARE,
             reviewer_sd: float = REVIEWER_SD) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # Year level and age (older students tend to be in higher years).
    year = rng.choice(4, size=n, p=[0.33, 0.28, 0.22, 0.17])
    age = np.clip(18 + year + rng.poisson(1.2, n), 18, 25)

    # Academic average: centred near 89, a few at or below 75.
    average = np.clip(rng.normal(88.5, 5.8, n), 70.0, 99.99).round(2)

    # Household: size 2-8; children, seniors and PWDs fit inside it.
    household = rng.integers(2, 9, n)
    children = np.minimum(rng.binomial(5, 0.42, n), household - 1)
    seniors = np.minimum(rng.choice(3, size=n, p=[0.42, 0.37, 0.21]), household - 1 - children)
    pwds = np.minimum(rng.choice(3, size=n, p=[0.52, 0.34, 0.14]), household - 1 - children - seniors)
    pwds = np.maximum(pwds, 0)
    dependent = np.minimum(children + seniors + rng.integers(0, 3, n), household - 1)
    solo = rng.random(n) < 0.15

    # Monthly income: right-skewed around PHP 15,500, PHP 5,000-60,000.
    income = np.clip(rng.lognormal(np.log(15_500), 0.55, n), 5_000, 60_000).round(0)

    # Entrance exam: score tracks the academic average; about 88% pass.
    total_items = rng.choice([25, 30, 40, 50, 60], size=n, p=[0.10, 0.20, 0.34, 0.26, 0.10])
    exam_pct = np.clip(rng.normal(0.70 + (average - 88.5) * 0.008, 0.075, n) + 0.17, 0.20, 1.0)
    exam_score = np.clip(np.round(exam_pct * total_items), 0, total_items).astype(int)
    exam_passed = exam_score >= EXAM_PASSING_RATE * total_items

    # Program flags.
    fourps = rng.random(n) < 0.08
    spes = rng.random(n) < 0.04
    scholars = (rng.random(n) < 0.06).astype(int)

    threshold = np.array([mswd_threshold(h, c, s, p) for h, c, s, p in zip(household, children, seniors, pwds)])

    df = pd.DataFrame({
        "Age": age,
        "GradeLevel": np.array(GRADE_LEVELS)[year],
        "AcademicAverage": average,
        "MonthlyIncome": income.astype(int),
        "Household": household,
        "Dependent": dependent,
        "ChildrenCount": children,
        "SeniorCount": seniors,
        "PWDCount": pwds,
        "4psBeneficiaries": yes_no(fourps),
        "SPESBeneficiaries": yes_no(spes),
        "SoloParent": yes_no(solo),
        "ScholarsInFamily": scholars,
        "MSWDOPovertyEligible": yes_no(income <= threshold),
        "ExamTotalItems": total_items,
        "ExamScore": exam_score,
        "ExamPassed": yes_no(exam_passed),
        "_threshold": threshold,
    })

    eligible = exam_passed & (average > 75) & ~fourps & ~spes & (scholars < 1)
    score = rubric_score(df) + rng.normal(0, reviewer_sd, n)
    cutoff = np.quantile(score[eligible], 1 - qualified_share)
    df["ScholarshipQualified"] = yes_no(eligible & (score >= cutoff))
    return df[COLUMNS]


def main():
    parser = argparse.ArgumentParser(description="Generate the synthetic scholarship dataset.")
    parser.add_argument("--rows", type=int, default=ROWS)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    df = generate(n=args.rows, seed=args.seed)
    df.to_csv(args.out, index=False)

    eligible = (
        (df["ExamPassed"] == "Yes") & (df["AcademicAverage"] > 75) & (df["4psBeneficiaries"] == "No")
        & (df["SPESBeneficiaries"] == "No") & (df["ScholarsInFamily"] < 1)
    )
    qualified = df["ScholarshipQualified"] == "Yes"
    print(f"Saved {len(df):,} students to {args.out}")
    print(f"Eligible: {eligible.sum():,} ({eligible.mean():.1%})")
    print(f"Qualified: {qualified.sum():,} ({qualified[eligible].mean():.1%} of eligible)")


if __name__ == "__main__":
    main()
