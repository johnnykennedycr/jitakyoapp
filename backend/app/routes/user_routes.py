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
    

    if not hasattr(g, 'user') or not g.user:
        
        return jsonify({'error': 'Usuário não encontrado no contexto da requisição.'}), 404

   

    try:
        user_data = g.user.to_dict()
        
        return jsonify(user_data), 200
    except Exception as e:
        print(f"ERRO CRÍTICO (user_routes): Falha ao chamar to_dict(): {e}")
        return jsonify({'error': 'Falha interna ao serializar dados do usuário.'}), 500