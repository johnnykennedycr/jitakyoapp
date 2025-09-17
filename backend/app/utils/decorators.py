# backend/app/utils/decorators.py (VERSÃO FINAL)

from functools import wraps
from flask import request, redirect, url_for, g, flash, jsonify
from firebase_admin import auth

# user_service é injetado pelo main.py
user_service = None

def init_decorators(service):
    global user_service
    user_service = service

# backend/app/utils/decorators.py (VERSÃO FINAL)

from functools import wraps
from flask import request, redirect, url_for, g, flash, jsonify
from firebase_admin import auth

# user_service é injetado pelo main.py
user_service = None

def init_decorators(service):
    global user_service
    user_service = service

def login_required(f):
    """
    Verifica o cookie de sessão E busca o perfil completo do usuário no Firestore,
    anexando-o a g.user.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_cookie = request.cookies.get('jitakyo_session')
        if not session_cookie:
            # Para APIs, retornamos um erro JSON. Para páginas, redirecionamos.
            if request.path.startswith('/api/'):
                return jsonify(error="Cookie de sessão ausente."), 401
            flash('Por favor, faça o login para acessar esta página.', 'warning')
            return redirect(url_for('auth_api.login', next=request.url))
        
        try:
            decoded_claims = auth.verify_session_cookie(session_cookie, check_revoked=True)
            
            # PASSO CRUCIAL: BUSCA O USUÁRIO NO FIRESTORE
            user_uid = decoded_claims['uid']
            user_from_db = user_service.get_user_by_id(user_uid)
            
            if not user_from_db:
                if request.path.startswith('/api/'):
                    return jsonify(error="Usuário não encontrado no banco de dados."), 404
                flash('Seu usuário foi autenticado, mas não encontrado em nosso banco de dados.', 'danger')
                return redirect(url_for('auth_api.login'))

            # Anexa o objeto de usuário completo do nosso banco ao contexto g
            g.user = user_from_db

        except auth.InvalidSessionCookieError:
            if request.path.startswith('/api/'):
                return jsonify(error="Sessão inválida ou expirada."), 401
            flash('Sua sessão é inválida ou expirou. Por favor, faça o login novamente.', 'danger')
            return redirect(url_for('auth_api.login'))
        except Exception as e:
            print(f"Erro inesperado no decorador login_required: {e}")
            if request.path.startswith('/api/'):
                return jsonify(error="Erro interno de autenticação."), 500
            flash('Ocorreu um erro na autenticação.', 'danger')
            return redirect(url_for('auth_api.login'))

        return f(*args, **kwargs)
    return decorated_function


def role_required(*roles):
    """
    Verifica a role do usuário. Assume que g.user já existe.
    DEVE ser usado DEPOIS de @login_required.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'user') or g.user.role not in roles:
                if request.path.startswith('/api/'):
                    return jsonify(error="Permissão negada."), 403
                flash('Você não tem permissão para acessar esta página.', 'danger')
                return redirect(url_for('auth_api.login')) 
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def role_required(*roles):
    """
    Verifica a role do usuário. Assume que g.user já existe.
    DEVE ser usado DEPOIS de @login_required.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'user') or g.user.role not in roles:
                if request.path.startswith('/api/'):
                    return jsonify(error="Permissão negada."), 403
                flash('Você não tem permissão para acessar esta página.', 'danger')
                return redirect(url_for('auth_api.login')) 
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator