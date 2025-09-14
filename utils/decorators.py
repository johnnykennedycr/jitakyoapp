from functools import wraps
from flask import request, redirect, url_for, g, flash
from firebase_admin import auth

# O user_service continua sendo injetado para buscar as roles do Firestore
user_service = None

def init_decorators(service):
    """Função para injetar o user_service nos decoradores."""
    global user_service
    user_service = service

def session_login_required(f):
    """
    Novo decorador principal. Verifica o cookie de sessão do Firebase.
    Se válido, anexa as informações do usuário ao contexto 'g'.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 1. Tenta obter o cookie de sessão da requisição
        session_cookie = request.cookies.get('jitakyo_session')
        if not session_cookie:
            # Se não houver cookie, o usuário não está logado. Redireciona para o login.
            flash('Por favor, faça o login para acessar esta página.', 'warning')
            return redirect(url_for('auth.login'))

        try:
            # 2. Usa o Firebase Admin SDK para verificar se o cookie é válido e não foi revogado
            decoded_token = auth.verify_session_cookie(session_cookie, check_revoked=True)
            
            # 3. Anexa o usuário decodificado ao contexto da requisição (g)
            g.firebase_user = decoded_token
            
        except auth.InvalidSessionCookieError:
            # O cookie é inválido ou expirou. Redireciona para o login.
            flash('Sua sessão é inválida ou expirou. Por favor, faça o login novamente.', 'danger')
            return redirect(url_for('auth.login'))
        except Exception as e:
            print(f"Erro inesperado na verificação do cookie de sessão: {e}")
            flash('Ocorreu um erro na autenticação. Tente novamente.', 'danger')
            return redirect(url_for('auth.login'))

        return f(*args, **kwargs)
    return decorated_function


def role_required(*roles):
    """
    Verifica se o usuário logado tem uma das funções (roles) necessárias.
    Este decorador DEVE ser usado DEPOIS de @session_login_required.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # g.firebase_user foi definido pelo decorador @session_login_required
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
                # Idealmente, redirecionar para um dashboard padrão ou página inicial
                return redirect(url_for('auth.login')) 
            
            # Anexa o objeto de usuário completo do nosso banco de dados ao contexto g
            # para que as rotas possam usá-lo
            g.user = user_from_db
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
