from django.shortcuts import render, redirect
import logging
from rest_framework import viewsets, status
from .serializer import MailSerializer
from .services import mail_service
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny

from imap_data_extractor_api.utils import get_next_sequence_value, serialize_mongo_doc
from bots.permissions import IsBot
from bots.authentication import BotJWTAuthentication
from authentication.authentication import CustomJWTAuthentication
from configurations.services import mongo_service
from authentication.permissions import IsAdmin
from rest_framework.decorators import action
from .serializer import EmailFilterSerializer, EmailListSerializer
from mail_integration.services import outlook_service

logger = logging.getLogger(__name__)


# ========================= CALLBACK OUTLOOK (hors ViewSet) =========================
@api_view(['GET'])
@permission_classes([AllowAny])
def outlook_callback(request):
    """
    GET /mail/callback/
    Microsoft redirige ici après le consentement OAuth2.
    Pas de JWT requis — AllowAny.
    """
    try:
        code  = request.query_params.get('code')
        state = request.query_params.get('state', '')  # format: "user_11001"
        error = request.query_params.get('error')

        if error:
            logger.error("Erreur OAuth2 Microsoft: %s", error)
            return redirect(f"http://localhost:3000?outlook_error={error}")

        if not code:
            return Response({"error": "Code OAuth2 manquant"}, status=status.HTTP_400_BAD_REQUEST)

        # Extraire user_id depuis le state
        user_id = None
        if state.startswith("user_"):
            try:
                user_id = int(state.replace("user_", ""))
            except ValueError:
                logger.warning("State invalide: %s", state)

        if not user_id:
            return Response({"error": "user_id introuvable dans le state"}, status=status.HTTP_400_BAD_REQUEST)

        # Échanger le code contre les tokens
        tokens = outlook_service.exchange_code_for_token(code, state)

        # Récupérer l'email Outlook de l'utilisateur
        import requests as http_requests
        graph_response = http_requests.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        outlook_email = None
        if graph_response.status_code == 200:
            outlook_email = graph_response.json().get("mail") or graph_response.json().get("userPrincipalName")

        # Sauvegarder le token en MongoDB
        from datetime import datetime
        outlook_service.token_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id":       user_id,
                "outlook_email": outlook_email,
                "access_token":  tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "expires_at":    tokens["expires_at"],
                "connected":     True,
                "updated_at":    datetime.utcnow(),
            }},
            upsert=True
        )

        logger.info("Outlook connecté pour user_id=%s (%s)", user_id, outlook_email)

        # Rediriger vers le frontend
        return redirect(f"http://localhost:3000?outlook_connected=true&email={outlook_email}")

    except Exception as e:
        logger.exception("Erreur callback OAuth2 Outlook")
        return redirect(f"http://localhost:3000?outlook_error={str(e)}")


class MailViewSet(viewsets.ViewSet):
    """ViewSet Crud des email avec pymongo"""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.collection = mongo_service.get_collection('filtered_emails')

    def _is_start_action(self):
        return self.request.path.rstrip('/').endswith('/start')

    def _is_status_action(self):
        return self.request.path.rstrip('/').endswith('/status')

    def _is_disconnect_action(self):
        return self.request.path.rstrip('/').endswith('/disconnect')

    def get_permissions(self):
        if self._is_start_action() or self._is_status_action() or self._is_disconnect_action():
            return [IsAuthenticated()]
        if self.request.method == 'GET':
            return [IsAdmin()]
        elif self.request.method == 'POST':
            return [IsBot()]
        return [IsAuthenticated()]

    def get_authenticators(self):
        if self._is_start_action() or self._is_status_action() or self._is_disconnect_action():
            return [CustomJWTAuthentication()]
        if self.request.method == 'GET':
            return [CustomJWTAuthentication()]
        elif self.request.method == 'POST':
            return [BotJWTAuthentication()]
        return [CustomJWTAuthentication()]

    # ========================= START OUTLOOK AUTH =========================
    @action(detail=False, methods=['get'], url_path='start')
    def start(self, request):
        """GET /mail/start/ — Lance le flux OAuth2 Outlook"""
        try:
            user_id = request.user.uid_number
            if not user_id:
                return Response({"error": "user_id introuvable dans le token"}, status=status.HTTP_400_BAD_REQUEST)
            auth_url = outlook_service.get_outlook_auth_url(user_id)
            return Response({'auth_url': auth_url}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Erreur lors du démarrage OAuth Outlook")
            return Response({'error': f'Erreur: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ========================= STATUS OUTLOOK =========================
    @action(detail=False, methods=['get'], url_path='status')
    def outlook_status(self, request):
        """GET /mail/status/ — Statut connexion Outlook"""
        try:
            user_id = request.user.uid_number
            result = outlook_service.get_connection_status(user_id)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Erreur lors de la récupération du statut Outlook")
            return Response({'error': f'Erreur: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ========================= DISCONNECT OUTLOOK =========================
    @action(detail=False, methods=['post'], url_path='disconnect')
    def disconnect(self, request):
        """POST /mail/disconnect/ — Déconnecte Outlook"""
        try:
            user_id = request.user.uid_number
            outlook_service.token_collection.update_one(
                {"user_id": user_id},
                {"$set": {"connected": False}}
            )
            return Response({"message": "Déconnecté avec succès"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Erreur lors de la déconnexion Outlook")
            return Response({'error': f'Erreur: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ========================= LIST EMAILS =========================
    def list(self, request):
        """GET /mail/"""
        try:
            ESSENTIAL_FIELDS = {
                "_id": 0,
                "gmail_message_id": 1,
                "subject": 1,
                "from": 1,
                "received_at": 1,
                "date": 1,
                "has_attachment": 1
            }
            page = max(1, int(request.query_params.get('page', 1)))
            page_size = max(1, min(100, int(request.query_params.get('page_size', 10))))
            skip = (page - 1) * page_size

            serializer = EmailFilterSerializer(data=request.query_params)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            filter_data = serializer.validated_data
            filter_data = {k: v for k, v in filter_data.items() if v is not None}

            total = self.collection.count_documents(filter_data)
            emails = list(
                self.collection
                    .find(filter_data, ESSENTIAL_FIELDS)
                    .skip(skip)
                    .limit(page_size)
            )
            emails_data = [serialize_mongo_doc(email) for email in emails]

            return Response({
                'count': total,
                'page': page,
                'page_size': page_size,
                'results': emails_data
            })
        except Exception as e:
            return Response(
                {'error': f'Erreur lors de la recuperation des email: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ========================= RETRIEVE EMAIL =========================
    def retrieve(self, request, pk=None):
        """GET /mail/{id}/"""
        try:
            if not pk:
                return Response(
                    {"detail": "L'identifiant de l'email est requis."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            data = mail_service.get_mail_id(pk)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": f"Erreur lors de la récupération de l'email: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )