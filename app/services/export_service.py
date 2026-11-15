"""Export of finalized scholarship records.

An application is finalized when it has gone through every stage of the
workflow: it was screened, its interview was completed, and an official
decision (Approved, Waitlisted or Rejected) was recorded and is its current
status. Applications still in progress are not exported.
"""

from database.connection import get_connection

FINAL_DECISIONS = ("APPROVED", "WAITLISTED", "REJECTED")

_FINALIZED_QUERY = """
    SELECT
        a.application_id,
        a.applicant_id,
        p.last_name,
        p.first_name,
        p.middle_name,
        p.suffix,
        p.sex,
        p.birth_date,
        p.email,
        p.phone,
        p.house_no_street,
        p.barangay,
        p.municipality,
        p.province,
        p.is_archived AS applicant_archived,
        a.scholarship_program,
        a.scholarship_year,
        a.academic_average,
        a.exam_score,
        a.monthly_income,
        a.household,
        a.children_count,
        a.senior_count,
        a.pwd_count,
        a.solo_parent,
        a.mswdo_poverty_eligible,
        sr.screening_id,
        sr.predicted_class,
        sr.confidence_score,
        sr.screened_at,
        mv.version_name AS model_version,
        iv.interview_id,
        iv.scheduled_at AS interview_date,
        iv.location AS interview_location,
        iv.result AS interview_result,
        iv.remarks AS interview_remarks,
        d.decision_id,
        d.decision,
        d.reason AS decision_reason,
        d.decided_at
    FROM applications a
    INNER JOIN applicants p ON p.applicant_id = a.applicant_id
    INNER JOIN screening_results sr ON sr.screening_id = (
        SELECT MAX(s2.screening_id)
        FROM screening_results s2
        WHERE s2.application_id = a.application_id
    )
    LEFT JOIN model_versions mv ON mv.model_version_id = sr.model_version_id
    INNER JOIN interviews iv ON iv.interview_id = (
        SELECT MAX(i2.interview_id)
        FROM interviews i2
        WHERE i2.application_id = a.application_id
          AND i2.status = 'COMPLETED'
    )
    INNER JOIN scholarship_decisions d ON d.decision_id = (
        SELECT MAX(d2.decision_id)
        FROM scholarship_decisions d2
        WHERE d2.application_id = a.application_id
    )
    WHERE d.decision IN (%s, %s, %s)
      AND a.status = d.decision
    ORDER BY a.scholarship_year DESC, a.scholarship_program,
             d.decision, p.last_name, p.first_name, a.application_id
"""


def finalized_records():
    """Return one row per finalized application (latest screening, completed
    interview and official decision), ready to be written to CSV."""
    connection = get_connection()
    try:
        with connection.cursor(dictionary=True) as cursor:
            cursor.execute(_FINALIZED_QUERY, FINAL_DECISIONS)
            rows = cursor.fetchall()
    finally:
        connection.close()

    for row in rows:
        score = row.get("confidence_score")
        row["chance_percent"] = round(float(score) * 100, 1) if score is not None else None
    return rows
