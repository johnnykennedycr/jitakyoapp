# routes/auth.py (VERSÃO FINAL CORRIGIDA)

from flask import Blueprint, render_template, request, jsonify, make_response, redirect, url_for, flash
from firebase_admin import auth
from datetime import datetime, timedelta

# NÃO importamos o user_service aqui. Apenas criamos a variável para recebê-lo.
user_service = None
auth_bp = Blueprint('auth', __name__, template_folder='../../templates')

def init_auth_bp(service):
    """Esta função 'injeta' a instância do UserService criada no main.py."""
    global user_service
    user_service = service

@auth_bp.route('/login', methods=['GET'])
def login():
    """Renderiza a página de login."""
    return render_template('auth/login.html')

@auth_bp.route('/sessionLogin', methods=['POST'])
def session_login():
    """Recebe o idToken e cria o cookie de sessão."""
    try:
        id_token = request.json.get('idToken')
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        
        # Agora o user_service é a instância correta e a chamada vai funcionar
        user = user_service.get_user_by_id(uid)
        if not user:
            return jsonify({"error": "Usuário autenticado mas não encontrado no banco de dados."}), 404

        if user.role in ['admin', 'super_admin']:
            redirect_url = url_for('admin.dashboard')
        elif user.role == 'teacher':
            redirect_url = url_for('teacher.dashboard')
        else:
            redirect_url = url_for('student.dashboard')

        expires_in = timedelta(days=5)
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)
        
        response = jsonify({"status": "success", "redirect_url": redirect_url})
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