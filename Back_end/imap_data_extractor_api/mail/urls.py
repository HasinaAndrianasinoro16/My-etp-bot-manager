from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MailViewSet, outlook_callback

router = DefaultRouter()
router.register(r'', MailViewSet, basename='mail')

urlpatterns = [
    # ✅ Callback OAuth2 Outlook — AllowAny, hors ViewSet
    path('callback/', outlook_callback, name='outlook-callback'),
    path('', include(router.urls)),
]