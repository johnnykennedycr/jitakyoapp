from flask import Blueprint, jsonify, g
from services.user_service import UserService
from services.class_service import ClassService
from services.payment_service import PaymentService
from utils.decorators import role_required # Corrigido para importar do seu arquivo

# Esta é uma representação para a lógica de rotas.
# No seu padrão Factory, os serviços serão injetados corretamente.
# A inicialização real acontece em main.py
user_service = UserService()
class_service = ClassService()
payment_service = PaymentService()

student_bp = Blueprint('student_routes', __name__, url_prefix='/api/student')

@student_bp.route('/profile', methods=['GET'])
@role_required('student')
def get_student_profile():
    """
    Retorna os dados do perfil do aluno logado.
    O decorator já anexa o usuário ao 'g'.
    """
    # O decorator `role_required` já executou `login_required`,
    # então g.user está disponível e é o objeto completo do usuário.
    return jsonify(g.user.to_dict()), 200

@student_bp.route('/enrollments', methods=['GET'])
@role_required('student')
def get_student_enrollments():
    """
    Retorna as matrículas ativas e o histórico de presença do aluno logado.
    """
    uid = g.user.id # Acessando o ID do usuário a partir de g.user
    try:
        enrollments_with_details = class_service.get_enrollments_by_student_id(uid)
        return jsonify(enrollments_with_details), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar matrículas: {str(e)}"}), 500
        
@student_bp.route('/payments', methods=['GET'])
@role_required('student')
def get_student_payments():
    """
    Retorna o histórico de cobranças e pagamentos do aluno logado.
    """
    uid = g.user.id # Acessando o ID do usuário a partir de g.user
    try:
        payments = payment_service.get_charges_by_user_id(uid)
        return jsonify(payments), 200
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar dados financeiros: {str(e)}"}), 500

