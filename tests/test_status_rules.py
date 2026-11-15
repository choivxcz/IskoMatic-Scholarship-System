"""Review-stage rejection and reopening rules. Pure logic; no database."""

import pytest

from app.services.application_service import ApplicationService
from app.services.decision_service import decision_choices

T = ApplicationService.ALLOWED_TRANSITIONS


@pytest.mark.parametrize("status", ["DRAFT", "SUBMITTED", "UNDER_REVIEW"])
def test_applications_can_be_rejected_during_review(status):
    assert "REJECTED" in T[status]
    assert status in ApplicationService.REVIEW_STAGES


def test_rejected_application_cannot_go_to_interview():
    assert "FOR_INTERVIEW" not in T["REJECTED"]
    assert "INTERVIEWED" not in T["REJECTED"]


def test_rejected_application_can_only_be_reopened_to_under_review():
    assert T["REJECTED"] == {"UNDER_REVIEW"}
    # Once reopened, it can be endorsed for interview again.
    assert "FOR_INTERVIEW" in T["UNDER_REVIEW"]


@pytest.mark.parametrize("status", ["FOR_INTERVIEW", "INTERVIEWED", "RECOMMENDED", "WAITLISTED"])
def test_after_review_rejection_is_not_a_review_stage(status):
    # From these stages, rejection must be recorded as an official decision.
    assert status not in ApplicationService.REVIEW_STAGES


@pytest.mark.parametrize("status", ["DRAFT", "SUBMITTED"])
def test_review_rejection_is_not_offered_as_an_official_decision(status):
    assert decision_choices(status, False) == []
