# backend/app/routes/user_routes.py

from flask import Blueprint, jsonify, g

# Importe o decorator que estamos usando para proteger a rota
from app.utils.decorators import login_required

# Lembre-se de que padronizamos o nome para 'user_api_bp'
user_api_bp = Blueprint('user_api', __name__, url_prefix='/api/users')

user_service = None

def init_user_bp(us):
    """Inicializa o blueprint com o serviço de usuário."""
    global user_service
    user_service = us

@user_api_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """
    Retorna os dados do usuário atualmente logado.
    """
    print("DEBUG (user_routes): Entrou na rota /api/users/me.")

    if not hasattr(g, 'user') or not g.user:
        print("DEBUG (user_routes): Erro! g.user não encontrado após o decorator.")
        return jsonify({'error': 'Usuário não encontrado no contexto da requisição.'}), 404

    print(f"DEBUG (user_routes): Objeto g.user encontrado: {g.user}")

    try:
        user_data = g.user.to_dict()
        print(f"DEBUG (user_routes): Dados do usuário convertidos para dict: {user_data}")
        return jsonify(user_data), 200
    except Exception as e:
        print(f"ERRO CRÍTICO (user_routes): Falha ao chamar to_dict(): {e}")
        return jsonify({'error': 'Falha interna ao serializar dados do usuário.'}), 500