# routes/auth.py (VERSÃO FINAL)
from flask import Blueprint, render_template, request, jsonify, make_response, redirect, url_for, flash
from firebase_admin import auth
from datetime import timedelta, datetime

auth_bp = Blueprint('auth', __name__, template_folder='../../templates')

@auth_bp.route('/login', methods=['GET'])
def login():
    """Apenas renderiza a página de login."""
    return render_template('auth/login.html')

@auth_bp.route('/sessionLogin', methods=['POST'])
def session_login():
    """Recebe o idToken do Firebase e cria um cookie de sessão."""
    try:
        id_token = request.json.get('idToken')
        expires_in = timedelta(days=5) # O cookie durará 5 dias
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)
        
        response = jsonify({"status": "success"})
        expires = datetime.now() + expires_in
        response.set_cookie(
            'jitakyo_session', session_cookie,
            expires=expires, httponly=True, secure=True, samesite='Lax'
        )
        return response
    except Exception as e:
        return jsonify(error=str(e)), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Limpa o cookie de sessão."""
    response = make_response(redirect(url_for('auth.login')))
    response.set_cookie('jitakyo_session', '', expires=0)
    flash("Você foi desconectado com segurança.", "info")
    return response