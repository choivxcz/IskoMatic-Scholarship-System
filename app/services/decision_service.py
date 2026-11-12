"""Which official decisions can be recorded for an application.

Decisions are made after the interview. An Administrator can approve,
waitlist or reject an interviewed (or recommended) applicant, and later
approve or reject a waitlisted one. Approved and Rejected are final.

Older records may still read FOR_INTERVIEW even though their interview was
completed (interview results used not to update the application). Those are
treated as INTERVIEWED so they can be decided.
"""

from __future__ import annotations

from app.services.application_service import ApplicationService

DECISIONS = ("APPROVED", "WAITLISTED", "REJECTED")

# Choices after an interview, by the application's (effective) stage.
INTERVIEWED_CHOICES = {
    "INTERVIEWED": ["APPROVED", "WAITLISTED", "REJECTED"],
    "RECOMMENDED": ["APPROVED", "WAITLISTED", "REJECTED"],
    "WAITLISTED": ["APPROVED", "REJECTED"],
}


def effective_stage(status: str | None, interview_completed: bool) -> str:
    status = str(status or "").strip().upper()
    if status == "FOR_INTERVIEW" and interview_completed:
        return "INTERVIEWED"
    return status


def decision_choices(status: str | None, interview_completed: bool) -> list[str]:
    """Decisions an Administrator may record now (empty when none)."""
    stage = effective_stage(status, interview_completed)
    if interview_completed:
        return list(INTERVIEWED_CHOICES.get(stage, []))
    # Without an interview, only the existing review-stage outcomes apply
    # (e.g. Under Review -> Rejected or Waitlisted).
    allowed = ApplicationService.ALLOWED_TRANSITIONS.get(stage, set())
    return [decision for decision in DECISIONS if decision in allowed]
