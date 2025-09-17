from flask import Blueprint, render_template, request, jsonify, make_response, redirect, url_for, flash, current_app
from firebase_admin import auth
from datetime import datetime, timedelta

auth_bp = Blueprint('auth_api', __name__, url_prefix='')

@auth_bp.route('/')
def index():
    """Redireciona a rota raiz para a página de login."""
    return redirect(url_for('auth_api.login'))

@auth_bp.route('/login', methods=['GET'])
def login():
    return render_template('auth/login.html')

@auth_bp.route('/sessionLogin', methods=['POST'])
def session_login():
    try:
        id_token = request.json.get('idToken')
        expires_in = timedelta(days=5)
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)
        
        response = jsonify({"status": "success"})
        expires = datetime.now() + expires_in
        response.set_cookie(
            current_app.config['SESSION_COOKIE_NAME'], 
            session_cookie,
            expires=expires, httponly=True, secure=True, samesite='Lax'
        )
        return response
    except Exception as e:
        return jsonify(error=str(e)), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    response = make_response(redirect(url_for('auth_api.login')))
    response.set_cookie(current_app.config['SESSION_COOKIE_NAME'], '', expires=0)
    flash("Você foi desconectado.", "info")
    return response