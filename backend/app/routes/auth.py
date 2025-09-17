from flask import Blueprint, render_template, request, jsonify, make_response, redirect, url_for, flash, current_app
from firebase_admin import auth
from datetime import datetime, timedelta

# Renomeado para auth_bp para clareza
auth_bp = Blueprint('auth_api', __name__)

@auth_bp.route('/login', methods=['GET'])
def login():
    """Apenas renderiza a página de login."""
    return render_template('auth/login.html')

@auth_bp.route('/sessionLogin', methods=['POST'])
def session_login():
    """
    Recebe o idToken do Firebase do frontend, verifica-o e cria um
    cookie de sessão HttpOnly, que será usado para autenticar
    requisições futuras.
    """
    try:
        id_token = request.json.get('idToken')
        # Cria o cookie de sessão. Duração de 5 dias.
        expires_in = timedelta(days=5)
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)
        
        # Cria a resposta de sucesso
        response = jsonify({"status": "success"})
        
        # Define o cookie na resposta
        expires = datetime.now() + expires_in
        response.set_cookie(
            # Usa o nome do cookie definido na config do app
            current_app.config['SESSION_COOKIE_NAME'], 
            session_cookie,
            expires=expires, 
            httponly=True, 
            secure=True, 
            samesite='Lax'
        )
        return response
    except Exception as e:
        # Retorna um 401 se o token for inválido
        return jsonify(error=f"Falha na autenticação: {e}"), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Limpa o cookie de sessão do navegador."""
    response = make_response(redirect(url_for('auth_api.login')))
    response.set_cookie(current_app.config['SESSION_COOKIE_NAME'], '', expires=0)
    flash("Você foi desconectado.", "info")
    return response