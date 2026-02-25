"""
mail_integration/views_account.py

API pour configurer et tester le compte mail Outlook (IMAP/SMTP)
de l'utilisateur connecté via LDAP.

Endpoints :
  GET  /outlook/account/          → récupérer la config actuelle
  POST /outlook/account/          → sauvegarder la config
  POST /outlook/account/test/     → tester la connexion IMAP
  DELETE /outlook/account/        → supprimer la config
"""

import logging
from datetime import datetime

from rest_framework.viewsets import ViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from configurations.services import mongo_service
from authentication.authentication import CustomJWTAuthentication
from .imap_service import m365_imap_service

logger = logging.getLogger(__name__)

# Collection MongoDB pour les comptes mail des utilisateurs
COLLECTION_NAME = "outlook_connections"


def _humanize_imap_error(raw: str, email: str = "") -> str:
    """
    Traduit les erreurs IMAP brutes Exchange Online en messages lisibles.
    """
    if not raw:
        return "Connexion IMAP échouée. Vérifiez vos identifiants."

    r = raw.lower()

    if "login failed" in r or "authentication failed" in r or "invalid credentials" in r:
        return (
            f"Échec de l'authentification pour {email}. "
            "Causes possibles : "
            "(1) IMAP non activé sur ce compte — contactez votre admin Exchange ; "
            "(2) Authentification basique désactivée sur votre tenant M365 → utilisez un App Password ; "
            "(3) Mot de passe incorrect."
        )

    if "too many" in r or "rate" in r or "throttl" in r:
        return "Trop de tentatives de connexion. Patientez quelques minutes avant de réessayer."

    if "timed out" in r or "timeout" in r or ("connect" in r and "failed" in r):
        return (
            "Impossible de joindre le serveur IMAP (outlook.office365.com:993). "
            "Vérifiez votre connexion réseau ou les règles de pare-feu."
        )

    if "certificate" in r or ("ssl" in r and "error" in r) or "tls" in r:
        return "Erreur SSL/TLS. Vérifiez que l'option SSL est activée et que le port est bien 993."

    if "disabled" in r or "not enabled" in r:
        return (
            f"L'accès IMAP est désactivé pour {email}. "
            "Demandez à votre administrateur d'exécuter : "
            f"Set-CASMailbox -Identity \"{email}\" -IMAPEnabled $true"
        )

    # Fallback : nettoyer le message brut Python (b'...')
    clean = raw.strip().lstrip("b'\"").rstrip("'\"")
    return f"Erreur IMAP : {clean}"


class OutlookAccountViewSet(ViewSet):
    """
    Gestion du compte mail Outlook (IMAP/SMTP) de l'utilisateur connecté.
    Les credentials sont chiffrés côté MongoDB — seul le mot de passe est masqué
    dans les réponses GET.
    """

    authentication_classes = [CustomJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_collection(self):
        return mongo_service.get_collection(COLLECTION_NAME)

    def _user_id(self, request):
        """Retourne l'identifiant unique de l'utilisateur LDAP."""
        return str(request.user.uid_number)

    # ── GET /outlook/account/ ────────────────────────────────────────────────
    def list(self, request):
        """Retourne la configuration du compte mail de l'utilisateur (sans le mot de passe)."""
        try:
            col = self._get_collection()
            doc = col.find_one({"user_id": self._user_id(request)}, {"_id": 0})

            if not doc:
                return Response(
                    {"configured": False, "message": "Aucune configuration trouvée."},
                    status=status.HTTP_200_OK,
                )

            # Masquer le mot de passe
            safe_doc = {**doc}
            if safe_doc.get("imap_password"):
                safe_doc["imap_password"] = "••••••••"
            if safe_doc.get("smtp_password"):
                safe_doc["smtp_password"] = "••••••••"

            safe_doc["configured"] = True
            return Response(safe_doc, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception("Erreur GET compte Outlook")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ── POST /outlook/account/ ───────────────────────────────────────────────
    def create(self, request):
        """
        Sauvegarde la configuration du compte mail Outlook.
        Body attendu :
          {
            "imap_host":     "outlook.office365.com",
            "imap_port":     993,
            "imap_user":     "user@company.com",
            "imap_password": "...",
            "smtp_host":     "smtp.office365.com",    (optionnel)
            "smtp_port":     587,                     (optionnel)
            "smtp_user":     "user@company.com",      (optionnel)
            "smtp_password": "...",                   (optionnel)
            "use_ssl":       true
          }
        """
        try:
            data = request.data

            # Champs IMAP obligatoires
            required = ["imap_host", "imap_port", "imap_user", "imap_password"]
            missing = [f for f in required if not data.get(f)]
            if missing:
                return Response(
                    {"error": f"Champs obligatoires manquants : {', '.join(missing)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            col = self._get_collection()
            user_id = self._user_id(request)

            # Récupérer le doc existant pour ne pas écraser le mot de passe si non fourni
            existing = col.find_one({"user_id": user_id}) or {}

            imap_password = data.get("imap_password")
            smtp_password = data.get("smtp_password")

            # Si le mot de passe est le placeholder masqué → garder l'ancien
            if imap_password in ("••••••••", "", None):
                imap_password = existing.get("imap_password", "")
            if smtp_password in ("••••••••", "", None):
                smtp_password = existing.get("smtp_password", "")

            doc = {
                "user_id":       user_id,
                "imap_host":     data.get("imap_host", "outlook.office365.com"),
                "imap_port":     int(data.get("imap_port", 993)),
                "imap_user":     data.get("imap_user", ""),
                "imap_password": imap_password,
                "smtp_host":     data.get("smtp_host", "smtp.office365.com"),
                "smtp_port":     int(data.get("smtp_port", 587)),
                "smtp_user":     data.get("smtp_user", data.get("imap_user", "")),
                "smtp_password": smtp_password,
                "use_ssl":       bool(data.get("use_ssl", True)),
                "configured":    True,
                "updated_at":    datetime.utcnow(),
            }

            col.update_one(
                {"user_id": user_id},
                {"$set": doc},
                upsert=True,
            )

            # Retourner sans les mots de passe
            safe = {k: v for k, v in doc.items() if "password" not in k}
            safe["imap_password"] = "••••••••"
            safe["smtp_password"] = "••••••••" if smtp_password else ""
            safe["configured"] = True

            return Response(safe, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception("Erreur POST compte Outlook")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ── POST /outlook/account/test/ ──────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="test")
    def test_connection(self, request):
        """
        Teste la connexion IMAP avec les credentials fournis OU ceux déjà stockés en MongoDB.

        Règles de résolution du mot de passe (par priorité) :
          1. Mot de passe fourni dans le body ET non masqué  → on l'utilise directement
          2. Mot de passe absent / masqué                    → on récupère celui stocké en MongoDB
          3. Rien du tout                                    → 400

        Le résultat (succès ou échec IMAP) est toujours retourné en HTTP 200
        avec { success: bool, message: str } pour que le frontend puisse
        l'afficher sans traiter une exception réseau.
        """
        try:
            col = self._get_collection()
            user_id = self._user_id(request)
            existing = col.find_one({"user_id": user_id}) or {}

            # ── Résoudre imap_user ────────────────────────────────────────────
            imap_user = (request.data.get("imap_user") or "").strip() or existing.get("imap_user", "")

            # ── Résoudre imap_password ────────────────────────────────────────
            raw_password = request.data.get("imap_password", "")

            # Détecter le placeholder masqué (bullet U+2022 ou caractère ASCII •)
            # quelle que soit l'encodage envoyé par le frontend
            is_placeholder = (
                not raw_password
                or raw_password.strip("•").strip("*") == ""
                or raw_password in ("••••••••", "********")
            )

            if is_placeholder:
                # Fallback sur le mot de passe stocké en base
                imap_password = existing.get("imap_password", "")
                logger.debug("test_connection: utilisation du mot de passe stocké pour user_id=%s", user_id)
            else:
                imap_password = raw_password
                logger.debug("test_connection: utilisation du mot de passe fourni pour user_id=%s", user_id)

            # ── Validation minimale ───────────────────────────────────────────
            if not imap_user:
                return Response(
                    {"success": False, "message": "Adresse email manquante. Veuillez d'abord configurer votre compte."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not imap_password:
                return Response(
                    {"success": False, "message": "Mot de passe manquant. Saisissez-le ou sauvegardez d'abord la configuration."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ── Test de connexion IMAP ────────────────────────────────────────
            logger.info("test_connection: test IMAP pour %s (user_id=%s)", imap_user, user_id)
            success, error_msg = m365_imap_service.test_credentials(imap_user, imap_password)

            # Mise à jour du statut en base (sans bloquer la réponse)
            try:
                col.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "last_tested_at": datetime.utcnow(),
                        "connection_ok": success,
                    }},
                )
            except Exception as db_err:
                logger.warning("test_connection: impossible de mettre à jour le statut en base : %s", db_err)

            # Toujours HTTP 200 — le résultat est dans le body
            if success:
                return Response(
                    {"success": True, "message": f"Connexion IMAP réussie pour {imap_user}"},
                    status=status.HTTP_200_OK,
                )
            else:
                human_message = _humanize_imap_error(error_msg, imap_user)
                return Response(
                    {"success": False, "message": human_message, "raw_error": error_msg},
                    status=status.HTTP_200_OK,
                )

        except Exception as e:
            logger.exception("Erreur inattendue lors du test de connexion IMAP")
            return Response(
                {"success": False, "message": f"Erreur serveur : {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ── DELETE /outlook/account/ ─────────────────────────────────────────────
    def destroy(self, request, pk=None):
        """Supprime la configuration du compte mail."""
        try:
            col = self._get_collection()
            result = col.delete_one({"user_id": self._user_id(request)})
            if result.deleted_count:
                return Response({"message": "Configuration supprimée."}, status=status.HTTP_200_OK)
            return Response({"message": "Aucune configuration à supprimer."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Erreur DELETE compte Outlook")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)