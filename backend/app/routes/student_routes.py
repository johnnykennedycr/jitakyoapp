from flask import Blueprint, jsonify, g
from app.utils.decorators import role_required
from app.services.user_service import UserService
from app.services.enrollment_service import EnrollmentService
from app.services.training_class_service import TrainingClassService
from app.services.attendance_service import AttendanceService
from app.services.payment_service import PaymentService

# 1. Crie o Blueprint
student_api_bp = Blueprint('student_api', __name__, url_prefix='/api/student')

# 2. Variáveis para armazenar as instâncias dos serviços
_user_service: UserService = None
_enrollment_service: EnrollmentService = None
_training_class_service: TrainingClassService = None
_attendance_service: AttendanceService = None
_payment_service: PaymentService = None


# 3. Função de inicialização para injeção de dependência
def init_student_bp(user_service, enrollment_service, training_class_service, attendance_service, payment_service):
    global _user_service, _enrollment_service, _training_class_service, _attendance_service, _payment_service
    _user_service = user_service
    _enrollment_service = enrollment_service
    _training_class_service = training_class_service
    _attendance_service = attendance_service
    _payment_service = payment_service


# 4. Defina as rotas
@student_api_bp.route('/profile', methods=['GET'])
@role_required('student')
def get_student_profile():
    """Retorna o perfil completo do aluno logado."""
    # g.user já foi carregado pelo decorator e contém o objeto do usuário
    return jsonify(g.user.to_dict()), 200

@student_api_bp.route('/classes', methods=['GET'])
@role_required('student')
def get_student_classes():
    """Retorna as turmas em que o aluno está matriculado."""
    student_id = g.user.id
    enrollments = _enrollment_service.get_enrollments_by_student_id(student_id)
    if not enrollments:
        return jsonify([])
    return jsonify([e.to_dict() for e in enrollments]), 200

@student_api_bp.route('/payments', methods=['GET'])
@role_required('student')
def get_student_payments():
    """Retorna o histórico financeiro do aluno."""
    student_id = g.user.id
    charges = _payment_service.get_charges_by_user_id(student_id)
    if not charges:
        return jsonify([])
    return jsonify([c.to_dict() for c in charges]), 200
