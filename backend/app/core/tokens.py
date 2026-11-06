"""HMAC-SHA256 signed table token generation and verification.

Customer sessions are stateless: the QR sticker at each table carries a URL
with a signed token. The backend verifies the signature per request, so no
client-side login and no server-side session store are needed.
Each table has its own random secret (tables.qr_token_secret) as the HMAC key,
so one table's QR can be rotated without invalidating the others.
"""
import hmac
import hashlib
import secrets

from app.core.database import Base
from app.core.config import settings


def generate_table_secret() -> str:
    """Per-table random secret used as the HMAC key. Created when a table is added."""
    return secrets.token_hex(32)


def sign_table_token(table_secret: str, table_id: str, table_number: int) -> str:
    """Sign '{table_id}:{table_number}' with the table's own secret."""
    message = f"{table_id}:{table_number}"
    return hmac.new(table_secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def verify_table_token(
    table_secret: str, token: str, table_id: str, table_number: int
) -> bool:
    """Constant-time comparison; rejects forged table numbers or tenant IDs."""
    expected = sign_table_token(table_secret, table_id, table_number)
    return hmac.compare_digest(token, expected)
