"""
mail_integration/services.py

Service de lecture des emails filtrés (collection filtered_emails).
Supporte les deux providers :
  - Gmail       → recherche par gmail_message_id
  - Outlook IMAP → recherche par imap_uid
"""

from imap_data_extractor_api.utils import get_next_sequence_value, serialize_mongo_doc
from configurations.services import mongo_service
from rest_framework.response import Response
from rest_framework import status


class MailService:

    def __init__(self):
        self.collection         = mongo_service.get_collection("filtered_emails")
        self.attachment_col     = mongo_service.get_collection("attachment_email")

    # ── champs à exclure systématiquement ─────────────────────────────────────
    _EXCLUDE = {"_id": 0, "body_html": 0}

    # =========================================================
    # LECTURE PAR ID  (Gmail ou IMAP selon le provider)
    # =========================================================

    def get_mail_by_gmail_id(self, gmail_message_id: str) -> dict:
        """Récupère un email filtré Gmail par son gmail_message_id."""
        email = self.collection.find_one(
            {"gmail_message_id": gmail_message_id},
            self._EXCLUDE,
        )
        if not email:
            return Response(
                {"detail": f"Aucun email trouvé avec gmail_message_id={gmail_message_id}"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return self._build_response(email, "gmail_message_id", gmail_message_id)

    def get_mail_by_imap_uid(self, imap_uid: str) -> dict:
        """Récupère un email filtré Outlook par son imap_uid."""
        email = self.collection.find_one(
            {"imap_uid": imap_uid},
            self._EXCLUDE,
        )
        if not email:
            return Response(
                {"detail": f"Aucun email trouvé avec imap_uid={imap_uid}"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return self._build_response(email, "imap_uid", imap_uid)

    def get_mail_id(self, mail_id: str) -> dict:
        """
        Point d'entrée générique (compatibilité avec l'ancien code).
        Tente d'abord Gmail, puis IMAP si non trouvé.
        """
        email = self.collection.find_one(
            {"$or": [
                {"gmail_message_id": mail_id},
                {"imap_uid": mail_id},
            ]},
            self._EXCLUDE,
        )
        if not email:
            return Response(
                {"detail": f"Aucun email trouvé avec id={mail_id}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Déterminer la clé de recherche pour les pièces jointes
        if email.get("gmail_message_id"):
            att_key   = "gmail_message_id"
            att_value = email["gmail_message_id"]
        else:
            att_key   = "imap_uid"
            att_value = email.get("imap_uid", mail_id)

        return self._build_response(email, att_key, att_value)

    # =========================================================
    # LISTE PAR USER + PROVIDER
    # =========================================================

    def get_mails_by_user(
        self,
        user_id: int,
        provider: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """
        Liste les emails filtrés d'un utilisateur.

        Args:
            user_id:   uid_number LDAP de l'utilisateur.
            provider:  "gmail" | "outlook_imap" | None (tous).
            page:      Numéro de page (1-based).
            page_size: Nombre d'éléments par page.
        """
        query: dict = {"user_id": user_id}
        if provider:
            query["provider"] = provider

        skip  = (page - 1) * page_size
        total = self.collection.count_documents(query)

        cursor = (
            self.collection
            .find(query, self._EXCLUDE)
            .sort("created_at", -1)
            .skip(skip)
            .limit(page_size)
        )

        emails = [serialize_mongo_doc(e) for e in cursor]

        return {
            "total":     total,
            "page":      page,
            "page_size": page_size,
            "results":   emails,
        }

    def get_mails_by_bot(self, bot_id: int, page: int = 1, page_size: int = 20) -> dict:
        """Liste les emails filtrés par un bot spécifique."""
        query = {"bot_id": bot_id}
        skip  = (page - 1) * page_size
        total = self.collection.count_documents(query)

        cursor = (
            self.collection
            .find(query, self._EXCLUDE)
            .sort("created_at", -1)
            .skip(skip)
            .limit(page_size)
        )

        return {
            "total":     total,
            "page":      page,
            "page_size": page_size,
            "results":   [serialize_mongo_doc(e) for e in cursor],
        }

    # =========================================================
    # HELPER INTERNE
    # =========================================================

    def _build_response(self, email: dict, att_key: str, att_value: str) -> dict:
        """
        Construit le dict de réponse avec l'email sérialisé
        et ses pièces jointes si disponibles.
        """
        email_data  = serialize_mongo_doc(email)
        attachments = []

        if email_data.get("has_attachment"):
            att_docs = self.attachment_col.find(
                {att_key: att_value},
                {"_id": 0},
            )
            attachments = [serialize_mongo_doc(a) for a in att_docs]

        return {
            "email":       email_data,
            "attachments": attachments,
        }


mail_service = MailService()