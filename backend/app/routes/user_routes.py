from flask import Blueprint, jsonify, g
from app.utils.decorators import login_required

user_bp = Blueprint('user_api', __name__, url_prefix='/api/users')

@user_bp.route('/me')
@login_required
def get_current_user_profile():
    """Retorna o perfil do usuário atualmente logado."""
    # O decorador @login_required já fez todo o trabalho e colocou o usuário em g.user
    return jsonify(g.user.to_dict()), 200