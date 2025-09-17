# /app/utils/decorators.py

from flask import g, jsonify, request
from firebase_admin import auth
from functools import wraps

# 1. Declare a variável de serviço no escopo do módulo
user_service = None

# 2. Crie a função que irá receber a instância do serviço
def init_decorators(us):
    """Inicializa os decorators com as instâncias de serviço necessárias."""
    global user_service
    user_service = us
    print("--- INFO: Decorators inicializados com UserService.")


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Agora podemos ter certeza que 'user_service' não é None
        if not user_service:
            print("--- ERRO FATAL: Módulo de decorators não foi inicializado com os serviços.")
            return jsonify({'error': 'Internal server configuration error'}), 500

        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization header is missing or invalid'}), 401

        id_token = auth_header.split('Bearer ')[1]
        
        try:
            decoded_token = auth.verify_id_token(id_token)
            uid = decoded_token['uid']
            
            # Esta linha agora vai funcionar!
            g.user = user_service.get_user_by_id(uid)
            
            if g.user is None:
                return jsonify({'error': 'User not found in database for the given token'}), 401
        
        except auth.InvalidIdTokenError:
            return jsonify({'error': 'Invalid token provided'}), 401
        except Exception as e:
            # Captura outros erros, como o que vimos
            print(f"--- ERRO: Erro inesperado no decorator: {e}")
            return jsonify({'error': f'An unexpected error occurred: {e}'}), 500
            
        return f(*args, **kwargs)
    return decorated_function


def role_required(*roles):
    def wrapper(f):
        @wraps(f)
        @login_required  # Garante que login_required execute primeiro
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'user') or not g.user:
                return jsonify({'error': 'User not found in request context'}), 401
            
            if g.user.role not in roles:
                return jsonify({'error': 'Permission denied for this role'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return wrapper