from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import MailIntegrationView
from .views_account import OutlookAccountViewSet

# ── Router pour le compte Outlook de l'utilisateur (nouveau) ──
router = DefaultRouter()
router.register(r'account', OutlookAccountViewSet, basename='outlook-account')

urlpatterns = [
    # ══ Nouveau : gestion du compte mail IMAP/SMTP de l'utilisateur ══
    # GET    /outlook/account/       → récupérer la config
    # POST   /outlook/account/       → sauvegarder la config
    # POST   /outlook/account/test/  → tester la connexion IMAP
    # DELETE /outlook/account/{id}/  → supprimer la config
    path('', include(router.urls)),

    # ══ Existant : endpoints mail_integration d'origine ══
    path('webhook/',         MailIntegrationView.as_view({'post': 'outlook_webhook'}),        name='mail-integration-webhook'),
    path('test-connection/', MailIntegrationView.as_view({'get': 'test_outlook_connection'}), name='mail-integration-test'),
    path('start/',           MailIntegrationView.as_view({'get': 'start_outlook_auth'}),      name='mail-integration-start'),
    path('callback/',        MailIntegrationView.as_view({'get': 'outlook_callback'}),        name='mail-integration-callback'),
    path('status/',          MailIntegrationView.as_view({'get': 'outlook_status'}),          name='mail-integration-status'),
    path('disconnect/',      MailIntegrationView.as_view({'post': 'disconnect_outlook'}),     name='mail-integration-disconnect'),
    path('',                 MailIntegrationView.as_view({'get': 'list'}),                    name='mail-integration-list'),
    path('<str:pk>/',        MailIntegrationView.as_view({'get': 'retrieve'}),                name='mail-integration-detail'),
]