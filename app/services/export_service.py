"""Export of finalized scholarship records.

An application is finalized when it has gone through every stage of the
workflow: it was screened, its interview was completed, and an official
decision (Approved, Waitlisted or Rejected) was recorded and is its current
status. Applications still in progress are not exported.

The CSV is written by the local bridge to a fixed folder on this computer,
``Downloads\\Iskolar ng Bayan Exports``, so staff always know where it is and
the app can open the file or its folder afterwards.
"""

import csv
import os
import re
import subprocess
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from database.connection import get_connection

FINAL_DECISIONS = ("APPROVED", "WAITLISTED", "REJECTED")
EXPORT_FOLDER_NAME = "Iskolar ng Bayan Exports"
FILENAME_PREFIX = "finalized-scholarship-records"
# Only files this module creates may be opened or revealed.
_FILENAME_RE = re.compile(rf"^{FILENAME_PREFIX}-\d{{4}}-\d{{2}}-\d{{2}}_\d{{6}}(-\d+)?\.csv$")

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
    interview and official decision)."""
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


# ---------------------------------------------------------------- CSV file

def _words(value):
    if value is None or value == "":
        return ""
    text = str(value).replace("_", " ").lower()
    return text[:1].upper() + text[1:]


def _yes_no(value):
    if value is None or value == "":
        return ""
    return "Yes" if value in (True, 1, "1", "true") else "No"


def _day(value):
    return value.isoformat() if isinstance(value, (date, datetime)) else (str(value)[:10] if value else "")


def _minute(value):
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    return str(value).replace("T", " ")[:16] if value else ""


def _plain(value):
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return format(value.normalize(), "f") if value == value.to_integral() else str(value)
    return str(value)


COLUMNS = [
    ("Application ID", lambda r: f"APP-{r['application_id']}"),
    ("Applicant ID", lambda r: r["applicant_id"]),
    ("Last name", lambda r: r["last_name"]),
    ("First name", lambda r: r["first_name"]),
    ("Middle name", lambda r: r["middle_name"]),
    ("Suffix", lambda r: r["suffix"]),
    ("Sex", lambda r: _words(r["sex"])),
    ("Birth date", lambda r: _day(r["birth_date"])),
    ("Email", lambda r: r["email"]),
    ("Phone", lambda r: r["phone"]),
    ("House no. / street", lambda r: r["house_no_street"]),
    ("Barangay", lambda r: r["barangay"]),
    ("Municipality", lambda r: r["municipality"]),
    ("Province", lambda r: r["province"]),
    ("Scholarship program", lambda r: r["scholarship_program"]),
    ("Scholarship year", lambda r: r["scholarship_year"]),
    ("Academic average", lambda r: r["academic_average"]),
    ("Entrance exam score (%)", lambda r: r["exam_score"]),
    ("Monthly household income (PHP)", lambda r: r["monthly_income"]),
    ("Household size", lambda r: r["household"]),
    ("Children", lambda r: r["children_count"]),
    ("Seniors", lambda r: r["senior_count"]),
    ("PWDs", lambda r: r["pwd_count"]),
    ("Solo parent", lambda r: _yes_no(r["solo_parent"])),
    ("Within MSWDO poverty line", lambda r: _yes_no(r["mswdo_poverty_eligible"])),
    ("AI recommendation (advisory)", lambda r: _words(r["predicted_class"])),
    ("Chance of qualifying (%)", lambda r: r["chance_percent"]),
    ("Screened at", lambda r: _minute(r["screened_at"])),
    ("Model version", lambda r: r["model_version"]),
    ("Interview date", lambda r: _minute(r["interview_date"])),
    ("Interview location", lambda r: r["interview_location"]),
    ("Interview result", lambda r: _words(r["interview_result"])),
    ("Interview remarks", lambda r: r["interview_remarks"]),
    ("Official decision", lambda r: _words(r["decision"])),
    ("Decision remarks", lambda r: r["decision_reason"]),
    ("Decided at", lambda r: _minute(r["decided_at"])),
    ("Decided by", lambda r: r.get("decided_by") or "Not recorded"),
    ("Applicant archived", lambda r: _yes_no(r["applicant_archived"])),
]


def _cell(value):
    """Text for one CSV cell. A value starting with = + - @ tab or CR gets an
    apostrophe so a spreadsheet never runs it as a formula (CSV injection)."""
    text = _plain(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def _downloads_folder():
    """The user's Downloads folder (follows a moved Downloads folder on Windows)."""
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes
            from uuid import UUID

            class GUID(ctypes.Structure):
                _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD),
                            ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]

            raw = UUID("{374DE290-123F-4565-9164-39C4925E467B}").bytes_le  # FOLDERID_Downloads
            guid = GUID.from_buffer_copy(raw)
            buffer = ctypes.c_wchar_p()
            if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(guid), 0, None, ctypes.byref(buffer)) == 0:
                try:
                    return Path(buffer.value)
                finally:
                    ctypes.windll.ole32.CoTaskMemFree(buffer)
        except Exception:
            pass
    downloads = Path.home() / "Downloads"
    return downloads if downloads.is_dir() else Path.home()


def export_folder():
    folder = _downloads_folder() / EXPORT_FOLDER_NAME
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def write_finalized_csv(rows, now=None):
    """Write the rows to a new CSV file and return its path. Never overwrites a file."""
    stamp = (now or datetime.now()).strftime("%Y-%m-%d_%H%M%S")
    folder = export_folder()
    path = folder / f"{FILENAME_PREFIX}-{stamp}.csv"
    counter = 1
    while path.exists():
        counter += 1
        path = folder / f"{FILENAME_PREFIX}-{stamp}-{counter}.csv"
    with open(path, "w", newline="", encoding="utf-8-sig") as handle:  # BOM so Excel reads UTF-8
        writer = csv.writer(handle, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
        writer.writerow([header for header, _ in COLUMNS])
        for row in rows:
            writer.writerow([_cell(read(row)) for _, read in COLUMNS])
    return path


def resolve_export(filename):
    """Path of an existing export created by this module, or raise ValueError."""
    name = str(filename or "")
    if not _FILENAME_RE.fullmatch(name):
        raise ValueError("Unknown export file.")
    folder = export_folder().resolve()
    path = (folder / name).resolve()
    if path.parent != folder or not path.is_file():
        raise ValueError("The export file was not found. It may have been moved or deleted.")
    return path


def open_export(filename, reveal=False):
    """Open the export in its default app, or show it selected in its folder."""
    path = resolve_export(filename)
    if sys.platform == "win32":
        if reveal:
            subprocess.Popen(["explorer", f"/select,{path}"])
        else:
            os.startfile(str(path))  # noqa: S606 - path is validated above
    elif sys.platform == "darwin":
        subprocess.Popen(["open", "-R", str(path)] if reveal else ["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path.parent if reveal else path)])
    return path
