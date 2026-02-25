"""
bots/views_activate.py

Vue d'activation d'un bot (Option C : mot de passe saisi à l'activation).

Endpoint : POST /bots/{bot_id}/activate/

Headers requis :
    Authorization: Bearer <jwt_token_utilisateur>

Body JSON :
    { "password": "motDePasseLDAP" }

Réponses :
    200  { "success": true, "task_id": 42 }
    400  { "error": "...", "code": "INVALID_CREDENTIALS" | "IMAP_CONNECTION_ERROR" | ... }
    403  { "error": "Vous n'êtes pas propriétaire de ce bot." }
    404  { "error": "Bot introuvable." }
"""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .service import bot_service
from .serializers_activate import BotActivateSerializer

logger = logging.getLogger(__name__)


class BotActivateView(APIView):
    """
    Active un bot en testant la connexion IMAP avec les credentials du user.
    Le mot de passe n'est jamais persisté — il sert uniquement à ouvrir
    la session IMAP qui reste en mémoire le temps de vie du thread bot.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, bot_id: int):

        # ── 1. Valider le body ────────────────────────────────────────────────
        serializer = BotActivateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        password = serializer.validated_data["password"]

        # ── 2. Récupérer l'identité depuis le JWT ────────────────────────────
        # CustomJWTAuthentication place un SimpleNamespace dans request.user
        user    = request.user
        user_id = getattr(user, "uid_number", None)
        email   = getattr(user, "email", None)
        role    = getattr(user, "ldap_role", "user")

        if not email:
            return Response(
                {"error": "Email introuvable dans le token JWT."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 3. Vérifier la propriété du bot ──────────────────────────────────
        if not bot_service.is_bot_owner(bot_id, user_id, role):
            return Response(
                {"error": "Vous n'êtes pas propriétaire de ce bot."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── 4. Activer le bot (test IMAP + démarrage thread) ─────────────────
        logger.info(
            "Activation bot_id=%s par user=%s (email=%s)", bot_id, user_id, email
        )
        result = bot_service.activate_bot(
            bot_id=bot_id,
            user_email=email,
            password=password,
        )

        # ── 5. Réponse ────────────────────────────────────────────────────────
        if "error" in result:
            code = result.get("code", "UNKNOWN_ERROR")

            # Distinguer erreur credentials (400) vs erreur réseau (503)
            if code == "INVALID_CREDENTIALS":
                http_status = status.HTTP_400_BAD_REQUEST
            elif code in ("IMAP_CONNECTION_ERROR", "IMAP_SESSION_ERROR"):
                http_status = status.HTTP_503_SERVICE_UNAVAILABLE
            elif code == "BOT_NOT_FOUND":
                http_status = status.HTTP_404_NOT_FOUND
            else:
                http_status = status.HTTP_400_BAD_REQUEST

            return Response(result, status=http_status)

        return Response(result, status=status.HTTP_200_OK)
