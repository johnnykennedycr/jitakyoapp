from flask import Blueprint, jsonify, g

# Garante que estamos a usar os decorators e serviços corretos da sua aplicação
from app.utils.decorators import role_required
from app.services.user_service import UserService
from app.services.enrollment_service import EnrollmentService
from app.services.training_class_service import TrainingClassService
from app.services.attendance_service import AttendanceService
from app.services.payment_service import PaymentService

# Esta linha é a mais importante: define o prefixo para todas as rotas neste ficheiro.
student_api_bp = Blueprint('student_api', __name__, url_prefix='/api/student')

# Variáveis globais para guardar as instâncias dos serviços
_user_service: UserService = None
_enrollment_service: EnrollmentService = None
_payment_service: PaymentService = None

def init_student_bp(user_service, enrollment_service, training_class_service, attendance_service, payment_service):
    """Inicializa o Blueprint com as instâncias dos serviços."""
    global _user_service, _enrollment_service, _payment_service
    _user_service = user_service
    _enrollment_service = enrollment_service
    _payment_service = payment_service


@student_api_bp.route('/profile', methods=['GET'])
@role_required('student')
def get_student_profile():
    """Retorna os dados do perfil do aluno logado."""
    try:
        # O decorator `role_required` já colocou o perfil do usuário em `g.user`
        return jsonify(g.user.to_dict()), 200
    except Exception as e:
        print(f"Erro ao buscar perfil do aluno: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@student_api_bp.route('/classes', methods=['GET'])
@role_required('student')
def get_student_classes():
    """Retorna as turmas em que o aluno está matriculado."""
    try:
        student_id = g.user.id
        enrollments = _enrollment_service.get_enrollments_by_student_id(student_id)
        return jsonify(enrollments), 200
    except Exception as e:
        print(f"Erro ao buscar turmas do aluno: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@student_api_bp.route('/payments', methods=['GET'])
@role_required('student')
def get_student_payments():
    """Retorna o histórico de cobranças e pagamentos do aluno."""
    try:
        student_id = g.user.id
        charges = _payment_service.get_charges_by_user_id(student_id)
        return jsonify(charges), 200
    except Exception as e:
        print(f"Erro ao buscar financeiro do aluno: {e}")
        return jsonify({'error': 'Internal server error'}), 500

