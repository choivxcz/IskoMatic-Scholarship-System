from database.connection import get_connection


class ScholarshipDecisionRepository:
    ALLOWED_DECISIONS = {"APPROVED", "REJECTED", "WAITLISTED"}

    @staticmethod
    def get_all():
        query = """
            SELECT
                d.decision_id,
                d.application_id,
                d.decision,
                d.reason,
                d.decided_at,
                a.applicant_id,
                a.scholarship_program,
                a.scholarship_year,
                a.status AS application_status,
                CONCAT_WS(
                    ' ', p.first_name, p.middle_name, p.last_name, p.suffix
                ) AS applicant_name,
                i.result AS interview_result
            FROM scholarship_decisions d
            INNER JOIN applications a ON a.application_id = d.application_id
            INNER JOIN applicants p ON p.applicant_id = a.applicant_id
            LEFT JOIN interviews i ON i.interview_id = (
                SELECT MAX(i2.interview_id)
                FROM interviews i2
                WHERE i2.application_id = a.application_id
            )
            WHERE a.is_archived = FALSE AND p.is_archived = FALSE
            ORDER BY d.decided_at DESC, d.decision_id DESC
        """
        connection = get_connection()
        try:
            with connection.cursor(dictionary=True) as cursor:
                cursor.execute(query)
                return cursor.fetchall()
        finally:
            connection.close()

    @staticmethod
    def get_interviewed_applications():
        """
        Active applications whose interview has been completed, with the
        latest completed interview and the latest official decision (if any).
        These are the applications shown on the Decisions page.
        """
        query = """
            SELECT
                a.application_id,
                a.applicant_id,
                a.scholarship_program,
                a.scholarship_year,
                a.status AS application_status,
                a.academic_average,
                a.monthly_income,
                CONCAT_WS(
                    ' ', p.first_name, p.middle_name, p.last_name, p.suffix
                ) AS applicant_name,
                p.barangay,
                iv.interview_id,
                iv.scheduled_at AS interview_date,
                iv.result AS interview_result,
                iv.remarks AS interview_remarks,
                d.decision_id,
                d.decision,
                d.reason,
                d.decided_at
            FROM applications a
            INNER JOIN applicants p ON p.applicant_id = a.applicant_id
            INNER JOIN interviews iv ON iv.interview_id = (
                SELECT MAX(i2.interview_id)
                FROM interviews i2
                WHERE i2.application_id = a.application_id
                  AND i2.status = 'COMPLETED'
            )
            LEFT JOIN scholarship_decisions d ON d.decision_id = (
                SELECT MAX(d2.decision_id)
                FROM scholarship_decisions d2
                WHERE d2.application_id = a.application_id
            )
            WHERE a.is_archived = FALSE AND p.is_archived = FALSE
            ORDER BY iv.scheduled_at DESC, a.application_id DESC
        """
        connection = get_connection()
        try:
            with connection.cursor(dictionary=True) as cursor:
                cursor.execute(query)
                return cursor.fetchall()
        finally:
            connection.close()

    @staticmethod
    def save(application_id, decision, reason, decided_at, expected_status=None):
        """
        Record a decision and set the application's status to it, together.

        When `expected_status` is given, the application must still have that
        status; otherwise nothing is saved. This stops a double submission or
        two staff deciding at once from recording two decisions.
        """
        decision = str(decision).strip().upper()
        if decision not in ScholarshipDecisionRepository.ALLOWED_DECISIONS:
            raise ValueError(f"Invalid scholarship decision: {decision}")
        if not str(reason).strip():
            raise ValueError("Decision reason is required.")

        connection = get_connection()
        try:
            with connection.cursor() as cursor:
                update = """
                    UPDATE applications
                    SET status = %s
                    WHERE application_id = %s AND is_archived = FALSE
                """
                values = [decision, application_id]
                if expected_status is not None:
                    update += " AND status = %s"
                    values.append(str(expected_status).upper())
                cursor.execute(update, tuple(values))
                if cursor.rowcount != 1:
                    raise ValueError(
                        "This application was changed by someone else or is "
                        "archived. Refresh the page and try again."
                    )
                cursor.execute(
                    """
                    INSERT INTO scholarship_decisions
                        (application_id, decision, reason, decided_at)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (application_id, decision, reason.strip(), decided_at),
                )
                decision_id = cursor.lastrowid
            connection.commit()
            return decision_id
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
