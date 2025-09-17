# backend/app/utils/decorators.py (VERSÃO FINAL)

from functools import wraps
from flask import request, g, jsonify
from firebase_admin import auth

user_service = None

def init_decorators(service):
    global user_service
    user_service = service

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers and request.headers['Authorization'].startswith('Bearer '):
            token = request.headers['Authorization'].split(' ')[1]

        if not token:
            return jsonify(error="Token de autorização ausente."), 401

        try:
            decoded_token = auth.verify_id_token(token)
            
            # Busca o usuário no Firestore para ter o perfil completo (incluindo a role)
            user_from_db = user_service.get_user_by_id(decoded_token['uid'])
            if not user_from_db:
                return jsonify(error="Usuário autenticado não encontrado no banco de dados."), 404
            
            # Anexa o objeto User completo ao contexto da requisição
            g.user = user_from_db
            
        except Exception as e:
            return jsonify(error=f"Token inválido ou expirado: {e}"), 401

        return f(*args, **kwargs)
    return decorated_function


def role_required(*roles):
    def decorator(f):
        @wraps(f) # <--- Esta linha deve estar AQUI DENTRO
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'user') or g.user.role not in roles:
                
                return jsonify(error="Permissão negada para este recurso."), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

