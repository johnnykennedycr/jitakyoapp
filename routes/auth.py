from flask import Blueprint, g, render_template, request, jsonify, make_response, redirect, url_for, flash
from firebase_admin import auth
from datetime import timedelta, datetime

from utils.decorators import role_required, token_required

# A função de inicialização e a variável global não são mais necessárias neste arquivo
auth_bp = Blueprint('auth', __name__, template_folder='../../templates')

@auth_bp.route('/login', methods=['GET'])
def login():
    """Apenas renderiza a página de login estática."""
    return render_template('auth/login.html')

@auth_bp.route('/api/create-session', methods=['POST'])
@token_required # 1. Primeiro, verificamos o token e colocamos o user em g.firebase_user
@role_required('student', 'teacher', 'receptionist', 'admin', 'super_admin') # 2. Depois, pegamos a role e colocamos em g.user
def create_session_cookie():
    try:
        id_token = request.json.get('idToken')
        expires_in = timedelta(days=5)
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)
        
        # 3. Agora, usamos o g.user (que os decoradores prepararam) para decidir a URL
        user = g.user
        if user.role in ['admin', 'super_admin']:
            redirect_url = url_for('admin.dashboard')
        elif user.role == 'teacher':
            redirect_url = url_for('teacher.dashboard')
        else:
            redirect_url = url_for('student.dashboard')

        # 4. Retornamos a URL no JSON
        response = jsonify({"success": True, "redirect_url": redirect_url})
        
        expires = datetime.now() + expires_in
        response.set_cookie(
            'jitakyo_session',
            session_cookie,
            expires=expires,
            httponly=True,
            secure=True,
            samesite='Lax'
        )
        return response

    except Exception as e:
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