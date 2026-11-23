"""Durable staff activity using the existing audit_logs table.

An entry is committed before a business operation starts. If recording its
outcome fails, the STARTED entry remains visible instead of inventing success.
Identity is supplied by the authenticated bridge, never by the request body.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from backend.database.connection import get_connection


_STATUS_FIELDS = {
    "previous_status", "new_status", "status", "result", "decision", "http_method",
}
_ALLOWED_STATUSES = {
    "DRAFT", "SUBMITTED", "UNDER_REVIEW", "FOR_INTERVIEW", "INTERVIEWED",
    "RECOMMENDED", "APPROVED", "REJECTED", "WAITLISTED", "WITHDRAWN",
    "SCHEDULED", "RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "ONGOING",
}
_ENUM_VALUES = {
    "previous_status": _ALLOWED_STATUSES,
    "new_status": _ALLOWED_STATUSES,
    "status": _ALLOWED_STATUSES,
    "result": {"PASSED", "FAILED", "FOR_FURTHER_REVIEW"},
    "decision": {"APPROVED", "REJECTED", "WAITLISTED"},
    "http_method": {"GET", "POST", "PUT", "DELETE", "OPTIONS"},
}
_ID_FIELDS = {
    "application_id", "applicant_id", "interview_id", "screening_id", "decision_id",
}
_SENSITIVE_FIELD_PARTS = {"password", "token", "secret", "credential", "authorization"}


def _positive_id(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"{label} must be a positive integer.")
    return value


def _label(value: Any, label: str, maximum: int = 100) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"{label} is required and must be at most {maximum} characters.")
    return value.strip()


def _actor_snapshot(actor: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(actor, dict):
        raise ValueError("Verified actor identity is required.")
    role = actor.get("role")
    if role not in {"ADMIN", "LYDO_OFFICIAL"}:
        raise ValueError("Unsupported staff role.")
    username = _label(actor.get("username"), "Actor username", 255)
    return {
        "user_id": _positive_id(actor.get("user_id"), "Actor user ID"),
        "username": username,
        "display_name": _label(actor.get("display_name") or username, "Actor display name", 255),
        "role": role,
    }


def _safe_details(details: dict[str, Any] | None) -> dict[str, Any]:
    """Keep operation metadata, not credentials, raw form data or contact data."""
    if details is None:
        return {}
    if not isinstance(details, dict):
        raise ValueError("Activity details must be an object.")
    safe: dict[str, Any] = {}
    for key in _STATUS_FIELDS:
        value = details.get(key)
        if isinstance(value, str) and value.strip() and len(value) <= 100:
            normalized = value.strip().upper()
            if normalized in _ENUM_VALUES[key]:
                safe[key] = normalized
    for key in _ID_FIELDS:
        value = details.get(key)
        if isinstance(value, int) and not isinstance(value, bool) and value > 0:
            safe[key] = value
    fields = details.get("fields")
    if isinstance(fields, (list, tuple)):
        safe["fields"] = sorted({
            field for field in fields
            if isinstance(field, str) and 0 < len(field) <= 100
            and field.replace("_", "").isalnum()
            and not any(part in field.lower() for part in _SENSITIVE_FIELD_PARTS)
        })[:100]
    return safe


def begin_activity(
    actor: dict[str, Any], action: str, entity_type: str,
    entity_id: int | None = None, details: dict[str, Any] | None = None,
) -> int:
    """Commit a STARTED entry before the caller performs a business mutation."""
    snapshot = _actor_snapshot(actor)
    action = _label(action, "Activity action")
    entity_type = _label(entity_type, "Activity entity type")
    if entity_id is not None:
        entity_id = _positive_id(entity_id, "Activity entity ID")
    payload = _safe_details(details)
    payload.update({"actor": snapshot, "outcome": "STARTED"})
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO audit_logs (action, entity_type, entity_id, details) "
            "VALUES (%s, %s, %s, %s)",
            (action, entity_type, entity_id, encoded),
        )
        audit_id = int(cursor.lastrowid)
        if audit_id < 1:
            raise RuntimeError("The activity entry could not be identified.")
        connection.commit()
        return audit_id
    except Exception:
        connection.rollback()
        raise
    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def finish_activity(
    audit_id: int, success: bool, entity_id: int | None = None, http_status: int = 200,
) -> None:
    """Finalize a STARTED entry without replacing its verified actor snapshot."""
    audit_id = _positive_id(audit_id, "Audit ID")
    if not isinstance(success, bool):
        raise ValueError("Activity success must be true or false.")
    if isinstance(http_status, bool) or not isinstance(http_status, int) or not 100 <= http_status <= 599:
        raise ValueError("Activity HTTP status is invalid.")
    if entity_id is not None:
        entity_id = _positive_id(entity_id, "Activity entity ID")
    outcome = "SUCCEEDED" if success else "FAILED"
    finished_at = datetime.now(timezone.utc).isoformat()
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE audit_logs "
            "SET details = JSON_SET(details, '$.outcome', %s, '$.http_status', %s, '$.finished_at', %s), "
            "entity_id = COALESCE(%s, entity_id) "
            "WHERE audit_id = %s AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.outcome')) = 'STARTED'",
            (outcome, http_status, finished_at, entity_id, audit_id),
        )
        if cursor.rowcount != 1:
            raise RuntimeError("The started activity entry was not found or is already finalized.")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def _decode(details: Any) -> dict[str, Any]:
    if isinstance(details, (str, bytes, bytearray)):
        try:
            details = json.loads(details)
        except (ValueError, UnicodeDecodeError):
            details = {}
    return details if isinstance(details, dict) else {}


def _fetch(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(sql, params)
        return cursor.fetchall()
    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def _attach_subjects(items: list[dict[str, Any]]) -> None:
    """Add the applicant name and reference each entry is about.

    Names are looked up at read time instead of being copied into the log,
    so the audit trail itself holds no personal contact data.
    """
    application_ids: set[int] = set()
    applicant_ids: set[int] = set()
    interview_ids: set[int] = set()
    for item in items:
        details = item["details"]
        entity_id = item.get("entity_id")
        if isinstance(details.get("application_id"), int):
            application_ids.add(details["application_id"])
        if isinstance(details.get("applicant_id"), int):
            applicant_ids.add(details["applicant_id"])
        if entity_id and item.get("entity_type") == "application":
            application_ids.add(int(entity_id))
        if entity_id and item.get("entity_type") == "applicant":
            applicant_ids.add(int(entity_id))
        if entity_id and item.get("entity_type") == "interview":
            interview_ids.add(int(entity_id))

    if interview_ids:
        marks = ",".join(["%s"] * len(interview_ids))
        interview_apps = {
            int(row["interview_id"]): int(row["application_id"])
            for row in _fetch(f"SELECT interview_id, application_id FROM interviews WHERE interview_id IN ({marks})", tuple(interview_ids))
        }
        application_ids.update(interview_apps.values())
    else:
        interview_apps = {}

    apps: dict[int, dict[str, Any]] = {}
    if application_ids:
        marks = ",".join(["%s"] * len(application_ids))
        for row in _fetch(
            "SELECT a.application_id, a.applicant_id, a.scholarship_program, "
            "CONCAT_WS(' ', p.first_name, p.middle_name, p.last_name, p.suffix) AS applicant_name "
            f"FROM applications a JOIN applicants p ON p.applicant_id = a.applicant_id WHERE a.application_id IN ({marks})",
            tuple(application_ids),
        ):
            apps[int(row["application_id"])] = row
    people: dict[int, str] = {}
    if applicant_ids:
        marks = ",".join(["%s"] * len(applicant_ids))
        for row in _fetch(
            "SELECT applicant_id, CONCAT_WS(' ', first_name, middle_name, last_name, suffix) AS applicant_name "
            f"FROM applicants WHERE applicant_id IN ({marks})",
            tuple(applicant_ids),
        ):
            people[int(row["applicant_id"])] = row["applicant_name"]

    for item in items:
        details = item["details"]
        entity_id = int(item["entity_id"]) if item.get("entity_id") else None
        application_id = details.get("application_id") if isinstance(details.get("application_id"), int) else None
        if application_id is None and item.get("entity_type") == "application":
            application_id = entity_id
        if application_id is None and item.get("entity_type") == "interview" and entity_id:
            application_id = interview_apps.get(entity_id)
        app = apps.get(application_id) if application_id else None
        applicant_id = details.get("applicant_id") if isinstance(details.get("applicant_id"), int) else None
        if applicant_id is None and item.get("entity_type") == "applicant":
            applicant_id = entity_id
        if app:
            item["application_id"] = application_id
            item["applicant_id"] = int(app["applicant_id"])
            item["applicant_name"] = app["applicant_name"]
            item["scholarship_program"] = app["scholarship_program"]
        elif applicant_id and applicant_id in people:
            item["applicant_id"] = applicant_id
            item["applicant_name"] = people[applicant_id]


def list_activity(limit: int = 500) -> list[dict[str, Any]]:
    """Return latest real audit records; legacy missing identities stay missing."""
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 1000:
        raise ValueError("Activity limit must be an integer between 1 and 1000.")
    items = []
    for row in _fetch(
        "SELECT audit_id, action, entity_type, entity_id, details, created_at "
        "FROM audit_logs ORDER BY created_at DESC, audit_id DESC LIMIT %s",
        (limit,),
    ):
        item = dict(row)
        item["details"] = _decode(item.get("details"))
        items.append(item)
    _attach_subjects(items)
    return items


# Which logged actions answer "who did this step for the applicant?"
_ATTRIBUTION_ACTIONS = {
    "ENDORSE_FOR_INTERVIEW": "endorsed",
    "SCHEDULE_INTERVIEW": "scheduled",
    "RECORD_INTERVIEW_RESULT": "result",
    "RECORD_DECISION": "decision",
    "RUN_SCREENING": "screened",
}


def attributions() -> dict[str, dict[int, dict[str, Any]]]:
    """Latest successful staff action per step, keyed by application and interview.

    Returns {"applications": {application_id: {step: actor}}, "interviews": {interview_id: {step: actor}},
    "entities": {"<entity_type>:<id>": actor}}
    where actor is {"name", "username", "role", "at"}.
    """
    marks = ",".join(["%s"] * len(_ATTRIBUTION_ACTIONS))
    rows = _fetch(
        "SELECT action, entity_type, entity_id, details, created_at FROM audit_logs "
        f"WHERE action IN ({marks}) ORDER BY created_at ASC, audit_id ASC",
        tuple(_ATTRIBUTION_ACTIONS),
    )
    by_application: dict[int, dict[str, Any]] = {}
    by_interview: dict[int, dict[str, Any]] = {}
    by_entity: dict[str, dict[str, Any]] = {}
    for row in rows:
        details = _decode(row["details"])
        if details.get("outcome") != "SUCCEEDED":
            continue
        actor = details.get("actor") if isinstance(details.get("actor"), dict) else {}
        stamp = {
            "name": actor.get("display_name") or actor.get("username"),
            "username": actor.get("username"),
            "role": actor.get("role"),
            "at": row["created_at"],
        }
        step = _ATTRIBUTION_ACTIONS[row["action"]]
        application_id = details.get("application_id")
        if isinstance(application_id, int):
            by_application.setdefault(application_id, {})[step] = stamp
        interview_id = details.get("interview_id")
        if not isinstance(interview_id, int) and row["entity_type"] == "interview" and row["entity_id"]:
            interview_id = int(row["entity_id"])
        if isinstance(interview_id, int):
            by_interview.setdefault(interview_id, {})[step] = stamp
        if row["entity_id"]:
            by_entity[f"{row['entity_type']}:{int(row['entity_id'])}"] = stamp
    return {"applications": by_application, "interviews": by_interview, "entities": by_entity}


def application_trail(application_id: int, interview_ids: list[int] | None = None) -> list[dict[str, Any]]:
    """Successful staff actions on one application, oldest first, for its References tab.

    Matches entries recorded against the application itself, entries whose details name it,
    and entries on its interviews. Returns [{"action", "name", "role", "at"}].
    """
    application_id = _positive_id(application_id, "Application ID")
    interview_ids = [_positive_id(i, "Interview ID") for i in (interview_ids or [])]
    conditions = [
        "(entity_type = 'application' AND entity_id = %s)",
        "JSON_UNQUOTE(JSON_EXTRACT(details, '$.application_id')) = %s",
    ]
    params: list[Any] = [application_id, str(application_id)]
    if interview_ids:
        conditions.append(f"(entity_type = 'interview' AND entity_id IN ({','.join(['%s'] * len(interview_ids))}))")
        params.extend(interview_ids)
    rows = _fetch(
        "SELECT action, details, created_at FROM audit_logs "
        f"WHERE {' OR '.join(conditions)} ORDER BY created_at ASC, audit_id ASC",
        tuple(params),
    )
    trail = []
    for row in rows:
        details = _decode(row["details"])
        if details.get("outcome") != "SUCCEEDED":
            continue
        actor = details.get("actor") if isinstance(details.get("actor"), dict) else {}
        trail.append({
            "action": row["action"],
            "name": actor.get("display_name") or actor.get("username"),
            "role": actor.get("role"),
            "at": row["created_at"],
        })
    return trail
