"""Scholarship screening: fixed eligibility rules first, then the ML model.

Step 1 (rules, no AI): the office's eligibility rules are checked directly.
An applicant who fails any rule is not scored by the model; staff confirm
the result before any official action.

Step 2 (ML): among applicants who pass every rule, a Random Forest estimates
the chance of qualifying from need and merit factors. That chance is used to
rank eligible applicants within the same program and year
(see screening_ranking_service.py).

Every result is advisory. The system never awards or rejects a scholarship.
"""

from pathlib import Path

import joblib
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from app.services.ml_explainer import explain_prediction

PROJECT_ROOT = Path(__file__).resolve().parents[2]

DEFAULT_CSV = PROJECT_ROOT / "isko.csv"

MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "scholarship_random_forest.joblib"
)

MODEL_VERSION = "rf-2.0.0"

# Eligibility rules (step 1). These are office policy, not model inputs.
EXAM_PASSING_RATE = 0.8
MINIMUM_AVERAGE_EXCLUSIVE = 75

# Need and merit factors the model weighs for eligible applicants (step 2).
# 4Ps, SPES, scholars in family and exam passed are decided by the rules,
# so the model does not use them.
FEATURES = [
    "AcademicAverage",
    "MonthlyIncome",
    "MSWDOPovertyEligible",
    "Household",
    "ChildrenCount",
    "SeniorCount",
    "PWDCount",
    "SoloParent",
    "Dependent",
]

# Columns needed to apply the eligibility rules to the training data.
RULE_COLUMNS = [
    "ExamPassed",
    "4psBeneficiaries",
    "SPESBeneficiaries",
    "ScholarsInFamily",
]

REQUIRED_COLUMNS = FEATURES + RULE_COLUMNS + ["ScholarshipQualified"]

TRAINING_CONFIGURATION = {
    "n_estimators": 300,
    "min_samples_leaf": 10,
    "random_state": 42,
    "test_size": 0.20,
    "training_population": "Applicants who pass every eligibility rule",
}

NOT_ELIGIBLE = "Not Eligible"
PROCEED_TO_INTERVIEW = "Proceed To Interview"
NEEDS_OFFICIAL_REVIEW = "Needs Official Review"


def load_saved_model():

    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Saved model not found: {MODEL_PATH}\n"
            "Please run train_ml_model.py first."
        )

    try:
        artifact = joblib.load(MODEL_PATH)
    except Exception as exc:
        raise RuntimeError(
            f"Unable to load the saved model: {MODEL_PATH}"
        ) from exc

    if not isinstance(artifact, dict):
        raise ValueError(
            "Invalid model artifact. Expected a dictionary."
        )

    saved_features = artifact.get("features")

    if saved_features != FEATURES:
        raise ValueError(
            "The saved model's feature configuration does not "
            "match the current ML service.\n"
            "Please retrain the model using train_ml_model.py."
        )

    model = artifact.get("model")

    if not isinstance(model, RandomForestClassifier):
        raise ValueError(
            "The saved artifact does not contain a valid "
            "RandomForestClassifier."
        )

    if not hasattr(model, "n_features_in_"):
        raise ValueError(
            "The saved model has not been fitted."
        )

    if model.n_features_in_ != len(FEATURES):
        raise ValueError(
            "The saved model has an unexpected number of features."
        )

    if list(model.classes_) != [0, 1]:
        raise ValueError(
            "The saved model must support both classes: "
            "0 = Not qualified and 1 = Qualified."
        )

    return model, artifact


def _yes_no_to_int(series):
    """Convert Yes/No values to 1/0."""

    values = series.astype(str).str.strip().str.lower()

    invalid = ~values.isin(["yes", "no"])

    if invalid.any():
        raise ValueError(
            "Unexpected Yes/No values: "
            f"{values[invalid].unique().tolist()}"
        )

    return values.map({
        "yes": 1,
        "no": 0,
    }).astype(int)


def eligibility_failures(average, exam_passed, fourps, spes, scholars):
    """Return the eligibility rules an applicant fails (empty when eligible)."""

    failures = []

    if not exam_passed:
        failures.append(
            "Exam score is below the required 80% passing rate."
        )

    if average <= MINIMUM_AVERAGE_EXCLUSIVE:
        failures.append(
            "Academic average must be greater than 75."
        )

    if spes:
        failures.append(
            "Applicant is an SPES beneficiary."
        )

    if fourps:
        failures.append(
            "Applicant is a 4Ps beneficiary."
        )

    if scholars >= 1:
        failures.append(
            "Family already has a scholar."
        )

    return failures


def eligible_rows(df):
    """Boolean mask of dataset rows that pass every eligibility rule."""

    average = pd.to_numeric(df["AcademicAverage"], errors="raise")
    scholars = pd.to_numeric(df["ScholarsInFamily"], errors="raise")

    return (
        (_yes_no_to_int(df["ExamPassed"]) == 1)
        & (average > MINIMUM_AVERAGE_EXCLUSIVE)
        & (_yes_no_to_int(df["4psBeneficiaries"]) == 0)
        & (_yes_no_to_int(df["SPESBeneficiaries"]) == 0)
        & (scholars < 1)
    )


def prepare_features(df):

    X = pd.DataFrame(index=df.index)

    X["AcademicAverage"] = pd.to_numeric(
        df["AcademicAverage"],
        errors="raise",
    )

    X["MonthlyIncome"] = pd.to_numeric(
        df["MonthlyIncome"],
        errors="raise",
    )

    X["MSWDOPovertyEligible"] = _yes_no_to_int(
        df["MSWDOPovertyEligible"]
    )

    X["Household"] = pd.to_numeric(
        df["Household"],
        errors="raise",
    )

    X["ChildrenCount"] = pd.to_numeric(
        df["ChildrenCount"],
        errors="raise",
    )

    X["SeniorCount"] = pd.to_numeric(
        df["SeniorCount"],
        errors="raise",
    )

    X["PWDCount"] = pd.to_numeric(
        df["PWDCount"],
        errors="raise",
    )

    X["SoloParent"] = _yes_no_to_int(
        df["SoloParent"]
    )

    X["Dependent"] = pd.to_numeric(
        df["Dependent"],
        errors="raise",
    )

    X = X[FEATURES]

    if X.isnull().any().any():
        raise ValueError(
            "Dataset contains missing feature values."
        )

    if not X.apply(
        lambda column: column.map(
            lambda value: (
                pd.notna(value)
                and float(value) != float("inf")
                and float(value) != float("-inf")
            )
        )
    ).all().all():
        raise ValueError(
            "Dataset contains non-finite feature values."
        )

    return X


def load_training_data(csv_path=DEFAULT_CSV):
    """
    Read the dataset and keep only rule-eligible applicants.

    Returns (X, y, summary). The model only ever scores eligible applicants,
    so it is trained and tested on that same group.
    """

    csv_path = Path(csv_path)

    if not csv_path.is_absolute():
        csv_path = PROJECT_ROOT / csv_path

    if not csv_path.exists():
        raise FileNotFoundError(
            f"Dataset not found: {csv_path}"
        )

    df = pd.read_csv(csv_path)

    missing = set(REQUIRED_COLUMNS) - set(df.columns)

    if missing:
        raise ValueError(
            "Dataset is missing columns: "
            + ", ".join(sorted(missing))
        )

    labels = (
        df["ScholarshipQualified"]
        .astype(str)
        .str.strip()
    )

    invalid_labels = ~labels.isin(["Yes", "No"])

    if invalid_labels.any():
        raise ValueError(
            "ScholarshipQualified must contain only Yes or No."
        )

    mask = eligible_rows(df)
    eligible = df[mask]

    X = prepare_features(eligible)

    y = labels[mask].map({
        "No": 0,
        "Yes": 1,
    }).astype(int)

    if y.nunique() != 2 or y.value_counts().min() < 2:
        raise ValueError(
            "Training requires at least two examples of each class "
            "among eligible applicants."
        )

    summary = {
        "dataset_rows": int(len(df)),
        "eligible_rows": int(len(eligible)),
        "eligible_qualified_share": float(y.mean()),
    }

    return X, y, summary


def split_training_data(X, y):
    return train_test_split(
        X,
        y,
        test_size=TRAINING_CONFIGURATION["test_size"],
        random_state=TRAINING_CONFIGURATION["random_state"],
        stratify=y,
    )


def load_and_train(csv_path=DEFAULT_CSV):

    X, y, summary = load_training_data(csv_path)

    X_train, X_test, y_train, y_test = split_training_data(X, y)

    model = RandomForestClassifier(
        n_estimators=TRAINING_CONFIGURATION["n_estimators"],
        min_samples_leaf=TRAINING_CONFIGURATION["min_samples_leaf"],
        random_state=TRAINING_CONFIGURATION["random_state"],
        n_jobs=-1,
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": accuracy_score(
            y_test,
            predictions,
        ),
        "precision": precision_score(
            y_test,
            predictions,
            zero_division=0,
        ),
        "recall": recall_score(
            y_test,
            predictions,
            zero_division=0,
        ),
        "f1_score": f1_score(
            y_test,
            predictions,
            zero_division=0,
        ),
        "roc_auc": roc_auc_score(
            y_test,
            probabilities,
        ),
        "training_rows": len(X_train),
        "testing_rows": len(X_test),
        **summary,
    }

    return model, metrics


def mswd_threshold(household, children, seniors, pwds):

    return (
        max(15000, 4000 * household)
        + 2000 * children
        + 2000 * seniors
        + 2500 * pwds
    )


def evaluate_applicant(model, applicant):

    required = {
        "average",
        "income",
        "household",
        "children",
        "seniors",
        "pwds",
        "dependents",
        "solo",
        "exam_score",
        "exam_total",
        "exam_passed",
        "fourps",
        "spes",
        "scholars",
    }

    missing = required - set(applicant)

    if missing:
        raise ValueError(
            "Missing applicant values: "
            + ", ".join(sorted(missing))
        )

    average = float(applicant["average"])
    income = float(applicant["income"])

    household = int(applicant["household"])
    children = int(applicant["children"])
    seniors = int(applicant["seniors"])
    pwds = int(applicant["pwds"])
    dependents = int(applicant["dependents"])

    exam_score = int(applicant["exam_score"])
    exam_total = int(applicant["exam_total"])

    if not 0 <= average <= 100:
        raise ValueError(
            "Academic average must be between 0 and 100."
        )

    if income < 0:
        raise ValueError(
            "Monthly income cannot be negative."
        )

    if household < 1:
        raise ValueError(
            "Household size must be at least 1."
        )

    if min(children, seniors, pwds, dependents) < 0:
        raise ValueError(
            "Household counts cannot be negative."
        )

    if children + seniors + pwds > household:
        raise ValueError(
            "Children, seniors, and PWD counts cannot exceed "
            "household size."
        )

    if exam_total < 1 or not 0 <= exam_score <= exam_total:
        raise ValueError(
            "Exam score or total items is invalid."
        )

    for key in ("solo", "exam_passed", "fourps", "spes"):
        if applicant[key] not in (0, 1, False, True):
            raise ValueError(
                f"{key} must be a Boolean or 0/1."
            )

    scholars = int(applicant["scholars"])

    if scholars < 0:
        raise ValueError(
            "Scholars count cannot be negative."
        )

    exam_passed = int(
        exam_score >= EXAM_PASSING_RATE * exam_total
    )

    exam_percentage = (
        exam_score / exam_total * 100
    )

    threshold = mswd_threshold(
        household,
        children,
        seniors,
        pwds,
    )

    mswd_eligible = income <= threshold

    common = {
        "exam_percentage": exam_percentage,
        "exam_passed": bool(exam_passed),
        "mswd_threshold": threshold,
        "mswd_eligible": bool(mswd_eligible),
        "passing_rate": None,
        "requires_human_review": True,
    }

    # Step 1: eligibility rules. Failing applicants are not scored.
    reasons = eligibility_failures(
        average,
        exam_passed,
        bool(applicant["fourps"]),
        bool(applicant["spes"]),
        scholars,
    )

    if reasons:
        return {
            "predicted_class": NOT_ELIGIBLE,
            "eligible": False,
            "model_prediction": "NOT_ELIGIBLE",
            "model_probability_percent": None,
            "reasons": reasons,
            "base_rate_percent": None,
            "feature_contributions": [],
            "ai_reasons": [(
                "The applicant does not pass every eligibility rule, "
                "so the AI did not score this application. "
                "Staff confirm this before any official action."
            )],
            **common,
        }

    # Step 2: the model scores eligible applicants on need and merit.
    row = pd.DataFrame([{
        "AcademicAverage": average,
        "MonthlyIncome": income,
        "MSWDOPovertyEligible": int(mswd_eligible),
        "Household": household,
        "ChildrenCount": children,
        "SeniorCount": seniors,
        "PWDCount": pwds,
        "SoloParent": int(applicant["solo"]),
        "Dependent": dependents,
    }])[FEATURES]

    prediction = int(model.predict(row)[0])

    probabilities = dict(
        zip(
            model.classes_,
            model.predict_proba(row)[0],
        )
    )

    probability = float(
        probabilities.get(1, 0.0)
    ) * 100

    # Why the model leaned this way: per-feature contributions that add up
    # exactly to `probability` (see ml_explainer.py).
    model_explanation = explain_prediction(model, row, FEATURES)

    return {
        "predicted_class": (
            PROCEED_TO_INTERVIEW
            if prediction == 1
            else NEEDS_OFFICIAL_REVIEW
        ),
        "eligible": True,
        "model_prediction": (
            "QUALIFIED"
            if prediction == 1
            else "NOT_QUALIFIED"
        ),
        "model_probability_percent": probability,
        "reasons": [],
        "base_rate_percent": model_explanation["baseline_percent"],
        "feature_contributions": model_explanation["contributions"],
        "ai_reasons": model_explanation["summary"],
        **common,
    }
