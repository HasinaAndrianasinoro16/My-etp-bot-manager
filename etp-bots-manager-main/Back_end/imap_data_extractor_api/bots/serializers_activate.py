"""
bots/serializers_activate.py

Serializer dédié à l'activation d'un bot (Option C).
Valide que le champ password est présent et non vide.
"""

from rest_framework import serializers


class BotActivateSerializer(serializers.Serializer):
    """
    Corps attendu pour POST /bots/{bot_id}/activate/ :

        {
            "password": "motDePasseLDAP"
        }

    L'email est extrait du token JWT, pas du body,
    pour éviter toute usurpation d'identité.
    """

    password = serializers.CharField(
        write_only=True,
        min_length=1,
        trim_whitespace=False,
        error_messages={
            "blank":    "Le mot de passe ne peut pas être vide.",
            "required": "Le mot de passe est requis pour activer le bot.",
            "min_length": "Le mot de passe ne peut pas être vide.",
        },
    )
