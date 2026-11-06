"""Staff accounts and sign-in sessions for the desktop bridge.

Tables are created on first use (CREATE TABLE IF NOT EXISTS), so no manual
migration is needed. Passwords are stored as salted PBKDF2-SHA256 hashes and
session tokens are stored only as SHA-256 digests.

Account flow:
- A sign-up creates a PENDING request. Only APPROVED accounts can sign in.
- The very first account ever registered becomes an approved ADMIN, so the
  office is never locked out of a fresh database.
- Admins approve or reject requests and choose the role.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import threading
from datetime import datetime, timedelta
from typing import Any

from database.connection import get_connection


ROLES = {"ADMIN", "LYDO_OFFICIAL"}
DEPARTMENTS = [
    "LYDO",
    "Office of the Mayor",
    "MSWDO",
    "HRMO",
    "MIS / IT Office",
    "Other municipal office",
]

_ITERATIONS = 600_000
_MAX_FAILED = 5
_LOCK_MINUTES = 5
_SESSION_HOURS = 12
_REMEMBER_DAYS = 30

_USERNAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{1,48}[a-z0-9])$")
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

_schema_ready = False
_schema_lock = threading.Lock()
_register_lock = threading.Lock()

# Used so a login for an unknown user takes as long as one for a real user.
_DUMMY_HASH: str | None = None


class AuthError(Exception):
    """A user-facing authentication problem with an HTTP status."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


# ---------------------------------------------------------------- schema

_SCHEMA = [
    """
    CREATE TABLE IF NOT EXISTS staff_accounts (
        account_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        username VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        department VARCHAR(100) NOT NULL,
        position VARCHAR(100) NOT NULL,
        reason VARCHAR(500) NULL,
        role ENUM('ADMIN', 'LYDO_OFFICIAL') NOT NULL DEFAULT 'LYDO_OFFICIAL',
        status ENUM('PENDING', 'APPROVED', 'REJECTED', 'DISABLED') NOT NULL DEFAULT 'PENDING',
        reviewed_by INT UNSIGNED NULL,
        reviewed_at DATETIME NULL,
        failed_attempts INT UNSIGNED NOT NULL DEFAULT 0,
        locked_until DATETIME NULL,
        last_login_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_staff_username (username),
        UNIQUE KEY uq_staff_email (email),
        INDEX idx_staff_status (status)
    ) ENGINE=InnoDB
    """,
    """
    CREATE TABLE IF NOT EXISTS staff_sessions (
        token_hash CHAR(64) PRIMARY KEY,
        account_id INT UNSIGNED NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_session_account (account_id),
        INDEX idx_session_expiry (expires_at),
        CONSTRAINT fk_session_account FOREIGN KEY (account_id)
            REFERENCES staff_accounts (account_id) ON DELETE CASCADE
    ) ENGINE=InnoDB
    """,
]


def ensure_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
        connection = get_connection()
        cursor = connection.cursor()
        try:
            for statement in _SCHEMA:
                cursor.execute(statement)
            connection.commit()
            _schema_ready = True
        finally:
            cursor.close()
            connection.close()


def _query(sql: str, params: tuple = (), *, one: bool = False, write: bool = False):
    ensure_schema()
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(sql, params)
        if write:
            connection.commit()
            return cursor.lastrowid or cursor.rowcount
        rows = cursor.fetchall()
        return (rows[0] if rows else None) if one else rows
    except Exception:
        if write:
            connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


# ---------------------------------------------------------------- passwords

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    encode = lambda raw: base64.b64encode(raw).decode("ascii")
    return f"pbkdf2_sha256${_ITERATIONS}${encode(salt)}${encode(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), base64.b64decode(salt), int(iterations)
        )
        return hmac.compare_digest(digest, base64.b64decode(expected))
    except (ValueError, TypeError):
        return False


def password_problems(password: str) -> list[str]:
    problems = []
    if len(password) < 12:
        problems.append("at least 12 characters")
    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password):
        problems.append("uppercase and lowercase letters")
    if not re.search(r"\d", password):
        problems.append("a number")
    if not re.search(r"[^A-Za-z0-9]", password):
        problems.append("a symbol")
    if len(password) > 128:
        problems.append("at most 128 characters")
    return problems


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- accounts

def public_user(row: dict[str, Any]) -> dict[str, Any]:
    """Fields that are safe to send to the UI."""
    return {
        "user_id": int(row["account_id"]),
        "username": row["username"],
        "display_name": f"{row['first_name']} {row['last_name']}".strip(),
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "email": row["email"],
        "department": row["department"],
        "position": row["position"],
        "role": row["role"],
        "status": row["status"],
        "reason": row.get("reason"),
        "created_at": row.get("created_at"),
        "last_login_at": row.get("last_login_at"),
    }


def _text(data: dict, key: str, label: str, maximum: int, required: bool = True) -> str:
    value = data.get(key)
    value = value.strip() if isinstance(value, str) else ""
    if required and not value:
        raise AuthError(f"{label} is required.")
    if len(value) > maximum:
        raise AuthError(f"{label} must be at most {maximum} characters.")
    return value


def normalize_username(value: Any) -> str:
    return value.strip().lower() if isinstance(value, str) else ""


def username_available(username: str) -> bool:
    username = normalize_username(username)
    if not _USERNAME_RE.match(username):
        return False
    row = _query("SELECT 1 AS taken FROM staff_accounts WHERE username = %s", (username,), one=True)
    return row is None


def register(data: dict[str, Any]) -> dict[str, Any]:
    first_name = _text(data, "first_name", "First name", 100)
    last_name = _text(data, "last_name", "Last name", 100)
    email = _text(data, "email", "Work email", 255).lower()
    if not _EMAIL_RE.match(email):
        raise AuthError("Enter a valid work email address.")
    username = normalize_username(data.get("username"))
    if not _USERNAME_RE.match(username):
        raise AuthError("Username must be 3–50 characters: lowercase letters, numbers, dots, dashes or underscores.")
    password = data.get("password") if isinstance(data.get("password"), str) else ""
    problems = password_problems(password)
    if problems:
        raise AuthError("Password needs " + ", ".join(problems) + ".")
    if data.get("confirm_password") is not None and data.get("confirm_password") != password:
        raise AuthError("Passwords do not match.")
    department = _text(data, "department", "Department / office", 100)
    if department not in DEPARTMENTS:
        raise AuthError("Choose a department / office from the list.")
    position = _text(data, "position", "Position / job title", 100)
    reason = _text(data, "reason", "Reason", 500, required=False) or None

    password_hash = hash_password(password)
    with _register_lock:
        taken = _query(
            "SELECT username, email FROM staff_accounts WHERE username = %s OR email = %s",
            (username, email),
        )
        if any(row["username"] == username for row in taken):
            raise AuthError("That username is already taken.", 409)
        if taken:
            raise AuthError("An account request already exists for this work email.", 409)

        first_account = _query("SELECT COUNT(*) AS total FROM staff_accounts", one=True)["total"] == 0
        role, status = ("ADMIN", "APPROVED") if first_account else ("LYDO_OFFICIAL", "PENDING")
        account_id = _query(
            "INSERT INTO staff_accounts (first_name, last_name, email, username, password_hash, "
            "department, position, reason, role, status, reviewed_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (first_name, last_name, email, username, password_hash, department, position,
             reason, role, status, datetime.now() if first_account else None),
            write=True,
        )
    return {"account_id": account_id, "status": status, "role": role, "first_account": first_account}


def login(identifier: Any, password: Any, remember: bool = False) -> tuple[str, dict[str, Any], datetime]:
    global _DUMMY_HASH
    identifier = identifier.strip().lower() if isinstance(identifier, str) else ""
    password = password if isinstance(password, str) else ""
    if not identifier or not password:
        raise AuthError("Enter your username or work email and your password.")

    row = _query(
        "SELECT * FROM staff_accounts WHERE username = %s OR email = %s LIMIT 1",
        (identifier, identifier), one=True,
    )
    now = datetime.now()
    if row is None:
        if _DUMMY_HASH is None:
            _DUMMY_HASH = hash_password(secrets.token_hex(8))
        verify_password(password, _DUMMY_HASH)
        raise AuthError("Incorrect username or password.", 401)

    if row["locked_until"] and row["locked_until"] > now:
        minutes = max(1, int((row["locked_until"] - now).total_seconds() // 60) + 1)
        raise AuthError(f"Too many failed attempts. Try again in {minutes} minute(s).", 429)

    if not verify_password(password, row["password_hash"]):
        failed = int(row["failed_attempts"] or 0) + 1
        locked = now + timedelta(minutes=_LOCK_MINUTES) if failed >= _MAX_FAILED else None
        _query(
            "UPDATE staff_accounts SET failed_attempts = %s, locked_until = %s WHERE account_id = %s",
            (0 if locked else failed, locked, row["account_id"]), write=True,
        )
        if locked:
            raise AuthError(f"Too many failed attempts. Try again in {_LOCK_MINUTES} minutes.", 429)
        raise AuthError("Incorrect username or password.", 401)

    if row["status"] == "PENDING":
        raise AuthError("Your account request is still waiting for administrator approval.", 403)
    if row["status"] != "APPROVED":
        raise AuthError("This account is not active. Contact your LYDO administrator.", 403)

    token = secrets.token_urlsafe(32)
    expires = now + (timedelta(days=_REMEMBER_DAYS) if remember else timedelta(hours=_SESSION_HOURS))
    _query(
        "INSERT INTO staff_sessions (token_hash, account_id, expires_at) VALUES (%s, %s, %s)",
        (_token_hash(token), row["account_id"], expires), write=True,
    )
    _query(
        "UPDATE staff_accounts SET failed_attempts = 0, locked_until = NULL, last_login_at = %s "
        "WHERE account_id = %s",
        (now, row["account_id"]), write=True,
    )
    _query("DELETE FROM staff_sessions WHERE expires_at < %s", (now,), write=True)
    row["last_login_at"] = now
    return token, public_user(row), expires


def user_for_token(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    row = _query(
        "SELECT a.* FROM staff_sessions s JOIN staff_accounts a ON a.account_id = s.account_id "
        "WHERE s.token_hash = %s AND s.expires_at > %s AND a.status = 'APPROVED'",
        (_token_hash(token), datetime.now()), one=True,
    )
    return public_user(row) if row else None


def logout(token: str | None) -> None:
    if token:
        _query("DELETE FROM staff_sessions WHERE token_hash = %s", (_token_hash(token),), write=True)


# ---------------------------------------------------------------- admin

def list_accounts() -> list[dict[str, Any]]:
    rows = _query(
        "SELECT * FROM staff_accounts ORDER BY FIELD(status, 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'), "
        "created_at DESC"
    )
    return [public_user(row) for row in rows]


def review(admin: dict[str, Any], account_id: int, action: str, role: str | None = None) -> dict[str, Any]:
    if admin.get("role") != "ADMIN":
        raise AuthError("Only administrators can review staff accounts.", 403)
    row = _query("SELECT * FROM staff_accounts WHERE account_id = %s", (account_id,), one=True)
    if row is None:
        raise AuthError("Account not found.", 404)
    if account_id == admin["user_id"]:
        raise AuthError("You cannot change your own account access.", 400)

    if action == "approve":
        role = role or "LYDO_OFFICIAL"
        if role not in ROLES:
            raise AuthError("Choose a valid role.")
        status = "APPROVED"
    elif action in {"reject", "disable"}:
        status = "REJECTED" if action == "reject" else "DISABLED"
        role = row["role"]
        if row["role"] == "ADMIN" and row["status"] == "APPROVED":
            admins = _query(
                "SELECT COUNT(*) AS total FROM staff_accounts WHERE role = 'ADMIN' AND status = 'APPROVED'",
                one=True,
            )["total"]
            if admins <= 1:
                raise AuthError("At least one active administrator is required.", 400)
    else:
        raise AuthError("Unknown review action.")

    _query(
        "UPDATE staff_accounts SET status = %s, role = %s, reviewed_by = %s, reviewed_at = %s "
        "WHERE account_id = %s",
        (status, role, admin["user_id"], datetime.now(), account_id), write=True,
    )
    if status != "APPROVED":
        _query("DELETE FROM staff_sessions WHERE account_id = %s", (account_id,), write=True)
    row.update(status=status, role=role)
    return public_user(row)
