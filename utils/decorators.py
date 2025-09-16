# utils/decorators.py ATUALIZADO E FINAL

from functools import wraps
from flask import request, redirect, url_for, g, flash
from firebase_admin import auth

# O user_service continua sendo injetado para buscar as roles do Firestore
user_service = None

def init_decorators(service):
    """Função para injetar o user_service nos decoradores."""
    global user_service
    user_service = service

def login_required(f):
    """Verifica se um cookie de sessão válido do Firebase está presente."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_cookie = request.cookies.get('jitakyo_session')
        if not session_cookie:
            flash('Por favor, faça o login para acessar esta página.', 'warning')
            return redirect(url_for('auth.login', next=request.url))
        try:
            # Verifica o cookie. Se for válido, o usuário está autenticado.
            decoded_claims = auth.verify_session_cookie(session_cookie, check_revoked=True)
            g.user = decoded_claims # Armazena os dados do usuário para a requisição
        except auth.InvalidSessionCookieError:
            flash('Sessão inválida. Por favor, faça o login novamente.', 'danger')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function


def role_required(*roles):
    """
    Verifica se o usuário logado tem uma das funções (roles) necessárias.
    Este decorador DEVE ser usado DEPOIS de @login_required.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # g.firebase_user foi definido pelo decorador @token_required
            if 'firebase_user' not in g:
                # Falha de segurança/configuração, redireciona por precaução
                flash('Erro interno de autenticação.', 'danger')
                return redirect(url_for('auth.login'))

            user_uid = g.firebase_user['uid']
            
            # Busca o usuário no Firestore para obter a role mais recente
            user_from_db = user_service.get_user_by_id(user_uid)
            
            if not user_from_db:
                 flash('Seu usuário não foi encontrado em nosso banco de dados.', 'danger')
                 return redirect(url_for('auth.login'))

            if user_from_db.role not in roles:
                flash('Você não tem permissão para acessar esta página.', 'danger')
                return redirect(url_for('auth.login')) 
            
            # Anexa o objeto de usuário completo do nosso banco de dados ao contexto g
            # para que as rotas possam usá-lo
            g.user = user_from_db
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator