"""Which official decisions are allowed. Pure logic; no database."""

import pytest

from app.services.decision_service import decision_choices, effective_stage


@pytest.mark.parametrize("status", ["INTERVIEWED", "RECOMMENDED"])
def test_interviewed_applicants_can_get_any_decision(status):
    assert decision_choices(status, True) == ["APPROVED", "WAITLISTED", "REJECTED"]


def test_completed_interview_still_marked_for_interview_counts_as_interviewed():
    assert effective_stage("FOR_INTERVIEW", True) == "INTERVIEWED"
    assert decision_choices("FOR_INTERVIEW", True) == ["APPROVED", "WAITLISTED", "REJECTED"]


def test_waitlisted_can_be_approved_or_rejected():
    assert decision_choices("WAITLISTED", True) == ["APPROVED", "REJECTED"]


@pytest.mark.parametrize("status", ["APPROVED", "REJECTED", "WITHDRAWN"])
def test_final_statuses_allow_nothing(status):
    assert decision_choices(status, True) == []


@pytest.mark.parametrize("status", ["DRAFT", "SUBMITTED", "FOR_INTERVIEW"])
def test_no_decision_before_the_interview(status):
    assert decision_choices(status, False) == []
