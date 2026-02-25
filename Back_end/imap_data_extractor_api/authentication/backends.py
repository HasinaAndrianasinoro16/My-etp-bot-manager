"""
authentication/backends.py

Backend LDAP pur — authentifie le user, synchronise le LDAPUser Django.
La connexion Outlook n'est plus déclenchée ici (Option C) :
le mot de passe est demandé au user uniquement au moment d'activer un bot.
"""

import logging
from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model
from .services.ldap_service import LDAPService

logger = logging.getLogger(__name__)
User = get_user_model()


class LDAPAuthenticationBackend(BaseBackend):

    def authenticate(self, request, username=None, email=None, password=None, **kwargs):

        login_value = email or username
        if not login_value or not password:
            return None

        # ── 1. Authentification LDAP ──────────────────────────────────────────
        ldap_service   = LDAPService()
        ldap_user_info = ldap_service.authenticate_user(login_value, password)

        if not ldap_user_info:
            logger.warning("LDAP auth failed: %s", login_value)
            return None

        # ── 2. Synchronisation du LDAPUser Django ─────────────────────────────
        try:
            user_data = {
                "username":   ldap_user_info.get("username"),
                "email":      ldap_user_info.get("email", ""),
                "first_name": ldap_user_info.get("first_name", ""),
                "last_name":  ldap_user_info.get("last_name", ""),
                "full_name":  ldap_user_info.get("full_name", ""),
                "uid_number": ldap_user_info.get("uidNumber", ""),
            }

            if hasattr(User, "ldap_dn"):
                user_data["ldap_dn"] = ldap_user_info.get("dn", "")

            if hasattr(User, "ldap_role"):
                user_data["ldap_role"] = ldap_user_info.get("role", "")

            user, created = User.objects.get_or_create(
                uid_number=user_data["uid_number"],
                defaults=user_data,
            )

            if not created:
                for k, v in user_data.items():
                    setattr(user, k, v)
                user.save()

            logger.info(
                "Login LDAP réussi : %s (created=%s)", user_data["username"], created
            )
            return user

        except Exception as exc:
            logger.error("User sync error: %s", exc)
            return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
