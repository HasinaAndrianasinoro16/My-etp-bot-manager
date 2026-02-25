"""
mail_integration/services.py

Service OAuth2 Outlook via Microsoft Graph API (MSAL).

Flux complet :
  1. GET  /mail/start/     → retourne auth_url Microsoft (OAuth2 consent)
  2. Utilisateur consent sur Microsoft
  3. GET  /mail/callback/  → échange code → stocke token dans MongoDB
  4. GET  /mail/status/    → vérifie si connecté
  5. Bots → list_messages() / get_message() via Graph API

Lien session → boîte mail :
  - Après login LDAP, l'email de l'utilisateur (issu d'AD) est utilisé
    pour vérifier si un token OAuth2 Outlook existe en MongoDB.
  - Si oui : la boîte mail est automatiquement liée à la session.
  - Si non : l'utilisateur doit effectuer le flux OAuth2 une seule fois.
"""

import os
import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from django.conf import settings
from msal import ConfidentialClientApplication
from pymongo.errors import DuplicateKeyError

from configurations.services import mongo_service
from imap_data_extractor_api.utils import get_next_sequence_value

logger = logging.getLogger(__name__)

# Scopes nécessaires pour lire les emails
OUTLOOK_SCOPES = [
    "https://graph.microsoft.com/Mail.Read",
    "https://graph.microsoft.com/User.Read",
]

GRAPH_ENDPOINT = "https://graph.microsoft.com/v1.0"


class OutlookNotConnectedException(Exception):
    """Levée quand aucun token valide n'existe pour l'utilisateur."""
    pass


class OutlookService:

    def __init__(self):
        self.token_collection = mongo_service.get_collection("outlook_token")
        self.filtered_emails  = mongo_service.get_collection("filtered_emails")
        self.attachments_col  = mongo_service.get_collection("attachment_email")

    # ── helper MSAL ───────────────────────────────────────────────────────────

    def _get_msal_app(self) -> ConfidentialClientApplication:
        return ConfidentialClientApplication(
            settings.AZURE_CLIENT_ID,
            authority=settings.AZURE_AUTHORITY,
            client_credential=settings.AZURE_CLIENT_SECRET,
        )

    # =========================================================
    # LIEN SESSION LDAP → BOÎTE OUTLOOK
    # =========================================================

    def connect_from_ldap_session(self, user) -> Dict:
        """
        Appelée après un login LDAP réussi.

        Vérifie si un token OAuth2 Outlook existe déjà en MongoDB
        pour cet utilisateur (identifié par uid_number).

        - Si oui et valide  → retourne le statut de connexion
        - Si oui et expiré  → tente un refresh automatique
        - Si non            → retourne un flag indiquant qu'il faut
                              effectuer le flux OAuth2 via /mail/start/

        Ne bloque JAMAIS le login : toutes les erreurs sont loggées.

        Returns:
            dict: {
                "connected": bool,
                "email": str | None,          # adresse mail Outlook liée
                "needs_oauth": bool,          # True si le flux OAuth2 est requis
                "is_valid": bool,
            }
        """
        user_id = user.uid_number
        ldap_email = user.email  # Email issu d'Active Directory

        try:
            doc = self.token_collection.find_one({"user_id": user_id})

            # ── Cas 1 : Aucun token en base ───────────────────────────────────
            if not doc:
                # Tentative : chercher par email Outlook (au cas où uid_number
                # aurait changé entre deux logins)
                doc = self.token_collection.find_one({"outlook_email": ldap_email})
                if doc:
                    # Rattacher ce token à l'uid_number actuel
                    self.token_collection.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"user_id": user_id, "updated_at": datetime.utcnow()}}
                    )
                    logger.info(
                        "Token Outlook rattaché par email LDAP: %s → user_id=%s",
                        ldap_email, user_id
                    )
                else:
                    logger.info(
                        "Aucun token Outlook pour user_id=%s (%s). Flux OAuth2 requis.",
                        user_id, ldap_email
                    )
                    return {
                        "connected": False,
                        "email": None,
                        "needs_oauth": True,
                        "is_valid": False,
                    }

            # ── Cas 2 : Token trouvé — vérifier validité ──────────────────────
            if not doc.get("connected"):
                return {
                    "connected": False,
                    "email": doc.get("outlook_email"),
                    "needs_oauth": True,
                    "is_valid": False,
                }

            expires_at = doc.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)

            # Marge de 5 minutes avant expiration
            if expires_at and expires_at < datetime.utcnow() + timedelta(minutes=5):
                if doc.get("refresh_token"):
                    logger.info("Token Outlook expiré → refresh automatique pour user_id=%s", user_id)
                    doc = self._refresh_token(doc)
                else:
                    logger.warning("Token Outlook expiré, pas de refresh_token pour user_id=%s", user_id)
                    return {
                        "connected": False,
                        "email": doc.get("outlook_email"),
                        "needs_oauth": True,
                        "is_valid": False,
                    }

            logger.info(
                "Boîte Outlook liée à la session: %s (user_id=%s)",
                doc.get("outlook_email"), user_id
            )
            return {
                "connected": True,
                "email": doc.get("outlook_email"),
                "needs_oauth": False,
                "is_valid": True,
            }

        except Exception as e:
            logger.error(
                "Erreur lors de la liaison Outlook pour user_id=%s: %s", user_id, e
            )
            return {
                "connected": False,
                "email": None,
                "needs_oauth": True,
                "is_valid": False,
                "error": str(e),
            }

    # =========================================================
    # AUTH — génération URL + callback OAuth2
    # =========================================================

    def get_outlook_auth_url(self, user_id: int) -> str:
        """Génère l'URL de consentement Microsoft pour l'utilisateur."""
        app = self._get_msal_app()
        return app.get_authorization_request_url(
            scopes=OUTLOOK_SCOPES,
            redirect_uri=settings.AZURE_REDIRECT_URI,
            state=f"user_{user_id}",
        )

    def exchange_code_for_token(self, code: str, state: str) -> Dict:
        """Échange le code OAuth2 contre les tokens et les retourne."""
        app = self._get_msal_app()
        result = app.acquire_token_by_authorization_code(
            code=code,
            scopes=OUTLOOK_SCOPES,
            redirect_uri=settings.AZURE_REDIRECT_URI,
        )
        if "error" in result:
            raise Exception(
                f"Erreur OAuth2 : {result.get('error_description', result.get('error'))}"
            )
        return {
            "access_token":  result["access_token"],
            "refresh_token": result.get("refresh_token"),
            "id_token":      result.get("id_token"),
            "expires_at":    datetime.utcnow() + timedelta(seconds=result.get("expires_in", 3600)),
            "scope":         result.get("scope"),
        }

    # =========================================================
    # TOKEN — récupération + refresh automatique
    # =========================================================

    def _refresh_token(self, doc: Dict) -> Dict:
        """Rafraîchit le token si expiré et met à jour MongoDB."""
        app = self._get_msal_app()
        result = app.acquire_token_by_refresh_token(
            refresh_token=doc["refresh_token"],
            scopes=OUTLOOK_SCOPES,
        )
        if "error" in result:
            raise OutlookNotConnectedException(
                f"Impossible de rafraîchir le token : {result.get('error_description')}"
            )
        update = {
            "access_token":  result["access_token"],
            "refresh_token": result.get("refresh_token", doc["refresh_token"]),
            "expires_at":    datetime.utcnow() + timedelta(seconds=result.get("expires_in", 3600)),
            "updated_at":    datetime.utcnow(),
        }
        self.token_collection.update_one({"_id": doc["_id"]}, {"$set": update})
        doc.update(update)
        return doc

    def get_access_token(self, user_id: int) -> str:
        """
        Retourne un access token valide pour user_id.
        Rafraîchit automatiquement si expiré.
        Lève OutlookNotConnectedException si non connecté.
        """
        doc = self.token_collection.find_one({"user_id": user_id})
        if not doc or not doc.get("access_token"):
            raise OutlookNotConnectedException(
                f"Outlook non connecté pour user_id={user_id}. "
                "Lancez le flux OAuth2 via /mail/start/"
            )

        # Vérifier expiration (marge de 5 minutes)
        expires_at = doc.get("expires_at")
        if expires_at:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at < datetime.utcnow() + timedelta(minutes=5):
                if doc.get("refresh_token"):
                    doc = self._refresh_token(doc)
                else:
                    raise OutlookNotConnectedException(
                        "Token expiré et aucun refresh token disponible."
                    )

        return doc["access_token"]

    def is_connected(self, user_id: int) -> bool:
        doc = self.token_collection.find_one({"user_id": user_id})
        return bool(doc and doc.get("connected"))

    def get_connection_status(self, user_id: int) -> Dict:
        doc = self.token_collection.find_one({"user_id": user_id})
        if not doc or not doc.get("connected"):
            return {"connected": False, "email": None, "is_valid": False}

        expires_at = doc.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        is_valid = expires_at > datetime.utcnow() if expires_at else False

        return {
            "connected":           True,
            "email":               doc.get("outlook_email"),
            "is_valid":            is_valid,
            "subscription_active": doc.get("subscription_active", False),
        }

    # =========================================================
    # GRAPH API — requêtes génériques
    # =========================================================

    def make_outlook_request(
        self,
        user_id: int,
        endpoint: str,
        method: str = "GET",
        data: Optional[Dict] = None,
    ) -> Dict:
        """Effectue une requête Microsoft Graph pour user_id."""
        token = self.get_access_token(user_id)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/json",
        }
        url = f"{GRAPH_ENDPOINT}{endpoint}"

        if method == "GET":
            r = requests.get(url, headers=headers)
        elif method == "POST":
            r = requests.post(url, headers=headers, json=data)
        elif method == "DELETE":
            r = requests.delete(url, headers=headers)
            r.raise_for_status()
            return {}
        else:
            raise ValueError(f"Méthode HTTP non supportée : {method}")

        # Retry avec refresh si 401
        if r.status_code == 401:
            doc = self.token_collection.find_one({"user_id": user_id})
            if doc and doc.get("refresh_token"):
                doc   = self._refresh_token(doc)
                token = doc["access_token"]
                headers["Authorization"] = f"Bearer {token}"
                r = (
                    requests.get(url, headers=headers)
                    if method == "GET"
                    else requests.post(url, headers=headers, json=data)
                )

        r.raise_for_status()
        return r.json()

    # =========================================================
    # MESSAGES
    # =========================================================

    def list_messages(self, user_id: int, top: int = 100) -> Dict:
        from datetime import datetime, timedelta
        since = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
        return self.make_outlook_request(
            user_id,
            f"/me/mailFolders/inbox/messages"
            f"?$top={top}"
            f"&$orderby=receivedDateTime desc"
            f"&$filter=receivedDateTime ge {since}"
            f"&$select=id,subject,receivedDateTime,sender,hasAttachments",
        )

    def get_message(self, user_id: int, message_id: str) -> Dict:
        return self.make_outlook_request(
            user_id, f"/me/messages/{message_id}?$expand=attachments"
        )

    # =========================================================
    # PIÈCES JOINTES
    # =========================================================

    def extract_attachments(self, user_id: int, message_id: str) -> List[Dict]:
        data = self.make_outlook_request(
            user_id, f"/me/messages/{message_id}/attachments"
        )
        return [
            {
                "attachment_id": a["id"],
                "filename":      a["name"],
                "content_type":  a["contentType"],
                "size":          a["size"],
            }
            for a in data.get("value", [])
            if a.get("@odata.type") == "#microsoft.graph.fileAttachment"
        ]

    def download_attachment(
        self, user_id: int, message_id: str, attachment_id: str
    ) -> bytes:
        token = self.get_access_token(user_id)
        r = requests.get(
            f"{GRAPH_ENDPOINT}/me/messages/{message_id}/attachments/{attachment_id}/$value",
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        return r.content

    # =========================================================
    # EXTRACTION & SAUVEGARDE
    # =========================================================

    def extract_mail_data(
        self, user_id: int, message: Dict, bot_id: int, has_attachments: bool
    ) -> Dict:
        return {
            "filtered_emails_id": get_next_sequence_value("filtered_emails_id"),
            "provider":           "outlook",
            "bot_id":             bot_id,
            "user_id":            user_id,
            "outlook_message_id": message["id"],
            "subject":            message.get("subject"),
            "from":               message.get("sender", {}).get("emailAddress", {}).get("address"),
            "received_at":        message.get("receivedDateTime"),
            "has_attachment":     has_attachments,
            "created_at":         datetime.utcnow(),
        }

    # Alias pour compatibilité avec tasks.py (IMAP)
    def extract_email_data(self, mongo_message: Dict, user_id: int, bot_id: int) -> Dict:
        """Alias pour les messages IMAP stockés en MongoDB."""
        imap_uid = mongo_message.get("imap_uid", "")
        return {
            "filtered_emails_id": get_next_sequence_value("filtered_emails_id"),
            "provider":           "outlook_imap",
            "bot_id":             bot_id,
            "user_id":            user_id,
            "imap_uid":           imap_uid,
            # Valeur unique par (bot, email) pour satisfaire l'index unique gmail_message_id
            "gmail_message_id":   f"bot{bot_id}_{imap_uid}",
            "subject":            mongo_message.get("subject"),
            "from_email":         mongo_message.get("from_email"),
            "from":               mongo_message.get("from_email"),
            "received_at":        mongo_message.get("date"),
            "date":               mongo_message.get("date"),
            "has_attachment":     mongo_message.get("has_attachment", False),
            "body_text":          (mongo_message.get("body_text") or "")[:500],
            "created_at":         datetime.utcnow(),
        }

    def save_email_and_attachments(
        self,
        user_id: int,
        message: Dict,
        email_data: Optional[Dict] = None,
        message_id: Optional[str] = None,
        mail_extracted: Optional[Dict] = None,
        attachments: Optional[List[Dict]] = None,
    ) -> bool:
        """
        Sauvegarde un email filtré et ses pièces jointes.
        Supporte les deux modes : Graph API (message_id) et IMAP (mongo_message dict).
        """
        try:
            doc = email_data or mail_extracted
            if doc:
                self.filtered_emails.insert_one(doc)

            # Pièces jointes pour le mode Graph API
            if message_id and attachments:
                for att in attachments:
                    content = self.download_attachment(user_id, message_id, att["attachment_id"])
                    path = os.path.join(
                        settings.BASE_MEDIA_PATH, f"user_{user_id}", message_id
                    )
                    os.makedirs(path, exist_ok=True)
                    file_path = os.path.join(path, att["filename"])
                    with open(file_path, "wb") as f:
                        f.write(content)
                    self.attachments_col.insert_one({
                        "user_id":            user_id,
                        "outlook_message_id": message_id,
                        "filename":           att["filename"],
                        "path":               file_path,
                        "size":               att["size"],
                        "created_at":         datetime.utcnow(),
                    })
            return True

        except DuplicateKeyError:
            return True
        except Exception as exc:
            logger.error("save_email_and_attachments : %s", exc)
            return False

    # =========================================================
    # EMAILS FILTRÉS — lecture depuis MongoDB
    # =========================================================

    def get_mails_by_user(
        self,
        user_id: int,
        provider: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict:
        """Retourne les emails filtrés d'un utilisateur avec pagination."""
        query: Dict = {"user_id": user_id}
        if provider:
            query["provider"] = provider

        total = self.filtered_emails.count_documents(query)
        skip  = (page - 1) * page_size
        docs  = list(
            self.filtered_emails.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(page_size)
        )

        # Sérialiser les ObjectId MongoDB
        from imap_data_extractor_api.utils import serialize_mongo_doc
        results = [serialize_mongo_doc(d) for d in docs]

        return {
            "count":     total,
            "page":      page,
            "page_size": page_size,
            "results":   results,
        }

    def get_mail_id(self, email_id: str) -> Optional[Dict]:
        """Retourne un email filtré par son filtered_emails_id."""
        from imap_data_extractor_api.utils import serialize_mongo_doc
        doc = self.filtered_emails.find_one({"filtered_emails_id": int(email_id)})
        return serialize_mongo_doc(doc) if doc else None

    # =========================================================
    # UTILITAIRES
    # =========================================================

    def sort_rules_by_indexed_priority(self, rules, indexed_map):
        """Trie les règles du bot : les règles indexées en premier."""
        def priority(rule):
            return 0 if indexed_map.get(int(rule["field_id"]), False) else 1
        return {
            "result": sorted(rules, key=priority),
            "true":   sum(priority(r) == 0 for r in rules),
            "false":  sum(priority(r) == 1 for r in rules),
        }


# instance globale
outlook_service = OutlookService()