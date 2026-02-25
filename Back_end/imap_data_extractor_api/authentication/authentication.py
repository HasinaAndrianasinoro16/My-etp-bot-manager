from rest_framework_simplejwt.authentication import JWTAuthentication
import logging

logger = logging.getLogger(__name__)

class CustomJWTAuthentication(JWTAuthentication):   
    """
    Authentication JWT personnalisée pour extraire le rôle du token
    """
    
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None
        
        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None
        
        validated_token = self.get_validated_token(raw_token)
        user = self.get_user_from_token(validated_token)
        
        return (user, validated_token)
    
    def get_user_from_token(self, validated_token):
        from types import SimpleNamespace
        
        uid_number = validated_token.get('uid_number')
        email      = validated_token.get('email', '')
        username   = validated_token.get('username', '')
        ldap_dn    = validated_token.get('ldap_dn', '')
        role       = validated_token.get('role', 'user')

        # LOG TEMPORAIRE — à supprimer après debug
        logger.info(f"TOKEN DECODE role={role} uid_number={uid_number}")

        user = SimpleNamespace(
            uid_number=uid_number,
            email=email,
            username=username,
            ldap_dn=ldap_dn,
            ldap_role=role,
            is_authenticated=True,
            is_active=True
        )
        
        return user