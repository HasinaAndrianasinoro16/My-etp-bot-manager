"""
mail_integration/tasks.py — Version complète avec support Graph API + IMAP
"""

import logging
from datetime import datetime
from celery import shared_task

from configurations.services import mongo_service
from bots.tasks import bot_task
from bots.serializer import BotSerializer
from imap_data_extractor_api.utils import serialize_mongo_doc, get_next_sequence_value
from notifications.services import notification
from .services import outlook_service

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def get_attachments_from_message(parsed_message: dict) -> list:
    return parsed_message.get("attachments", [])


# ═════════════════════════════════════════════════════════════════════════════
# ✅ NOUVEAU — GRAPH API : Traite un message Outlook via Microsoft Graph
# ═════════════════════════════════════════════════════════════════════════════

@shared_task(bind=True, max_retries=2)
def process_graph_message(self, user_id: int, message_id: str, bot_id: int):
    """
    Reçoit un message_id Outlook (Graph API), récupère le message complet,
    le stocke dans raw_imap_emails, puis lance le dispatch vers les bots.

    Appelé depuis BotGraphRunner.run() dans service.py.
    """
    messages_collection = mongo_service.get_collection("raw_imap_emails")

    # ── Dédoublonnage ─────────────────────────────────────────────────────────
    existing = messages_collection.find_one({"outlook_message_id": message_id})
    if existing:
        logger.info("Message Graph %s déjà traité — Skip", message_id)
        return

    try:
        # ── Récupérer le message complet via Graph API ─────────────────────────
        full_message = outlook_service.get_message(user_id, message_id)

        # ── Extraire les pièces jointes ────────────────────────────────────────
        attachments_meta = []
        has_attachments = full_message.get("hasAttachments", False)
        if has_attachments:
            try:
                attachments_raw = outlook_service.extract_attachments(user_id, message_id)
                attachments_meta = [
                    {
                        "filename":     att["filename"],
                        "content_type": att["content_type"],
                        "size":         att["size"],
                    }
                    for att in attachments_raw
                ]
            except Exception as e:
                logger.warning("Impossible de récupérer les pièces jointes : %s", e)

        # ── Extraire l'expéditeur ──────────────────────────────────────────────
        sender = full_message.get("sender", {}).get("emailAddress", {})
        from_email = sender.get("address", "")

        # ── Construire le document brut ────────────────────────────────────────
        raw_imap_id = get_next_sequence_value("raw_imap_emails")
        mail_data = {
            "raw_imap_id":        raw_imap_id,
            "user_id":            user_id,
            "imap_uid":           message_id,           # ← compatible avec le pipeline IMAP
            "outlook_message_id": message_id,
            "subject":            full_message.get("subject", ""),
            "from_email":         from_email,
            "date":               full_message.get("receivedDateTime", ""),
            "body_text":          full_message.get("body", {}).get("content", ""),
            "has_attachment":     has_attachments,
            "attachments":        attachments_meta,
            "received_at":        datetime.utcnow(),
        }

        logger.info(
            "Mail Graph | id=%s | from=%s | subject=%s",
            message_id, from_email, mail_data["subject"]
        )

        messages_collection.insert_one(mail_data)
        logger.info("Message Graph %s enregistré (raw_imap_id=%s)", message_id, raw_imap_id)

    except Exception as exc:
        if "duplicate key error" in str(exc).lower():
            logger.warning("Message Graph %s déjà inséré — Skip", message_id)
            return
        logger.error("Erreur traitement Graph message %s : %s", message_id, exc)
        raise self.retry(exc=exc, countdown=30)

    # ── Dispatch vers les bots ─────────────────────────────────────────────────
    dispatch_imap_mail_to_bots.delay(user_id, message_id)


# ═════════════════════════════════════════════════════════════════════════════
# TÂCHE 3 — Applique les règles d'un bot sur un message
# ═════════════════════════════════════════════════════════════════════════════

@shared_task
def apply_imap_bot_filter(user_id: int, imap_uid: str, bot: dict, indexed_map: dict):
    messages_collection = mongo_service.get_collection("raw_imap_emails")
    field_collection    = mongo_service.get_collection("fields")

    mongo_message = messages_collection.find_one({
        "$or": [
            {"imap_uid": imap_uid},
            {"outlook_message_id": imap_uid}
        ]
    })
    if not mongo_message:
        msg = f"Message introuvable en base : uid={imap_uid}"
        logger.error(msg)
        notification.notify_email_process(user_id, bot.get("bot_id"), imap_uid, msg, 5)
        return False

    filter_data = bot.get("filter", {})
    rq_all      = filter_data.get("required_all", False)
    rules       = filter_data.get("rules", [])

    if not rules:
        msg = "Aucune règle définie pour ce bot"
        logger.warning(msg)
        notification.notify_email_process(user_id, bot.get("bot_id"), imap_uid, msg, 0)
        return False

    priorities_data = outlook_service.sort_rules_by_indexed_priority(rules, indexed_map)
    bot_rules       = priorities_data.get("result", [])
    priority_limit  = priorities_data.get("true", 0)

    attachments        = []
    attachments_loaded = False
    is_mail_valid      = False

    for i, bot_rule in enumerate(bot_rules, start=1):
        field_id = bot_rule.get("field_id")
        if field_id is None:
            continue

        field_id  = int(field_id)
        field_doc = field_collection.find_one({"field_id": field_id})
        if not field_doc:
            logger.error("Field introuvable : %s", field_id)
            continue

        notification.notify_email_process(
            user_id, bot.get("bot_id"), imap_uid, "Traitement du bot par une règle", 2
        )

        value = bot_rule.get("value")
        if value is None:
            continue

        need_attachment = field_doc.get("need_attachment", False)
        operator_id     = bot_rule.get("operator_id")
        operator_id     = int(operator_id) if operator_id is not None else None

        if need_attachment and not attachments_loaded:
            attachments        = mongo_message.get("attachments", [])
            attachments_loaded = True

        is_rule_valid = bot_task.arg_handler(
            mongo_message, value, field_id,
            None if i <= priority_limit else operator_id,
            attachments if need_attachment else [],
        )

        from_email = mongo_message.get("from_email", "inconnu")
        subject    = mongo_message.get("subject", "")
        rule_value = value.get("value", value) if isinstance(value, dict) else value

        logger.info(
            "Résultat règle | field_id=%s | from='%s' | sujet='%s' | valeur_règle='%s' | valide=%s",
            field_id, from_email, subject, rule_value, is_rule_valid
        )

        if is_rule_valid:
            notification.notify_email_process(
                user_id, bot.get("bot_id"), imap_uid,
                f"Règle validée | expéditeur='{from_email}' | sujet='{subject}'",
                2
            )
            if rq_all:
                is_mail_valid = True
                continue
            else:
                is_mail_valid = True
                break
        else:
            notification.notify_email_process(
                user_id, bot.get("bot_id"), imap_uid,
                f"Règle non validée | expéditeur='{from_email}' | valeur_attendue='{rule_value}'",
                0
            )
            if rq_all:
                logger.info(
                    "required_all=True -> mail rejeté car règle field_id=%s non validée | from='%s'",
                    field_id, from_email
                )
                return False
            else:
                continue

    if not is_mail_valid:
        from_email = mongo_message.get("from_email", "inconnu")
        logger.info(
            "Mail rejeté (aucune règle validée) | uid=%s | from='%s'",
            imap_uid, from_email
        )
        notification.notify_email_process(
            user_id, bot.get("bot_id"), imap_uid,
            f"Mail ignoré — aucune règle ne correspond | expéditeur='{from_email}'",
            0
        )
        return False

    if not attachments_loaded:
        attachments = mongo_message.get("attachments", [])

    bot_id     = bot.get("bot_id", 0)
    email_data = outlook_service.extract_email_data(mongo_message, user_id, bot_id)

    result = outlook_service.save_email_and_attachments(
        user_id=user_id,
        message=mongo_message,
        email_data=email_data,
    )

    if not result:
        msg = "Erreur lors de l'enregistrement du mail"
        notification.notify_email_process(user_id, bot.get("bot_id"), imap_uid, msg, 5)
        return False

    msg = f"Mail enregistré avec succès : uid={imap_uid} | from='{mongo_message.get('from_email', '')}'"
    notification.notify_email_process(user_id, bot.get("bot_id"), imap_uid, msg, 4)
    logger.info("Mail enregistré, uid=%s | from='%s' | user_id=%s", imap_uid, mongo_message.get("from_email", ""), user_id)
    return True


# ═════════════════════════════════════════════════════════════════════════════
# TÂCHE 2b — Dispatche un message vers UN SEUL bot (utilisé au démarrage)
# ═════════════════════════════════════════════════════════════════════════════

@shared_task
def dispatch_imap_mail_to_single_bot(user_id: int, imap_uid: str, bot_id: int):
    """
    Re-dispatch un email existant dans raw_imap_emails vers un bot précis.
    Utilisé au démarrage du BotGraphRunner pour traiter les emails déjà en base
    qui n'ont pas encore été filtrés par ce bot.
    """
    bot_collection    = mongo_service.get_collection("bot")
    fields_collection = mongo_service.get_collection("fields")

    bot = bot_collection.find_one({"bot_id": bot_id, "assigned_user_id": user_id, "status": 1})
    if not bot:
        logger.warning(
            "dispatch_imap_mail_to_single_bot : bot_id=%s introuvable ou inactif pour user_id=%s",
            bot_id, user_id
        )
        return

    # Récupérer le message pour logger l'expéditeur
    raw_collection = mongo_service.get_collection("raw_imap_emails")
    raw_msg = raw_collection.find_one(
        {"$or": [{"imap_uid": imap_uid}, {"outlook_message_id": imap_uid}]},
        {"from_email": 1, "subject": 1, "_id": 0}
    )
    from_email = raw_msg.get("from_email", "inconnu") if raw_msg else "inconnu"
    subject    = raw_msg.get("subject", "") if raw_msg else ""

    fields_dict = fields_collection.find()
    indexed_map = {int(f["field_id"]): f["is_indexed"] for f in fields_dict}

    bot_result     = serialize_mongo_doc(bot)
    bot_serializer = BotSerializer(bot_result)

    logger.info(
        "dispatch_imap_mail_to_single_bot | imap_uid=%s | from='%s' | sujet='%s' | bot_id=%s | user_id=%s",
        imap_uid, from_email, subject, bot_id, user_id
    )

    notification.notify_email_process(
        user_id,
        bot_serializer.data.get("bot_id"),
        imap_uid,
        f"Analyse du mail | expéditeur='{from_email}' | sujet='{subject}'",
        1,
    )

    apply_imap_bot_filter.delay(
        user_id=user_id,
        imap_uid=imap_uid,
        bot=bot_serializer.data,
        indexed_map=indexed_map,
    )


# ═════════════════════════════════════════════════════════════════════════════
# TÂCHE 2 — Dispatche un message vers tous les bots actifs du user
# ═════════════════════════════════════════════════════════════════════════════

@shared_task
def dispatch_imap_mail_to_bots(user_id: int, imap_uid: str):
    bot_collection    = mongo_service.get_collection("bot")
    fields_collection = mongo_service.get_collection("fields")

    bots = list(bot_collection.find({"assigned_user_id": user_id, "status": 1}))
    logger.info(
        "dispatch_imap_mail_to_bots : %d bot(s) actif(s) pour user_id=%s",
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
            imap_uid,
            f"Nouveau mail {imap_uid} en cours de traitement",
            1,
        )

        apply_imap_bot_filter.delay(
            user_id=user_id,
            imap_uid=imap_uid,
            bot=bot_serializer.data,
            indexed_map=indexed_map,
        )


# ═════════════════════════════════════════════════════════════════════════════
# TÂCHE 1 — Traite un message IMAP brut
# ═════════════════════════════════════════════════════════════════════════════

@shared_task(bind=True, max_retries=2)
def process_imap_message(self, user_id: int, imap_uid: str, parsed_message: dict):
    messages_collection = mongo_service.get_collection("raw_imap_emails")

    existing = messages_collection.find_one({"imap_uid": imap_uid})
    if existing:
        logger.info("Message IMAP %s déjà traité — Skip", imap_uid)
        return

    raw_imap_id = get_next_sequence_value("raw_imap_emails")
    mail_data = {
        "raw_imap_id":    raw_imap_id,
        "user_id":        user_id,
        "imap_uid":       imap_uid,
        "subject":        parsed_message.get("subject", ""),
        "from_email":     parsed_message.get("from_email", ""),
        "date":           parsed_message.get("date", ""),
        "body_text":      parsed_message.get("body_text", ""),
        "has_attachment": parsed_message.get("has_attachment", False),
        "attachments":    parsed_message.get("attachments", []),
        "received_at":    datetime.utcnow(),
    }

    logger.info("Mail IMAP | uid=%s | from=%s | subject=%s",
                imap_uid, mail_data["from_email"], mail_data["subject"])

    try:
        messages_collection.insert_one(mail_data)
        logger.info("Message IMAP %s enregistré (raw_imap_id=%s)", imap_uid, raw_imap_id)
    except Exception as exc:
        if "duplicate key error" in str(exc).lower():
            logger.warning("Message IMAP %s déjà inséré — Skip", imap_uid)
            return
        logger.error("Erreur MongoDB : %s", exc)
        raise self.retry(exc=exc, countdown=30)

    dispatch_imap_mail_to_bots.delay(user_id, imap_uid)