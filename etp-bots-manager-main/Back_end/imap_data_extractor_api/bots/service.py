"""
bots/service.py
"""

import logging
import threading
import datetime as dt
from datetime import timedelta
from typing import Dict

from rest_framework_simplejwt.tokens import AccessToken

from configurations.services import mongo_service
from task.services import task_service
from imap_data_extractor_api.utils import get_next_sequence_value
from .serializer import BotSerializer, BotArchiveSerializer

logger = logging.getLogger(__name__)


class BotService:

    def __init__(self):
        self.collection     = mongo_service.get_collection("bot")
        self.archive        = mongo_service.get_collection("bot_archive")
        self.outlook_tokens = mongo_service.get_collection("outlook_token")

    def get_by_id(self, bot_id):
        return self.collection.find_one({"bot_id": bot_id})

    def generate_bot_token(self, bot_id, user_id):
        token = AccessToken()
        token.set_exp(lifetime=timedelta(days=30))
        token["is_bot"]           = True
        token["bot_id"]           = bot_id
        token["assigned_user_id"] = user_id
        return str(token)

    def is_bot_owner(self, bot_id, user_id, role):
        if role == "admin":
            return True
        return self.collection.find_one({
            "bot_id":           bot_id,
            "assigned_user_id": user_id,
        }) is not None

    def update_status(self, bot_id, status):
        self.collection.update_one(
            {"bot_id": bot_id},
            {"$set": {"status": status}},
        )

    def activate_bot(self, bot_id: int, user_id: int) -> Dict:
        bot = self.get_by_id(bot_id)
        if not bot:
            return {"error": "Bot introuvable", "code": "BOT_NOT_FOUND"}

        status = bot.get("status")
        if status == 1:
            return {"error": "Bot deja actif", "code": "ALREADY_ACTIVE"}
        if status == 2:
            return {"error": "Bot en pause", "code": "PAUSED"}

        outlook_doc = self.outlook_tokens.find_one({"user_id": user_id})
        if not outlook_doc or not outlook_doc.get("connected"):
            logger.warning("Outlook non connecte pour user_id=%s", user_id)
            return {
                "error": "Votre boite Outlook n'est pas connectee.",
                "code": "OUTLOOK_NOT_CONNECTED",
            }

        self.update_status(bot_id, 1)
        task = task_service.create_task(bot_id, user_id)

        runner = BotGraphRunner(bot_id=bot_id, user_id=user_id)

        def run_and_cleanup():
            try:
                runner.run()
            except Exception as exc:
                logger.exception("Bot %s plante : %s", bot_id, exc)
            finally:
                self.update_status(bot_id, 0)
                logger.info("Bot %s arrete, statut remis a 0", bot_id)

        thread = threading.Thread(target=run_and_cleanup, daemon=True)
        thread.start()
        logger.info("Bot %s demarre (user_id=%s)", bot_id, user_id)
        return {"success": True, "task_id": task.get("id")}

    def start_bot(self, bot_id):
        self.update_status(bot_id, 1)

    def pause_bot(self, bot_id):
        self.update_status(bot_id, 2)

    def stop_bot(self, bot_id):
        self.update_status(bot_id, 0)
        task_service.stop_task(bot_id)

    def delete_bot(self, bot_id, user_id):
        now = dt.datetime.utcnow()
        self.update_status(bot_id, 3)
        bot = self.get_by_id(bot_id)
        archive = {
            "bot_archive_id": get_next_sequence_value("bot_archive_id"),
            "bot_id":         bot_id,
            "bot":            BotSerializer(bot).data,
            "deleted_at":     now,
            "deleted_by":     user_id,
        }
        self.archive.insert_one(archive)


bot_service = BotService()


# ═══════════════════════════════════════════════════════════════════
# RUNNER
# ═══════════════════════════════════════════════════════════════════

class BotGraphRunner:

    POLL_INTERVAL = 30

    def __init__(self, bot_id: int, user_id: int):
        self.bot_id     = bot_id
        self.user_id    = user_id
        self._stop_flag = threading.Event()

    def stop(self):
        self._stop_flag.set()

    @staticmethod
    def _get_sender_value(rules: list) -> str | None:
        """
        Lit la règle expéditeur (field_id=3) depuis les règles brutes MongoDB.
        Gère les deux formats :
          - value = {"value": "email@..."}   (JSONField dict)
          - value = "email@..."              (string directe)
        """
        for rule in rules:
            if int(rule.get("field_id", 0)) == 3:
                v = rule.get("value", {})
                if isinstance(v, dict):
                    return v.get("value", "").strip()
                return str(v).strip()
        return None

    def run(self) -> None:
        from mail_integration.services import outlook_service, OutlookNotConnectedException
        from mail_integration.tasks import process_graph_message

        raw_collection      = mongo_service.get_collection("raw_imap_emails")
        filtered_collection = mongo_service.get_collection("filtered_emails")

        # 1. Charger le bot directement depuis MongoDB (sans BotSerializer)
        bot_doc = mongo_service.get_collection("bot").find_one({
            "bot_id": self.bot_id, "assigned_user_id": self.user_id
        })
        if not bot_doc:
            logger.error("BotGraphRunner : bot_id=%s introuvable", self.bot_id)
            return

        rules = bot_doc.get("filter", {}).get("rules", [])
        if not rules:
            logger.error("Bot %s : aucune règle définie — arrêt", self.bot_id)
            return

        # 2. Extraire la valeur de la règle expéditeur
        sender_value = self._get_sender_value(rules)
        logger.info(
            "BotGraphRunner demarre | bot_id=%s | user_id=%s | expéditeur='%s'",
            self.bot_id, self.user_id, sender_value
        )

        if not sender_value:
            logger.error("Bot %s : règle expéditeur vide — arrêt", self.bot_id)
            return

        # 3. imap_uid déjà sauvegardés pour ce bot
        seen_ids: set = set(
            doc["imap_uid"]
            for doc in filtered_collection.find(
                {"imap_uid": {"$exists": True}, "bot_id": self.bot_id},
                {"imap_uid": 1, "_id": 0}
            )
        )
        logger.info(
            "%d email(s) déjà filtrés pour bot_id=%s",
            len(seen_ids), self.bot_id
        )

        # 4. Chercher dans raw_imap_emails les emails de cet expéditeur
        #    qui ne sont pas encore dans filtered_emails pour ce bot
        pending_emails = list(raw_collection.find({
            "user_id":    self.user_id,
            "from_email": sender_value,
            "imap_uid":   {"$exists": True, "$nin": list(seen_ids)},
        }))

        logger.info(
            "%d email(s) de '%s' à sauvegarder | bot_id=%s",
            len(pending_emails), sender_value, self.bot_id
        )

        # 5. Sauvegarder dans filtered_emails
        saved = 0
        for raw_email in pending_emails:
            imap_uid   = raw_email.get("imap_uid")
            from_email = raw_email.get("from_email", "")
            subject    = raw_email.get("subject", "")

            filtered_doc = {
                "filtered_emails_id": get_next_sequence_value("filtered_emails_id"),
                "provider":           "outlook_imap",
                "bot_id":             self.bot_id,
                "user_id":            self.user_id,
                "imap_uid":           imap_uid,
                "gmail_message_id":   f"bot{self.bot_id}_{imap_uid}",
                "subject":            subject,
                "from_email":         from_email,
                "from":               from_email,
                "received_at":        raw_email.get("date"),
                "date":               raw_email.get("date"),
                "has_attachment":     raw_email.get("has_attachment", False),
                "body_text":          (raw_email.get("body_text") or "")[:500],
                "created_at":         dt.datetime.utcnow(),
            }

            try:
                filtered_collection.insert_one(filtered_doc)
                seen_ids.add(imap_uid)
                saved += 1
                logger.info(
                    "✅ Sauvegardé | from='%s' | sujet='%s' | bot_id=%s",
                    from_email, subject, self.bot_id
                )
            except Exception as e:
                logger.warning("Insert ignoré | sujet='%s' | err=%s", subject, e)

        logger.info(
            "Filtrage initial terminé : %d/%d sauvegardés | bot_id=%s",
            saved, len(pending_emails), self.bot_id
        )

        # 6. Polling : nouveaux messages toutes les 30s
        while not self._stop_flag.is_set():
            try:
                data     = outlook_service.list_messages(self.user_id, top=100)
                messages = data.get("value", [])

                for msg in messages:
                    message_id = msg.get("id")
                    if not message_id or message_id in seen_ids:
                        continue
                    logger.info("Nouveau message | id=...%s | bot_id=%s",
                                message_id[-20:], self.bot_id)
                    process_graph_message.delay(
                        user_id=self.user_id,
                        message_id=message_id,
                        bot_id=self.bot_id,
                    )
                    seen_ids.add(message_id)

                self._stop_flag.wait(timeout=self.POLL_INTERVAL)

            except OutlookNotConnectedException as exc:
                logger.error("Token expiré bot_id=%s : %s", self.bot_id, exc)
                break
            except Exception as exc:
                logger.exception("Erreur bot_id=%s : %s", self.bot_id, exc)
                self._stop_flag.wait(timeout=self.POLL_INTERVAL)

        logger.info("BotGraphRunner arrêté | bot_id=%s", self.bot_id)