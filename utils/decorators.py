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
            if 'firebase_user' not in g:
                return jsonify({'message': 'Erro de configuração: @role_required sem @token_required.'}), 500

            user_uid = g.firebase_user['uid']
            
            print("\n--- DIAGNÓSTICO DO DECORADOR @role_required ---")
            print(f"1. UID do token do Firebase: {user_uid}")
            print(f"2. Roles permitidas para esta rota: {roles}")

            user_from_db = user_service.get_user_by_id(user_uid)
            
            if not user_from_db:
                 print("!!! FALHA: Usuário não foi encontrado no Firestore com o UID acima.")
                 flash('Usuário não encontrado no banco de dados.', 'danger')
                 return redirect(url_for('auth.login'))

            # Acessa a role do objeto User que veio do Firestore
            user_role = user_from_db.role
            
            print(f"3. Role encontrada no objeto User do Firestore: '{user_role}'")
            print(f"4. Tipo da variável 'user_role': {type(user_role)}")
            
            check_passes = user_role in roles
            print(f"5. Resultado da verificação ('{user_role}' in {roles}): {check_passes}")

            if not check_passes:
                print("!!! ACESSO NEGADO PELA ROLE !!! Redirecionando para /login.")
                flash('Você não tem permissão para acessar esta página.', 'danger')
                return redirect(url_for('auth.login')) 
            
            g.user = user_from_db
            print("--- ACESSO PERMITIDO. Executando a função da rota. ---")
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator