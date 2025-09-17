# backend/app/utils/decorators.py (VERSÃO FINAL CORRIGIDA)

from functools import wraps
from flask import request, g, jsonify # Removido redirect, url_for, flash
from firebase_admin import auth

user_service = None

def init_decorators(service):
    global user_service
    user_service = service

def login_required(f):
    """Verifica se um token válido foi enviado no cabeçalho Authorization."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers and request.headers['Authorization'].startswith('Bearer '):
            token = request.headers['Authorization'].split(' ')[1]

        if not token:
            # RETORNA UM ERRO JSON, NÃO UM REDIRECT
            return jsonify(error="Token de autorização ausente."), 401

        try:
            decoded_token = auth.verify_id_token(token)
            g.firebase_user = decoded_token
        except Exception as e:
            # RETORNA UM ERRO JSON, NÃO UM REDIRECT
            return jsonify(error=f"Token inválido ou expirado: {e}"), 401

        return f(*args, **kwargs)
    return decorated_function


def role_required(*roles):
    """Verifica a role do usuário. Deve ser usado DEPOIS de @login_required."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'firebase_user' not in g:
                return jsonify(error='Erro de configuração: @role_required sem @login_required.'), 500

            user_uid = g.firebase_user['uid']
            user_from_db = user_service.get_user_by_id(user_uid)
            
            if not user_from_db:
                # RETORNA UM ERRO JSON, NÃO UM REDIRECT
                return jsonify(error="Usuário não encontrado no banco de dados."), 404

            if user_from_db.role not in roles:
                # RETORNA UM ERRO JSON, NÃO UM REDIRECT
                return jsonify(error="Permissão negada."), 403
            
            g.user = user_from_db
            return f(*args, **kwargs)
        return decorated_function
    return decorator