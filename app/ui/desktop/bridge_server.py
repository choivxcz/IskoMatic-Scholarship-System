
"""Loopback-only API bridge for the Iskolar ng Bayan desktop UI.

This file lives inside app/ui/desktop and deliberately reuses the existing
repositories and services. It does not create tables or modify backend files.
"""
from __future__ import annotations

import json
import os
import sys
from decimal import Decimal
from datetime import date, datetime, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[3]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.chdir(PROJECT_ROOT)

from app.repositories.applicant_repository import ApplicantRepository
from app.repositories.application_repository import ApplicationRepository
from app.repositories.interview_repository import InterviewRepository
from app.repositories.scholarship_decision_repository import (
    ScholarshipDecisionRepository,
)
from app.repositories.screening_result_repository import ScreeningResultRepository
from app.services.application_service import ApplicationService
from app.services.screening_persistence_service import ScreeningPersistenceService
from app.services.ml_screening_service import evaluate_applicant
from database.connection import get_connection
from app.ui.desktop import activity_store, auth_store


HOST, PORT = "127.0.0.1", 8765

# Bump when the UI depends on new bridge behaviour, so an old bridge left
# running is detected instead of silently returning incomplete data.
# 2 = staff sign-in + per-action activity logging and attribution.
API_VERSION = 2

ALLOWED_ORIGINS = {
    "http://127.0.0.1:1420",
    "http://localhost:1420",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
    "http://localhost",
    "http://127.0.0.1",
}

_screening_service = None


def clean(value):
    """Recursively convert database values into JSON-compatible values."""
    if isinstance(value, dict):
        return {str(key): clean(item) for key, item in value.items()}

    if isinstance(value, (list, tuple)):
        return [clean(item) for item in value]

    if isinstance(value, Decimal):
        # MySQL DECIMAL values are returned by Python as Decimal.
        # Convert them to numbers so the frontend can use them.
        return float(value)

    if isinstance(value, (datetime, date, time)):
        return value.isoformat()

    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")

    if isinstance(value, (str, int, float, bool)) or value is None:
        return value

    # Avoid crashing the entire API response if a repository returns an
    # uncommon database-specific value.
    if hasattr(value, "item"):
        try:
            return clean(value.item())
        except (ValueError, TypeError):
            pass

    raise TypeError(
        f"Object of type {type(value).__name__} is not JSON serializable"
    )


def read_screening_service():
    global _screening_service

    if _screening_service is None:
        _screening_service = ScreeningPersistenceService()

    return _screening_service


def ai_explanation(application_id):
    """Live, read-only AI analysis of an application plus its latest saved screening.

    Nothing is saved: this explains what the model thinks of the application's
    current data. "Run screening" is still the action that records a result.
    """
    application = ApplicationRepository.get_by_id(application_id)
    if not application:
        return 404, {"error": "Application not found."}

    service = read_screening_service()
    inputs = application_screening_inputs(application)
    try:
        result = evaluate_applicant(service.model, inputs)
    except ValueError as exc:
        return 200, {"available": False, "error": f"The AI cannot analyse this application yet: {exc}"}

    connection = get_connection()
    try:
        with connection.cursor(dictionary=True) as cursor:
            cursor.execute(
                "SELECT screening_id, predicted_class, confidence_score, explanation, screened_at "
                "FROM screening_results WHERE application_id = %s "
                "ORDER BY screened_at DESC, screening_id DESC LIMIT 1",
                (application_id,),
            )
            latest = cursor.fetchone()
    finally:
        connection.close()

    saved = None
    if latest:
        try:
            details = json.loads(latest["explanation"] or "{}")
        except (TypeError, ValueError):
            details = {}
        saved = {
            "screening_id": latest["screening_id"],
            "screened_at": latest["screened_at"],
            "recommendation": latest["predicted_class"],
            "probability_percent": round(float(latest["confidence_score"] or 0) * 100, 2),
            "fingerprint": details.get("screening_input_fingerprint"),
        }

    fingerprint = service.create_input_fingerprint(inputs)
    return 200, {
        "available": True,
        "application_id": application_id,
        "model_version": service.artifact.get("model_version"),
        "model_metrics": service.artifact.get("metrics"),
        "probability_percent": round(result["model_probability_percent"], 2),
        "model_prediction": result["model_prediction"],
        "recommendation": result["predicted_class"],
        "baseline_percent": result["base_rate_percent"],
        "contributions": result["feature_contributions"],
        "ai_reasons": result["ai_reasons"],
        "rule_flags": result["reasons"],
        "exam_percentage": round(result["exam_percentage"], 1),
        "mswd_threshold": result["mswd_threshold"],
        "saved": saved,
        "inputs_changed_since_saved": bool(saved and saved["fingerprint"] and saved["fingerprint"] != fingerprint),
    }


def enrich_applications(applications):
    applicants = {
        int(applicant["applicant_id"]): applicant
        for applicant in ApplicantRepository.get_all()
    }

    enriched = []

    for application in applications:
        item = dict(application)
        applicant = applicants.get(int(item.get("applicant_id") or 0), {})

        item["applicant_name"] = " ".join(
            str(applicant.get(key) or "").strip()
            for key in ("first_name", "middle_name", "last_name", "suffix")
            if str(applicant.get(key) or "").strip()
        ) or "Unknown applicant"
        item["barangay"] = applicant.get("barangay")
        item["municipality"] = applicant.get("municipality")

        enriched.append(item)

    return enriched


def dashboard_data():
    applicants = ApplicantRepository.get_all()
    applications = enrich_applications(ApplicationRepository.get_all())
    interviews = InterviewRepository.get_all()
    decisions = ScholarshipDecisionRepository.get_all()
    application_lookup = {int(item["application_id"]): item for item in applications}
    activity = []
    for application in applications:
        stamp = application.get("submitted_at") or application.get("created_at")
        if stamp:
            activity.append({
                "type": "application", "id": application["application_id"], "at": stamp,
                "title": "New application submitted" if application.get("submitted_at") else "Application created",
                "detail": " · ".join(str(value) for value in (application.get("applicant_name"), application.get("scholarship_program")) if value),
            })
    for interview in interviews:
        completed = interview.get("status") == "COMPLETED"
        stamp = interview.get("updated_at") if completed else interview.get("created_at")
        if stamp:
            activity.append({
                "type": "interview", "id": interview["interview_id"], "at": stamp,
                "title": "Interview result recorded" if completed else "Interview scheduled",
                "detail": " · ".join(str(value) for value in (interview.get("applicant_name"), interview.get("result") if completed else interview.get("location")) if value),
            })
    for decision in decisions:
        if decision.get("decided_at"):
            application = application_lookup.get(int(decision.get("application_id") or 0), {})
            activity.append({
                "type": "decision", "id": decision["decision_id"], "at": decision["decided_at"],
                "title": "Official decision recorded",
                "detail": " · ".join(str(value) for value in (application.get("applicant_name"), decision.get("decision")) if value),
            })

    counts = {}

    for application in applications:
        status = str(application.get("status") or "UNKNOWN").upper()
        counts[status] = counts.get(status, 0) + 1

    latest = sorted(
        applications,
        key=lambda application: str(application.get("created_at") or ""),
        reverse=True,
    )[:6]

    trend = {}
    for application in applications:
        created = application.get("created_at")
        if created:
            month = str(created)[:7]
            trend[month] = trend.get(month, 0) + 1

    return {
        "recentActivity": sorted(activity, key=lambda event: str(event["at"]), reverse=True)[:6],
        "applicationTrend": dict(sorted(trend.items())[-12:]),
        "stats": {
            "applicants": len(applicants),
            "applications": len(applications),
            "awaitingDecision": sum(
                1 for interview in interviews
                if interview.get("status") == "COMPLETED"
                and interview.get("application_status") in {"FOR_INTERVIEW", "INTERVIEWED"}
            ),
            "pending": sum(
                1
                for application in applications
                if str(application.get("status") or "").upper()
                in {
                    "PENDING",
                    "SUBMITTED",
                    "DRAFT",
                    "FOR_REVIEW",
                    "UNDER_REVIEW",
                }
            ),
            "interviews": sum(
                1
                for interview in interviews
                if str(interview.get("status") or "").upper()
                in {"SCHEDULED", "RESCHEDULED"}
            ),
            "approved": sum(
                1
                for decision in decisions
                if str(decision.get("decision") or "").upper() == "APPROVED"
            ),
        },
        "statusCounts": counts,
        "recentApplications": latest,
        "upcomingInterviews": InterviewRepository.get_upcoming(limit=5),
    }


def application_screening_inputs(app):
    """
    Convert a saved applications-table row into the input expected by
    ml_screening_service.py.

    Use upstream raw exam inputs and dependent counts when available.
    Older records can fall back to a percentage-based exam representation.
    """
    percentage = float(app.get("exam_score") or 0)
    percentage = max(0.0, min(100.0, percentage))

    household = int(app.get("household") or 1)

    return {
        "average": float(app.get("academic_average") or 0),
        "income": float(app.get("monthly_income") or 0),
        "household": household,
        "children": int(app.get("children_count") or 0),
        "seniors": int(app.get("senior_count") or 0),
        "pwds": int(app.get("pwd_count") or 0),

        "dependents": int(app.get("dependents_count") or 0),
        "solo": int(bool(app.get("solo_parent", 0))),

        "exam_score": int(app["exam_raw_score"]) if app.get("exam_raw_score") is not None else round(percentage),
        "exam_total": int(app["exam_total_items"]) if app.get("exam_total_items") else 100,
        "exam_passed": int(percentage >= 80),

        "fourps": int(bool(app.get("four_ps_beneficiary", 0))),
        "spes": int(bool(app.get("spes_beneficiary", 0))),
        "scholars": int(app.get("scholars_in_family") or 0),
    }




class Handler(BaseHTTPRequestHandler):
    server_version = "IskolarLocalBridge/2.1"

    def log_message(self, fmt, *args):
        # Keep personal applicant details out of the console log.
        print(f"[bridge] {self.address_string()} - {fmt % args}")

    def _send(self, status, payload):
        """Send a JSON response after normalizing database values."""
        try:
            body = json.dumps(
                clean(payload),
                ensure_ascii=False,
                allow_nan=False,
            ).encode("utf-8")
        except (TypeError, ValueError) as exc:
            # Log serialization failures so they can be diagnosed.
            print(f"[bridge] JSON serialization failed: {exc}")
            status = 500
            body = json.dumps(
                {"error": "The server could not serialize its response."}
            ).encode("utf-8")

        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))

            origin = self.headers.get("Origin", "")

            if origin and origin not in ALLOWED_ORIGINS:
                print(f"[bridge] Browser origin is not allowed: {origin!r}", flush=True)
            if origin in ALLOWED_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")

            self.send_header(
                "Access-Control-Allow-Methods",
                "GET, POST, PUT, DELETE, OPTIONS",
            )
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.end_headers()

            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            # Navigation, refresh, or AbortController can close the frontend
            # connection during either the headers or the response body.
            # Do not attempt a second response on that disconnected socket.
            self.close_connection = True

    def _body(self):
        if hasattr(self, "_parsed_body"):
            return self._parsed_body
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid Content-Length header.")

        if length < 0:
            raise ValueError("Invalid Content-Length header.")

        if length > 100_000:
            raise OverflowError("Request too large.")

        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        value = json.loads(raw or "{}")

        if not isinstance(value, dict):
            raise ValueError("Request body must be a JSON object.")

        return value

    def _untrusted(self, method):
        """Reason to refuse a request from a web page that is not this app, else None.

        - Host must be the loopback address (blocks DNS-rebinding pages).
        - Writes from a browser must come from an allowed Origin.
        - POST/PUT bodies must be declared application/json, which forces the
          browser's CORS preflight, so other sites cannot send "simple" form
          posts (for example to register the first Administrator account).
        """
        host = (self.headers.get("Host") or "").strip().lower()
        if host not in {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}:
            return "Unexpected Host header."
        if method == "GET":
            return None
        origin = self.headers.get("Origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return "This origin is not allowed to change data."
        if method in {"POST", "PUT"}:
            content_type = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if content_type != "application/json":
                return "Requests must be sent as application/json."
        return None

    def _token(self):
        header = self.headers.get("Authorization", "")
        return header[7:].strip() if header.lower().startswith("bearer ") else None

    def _require_user(self):
        """Return the signed-in staff user, or send 401 and return None."""
        user = auth_store.user_for_token(self._token())
        if user is None:
            self._send(401, {"error": "Your session has ended. Please sign in again.", "auth": "required"})
        return user

    def _record(self, user, action, entity_id=None):
        """Best-effort audit entry for account events; never blocks sign-in."""
        try:
            audit_id = activity_store.begin_activity(user, action, "staff_account", entity_id)
            activity_store.finish_activity(audit_id, True, entity_id)
        except Exception as exc:
            print(f"[bridge] could not record {action}: {exc}")

    def _tracked(self, user, action, entity_type, entity_id, details, operation):
        """Run a data change under an audit entry that names the signed-in staff member.

        The STARTED entry is committed first, so an unloggable change is refused.
        `operation` returns (http_status, payload, final_entity_id).
        """
        audit_id = activity_store.begin_activity(user, action, entity_type, entity_id, details)
        try:
            status, payload, final_id = operation()
        except Exception as exc:
            if isinstance(exc, auth_store.AuthError):
                failed = exc.status
            elif isinstance(exc, (ValueError, TypeError)):
                failed = 400
            else:
                failed = 500
            self._finish(audit_id, False, None, failed)
            raise
        final_id = final_id if isinstance(final_id, int) and final_id > 0 else None
        self._finish(audit_id, 200 <= status < 300, final_id, status)
        return self._send(status, payload)

    @staticmethod
    def _finish(audit_id, ok, entity_id, status):
        try:
            activity_store.finish_activity(audit_id, ok, entity_id, status)
        except Exception as exc:
            print(f"[bridge] could not finalize activity {audit_id}: {exc}")

    def _auth_post(self, path, data):
        if path == "/api/auth/login":
            token, user, expires = auth_store.login(
                data.get("username"), data.get("password"), bool(data.get("remember"))
            )
            self._record(user, "SIGN_IN", user["user_id"])
            return self._send(200, {"token": token, "user": user, "expires_at": expires})

        if path == "/api/auth/register":
            result = auth_store.register(data)
            return self._send(201, {"ok": True, **result})

        user = self._require_user()
        if user is None:
            return None

        if path == "/api/auth/logout":
            auth_store.logout(self._token())
            self._record(user, "SIGN_OUT", user["user_id"])
            return self._send(200, {"ok": True})

        parts = path.split("/")
        # /api/auth/accounts/<id>/<approve|reject|disable>
        if len(parts) == 6 and parts[3] == "accounts":
            updated = auth_store.review(user, int(parts[4]), parts[5], data.get("role"))
            self._record(user, f"ACCOUNT_{parts[5].upper()}", updated["user_id"])
            return self._send(200, {"ok": True, "account": updated})

        return self._send(404, {"error": "Endpoint not found"})

    def _error(self, exc):
        if isinstance(exc, auth_store.AuthError):
            return self._send(exc.status, {"error": str(exc)})

        if isinstance(exc, OverflowError):
            return self._send(413, {"error": str(exc)})

        if isinstance(exc, (ValueError, TypeError, json.JSONDecodeError)):
            return self._send(400, {"error": str(exc)})

        print(f"[bridge] request failed: {type(exc).__name__}: {exc}")
        return self._send(500, {"error": str(exc)})

    def do_OPTIONS(self):
        return self._send(200, {"ok": True})

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        refused = self._untrusted("GET")
        if refused:
            return self._send(403, {"error": refused})

        try:
            if path == "/api/health":
                return self._send(
                    200,
                    {"ok": True, "service": "Iskolar local bridge", "api_version": API_VERSION},
                )

            if path == "/api/auth/options":
                return self._send(200, {"departments": auth_store.DEPARTMENTS})

            if path == "/api/auth/username-available":
                username = (parse_qs(urlparse(self.path).query).get("username") or [""])[0]
                return self._send(200, {"available": auth_store.username_available(username)})

            user = self._require_user()
            if user is None:
                return None

            if path == "/api/auth/me":
                return self._send(200, {"user": user})

            if path == "/api/auth/accounts":
                if user["role"] != "ADMIN":
                    return self._send(403, {"error": "Only administrators can view staff accounts."})
                return self._send(200, {"items": auth_store.list_accounts()})

            if path == "/api/activity":
                return self._send(200, {"items": activity_store.list_activity()})

            if path == "/api/dashboard":
                return self._send(200, dashboard_data())

            if path == "/api/applicants":
                return self._send(
                    200,
                    {"items": ApplicantRepository.get_all()},
                )

            if path == "/api/applications":
                return self._send(
                    200,
                    {
                        "items": enrich_applications(
                            ApplicationRepository.get_all()
                        )
                    },
                )

            if path == "/api/interviews":
                items = InterviewRepository.get_all()
                awaiting = InterviewRepository.get_awaiting_schedule()
                credit = activity_store.attributions()
                for row in items + awaiting:
                    steps = credit["applications"].get(int(row["application_id"]), {})
                    row["endorsed_by"] = steps.get("endorsed")
                    row["scheduled_by"] = steps.get("scheduled")
                    row["decision_by"] = steps.get("decision")
                for row in items:
                    steps = credit["interviews"].get(int(row["interview_id"]), {})
                    row["scheduled_by"] = steps.get("scheduled") or row["scheduled_by"]
                    row["result_by"] = steps.get("result")
                return self._send(200, {"items": items, "awaitingSchedule": awaiting})

            if path == "/api/decisions":
                items = ScholarshipDecisionRepository.get_all()
                credit = activity_store.attributions()["entities"]
                for row in items:
                    maker = credit.get(f"decision:{int(row['decision_id'])}")
                    row["decided_by"] = maker["name"] if maker else None
                    row["decided_by_role"] = maker["role"] if maker else None
                return self._send(200, {"items": items})

            if path == "/api/screening-results":
                connection = get_connection()

                try:
                    with connection.cursor(dictionary=True) as cursor:
                        cursor.execute(
                            """
                            SELECT sr.screening_id,
                                   sr.application_id,
                                   sr.predicted_class,
                                   sr.confidence_score,
                                   sr.explanation,
                                   sr.screened_at,
                                   a.scholarship_program,
                                   a.scholarship_year,
                                   CONCAT_WS(
                                       ' ',
                                       p.first_name,
                                       p.middle_name,
                                       p.last_name,
                                       p.suffix
                                   ) AS applicant_name
                            FROM screening_results sr
                            JOIN applications a
                                ON a.application_id = sr.application_id
                            JOIN applicants p
                                ON p.applicant_id = a.applicant_id
                            WHERE a.is_archived = FALSE
                              AND p.is_archived = FALSE
                            ORDER BY sr.screened_at DESC, sr.screening_id DESC
                            """
                        )

                        return self._send(
                            200,
                            {"items": cursor.fetchall()},
                        )
                finally:
                    connection.close()

            if path.startswith("/api/applicants/"):
                applicant_id = int(path.rsplit("/", 1)[1])
                item = ApplicantRepository.get_by_id(applicant_id)

                if item:
                    return self._send(200, {"item": item})

                return self._send(404, {"error": "Applicant not found."})

            if path.startswith("/api/applications/") and path.endswith("/ai-explanation"):
                status, payload = ai_explanation(int(path.split("/")[-2]))
                return self._send(status, payload)

            if path.startswith("/api/applications/"):
                application_id = int(path.rsplit("/", 1)[1])
                item = ApplicationRepository.get_by_id(application_id)

                if item:
                    return self._send(200, {"item": item})

                return self._send(404, {"error": "Application not found."})

            return self._send(404, {"error": "Endpoint not found"})

        except Exception as exc:
            return self._error(exc)

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        refused = self._untrusted("POST")
        if refused:
            return self._send(403, {"error": refused})

        try:
            data = self._body()

            if path.startswith("/api/auth/"):
                return self._auth_post(path, data)

            user = self._require_user()
            if user is None:
                return None

            if path == "/api/register":
                applicant = data.get("applicant") or {}
                application = dict(data.get("application") or {})
                # Public/local registration cannot create an official award.
                if str(application.get("status") or "DRAFT").upper() != "DRAFT":
                    return self._send(403, {"error": "New applications must begin as draft. Official decisions require verified authorization."})
                application["status"] = "DRAFT"

                def register():
                    applicant_id, application_id = (
                        ApplicationService.register_applicant_with_application(
                            applicant,
                            application,
                        )
                    )
                    return 201, {
                        "ok": True,
                        "applicant_id": applicant_id,
                        "application_id": application_id,
                    }, application_id

                return self._tracked(
                    user, "REGISTER_APPLICATION", "application", None,
                    {"new_status": "DRAFT"}, register,
                )

            if path == "/api/screening":
                application_id = int(data.get("application_id", 0))
                application = ApplicationRepository.get_by_id(application_id)

                if not application:
                    return self._send(
                        404,
                        {"error": "Application not found."},
                    )

                def screen():
                    result = read_screening_service().screen_application(
                        application_id,
                        application_screening_inputs(application),
                        screened_by=None,
                    )
                    screening_id = result.get("screening_id") if isinstance(result, dict) else None
                    return 201, {"ok": True, "result": result}, screening_id

                return self._tracked(
                    user, "RUN_SCREENING", "screening", None,
                    {"application_id": application_id, "status": application.get("status")}, screen,
                )

            if path == "/api/decisions":
                # Official decisions: Administrators only, remarks required,
                # and only along the allowed status transitions.
                if user["role"] != "ADMIN":
                    return self._send(403, {"error": "Only Administrators can record official scholarship decisions."})
                application_id = int(data.get("application_id", 0))
                decision = str(data.get("decision", "")).strip().upper()
                reason = str(data.get("reason", "")).strip()
                if decision not in ScholarshipDecisionRepository.ALLOWED_DECISIONS:
                    return self._send(400, {"error": "Choose Approved, Rejected or Waitlisted."})
                if len(reason) < 10:
                    return self._send(400, {"error": "Decision remarks are required (at least 10 characters)."})
                application = ApplicationRepository.get_by_id(application_id)
                if not application:
                    return self._send(404, {"error": "Application not found."})
                current = str(application.get("status") or "").upper()
                if decision not in ApplicationService.ALLOWED_TRANSITIONS.get(current, set()):
                    def pretty(value):
                        return value.replace("_", " ").title()
                    return self._send(400, {"error": (
                        f"An application that is {pretty(current)} cannot be marked {pretty(decision)}. "
                        "Decisions follow the review stages (for example Interviewed, then Recommended, then Approved)."
                    )})

                def record():
                    decision_id = ScholarshipDecisionRepository.save(application_id, decision, reason, datetime.now())
                    return 201, {"ok": True, "decision_id": decision_id}, decision_id

                return self._tracked(
                    user, "RECORD_DECISION", "decision", None,
                    {"application_id": application_id, "decision": decision,
                     "previous_status": current, "new_status": decision},
                    record,
                )

            if path == "/api/interviews":
                application_id = int(data.get("application_id", 0))
                application = ApplicationRepository.get_by_id(application_id)

                if not application:
                    return self._send(
                        404,
                        {"error": "Application not found."},
                    )

                if application.get("status") != "FOR_INTERVIEW":
                    return self._send(
                        400,
                        {
                            "error": (
                                "Only applications marked FOR_INTERVIEW "
                                "can be scheduled."
                            )
                        },
                    )

                scheduled_at = str(data.get("scheduled_at", "")).strip()

                if not scheduled_at:
                    return self._send(
                        400,
                        {"error": "Interview date and time are required."},
                    )

                def schedule():
                    new_id = InterviewRepository.create(
                        application_id,
                        scheduled_at,
                        data.get("location"),
                        data.get("remarks"),
                    )
                    return 201, {"ok": True, "interview_id": new_id}, new_id

                return self._tracked(
                    user, "SCHEDULE_INTERVIEW", "interview", None,
                    {"application_id": application_id, "status": "SCHEDULED"}, schedule,
                )

            if path.startswith("/api/interviews/") and path.endswith("/result"):
                interview_id = int(path.split("/")[-2])
                result = str(data.get("result", "")).upper()
                remarks = str(data.get("remarks", "")).strip()

                interview = InterviewRepository.get_by_id(interview_id)
                if not interview:
                    return self._send(404, {"error": "Interview not found."})

                def save_result():
                    if InterviewRepository.update_result(interview_id, result, remarks):
                        return 200, {"ok": True}, interview_id
                    return 404, {"error": "Interview not found."}, interview_id

                return self._tracked(
                    user, "RECORD_INTERVIEW_RESULT", "interview", interview_id,
                    {"interview_id": interview_id, "application_id": int(interview["application_id"]), "result": result},
                    save_result,
                )

            return self._send(404, {"error": "Endpoint not found"})

        except Exception as exc:
            return self._error(exc)

    def do_PUT(self):
        path = urlparse(self.path).path.rstrip("/")
        refused = self._untrusted("PUT")
        if refused:
            return self._send(403, {"error": refused})

        try:
            user = self._require_user()
            if user is None:
                return None

            data = self._body()

            if path.startswith("/api/applicants/"):
                applicant_id = int(path.rsplit("/", 1)[1])
                allowed = ApplicantRepository.ALLOWED_UPDATE_FIELDS

                fields = {
                    key: value
                    for key, value in data.items()
                    if key in allowed
                }

                def update_applicant():
                    if ApplicantRepository.update(applicant_id, **fields):
                        return 200, {"ok": True}, applicant_id
                    return 404, {"error": "Applicant not found or no fields changed."}, applicant_id

                return self._tracked(
                    user, "UPDATE_APPLICANT", "applicant", applicant_id,
                    {"applicant_id": applicant_id, "fields": list(fields)}, update_applicant,
                )

            if path.startswith("/api/applications/"):
                application_id = int(path.rsplit("/", 1)[1])
                allowed = (
                    ApplicationRepository.ALLOWED_UPDATE_FIELDS - {"status"}
                )

                fields = {
                    key: value
                    for key, value in data.items()
                    if key in allowed
                }

                previous_status = None
                requested_status = None

                # Validate the requested transition before applying edits.
                if "status" in data:
                    current_app = ApplicationRepository.get_by_id(
                        application_id
                    )

                    if current_app is None:
                        return self._send(
                            404,
                            {"error": "Application not found."},
                        )

                    requested_status = str(data["status"]).strip().upper()
                    if requested_status in {"APPROVED", "REJECTED", "WAITLISTED"}:
                        return self._send(403, {"error": "Use Record decision to save an official decision with required remarks and accountable history."})
                    current_status = str(
                        current_app.get("status") or ""
                    ).upper()
                    previous_status = current_status

                    allowed_transitions = (
                        ApplicationService.ALLOWED_TRANSITIONS.get(
                            current_status,
                            set(),
                        )
                    )

                    if (
                        requested_status != current_status
                        and requested_status not in allowed_transitions
                    ):
                        raise ValueError(
                            f"Cannot change application status from "
                            f"{current_status} to {requested_status}."
                        )

                # Recalculate poverty eligibility if related fields change.
                if any(
                    key in fields
                    for key in (
                        "monthly_income",
                        "household",
                        "children_count",
                        "senior_count",
                        "pwd_count",
                    )
                ):
                    current = ApplicationRepository.get_by_id(application_id)

                    if current is None:
                        return self._send(
                            404,
                            {"error": "Application not found."},
                        )

                    combined = {
                        key: current.get(key)
                        for key in (
                            "household",
                            "children_count",
                            "senior_count",
                            "pwd_count",
                            "monthly_income",
                        )
                    }

                    combined.update(
                        {
                            key: value
                            for key, value in fields.items()
                            if key in combined
                        }
                    )

                    threshold = ApplicationService.mswdo_threshold(
                        int(combined["household"]),
                        int(combined["children_count"] or 0),
                        int(combined["senior_count"] or 0),
                        int(combined["pwd_count"] or 0),
                    )

                    fields["mswdo_poverty_eligible"] = (
                        float(combined["monthly_income"]) <= threshold
                    )

                # Upstream persists the count and its derived boolean together.
                if "dependents_count" in fields:
                    fields["dependent"] = (
                        int(fields["dependents_count"]) > 0
                    )

                def update_application():
                    updated = (
                        ApplicationRepository.update(
                            application_id,
                            **fields,
                        )
                        if fields
                        else False
                    )

                    if "status" in data:
                        status_updated = ApplicationService.change_status(
                            application_id,
                            data["status"],
                        )
                        updated = bool(updated or status_updated)

                    if updated:
                        return 200, {"ok": True}, application_id
                    return 404, {"error": "Application not found or no fields changed."}, application_id

                if requested_status == "FOR_INTERVIEW" and previous_status != "FOR_INTERVIEW":
                    action = "ENDORSE_FOR_INTERVIEW"
                elif requested_status:
                    action = "CHANGE_STATUS"
                else:
                    action = "UPDATE_APPLICATION"
                details = {
                    "application_id": application_id,
                    "fields": [key for key in fields if key != "mswdo_poverty_eligible"],
                }
                if requested_status:
                    details.update(previous_status=previous_status, new_status=requested_status)
                return self._tracked(user, action, "application", application_id, details, update_application)

            return self._send(404, {"error": "Endpoint not found"})

        except Exception as exc:
            return self._error(exc)

    def do_DELETE(self):
        path = urlparse(self.path).path.rstrip("/")
        refused = self._untrusted("DELETE")
        if refused:
            return self._send(403, {"error": refused})

        try:
            user = self._require_user()
            if user is None:
                return None

            if path.startswith("/api/applicants/"):
                applicant_id = int(path.rsplit("/", 1)[1])

                def archive():
                    if ApplicantRepository.archive(applicant_id):
                        return 200, {"ok": True}, applicant_id
                    return 404, {"error": "Applicant not found or already archived."}, applicant_id

                return self._tracked(
                    user, "ARCHIVE_APPLICANT", "applicant", applicant_id,
                    {"applicant_id": applicant_id}, archive,
                )

            return self._send(404, {"error": "Endpoint not found"})

        except Exception as exc:
            return self._error(exc)


def main():
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        print(f"Could not start local bridge on {HOST}:{PORT}: {exc}")
        raise SystemExit(1)

    print(f"Iskolar local bridge running at http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop it.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local bridge...")
    finally:
        server.server_close()



if __name__ == "__main__":
    main()
