"""Rank eligible applicants so staff can review them in priority order.

Scholarships have a limited number of slots, so instead of a yes/no cut-off
the office reviews applicants from the highest AI score down. Applicants are
ranked against others in the same scholarship program and year (a cohort).

Only applications whose latest screening is up to date are ranked:
  - screened by the current model version, and
  - screened with the application's current details.
Anything else is marked RESCREEN_NEEDED so an outdated score never sets a rank.

The rank is advisory. It does not change any official status.
"""

from __future__ import annotations

from typing import Any, Mapping

RANKED = "RANKED"
NOT_ELIGIBLE = "NOT_ELIGIBLE"
RESCREEN_NEEDED = "RESCREEN_NEEDED"
NOT_SCREENED = "NOT_SCREENED"
CLOSED = "CLOSED"

# Applications in these stages are not competing for a slot.
CLOSED_STATUSES = {"DRAFT", "REJECTED", "WITHDRAWN"}


def cohort_key(application: Mapping[str, Any]) -> tuple[str, str]:
    program = " ".join(str(application.get("scholarship_program") or "").split()).lower()
    year = str(application.get("scholarship_year") or "").strip()
    return program, year


def _number(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def rank_applications(
    applications: list[Mapping[str, Any]],
    latest_screenings: Mapping[int, Mapping[str, Any]],
    current_model_version: str,
    current_fingerprints: Mapping[int, str] | None = None,
) -> dict[int, dict[str, Any]]:
    """
    Return {application_id: ranking entry} for every application given.

    `latest_screenings` maps application_id to its latest saved screening,
    with at least `version_name` (model version), `confidence_score` (0-1 or
    None), `eligible` (bool or None) and `screening_input_fingerprint`.
    `current_fingerprints` maps application_id to the fingerprint of its
    current details; when given, results saved from older details are not ranked.
    """
    current_fingerprints = current_fingerprints or {}
    entries: dict[int, dict[str, Any]] = {}
    cohorts: dict[tuple[str, str], list[tuple[Mapping[str, Any], float]]] = {}

    for application in applications:
        application_id = int(application["application_id"])
        screening = latest_screenings.get(application_id)
        status = str(application.get("status") or "").upper()
        entry: dict[str, Any] = {
            "application_id": application_id,
            "scholarship_program": application.get("scholarship_program"),
            "scholarship_year": application.get("scholarship_year"),
            "rank": None,
            "cohort_size": None,
            "probability_percent": None,
        }
        entries[application_id] = entry

        if status in CLOSED_STATUSES:
            entry["state"] = CLOSED
            continue

        if not screening:
            entry["state"] = NOT_SCREENED
            continue

        saved_fingerprint = screening.get("screening_input_fingerprint")
        current_fingerprint = current_fingerprints.get(application_id)
        outdated = (
            screening.get("version_name") != current_model_version
            or (current_fingerprint is not None and saved_fingerprint != current_fingerprint)
        )
        if outdated:
            entry["state"] = RESCREEN_NEEDED
            continue

        if screening.get("eligible") is False or screening.get("confidence_score") is None:
            entry["state"] = NOT_ELIGIBLE
            continue

        probability = float(screening["confidence_score"]) * 100
        entry["probability_percent"] = round(probability, 2)
        cohorts.setdefault(cohort_key(application), []).append((application, probability))

    for members in cohorts.values():
        # Highest chance first. Ties: higher academic average, then lower
        # income (greater need), then the earlier application.
        members.sort(key=lambda item: (
            -item[1],
            -_number(item[0].get("academic_average"), 0),
            _number(item[0].get("monthly_income"), float("inf")),
            int(item[0]["application_id"]),
        ))
        for position, (application, _) in enumerate(members, start=1):
            entry = entries[int(application["application_id"])]
            entry["state"] = RANKED
            entry["rank"] = position
            entry["cohort_size"] = len(members)

    return entries
