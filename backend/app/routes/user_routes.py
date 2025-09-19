from flask import Blueprint, jsonify, g
from app.utils.decorators import login_required

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
    O decorator @login_required já buscou o usuário e o colocou em g.user.
    """
    if not hasattr(g, 'user') or not g.user:
        return jsonify({'error': 'Usuário não encontrado no contexto da requisição.'}), 404

    # O objeto g.user é uma instância da nossa classe User.
    # O método to_dict() o converte para um formato JSON compatível.
    user_data = g.user.to_dict()
    
    # Adicionamos o ID manualmente, pois ele é o ID do documento
    user_data['id'] = g.user.id
    
    return jsonify(user_data), 200