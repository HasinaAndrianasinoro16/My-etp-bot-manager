"""
Django settings for imap_data_extractor_api project.
"""
import os
from pathlib import Path
from datetime import timedelta
from decouple import config
from dotenv import load_dotenv
from pymongo import MongoClient

# ── chemins ───────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

BASE_MEDIA_PATH = os.path.join(os.getcwd(), "media", "attachments")

# ── GMAIL ─────────────────────────────────────────────────────────────────────
GMAIL_CLIENT_ID     = os.getenv("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET")
GMAIL_REDIRECT_URI  = "http://localhost:8000/gmail/callback/"
GMAIL_SCOPES        = ["https://www.googleapis.com/auth/gmail.readonly"]

# ── Celery ────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL       = "redis://localhost:6379/0"
CELERY_ACCEPT_CONTENT   = ["json"]
CELERY_TASK_SERIALIZER  = "json"

# ── Azure (conservé pour compatibilité éventuelle) ────────────────────────────
AZURE_TENANT_ID    = os.getenv("AZURE_TENANT_ID")
AZURE_CLIENT_ID    = os.getenv("AZURE_CLIENT_ID")
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET")
AZURE_REDIRECT_URI  = os.getenv("AZURE_REDIRECT_URI")
AZURE_AUTHORITY     = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}"

# ── Outlook webhook ───────────────────────────────────────────────────────────
SUBSCRIPTION_URL = "https://graph.microsoft.com/v1.0/subscriptions"
WEBHOOK_URL      = "https://finger-unintellectually-seymour.ngrok-free.dev/outlook/webhook/"

# ─────────────────────────────────────────────────────────────────────────────
# COMPTE DE SERVICE M365  ← NOUVEAU
#
# Ce compte unique (ex. svc-minibot@bcm.int) doit avoir :
#   - Le rôle Exchange Online "ApplicationImpersonation" OU
#   - "Full Access" sur les boîtes de tous les utilisateurs
#   - IMAP activé pour son propre compte ET pour les boîtes cibles
#
# Commandes PowerShell pour accorder Full Access à toutes les boîtes :
#   $svc = "svc-minibot@bcm.int"
#   Get-Mailbox -ResultSize Unlimited | Add-MailboxPermission \
#       -User $svc -AccessRights FullAccess -InheritanceType All -AutoMapping $false
# ─────────────────────────────────────────────────────────────────────────────
M365_SERVICE_ACCOUNT = {
    "EMAIL":    config("M365_SVC_EMAIL",    default="svc-minibot@bcm.int"),
    "PASSWORD": config("M365_SVC_PASSWORD", default=""),
}

# ── MongoDB ───────────────────────────────────────────────────────────────────
DEFAULT_MONGO_URI  = "mongodb://localhost:27017/"
MONGO_CONFIG_URI   = os.getenv("MONGO_CONFIG_URI", DEFAULT_MONGO_URI)

MONGO_URI    = "mongodb://localhost:27017/"
MONGO_CLIENT = MongoClient(MONGO_URI)
MONGO_DB     = MONGO_CLIENT.get_database("imap_data_extractor_db")

MONGO_COLLECTIONS = {
    "bots":                MONGO_DB.get_collection("bot"),
    "fields":              MONGO_DB.get_collection("field"),
    "operators":           MONGO_DB.get_collection("operator"),
    "mails":               MONGO_DB.get_collection("mail"),
    "notifications":       MONGO_DB.get_collection("notification"),
    # outlook_tokens est remplacé par outlook_connections (connexion IMAP)
    "outlook_connections": MONGO_DB.get_collection("outlook_connections"),
    "gmail_tokens":        MONGO_DB.get_collection("gmail_token"),
}

# ── Sécurité ──────────────────────────────────────────────────────────────────
SECRET_KEY = config(
    "SECRET_KEY",
    default="django-insecure-+rvpwf)+2y%4+py334pv(sm7fbl(*qi&^n4cw9ez*i81pc*60c",
)
DEBUG = config("DEBUG", default=True, cast=bool)

ALLOWED_HOSTS = ["*", "host.docker.internal", "localhost", "127.0.0.1", "10.200.222.36"]

AUTHENTICATION_BACKENDS = [
    "authentication.backends.LDAPAuthenticationBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# ── Applications ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "configurations.apps.ConfigurationsConfig",
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "corsheaders",
    "imap_data_extractor_api",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    # Internal apps
    "authentication",
    "departments",
    "users",
    "bots",
    "bot_filter",
    "mail_integration",
    # Real-time
    "channels",
    "notifications",
    # Azure / Celery
    "django_auth_adfs",
    "celery",
    "typing",
    "drf_spectacular",
]

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [("127.0.0.1", 6379)]},
    },
}

# ── DRF + JWT ─────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "bots.authentication.BotJWTAuthentication",
        "authentication.authentication.CustomJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES":   ["rest_framework.parsers.JSONParser"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

CORS_ALLOW_ALL_ORIGINS  = True
CORS_ALLOW_CREDENTIALS  = True

MONGODB_SETTINGS = {
    "host":     config("MONGO_HOST",     default="localhost"),
    "port":     int(config("MONGO_PORT", default=27017)),
    "db_name":  config("MONGO_DB_NAME",  default="imap_data_extractor_db"),
    "username": config("MONGO_USERNAME", default=""),
    "password": config("MONGO_PASSWORD", default=""),
}

AUTH_USER_MODEL = "authentication.LDAPUser"

# ── LDAP ──────────────────────────────────────────────────────────────────────
LDAP_CONFIG = {
    "SERVER":          config("LDAP_SERVER",          default="ldap://localhost:389"),
    "BASE_DN":         config("LDAP_BASE_DN",         default="dc=bcm,dc=int"),
    "BIND_DN":         config("LDAP_BIND_DN",         default="cn=admin,dc=bcm,dc=int"),
    "BIND_PASSWORD":   config("LDAP_BIND_PASSWORD",   default="admin123"),
    "USER_BASE":       config("LDAP_USER_BASE",       default="ou=departements,dc=bcm,dc=int"),
    "DEPARTMENT_BASE": config("LDAP_DEPARTMENT_BASE", default="ou=departements,dc=bcm,dc=int"),
    "ROLE_BASE":       config("LDAP_ROLE_BASE",       default="ou=roles,dc=bcm,dc=int"),
    "USER_FILTER":     "(uid={username})",
    "TIMEOUT":         10,
    "USE_SSL":         False,
}

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
        "file": {
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "logs/django.log",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console", "file"], "level": "INFO"},
    "loggers": {
        "authentication": {
            "handlers": ["console", "file"],
            "level": "DEBUG",
            "propagate": False,
        },
        "mail_integration": {
            "handlers": ["console", "file"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}

# ── Simple JWT ────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(minutes=120),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS":  True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM":    "HS256",
    "SIGNING_KEY":  SECRET_KEY,
    "VERIFYING_KEY": None,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME":  "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "authentication.serializers.CustomTokenObtainPairSerializer",
}

# ── Middleware ────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF      = "imap_data_extractor_api.urls"
WSGI_APPLICATION  = "imap_data_extractor_api.wsgi.application"
ASGI_APPLICATION  = "imap_data_extractor_api.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ── Base de données Django ────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE     = "UTC"
USE_I18N      = True
USE_TZ        = True

STATIC_URL        = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
