# backend/app/routes/user_routes.py

from flask import Blueprint, jsonify, g
from app.utils.decorators import login_required

# Renomeamos para user_bp para clareza e adicionamos /api ao prefixo
user_bp = Blueprint('user_api', __name__, url_prefix='/api/users')

@user_bp.route('/me')
@login_required
def get_current_user_profile():
    """
    Retorna o perfil do usuário atualmente logado.
    O decorador @login_required garante que o usuário está autenticado
    e já busca o perfil dele no Firestore, colocando-o em g.user.
    """
    if hasattr(g, 'user') and g.user:
        return jsonify(g.user.to_dict()), 200
    else:
        # Isso não deve acontecer se @login_required funcionar corretamente
        return jsonify(error="Usuário não encontrado no contexto da requisição."), 404