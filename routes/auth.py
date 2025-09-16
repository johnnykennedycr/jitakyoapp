from flask import Blueprint, render_template, request, jsonify, make_response, redirect, url_for, flash
from firebase_admin import auth
from datetime import datetime, timedelta

# Importamos o user_service global que será inicializado no main.py
from services.user_service import user_service

auth_bp = Blueprint('auth', __name__, template_folder='../../templates')

@auth_bp.route('/login', methods=['GET'])
def login():
    """Apenas renderiza a página de login."""
    return render_template('auth/login.html')

@auth_bp.route('/sessionLogin', methods=['POST'])
def session_login():
    """Recebe o idToken, cria um cookie de sessão e retorna a URL de redirect correta."""
    try:
        id_token = request.json.get('idToken')
        
        # Verifica o idToken para obter o UID do usuário
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        
        # Usa o UID para buscar o perfil completo do usuário no Firestore
        user = user_service.get_user_by_id(uid)
        if not user:
            return jsonify({"error": "Usuário autenticado mas não encontrado no banco de dados."}), 404

        # Determina a URL de redirecionamento com base na role
        if user.role in ['admin', 'super_admin']:
            redirect_url = url_for('admin.dashboard')
        elif user.role == 'teacher':
            redirect_url = url_for('teacher.dashboard')
        else: # student
            redirect_url = url_for('student.dashboard')

        # Cria o cookie de sessão
        expires_in = timedelta(days=5)
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)
        
        # Cria a resposta JSON com a URL de redirect
        response = jsonify({"status": "success", "redirect_url": redirect_url})
        
        # Anexa o cookie de sessão à resposta
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