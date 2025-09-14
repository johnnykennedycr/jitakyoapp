from flask import Blueprint, render_template, request, jsonify
from firebase_admin import auth

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
    """
    Renderiza a página de login.
    A lógica de autenticação agora é 100% no frontend com o Firebase SDK.
    O método POST foi removido, pois não é mais usado pelo nosso backend.
    """
    return render_template('auth/login.html')

