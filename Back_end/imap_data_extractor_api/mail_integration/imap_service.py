"""
mail_integration/imap_service.py

Service IMAP pour Exchange Online (Microsoft 365).
Les credentials (email + password) sont fournis à chaque appel — jamais stockés.
Le user les saisit une seule fois au moment d'activer un bot.
"""

import imaplib
import email
import os
import logging
from datetime import datetime
from typing import Optional, Dict, List, Tuple
from email.header import decode_header

from django.conf import settings

logger = logging.getLogger(__name__)

IMAP_HOST = "outlook.office365.com"
IMAP_PORT = 993


class ImapAuthError(Exception):
    """Credentials invalides ou accès refusé."""


class ImapConnectionError(Exception):
    """Erreur réseau / serveur IMAP."""


class M365ImapService:
    """
    Ouvre une connexion IMAP vers Exchange Online avec les credentials
    de l'utilisateur fournis à l'appel. Aucun stockage d'identifiants.
    """

    # ── connexion ─────────────────────────────────────────────────────────────

    def _open_session(self, user_email: str, password: str) -> imaplib.IMAP4_SSL:
        """
        Ouvre et retourne une session IMAP authentifiée.
        Lève ImapAuthError ou ImapConnectionError selon l'échec.
        """
        try:
            imap = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
            typ, data = imap.login(user_email, password)
            if typ != "OK":
                raise ImapAuthError(f"Login refusé pour {user_email} : {data}")
            logger.info("Session IMAP ouverte pour %s", user_email)
            return imap

        except imaplib.IMAP4.error as exc:
            msg = str(exc).lower()
            if "invalid credentials" in msg or "authentication failed" in msg:
                raise ImapAuthError(
                    f"Credentials invalides pour {user_email}"
                ) from exc
            raise ImapConnectionError(str(exc)) from exc

        except OSError as exc:
            raise ImapConnectionError(
                f"Impossible de joindre {IMAP_HOST}:{IMAP_PORT} — {exc}"
            ) from exc

    def test_credentials(self, user_email: str, password: str) -> Tuple[bool, str]:
        """
        Vérifie que email + password ouvrent bien une session Exchange Online.

        Returns:
            (True, "")           si OK
            (False, msg_erreur)  sinon
        """
        try:
            imap = self._open_session(user_email, password)
            imap.logout()
            return True, ""
        except (ImapAuthError, ImapConnectionError) as exc:
            return False, str(exc)

    def open_session(self, user_email: str, password: str) -> imaplib.IMAP4_SSL:
        """
        Ouvre une session IMAP et la retourne pour réutilisation dans un thread bot.
        L'appelant est responsable d'appeler imap.logout() à la fin.
        """
        return self._open_session(user_email, password)

    # ── lecture (sur session déjà ouverte) ────────────────────────────────────

    def list_inbox_ids(
        self,
        imap: imaplib.IMAP4_SSL,
        since_date: Optional[datetime] = None,
        unseen_only: bool = False,
    ) -> List[str]:
        """
        Retourne les UIDs des messages INBOX sur une session déjà ouverte.
        """
        imap.select("INBOX", readonly=True)

        parts = []
        if unseen_only:
            parts.append("UNSEEN")
        if since_date:
            parts.append(f'SINCE "{since_date.strftime("%d-%b-%Y")}"')
        criteria = " ".join(parts) if parts else "ALL"

        typ, data = imap.uid("search", None, criteria)
        if typ != "OK" or not data[0]:
            return []

        uids = data[0].decode().split()
        logger.debug("%d messages trouvés dans INBOX", len(uids))
        return uids

    def fetch_message(
        self, imap: imaplib.IMAP4_SSL, uid: str
    ) -> Optional[Dict]:
        """Fetch et parse un message par UID sur une session déjà ouverte."""
        typ, raw = imap.uid("fetch", uid, "(RFC822)")
        if typ != "OK" or not raw or raw[0] is None:
            return None
        msg = email.message_from_bytes(raw[0][1])
        return self._parse_message(uid, msg)

    # ── parsing ───────────────────────────────────────────────────────────────

    def _decode_header_value(self, value: str) -> str:
        if not value:
            return ""
        parts = decode_header(value)
        decoded = []
        for part, charset in parts:
            if isinstance(part, bytes):
                decoded.append(part.decode(charset or "utf-8", errors="replace"))
            else:
                decoded.append(part)
        return " ".join(decoded)

    def _parse_message(self, uid: str, msg: email.message.Message) -> Dict:
        subject  = self._decode_header_value(msg.get("Subject", ""))
        from_raw = self._decode_header_value(msg.get("From", ""))
        date_raw = msg.get("Date", "")

        from_email = from_raw
        if "<" in from_raw and ">" in from_raw:
            from_email = from_raw.split("<")[1].rstrip(">").strip()

        body_text   = ""
        attachments: List[Dict] = []

        for part in msg.walk():
            content_type = part.get_content_type()
            disposition  = part.get("Content-Disposition", "")

            if "attachment" in disposition:
                filename = self._decode_header_value(part.get_filename("unnamed"))
                payload  = part.get_payload(decode=True) or b""
                attachments.append({
                    "filename":     filename,
                    "content_type": content_type,
                    "size":         len(payload),
                    "data":         payload,
                })
            elif content_type == "text/plain" and not body_text:
                payload = part.get_payload(decode=True)
                if payload:
                    charset   = part.get_content_charset("utf-8")
                    body_text = payload.decode(charset, errors="replace")

        return {
            "uid":            uid,
            "subject":        subject,
            "from_email":     from_email,
            "date":           date_raw,
            "body_text":      body_text,
            "has_attachment": len(attachments) > 0,
            "attachments":    attachments,
        }

    # ── sauvegarde pièces jointes ─────────────────────────────────────────────

    def save_attachment(
        self, user_id: int, message_uid: str, attachment: Dict
    ) -> str:
        path = os.path.join(
            settings.BASE_MEDIA_PATH,
            f"user_{user_id}",
            message_uid,
        )
        os.makedirs(path, exist_ok=True)
        safe_name = os.path.basename(attachment["filename"]) or "unnamed"
        file_path = os.path.join(path, safe_name)
        with open(file_path, "wb") as f:
            f.write(attachment["data"])
        logger.info("Pièce jointe sauvegardée : %s", file_path)
        return file_path


# instance globale
m365_imap_service = M365ImapService()
