from flask import Blueprint, render_template, request, jsonify, make_response, redirect, url_for, flash
from firebase_admin import auth
from datetime import timedelta

# A função de inicialização e a variável global não são mais necessárias neste arquivo
auth_bp = Blueprint('auth', __name__, template_folder='../../templates')

@auth_bp.route('/login', methods=['GET'])
def login():
    """Apenas renderiza a página de login estática."""
    return render_template('auth/login.html')

@auth_bp.route('/api/create-session', methods=['POST'])
def create_session_cookie():
    """
    Recebe o idToken do frontend, verifica sua validade e o troca
    por um cookie de sessão seguro, HttpOnly.
    """
    try:
        # 1. Pega o idToken enviado pelo corpo da requisição do frontend
        id_token = request.json.get('idToken')
        if not id_token:
            return jsonify({"success": False, "message": "ID Token não fornecido."}), 400

        # 2. Define o tempo de validade do cookie (ex: 5 dias)
        expires_in = timedelta(days=5)
        
        # 3. Usa o Firebase Admin SDK para criar o cookie de sessão
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)
        
        # 4. Cria uma resposta JSON de sucesso
        response = jsonify({"success": True, "message": "Sessão criada com sucesso."})
        
        # 5. Anexa o cookie de sessão à resposta
        expires = datetime.now() + expires_in
        response.set_cookie(
            'jitakyo_session',  # O mesmo nome que definimos no main.py
            session_cookie,
            expires=expires,
            httponly=True,  # Impede acesso via JavaScript no frontend
            secure=True,    # Garante que só seja enviado via HTTPS
            samesite='Lax'
        )
        
        return response

    except Exception as e:
        print(f"Erro ao criar o cookie de sessão: {e}")
        # Retorna um erro que o frontend pode interpretar
        return jsonify({"success": False, "message": f"Erro de autenticação: {e}"}), 401


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    Limpa o cookie de sessão do navegador, efetivamente deslogando o usuário.
    """
    # Cria uma resposta de redirecionamento
    response = make_response(redirect(url_for('auth.login')))
    
    # Remove o cookie de sessão
    response.set_cookie('jitakyo_session', '', expires=0)
    
    flash("Você foi desconectado com segurança.", "info")
    return response