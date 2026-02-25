from django.shortcuts import render
from rest_framework.viewsets import ViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .services import outlook_service 
from django.http import HttpResponseRedirect, HttpResponse
from configurations.services import mongo_service
from datetime import datetime, timedelta
import json
import base64
import logging
from .tasks import get_attachments_from_message
from .services import outlook_service

logger = logging.getLogger(__name__)

# Create your views here.
class MailIntegrationView(ViewSet):  
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.outlook_collection = mongo_service.get_collection("outlook_token")
        self.bots_collection    = mongo_service.get_collection("bot")

    def list(self, request):
        """
        GET /mail/?page=1&page_size=20
        Retourne les emails filtres de l'utilisateur connecte.
        """
        try:
            user_id   = request.user.uid_number
            page      = int(request.GET.get("page", 1))
            page_size = int(request.GET.get("page_size", 20))
            provider  = request.GET.get("provider", None)

            result = outlook_service.get_mails_by_user(
                user_id=user_id,
                provider=provider,
                page=page,
                page_size=page_size,
            )
            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Erreur liste emails : {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def retrieve(self, request, pk=None):
        """
        GET /mail/{id}/
        Retourne un email filtre par son id.
        """
        try:
            result = outlook_service.get_mail_id(pk)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Erreur recuperation email {pk} : {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=["POST"], url_path="webhook", permission_classes=[AllowAny]) 
    def outlook_webhook(self, request):  # Renommé de gmail_webhook
        """
        Reçoit les notifications webhook Microsoft Graph et traite les nouveaux mails
        """
        try: 
            # Vérification de la validation de l'abonnement
            validation_token = request.GET.get('validationToken')
            if validation_token:
                # Microsoft Graph vérifie l'URL webhook lors de la création
                return HttpResponse(validation_token, content_type='text/plain')
            
            # Traitement des notifications
            body = request.data
            logger.info(f"Notification reçue de Outlook: {body}")
            
            # Les notifications Outlook ont un format différent de Gmail
            notifications = body.get('value', [])
            
            if not notifications:
                return HttpResponse(status=204)
            
            for notification in notifications:
                try:
                    # Récupérer les informations de la notification
                    subscription_id = notification.get('subscriptionId')
                    change_type = notification.get('changeType')
                    resource = notification.get('resource')
                    
                    logger.info(f"Notification - Subscription: {subscription_id}, Type: {change_type}, Resource: {resource}")
                    
                    # Vérifier le type de changement
                    if change_type != 'created':
                        continue  # Nous ne nous intéressons qu'aux nouveaux emails
                    
                    # Extraire l'ID du message
                    if resource and 'messages' in resource:
                        # L'URL du message est dans resourceData
                        resource_data = notification.get('resourceData', {})
                        if resource_data.get('@odata.type') == '#Microsoft.Graph.Message':
                            message_id = resource_data.get('id')
                            
                            # Chercher l'utilisateur associé à cette subscription
                            user_doc = self.outlook_collection.find_one({
                                "subscription_id": subscription_id
                            })
                            
                            if user_doc:
                                user_id = user_doc.get("user_id")
                                logger.info(f"Traitement du message {message_id} pour l'utilisateur {user_id}")
                                
                                # Lancer le traitement asynchrone
                                get_attachments_from_message.delay(user_id=user_id, message_id=message_id)
                            else:
                                logger.warning(f"Aucun utilisateur trouvé pour la subscription {subscription_id}")
                    
                except Exception as e:
                    logger.error(f"Erreur lors du traitement d'une notification: {str(e)}")
                    continue
            
            # Retourner 202 Accepted pour confirmer la réception
            return HttpResponse(status=202)
            
        except Exception as e:
            logger.error(f"Erreur webhook Outlook: {str(e)}")
            return HttpResponse(status=202)  # Accepter quand même pour éviter les retries
        
    @action(detail=False, methods=['get'], url_path='start', permission_classes=[IsAuthenticated])
    def start_outlook_auth(self, request):  # Renommé de start_gmail_auth
        """
        Génère l'URL OAuth Outlook et renvoie au front-end
        """
        try:
            user_id = request.user.uid_number
            if not user_id:
                return Response({"error": "Utilisateur non authentifié"}, status=status.HTTP_401_UNAUTHORIZED)
            
            auth_url = outlook_service.get_outlook_auth_url(user_id)
            request.session['outlook_oauth_state'] = f"user_{user_id}"
            return Response({"auth_url": auth_url}, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Erreur lors de la génération de l'URL OAuth Outlook: {str(e)}")
            return Response(
                {"error": f"Erreur lors de la génération de l'URL OAuth: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    @action(detail=False, methods=['get'], url_path='callback', permission_classes=[AllowAny])
    def outlook_callback(self, request):  # Renommé de gmail_callback
        """
        Récupère le code OAuth et stocke les tokens dans MongoDB
        """
        try:
            code = request.GET.get('code')
            state = request.GET.get('state')
            error = request.GET.get('error')
            
            if error:
                error_description = request.GET.get('error_description', 'Erreur inconnue')
                logger.error(f"Erreur d'authentification Outlook: {error} - {error_description}")
                return HttpResponseRedirect("http://localhost:3000/outlook-error?msg=auth_failed")
            
            if not code:
                logger.error("Code OAuth manquant dans le callback")
                return HttpResponseRedirect("http://localhost:3000/outlook-error?msg=no_code")
            
            # Extraire l'user_id du state
            user_id = None
            if state and state.startswith("user_"):
                try:
                    user_id = int(state.split("_")[1])
                except ValueError:
                    logger.error(f"Format de state invalide: {state}")
            else:
                # Si pas de state, on peut essayer de récupérer depuis la session
                user_id = request.session.get('outlook_oauth_user_id')
            
            if not user_id:
                logger.error("Impossible de déterminer l'utilisateur")
                return HttpResponseRedirect("http://localhost:3000/outlook-error?msg=invalid_user")
            
            # Échanger le code contre les tokens
            tokens = outlook_service.exchange_code_for_token(code, state)
            
            # Stocker les tokens dans MongoDB
            self.outlook_collection.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "user_id": user_id,
                        "access_token": tokens["access_token"],
                        "refresh_token": tokens["refresh_token"],
                        "id_token": tokens.get("id_token"),
                        "expires_at": tokens["expires_at"],
                        "scope": tokens.get("scope"),
                        "connected": True,
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            
            # Récupérer l'adresse email Outlook de l'utilisateur
            try:
                user_info = outlook_service.make_outlook_request(user_id, "/me")
                outlook_email = user_info.get("mail") or user_info.get("userPrincipalName")
                
                if outlook_email:
                    self.outlook_collection.update_one(
                        {"user_id": user_id},
                        {"$set": {"outlook_email": outlook_email}}
                    )
                    logger.info(f"Email Outlook récupéré: {outlook_email}")
            except Exception as e:
                logger.warning(f"Impossible de récupérer l'email Outlook: {str(e)}")
            
            # Créer un abonnement webhook si nécessaire
            try:
                self.create_outlook_subscription(user_id)
            except Exception as e:
                logger.warning(f"Impossible de créer l'abonnement webhook: {str(e)}")
            
            # Redirection vers le frontend succès
            return HttpResponseRedirect("http://localhost:3000/outlook-success")
        
        except Exception as e:
            logger.error(f"Erreur lors du callback Outlook: {str(e)}")
            return HttpResponseRedirect(f"http://localhost:3000/outlook-error?msg={str(e)}")
    
    def create_outlook_subscription(self, user_id):
        """
        Crée un abonnement webhook pour les emails Outlook
        """
        try:
            # Vérifier si un abonnement existe déjà
            existing_sub = self.outlook_collection.find_one({
                "user_id": user_id,
                "subscription_active": True
            })
            
            if existing_sub and existing_sub.get("subscription_expiry"):
                expiry = existing_sub.get("subscription_expiry")
                if isinstance(expiry, str):
                    expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                
                # Vérifier si l'abonnement est encore valide (max 3 jours pour Outlook)
                if expiry > datetime.utcnow():
                    logger.info(f"Abonnement actif trouvé pour l'utilisateur {user_id}")
                    return
            
            # Créer un nouvel abonnement
            from django.conf import settings
            
            subscription_data = {
                "changeType": "created",
                "notificationUrl": settings.WEBHOOK_URL,
                "resource": "me/mailFolders('inbox')/messages",
                "expirationDateTime": (datetime.utcnow() + timedelta(days=2)).isoformat() + "Z",
                "clientState": f"user_{user_id}",
                "latestSupportedTlsVersion": "v1_2"
            }
            
            response = outlook_service.make_outlook_request(
                user_id,
                "/subscriptions",
                method="POST",
                data=subscription_data
            )
            
            # Sauvegarder les informations d'abonnement
            self.outlook_collection.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "subscription_id": response.get("id"),
                        "subscription_expiry": response.get("expirationDateTime"),
                        "subscription_active": True,
                        "subscription_created": datetime.utcnow()
                    }
                }
            )
            
            logger.info(f"Abonnement webhook créé pour l'utilisateur {user_id}")
            
        except Exception as e:
            logger.error(f"Erreur lors de la création de l'abonnement: {str(e)}")
            raise
    
    @action(detail=False, methods=['get'], url_path='status', permission_classes=[IsAuthenticated])
    def outlook_status(self, request):
        """
        Vérifie si l'utilisateur est connecté à Outlook
        """
        try:
            user_id = request.user.uid_number
            if not user_id:
                return Response({"error": "Utilisateur non authentifié"}, status=status.HTTP_401_UNAUTHORIZED)
            
            user_doc = self.outlook_collection.find_one({"user_id": user_id})
            
            if user_doc and user_doc.get("connected"):
                # Vérifier si le token est encore valide
                expires_at = user_doc.get("expires_at")
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at)
                
                is_valid = expires_at > datetime.utcnow() if expires_at else False
                
                return Response({
                    "connected": True,
                    "email": user_doc.get("outlook_email"),
                    "is_valid": is_valid,
                    "subscription_active": user_doc.get("subscription_active", False)
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    "connected": False,
                    "email": None,
                    "is_valid": False,
                    "subscription_active": False
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Erreur lors de la vérification du statut Outlook: {str(e)}")
            return Response(
                {"error": f"Erreur lors de la vérification du statut: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='disconnect', permission_classes=[IsAuthenticated])
    def disconnect_outlook(self, request):
        """
        Déconnecte l'utilisateur d'Outlook et supprime l'abonnement
        """
        try:
            user_id = request.user.uid_number
            if not user_id:
                return Response({"error": "Utilisateur non authentifié"}, status=status.HTTP_401_UNAUTHORIZED)
            
            # Supprimer l'abonnement webhook s'il existe
            user_doc = self.outlook_collection.find_one({"user_id": user_id})
            if user_doc and user_doc.get("subscription_id"):
                try:
                    outlook_service.make_outlook_request(
                        user_id,
                        f"/subscriptions/{user_doc['subscription_id']}",
                        method="DELETE"
                    )
                except Exception as e:
                    logger.warning(f"Impossible de supprimer l'abonnement: {str(e)}")
            
            # Supprimer les tokens de la base de données
            self.outlook_collection.delete_one({"user_id": user_id})
            
            return Response({
                "success": True,
                "message": "Compte Outlook déconnecté avec succès"
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Erreur lors de la déconnexion d'Outlook: {str(e)}")
            return Response(
                {"error": f"Erreur lors de la déconnexion: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='test-connection', permission_classes=[IsAuthenticated])
    def test_outlook_connection(self, request):
        """
        Teste la connexion à Outlook et récupère quelques informations
        """
        try:
            user_id = request.user.uid_number
            if not user_id:
                return Response({"error": "Utilisateur non authentifié"}, status=status.HTTP_401_UNAUTHORIZED)
            
            # Tester la connexion en récupérant le profil
            user_info = outlook_service.make_outlook_request(user_id, "/me")
            emails = outlook_service.list_messages(user_id, top=5)
            
            return Response({
                "success": True,
                "user_info": {
                    "name": user_info.get("displayName"),
                    "email": user_info.get("mail") or user_info.get("userPrincipalName")
                },
                "recent_emails": len(emails.get("value", [])),
                "message": "Connexion à Outlook établie avec succès"
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Erreur lors du test de connexion Outlook: {str(e)}")
            return Response({
                "success": False,
                "error": str(e),
                "message": "Échec de la connexion à Outlook"
            }, status=status.HTTP_400_BAD_REQUEST)