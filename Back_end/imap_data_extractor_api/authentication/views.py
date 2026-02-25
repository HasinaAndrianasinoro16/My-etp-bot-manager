"""
authentication/views.py
"""

import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, UserSerializer
from mail_integration.services import OutlookService, OutlookNotConnectedException

logger = logging.getLogger(__name__)
outlook_service = OutlookService()


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data['email']
    password = serializer.validated_data['password']

    # ── 1. Authentification LDAP ──────────────────────────────────────────────
    user = authenticate(request, email=email, password=password)

    if not user:
        logger.warning("Échec authentification LDAP pour: %s", email)
        return Response(
            {"success": False, "message": "Identifiants incorrects ou compte LDAP introuvable"},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # ── 2. Ouvrir la session Django ───────────────────────────────────────────
    login(request, user)
    logger.info("Session ouverte pour: %s (uid_number=%s)", user.username, user.uid_number)

    # ── 3. Générer les tokens JWT + ajouter les champs personnalisés ──────────
    refresh = RefreshToken.for_user(user)

    # ✅ CORRECTION : enrichir le token avec les infos utilisateur
    refresh['uid_number'] = user.uid_number
    refresh['email']      = user.email
    refresh['username']   = user.username
    refresh['ldap_dn']    = user.ldap_dn if hasattr(user, 'ldap_dn') else ''
    refresh['role']       = user.ldap_role if hasattr(user, 'ldap_role') else 'user'

    # Idem pour l'access token
    access = refresh.access_token
    access['uid_number'] = user.uid_number
    access['email']      = user.email
    access['username']   = user.username
    access['ldap_dn']    = user.ldap_dn if hasattr(user, 'ldap_dn') else ''
    access['role']       = user.ldap_role if hasattr(user, 'ldap_role') else 'user'

    # ── 4. Vérifier l'état de la connexion Outlook (non bloquant) ─────────────
    outlook_status = _get_outlook_status(user)

    return Response({
        "success":    True,
        "user":       UserSerializer(user).data,
        "access":     str(access),
        "refresh":    str(refresh),
        "token_type": "Bearer",
        "outlook":    outlook_status,
    }, status=status.HTTP_200_OK)


def _get_outlook_status(user) -> dict:
    try:
        conn_status = outlook_service.get_connection_status(user.uid_number)
        return {
            "connected":           conn_status.get("connected", False),
            "email":               conn_status.get("email"),
            "is_valid":            conn_status.get("is_valid", False),
            "subscription_active": conn_status.get("subscription_active", False),
        }
    except Exception as e:
        logger.warning("Impossible de vérifier le statut Outlook pour user_id=%s: %s",
                       user.uid_number, e)
        return {
            "connected":           False,
            "email":               None,
            "is_valid":            False,
            "subscription_active": False,
            "hint":                "Connectez votre boîte Outlook via /mail/start/"
        }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    user_id = request.user.uid_number
    logout(request)
    logger.info("Déconnexion user_id=%s", user_id)
    return Response({"success": True, "message": "Déconnexion réussie"})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user
    outlook_status = _get_outlook_status(user)
    return Response({
        "user":    UserSerializer(user).data,
        "outlook": outlook_status,
    })