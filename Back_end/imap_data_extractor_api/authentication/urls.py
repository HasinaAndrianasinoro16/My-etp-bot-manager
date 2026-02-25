from django.urls import path
from .views import(
    login_view,
    logout_view,
)

urlpatterns = [
    path('login/', login_view, name='login'),
    
    # Logout
    path('logout/', logout_view, name='logout'),

]