from functools import wraps
from flask import request, jsonify, g, flash, redirect, url_for
from firebase_admin import auth, firestore

# O user_service será necessário para buscar as roles do Firestore
# Vamos inicializá-lo a partir do app no main.py
user_service = None

def init_decorators(service):
    """Função para injetar o user_service nos decoradores."""
    global user_service

    user_service = service


def token_required(f):
    """Verifica se um ID Token do Firebase foi enviado e é válido."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        # O token é enviado no cabeçalho 'Authorization' como "Bearer <token>"
        if 'Authorization' in request.headers:
            try:
                token = request.headers['Authorization'].split(' ')[1]
            except IndexError:
                # Cabeçalho malformatado
                return jsonify({'message': 'Cabeçalho de autorização malformatado.'}), 401
        
        if not token:
            # Em um cenário de navegador, se o token não estiver no header,
            # podemos redirecionar para o login.
            flash('Por favor, faça o login para acessar esta página.', 'warning')
            return redirect(url_for('auth.login'))

        try:
            # Usa o Firebase Admin SDK para verificar a validade do token
            decoded_token = auth.verify_id_token(token)
            
            # Anexa o usuário decodificado ao contexto da requisição (g)
            # 'g' é um objeto especial do Flask que dura por uma única requisição
            g.firebase_user = decoded_token

        except auth.InvalidIdTokenError:
            flash('Token de autenticação inválido. Por favor, faça o login novamente.', 'danger')
            return redirect(url_for('auth.login'))
        except auth.ExpiredIdTokenError:
            flash('Sua sessão expirou. Por favor, faça o login novamente.', 'danger')
            return redirect(url_for('auth.login'))
        except Exception as e:
            # Em caso de outros erros, é bom logar e dar uma resposta genérica
            print(f"Erro inesperado na verificação do token: {e}")
            return jsonify({'message': 'Erro interno na verificação do token.'}), 500

        return f(*args, **kwargs)
    return decorated_function


def role_required(*roles):
    """
    Verifica se o usuário logado tem uma das funções (roles) necessárias.
    Este decorador DEVE ser usado DEPOIS de @token_required.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # g.firebase_user foi definido pelo decorador @token_required
            if 'firebase_user' not in g:
                # Isso não deveria acontecer se os decoradores forem usados na ordem correta
                return jsonify({'message': 'Erro de configuração: @role_required sem @token_required.'}), 500

            user_uid = g.firebase_user['uid']
            
            # Busca o usuário no Firestore para obter a role atualizada
            user_from_db = user_service.get_user_by_id(user_uid)
            
            if not user_from_db:
                 flash('Usuário não encontrado no banco de dados.', 'danger')
                 return redirect(url_for('auth.login'))

            user_role = user_from_db.role

            if user_role not in roles:
                flash('Você não tem permissão para acessar esta página.', 'danger')
                # Redireciona para um dashboard padrão ou para a página de login
                return redirect(url_for('auth.login')) 
            
            # Anexa o objeto de usuário completo do nosso banco de dados ao contexto g
            g.user = user_from_db
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator