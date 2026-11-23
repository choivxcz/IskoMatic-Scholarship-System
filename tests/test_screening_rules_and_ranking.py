"""Eligibility rules, model scoring and priority ranking.

These tests use the saved model file only. They do not connect to MySQL.
"""

import pytest

from backend.services.ml_screening_service import (
    MODEL_VERSION,
    NOT_ELIGIBLE,
    evaluate_applicant,
    load_saved_model,
)
from backend.services.screening_ranking_service import (
    CLOSED,
    NOT_SCREENED,
    RANKED,
    RESCREEN_NEEDED,
    rank_applications,
)
from backend.services.screening_ranking_service import NOT_ELIGIBLE as RANK_NOT_ELIGIBLE

ELIGIBLE_APPLICANT = {
    "average": 90,
    "income": 12000,
    "household": 5,
    "children": 2,
    "seniors": 1,
    "pwds": 0,
    "dependents": 2,
    "solo": 0,
    "exam_score": 45,
    "exam_total": 50,
    "exam_passed": 1,
    "fourps": 0,
    "spes": 0,
    "scholars": 0,
}


@pytest.fixture(scope="module")
def model():
    loaded, artifact = load_saved_model()
    assert artifact["model_version"] == MODEL_VERSION
    return loaded


@pytest.mark.parametrize(
    ("change", "expected_reason"),
    [
        ({"fourps": 1}, "Applicant is a 4Ps beneficiary."),
        ({"spes": 1}, "Applicant is an SPES beneficiary."),
        ({"scholars": 1}, "Family already has a scholar."),
        ({"average": 75}, "Academic average must be greater than 75."),
        ({"exam_score": 39}, "Exam score is below the required 80% passing rate."),
    ],
)
def test_failing_a_rule_skips_the_model(model, change, expected_reason):
    result = evaluate_applicant(model, {**ELIGIBLE_APPLICANT, **change})

    assert result["predicted_class"] == NOT_ELIGIBLE
    assert result["eligible"] is False
    assert result["model_probability_percent"] is None
    assert result["feature_contributions"] == []
    assert result["reasons"] == [expected_reason]
    assert result["requires_human_review"] is True


def test_eligible_applicant_is_scored_and_explained(model):
    result = evaluate_applicant(model, ELIGIBLE_APPLICANT)

    assert result["eligible"] is True
    assert result["reasons"] == []
    assert 0 <= result["model_probability_percent"] <= 100
    total = result["base_rate_percent"] + sum(
        item["impact_points"] for item in result["feature_contributions"]
    )
    assert total == pytest.approx(result["model_probability_percent"], abs=0.2)
    rule_features = {"4psBeneficiaries", "SPESBeneficiaries", "ScholarsInFamily", "ExamPassed"}
    assert not rule_features & {item["feature"] for item in result["feature_contributions"]}


def _application(application_id, program="BS Information Technology", year=2026, status="SUBMITTED", **extra):
    return {
        "application_id": application_id,
        "scholarship_program": program,
        "scholarship_year": year,
        "status": status,
        "academic_average": extra.get("average", 85),
        "monthly_income": extra.get("income", 15000),
    }


def _screening(probability, version=MODEL_VERSION, eligible=True, fingerprint="current"):
    return {
        "version_name": version,
        "confidence_score": probability,
        "eligible": eligible,
        "screening_input_fingerprint": fingerprint,
    }


def test_ranks_highest_chance_first_within_each_cohort():
    applications = [
        _application(1),
        _application(2),
        _application(3, program="  bs information   technology "),
        _application(4, program="BS Education"),
        _application(5, year=2025),
    ]
    latest = {1: _screening(0.61), 2: _screening(0.88), 3: _screening(0.74), 4: _screening(0.40), 5: _screening(0.95)}
    fingerprints = {key: "current" for key in latest}

    ranking = rank_applications(applications, latest, MODEL_VERSION, fingerprints)

    assert [ranking[i]["rank"] for i in (2, 3, 1)] == [1, 2, 3]
    assert ranking[1]["cohort_size"] == 3
    assert ranking[4]["rank"] == 1 and ranking[4]["cohort_size"] == 1
    assert ranking[5]["rank"] == 1 and ranking[5]["cohort_size"] == 1
    assert all(entry["state"] == RANKED for entry in ranking.values())


def test_ties_prefer_higher_average_then_lower_income():
    applications = [
        _application(1, average=88, income=20000),
        _application(2, average=92, income=30000),
        _application(3, average=88, income=9000),
    ]
    latest = {i: _screening(0.80) for i in (1, 2, 3)}

    ranking = rank_applications(applications, latest, MODEL_VERSION)

    assert [ranking[i]["rank"] for i in (2, 3, 1)] == [1, 2, 3]


def test_outdated_ineligible_closed_and_unscreened_are_not_ranked():
    applications = [
        _application(1),
        _application(2),
        _application(3),
        _application(4, status="WITHDRAWN"),
        _application(5),
        _application(6),
    ]
    latest = {
        1: _screening(0.70),
        2: _screening(0.90, version="rf-1.0.0"),
        3: _screening(0.90, fingerprint="old details"),
        4: _screening(0.99),
        6: _screening(None, eligible=False),
    }
    fingerprints = {i: "current" for i in range(1, 7)}

    ranking = rank_applications(applications, latest, MODEL_VERSION, fingerprints)

    assert ranking[1]["state"] == RANKED and ranking[1]["cohort_size"] == 1
    assert ranking[2]["state"] == RESCREEN_NEEDED
    assert ranking[3]["state"] == RESCREEN_NEEDED
    assert ranking[4]["state"] == CLOSED
    assert ranking[5]["state"] == NOT_SCREENED
    assert ranking[6]["state"] == RANK_NOT_ELIGIBLE
    assert all(ranking[i]["rank"] is None for i in (2, 3, 4, 5, 6))
