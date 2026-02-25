"""
bot_filter/tasks.py  (nouveau fichier)

Pipeline de filtrage des emails Outlook via Microsoft Graph API.

Flux :
  BotGraphRunner.run()          (dans bots/service.py)
        ↓  process_graph_message.delay()
  process_graph_message()       ← stocke le message dans raw_graph_emails
        ↓  dispatch_graph_mail_to_bots.delay()
  dispatch_graph_mail_to_bots() ← trouve les bots actifs du user
        ↓  apply_graph_bot_filter.delay()
  apply_graph_bot_filter()      ← applique les règles du bot sur le message

Différence avec le flux IMAP :
  - Source : Microsoft Graph API (push via webhook ou pull via polling)
  - Pas de session IMAP longue durée
  - Le token OAuth2 est géré automatiquement par OutlookService
"""

import logging
from datetime import datetime
from celery import shared_task

from configurations.services import mongo_service
from bots.tasks import bot_task
from bots.serializer import BotSerializer
from imap_data_extractor_api.utils import serialize_mongo_doc, get_next_sequence_value
from notifications.services import notification
from mail_integration.services import outlook_service, OutlookNotConnectedException

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# TÂCHE 3 — Applique les règles d'un bot sur un message Graph
# ═════════════════════════════════════════════════════════════════════════════

@shared_task
def apply_graph_bot_filter(user_id: int, message_id: str, bot: dict, indexed_map: dict):
    """
    Applique toutes les règles du bot sur un message stocké dans raw_graph_emails.

    Args:
        user_id:     uid_number de l'utilisateur
        message_id:  ID du message Microsoft Graph
        bot:         données du bot (sérialisées)
        indexed_map: {field_id: is_indexed} pour la priorisation des règles
    """
    messages_collection = mongo_service.get_collection("raw_graph_emails")
    field_collection    = mongo_service.get_collection("fields")

    # ── Récupérer le message depuis MongoDB ───────────────────────────────────
    mongo_message = messages_collection.find_one({"graph_message_id": message_id})
    if not mongo_message:
        msg = f"Message Graph introuvable en base : id={message_id}"
        logger.error(msg)
        notification.notify_email_process(user_id, bot.get("bot_id"), message_id, msg, 5)
        return False

    filter_data = bot.get("filter", {})
    rq_all      = filter_data.get("required_all", False)
    rules       = filter_data.get("rules", [])

    if not rules:
        msg = "Aucune règle définie pour ce bot"
        logger.warning(msg)
        notification.notify_email_process(user_id, bot.get("bot_id"), message_id, msg, 0)
        return False

    # ── Trier les règles par priorité (règles indexées en premier) ────────────
    priorities_data = outlook_service.sort_rules_by_indexed_priority(rules, indexed_map)
    bot_rules       = priorities_data.get("result", [])
    priority_limit  = priorities_data.get("true", 0)
    logger.info("Rules triées : %s", bot_rules)

    attachments         = []
    attachments_loaded  = False
    is_mail_valid       = False

    for i, bot_rule in enumerate(bot_rules, start=1):
        field_id = bot_rule.get("field_id")
        if field_id is None:
            msg = "field_id manquant dans la règle"
            logger.error(msg)
            notification.notify_email_process(user_id, bot.get("bot_id"), message_id, msg, 5)
            continue

        field_id  = int(field_id)
        field_doc = field_collection.find_one({"field_id": field_id})

        if not field_doc:
            msg = f"Field introuvable : {field_id}"
            logger.error(msg)
            notification.notify_email_process(user_id, bot.get("bot_id"), message_id, msg, 5)
            continue

        notification.notify_email_process(
            user_id, bot.get("bot_id"), message_id,
            "Traitement du bot par une règle", 2
        )

        value = bot_rule.get("value")
        if value is None:
            msg = "value manquante dans la règle"
            logger.error(msg)
            notification.notify_email_process(user_id, bot.get("bot_id"), message_id, msg, 5)
            continue

        need_attachment = field_doc.get("need_attachment", False)
        operator_id     = bot_rule.get("operator_id")
        operator_id     = int(operator_id) if operator_id is not None else None

        # ── Charger les pièces jointes si nécessaire (une seule fois) ─────────
        if need_attachment and not attachments_loaded:
            notification.notify_email_process(
                user_id, bot.get("bot_id"), message_id,
                "Extraction des pièces jointes", 2
            )
            try:
                attachments       = outlook_service.extract_attachments(user_id, message_id)
                attachments_loaded = True
                logger.info("Pièces jointes chargées via Graph : %d", len(attachments))
            except OutlookNotConnectedException as exc:
                logger.error("Token Outlook invalide pendant le filtrage : %s", exc)
                notification.notify_email_process(
                    user_id, bot.get("bot_id"), message_id,
                    "Token Outlook expiré — reconnexion requise", 5
                )
                return False

        # ── Appliquer le handler de règle ─────────────────────────────────────
        if i <= priority_limit:
            is_rule_valid = bot_task.arg_handler(
                mongo_message, value, field_id, None,
                attachments if need_attachment else [],
            )
        else:
            is_rule_valid = bot_task.arg_handler(
                mongo_message, value, field_id, operator_id,
                attachments if need_attachment else [],
            )

        logger.info("Résultat règle field_id=%s : %s", field_id, is_rule_valid)

        if is_rule_valid:
            if rq_all:
                is_mail_valid = True
                continue
            else:
                logger.info("Règle validée, required_all=False → arrêt")
                is_mail_valid = True
                break
        else:
            if rq_all:
                return False
            else:
                continue

    if not is_mail_valid:
        return False

    # ── Sauvegarder le mail filtré ────────────────────────────────────────────
    bot_id          = bot.get("bot_id", 0)
    has_attachments = mongo_message.get("has_attachment", False)

    email_data = outlook_service.extract_mail_data(
        user_id, mongo_message, bot_id, has_attachments
    )

    result = outlook_service.save_email_and_attachments(
        user_id=user_id,
        message=mongo_message,
        mail_extracted=email_data,
        message_id=message_id if has_attachments else None,
        attachments=attachments if has_attachments else [],
    )

    if not result:
        msg = "Erreur lors de l'enregistrement du mail"
        notification.notify_email_process(user_id, bot.get("bot_id"), message_id, msg, 5)
        return False

    msg = f"Mail Graph enregistré : message_id={message_id}"
    notification.notify_email_process(user_id, bot.get("bot_id"), message_id, msg, 4)
    logger.info("Mail enregistré, message_id=%s par user_id=%s", message_id, user_id)
    return True


# ═════════════════════════════════════════════════════════════════════════════
# TÂCHE 2 — Dispatche vers tous les bots actifs du user
# ═════════════════════════════════════════════════════════════════════════════

@shared_task
def dispatch_graph_mail_to_bots(user_id: int, message_id: str):
    """
    Trouve tous les bots actifs (status=1) de l'utilisateur et
    lance apply_graph_bot_filter() pour chacun.
    """
    bot_collection    = mongo_service.get_collection("bot")
    fields_collection = mongo_service.get_collection("fields")

    bots = list(bot_collection.find({
        "assigned_user_id": user_id,
        "status": 1,
    }))
    logger.info(
        "dispatch_graph_mail_to_bots : %d bot(s) actif(s) pour user_id=%s",
        len(bots), user_id,
    )

    fields_dict = fields_collection.find()
    indexed_map = {int(f["field_id"]): f["is_indexed"] for f in fields_dict}

    for bot in bots:
        bot_result     = serialize_mongo_doc(bot)
        bot_serializer = BotSerializer(bot_result)

        notification.notify_email_process(
            user_id,
            bot_serializer.data.get("bot_id"),
            message_id,
            f"Nouveau mail Graph {message_id} en cours de traitement",
            1,
        )

        apply_graph_bot_filter.delay(
            user_id=user_id,
            message_id=message_id,
            bot=bot_serializer.data,
            indexed_map=indexed_map,
        )


# ═════════════════════════════════════════════════════════════════════════════
# TÂCHE 1 — Télécharge et stocke un message Graph dans MongoDB
# ═════════════════════════════════════════════════════════════════════════════

@shared_task(bind=True, max_retries=2)
def process_graph_message(self, user_id: int, message_id: str, bot_id: int = None):
    """
    Récupère un message via Microsoft Graph API, le stocke dans
    raw_graph_emails, puis lance le dispatch vers les bots.

    Appelé par :
      - BotGraphRunner.run() (polling toutes les 30s)
      - MailIntegrationView.outlook_webhook() (push webhook)
    """
    messages_collection = mongo_service.get_collection("raw_graph_emails")

    # ── Dédoublonnage ─────────────────────────────────────────────────────────
    if messages_collection.find_one({"graph_message_id": message_id}):
        logger.info("Message Graph %s déjà traité — Skip", message_id)
        return

    # ── Récupérer le message via Graph API ────────────────────────────────────
    try:
        message = outlook_service.get_message(user_id, message_id)
    except OutlookNotConnectedException as exc:
        logger.error("Token Outlook invalide pour user_id=%s : %s", user_id, exc)
        return
    except Exception as exc:
        logger.error("Erreur Graph API : %s", exc)
        raise self.retry(exc=exc, countdown=30)

    # ── Construction du document brut ─────────────────────────────────────────
    raw_id = get_next_sequence_value("raw_graph_emails")

    mail_data = {
        "raw_graph_id":     raw_id,
        "user_id":          user_id,
        "graph_message_id": message_id,
        "subject":          message.get("subject", ""),
        "from_email":       (
            message.get("sender", {})
                   .get("emailAddress", {})
                   .get("address", "")
        ),
        "date":             message.get("receivedDateTime", ""),
        "body_text":        message.get("body", {}).get("content", ""),
        "has_attachment":   message.get("hasAttachments", False),
        "received_at":      datetime.utcnow(),
    }

    logger.info(
        "Mail Graph data : id=%s | from=%s | subject=%s",
        message_id, mail_data["from_email"], mail_data["subject"]
    )

    try:
        messages_collection.insert_one(mail_data)
        logger.info("Message Graph %s enregistré (raw_id=%s)", message_id, raw_id)
    except Exception as exc:
        if "duplicate key error" in str(exc).lower():
            logger.warning("Message Graph %s déjà inséré — Skip", message_id)
            return
        logger.error("Erreur MongoDB : %s", exc)
        raise self.retry(exc=exc, countdown=30)

    # ── Dispatch vers les bots ─────────────────────────────────────────────────
    dispatch_graph_mail_to_bots.delay(user_id, message_id)
