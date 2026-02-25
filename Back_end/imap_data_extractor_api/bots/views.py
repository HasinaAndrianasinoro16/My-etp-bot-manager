from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import APIException

from datetime import datetime
import logging

from configurations.services import mongo_service
from imap_data_extractor_api.utils import (
    serialize_mongo_doc,
    get_next_sequence_value
)
from .serializer import BotSerializer
from .service import bot_service


logger = logging.getLogger(__name__)


class BotViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.collection = mongo_service.get_collection("bot")

    # ========================= CREATE BOT =========================
    def create(self, request):
        serializer = BotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bot_data = serializer.validated_data
        bot_data.update({
            "bot_id": get_next_sequence_value("bot_id"),
            "assigned_user_id": request.user.uid_number,
            "created_date": datetime.utcnow(),
            "killed_date": None,
            "status": 0
        })

        result = self.collection.insert_one(bot_data)
        bot = self.collection.find_one({"_id": result.inserted_id})

        return Response(
            BotSerializer(serialize_mongo_doc(bot)).data,
            status=status.HTTP_201_CREATED
        )

    # ========================= LIST BOTS =========================
    def list(self, request):
        bots = self.collection.find({
            "assigned_user_id": request.user.uid_number
        })

        bots = [serialize_mongo_doc(b) for b in bots]
        return Response(BotSerializer(bots, many=True).data)

    # ========================= RETRIEVE BOT =========================
    def retrieve(self, request, pk=None):
        bot = self.collection.find_one({
            "bot_id": int(pk),
            "assigned_user_id": request.user.uid_number
        })

        if not bot:
            return Response({"error": "Bot introuvable"}, status=404)

        return Response(BotSerializer(serialize_mongo_doc(bot)).data)

    # ========================= UPDATE BOT =========================
    def partial_update(self, request, pk=None):
        bot = self.collection.find_one({"bot_id": int(pk)})
        if not bot:
            return Response({"error": "Bot introuvable"}, status=404)

        if bot["assigned_user_id"] != request.user.uid_number:
            return Response({"error": "Acces refuse"}, status=403)

        self.collection.update_one(
            {"_id": bot["_id"]},
            {"$set": request.data}
        )

        updated = self.collection.find_one({"_id": bot["_id"]})
        return Response(BotSerializer(serialize_mongo_doc(updated)).data)

    # ========================= ACTIVATE BOT =========================
    @action(detail=True, methods=['post'], url_path="activate")
    def activate(self, request, pk=None):
        try:
            bot_id  = int(pk)
            user_id = request.user.uid_number
            role    = request.user.ldap_role

            if not bot_service.is_bot_owner(bot_id, user_id, role):
                return Response(
                    {"error": "Acces refuse"},
                    status=status.HTTP_403_FORBIDDEN
                )

            result = bot_service.activate_bot(bot_id=bot_id, user_id=user_id)

            if "error" in result:
                code = result.get("code", "")
                if code == "OUTLOOK_NOT_CONNECTED":
                    return Response(result, status=status.HTTP_409_CONFLICT)
                if code == "BOT_NOT_FOUND":
                    return Response(result, status=status.HTTP_404_NOT_FOUND)
                if code in ("ALREADY_ACTIVE", "PAUSED"):
                    return Response(result, status=status.HTTP_409_CONFLICT)
                return Response(result, status=status.HTTP_400_BAD_REQUEST)

            return Response(
                {"status": "success", "message": f"Bot {bot_id} active", "task": result},
                status=status.HTTP_200_OK
            )

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("Erreur activation bot")
            return Response(
                {"error": "Erreur interne lors de l'activation du bot"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ========================= START BOT =========================
    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        try:
            bot_id  = int(pk)
            user_id = request.user.uid_number
            role    = request.user.ldap_role

            if not bot_service.is_bot_owner(bot_id, user_id, role):
                return Response(
                    {"error": "Acces refuse"},
                    status=status.HTTP_403_FORBIDDEN
                )

            bot_service.start_bot(bot_id)
            return Response(
                {"status": "success", "message": f"Bot {bot_id} demarre"},
                status=status.HTTP_200_OK
            )

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("Erreur demarrage bot")
            return Response(
                {"error": "Erreur interne lors du demarrage du bot"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ========================= PAUSE BOT =========================
    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        try:
            bot_id  = int(pk)
            user_id = request.user.uid_number
            role    = request.user.ldap_role

            if not bot_service.is_bot_owner(bot_id, user_id, role):
                return Response(
                    {"error": "Acces refuse"},
                    status=status.HTTP_403_FORBIDDEN
                )

            bot_service.pause_bot(bot_id)
            return Response(
                {"status": "success", "message": f"Bot {bot_id} mis en pause"},
                status=status.HTTP_200_OK
            )

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("Erreur mise en pause bot")
            return Response(
                {"error": "Erreur interne lors de la mise en pause du bot"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ========================= STOP BOT =========================
    @action(detail=True, methods=["post"], url_path="stop")
    def stop(self, request, pk=None):
        try:
            bot_id  = int(pk)
            user_id = request.user.uid_number
            role    = request.user.ldap_role

            if not bot_service.is_bot_owner(bot_id, user_id, role):
                return Response(
                    {"error": "Acces refuse"},
                    status=status.HTTP_403_FORBIDDEN
                )

            bot_service.stop_bot(bot_id)
            return Response(
                {"status": "success", "message": f"Bot {bot_id} arrete"},
                status=status.HTTP_200_OK
            )

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("Erreur arret bot")
            return Response(
                {"error": "Erreur interne lors de l'arret du bot"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ========================= EMAILS DU BOT =========================
    @action(detail=True, methods=["get"], url_path="emails")
    def emails(self, request, pk=None):
        """
        GET /bots/{id}/emails/
        Retourne tous les emails de raw_imap_emails qui correspondent
        à la règle expéditeur du bot (field_id=3).
        C'est la source de vérité pour les logs bots dans le dashboard.
        """
        try:
            bot_id  = int(pk)
            user_id = request.user.uid_number

            bot = self.collection.find_one({
                "bot_id": bot_id,
                "assigned_user_id": user_id,
            })
            if not bot:
                return Response({"error": "Bot introuvable"}, status=404)

            # Pagination
            page      = max(1, int(request.query_params.get("page", 1)))
            page_size = max(1, min(1000, int(request.query_params.get("page_size", 100))))
            skip      = (page - 1) * page_size

            # Extraire la valeur de la règle expéditeur (field_id=3)
            rules = bot.get("filter", {}).get("rules", [])
            sender_rule = next(
                (r for r in rules if int(r.get("field_id", 0)) == 3),
                None
            )

            raw_collection = mongo_service.get_collection("raw_imap_emails")

            if sender_rule:
                sender_value = sender_rule.get("value", {})
                # La valeur peut être {"value": "email@..."} ou directement "email@..."
                if isinstance(sender_value, dict):
                    sender_email = sender_value.get("value", "")
                else:
                    sender_email = str(sender_value)

                logger.info(
                    "GET /bots/%s/emails/ — filtre expéditeur='%s'", bot_id, sender_email
                )

                query = {
                    "user_id": user_id,
                    "from_email": sender_email,
                }
            else:
                # Pas de règle expéditeur → tous les emails de cet user
                logger.info(
                    "GET /bots/%s/emails/ — aucune règle expéditeur, retour tous emails", bot_id
                )
                query = {"user_id": user_id}

            total  = raw_collection.count_documents(query)
            cursor = (
                raw_collection
                .find(query, {"_id": 0, "attachments": 0})
                .sort("received_at", -1)
                .skip(skip)
                .limit(page_size)
            )

            results = [serialize_mongo_doc(e) for e in cursor]

            logger.info(
                "GET /bots/%s/emails/ → %d/%d emails retournés", bot_id, len(results), total
            )

            return Response({
                "count":     total,
                "page":      page,
                "page_size": page_size,
                "results":   results,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception("Erreur récupération emails bot")
            return Response(
                {"error": f"Erreur interne : {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ========================= DELETE BOT =========================
    @action(detail=True, methods=["delete"], url_path="delete")
    def delete(self, request, pk=None):
        try:
            bot_id  = int(pk)
            user_id = request.user.uid_number
            role    = request.user.ldap_role

            if not bot_service.is_bot_owner(bot_id, user_id, role):
                return Response(
                    {"error": "Acces refuse"},
                    status=status.HTTP_403_FORBIDDEN
                )

            bot_service.delete_bot(bot_id, user_id)
            return Response(
                {"status": "success", "message": f"Bot {bot_id} supprime"},
                status=status.HTTP_200_OK
            )

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("Erreur suppression bot")
            return Response(
                {"error": "Erreur interne lors de la suppression du bot"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )