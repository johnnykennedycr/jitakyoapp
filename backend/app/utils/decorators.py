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
        auth_header = request.headers.get('Authorization')
        print(f"--- DEBUG: Cabeçalho Authorization recebido: {auth_header}") # LOG 1

        if not auth_header or not auth_header.startswith('Bearer '):
            print("--- DEBUG: Cabeçalho ausente ou mal formatado.") # LOG 2
            return jsonify({'error': 'Authorization header is missing or invalid'}), 401

        id_token = auth_header.split('Bearer ')[1]
        # print(f"--- DEBUG: Token extraído: {id_token[:30]}...") # Opcional: não logue o token inteiro

        try:
            decoded_token = auth.verify_id_token(id_token)
            uid = decoded_token['uid']
            print(f"--- DEBUG: Token verificado com sucesso para UID: {uid}") # LOG 3

            # ... busca o usuário no serviço
            g.user = user_service.get_user_by_id(uid)
            if g.user is None:
                print(f"--- DEBUG: UID {uid} verificado, mas não encontrado no Firestore.") # LOG 4
                return jsonify({'error': 'User not found in database'}), 401

        except auth.InvalidIdTokenError as e:
            print(f"--- DEBUG: Token inválido: {e}") # LOG 5
            return jsonify({'error': 'Invalid token provided'}), 401
        except Exception as e:
            print(f"--- DEBUG: Erro inesperado na verificação: {e}") # LOG 6
            return jsonify({'error': f'An unexpected error occurred: {e}'}), 401

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

