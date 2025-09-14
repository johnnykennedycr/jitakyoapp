from flask import Blueprint, g, render_template, request, jsonify, url_for
from firebase_admin import auth

from utils.decorators import token_required

# O user_service não é mais necessário para a autenticação básica,
# mas pode ser útil para outras funções, como o registro.
user_service = None
auth_bp = Blueprint('auth', __name__, template_folder='../../templates')

def init_auth_bp(service):
    """Inicializa o blueprint de autenticação com o serviço de usuário."""
    global user_service
    user_service = service

@auth_bp.route('/login', methods=['GET'])
def login():
    """Apenas renderiza a página de login estática."""
    return render_template('auth/login.html')

@auth_bp.route('/api/login-session', methods=['POST'])
@token_required
def create_login_session():
    """
    Esta rota é chamada pelo frontend DEPOIS que o Firebase Auth confirma o login.
    Ela usa o token para buscar a role do usuário no Firestore e retornar
    a URL de redirecionamento correta.
    """
    # O decorador @token_required já verificou o token e o @role_required
    # (dentro de @token_required) já buscou o usuário do nosso banco e o colocou em g.user
    user = g.user

    if not user:
        return jsonify({'success': False, 'message': 'Usuário não encontrado no banco de dados.'}), 404

    # Lógica para determinar o dashboard correto baseado na role
    if user.role == 'admin' or user.role == 'super_admin':
        redirect_url = url_for('admin.dashboard')
    elif user.role == 'teacher':
        redirect_url = url_for('teacher.dashboard')
    else: # student
        redirect_url = url_for('student.dashboard')

    return jsonify({'success': True, 'redirect_url': redirect_url})
