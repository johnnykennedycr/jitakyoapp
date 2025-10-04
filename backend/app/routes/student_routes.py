from flask import Blueprint, jsonify, g
from app.utils.decorators import role_required

student_api_bp = Blueprint('student_api', __name__, url_prefix='/api/student')

# Variáveis globais para os serviços
user_service = None
enrollment_service = None
payment_service = None

def init_student_bp(us, es, tcs, ats, ps):
    """Inicializa o Blueprint com as instâncias dos serviços."""
    global user_service, enrollment_service, payment_service
    user_service = us
    enrollment_service = es
    # A função estava recebendo mais argumentos do que o esperado.
    # Corrigido para atribuir o serviço de pagamento (ps) corretamente.
    payment_service = ps

@student_api_bp.route('/profile', methods=['GET'])
@role_required('student')
def get_student_profile():
    """Retorna o perfil do aluno logado."""
    try:
        # g.user é preenchido pelo decorator
        return jsonify(g.user.to_dict()), 200
    except Exception as e:
        print(f"Erro em get_student_profile: {e}")
        return jsonify(error=str(e)), 500

@student_api_bp.route('/classes', methods=['GET'])
@role_required('student')
def get_student_classes():
    """Retorna as turmas em que o aluno está matriculado."""
    try:
        student_id = g.user.id
        enrollments = enrollment_service.get_enrollments_by_student_id(student_id)
        return jsonify(enrollments), 200
    except Exception as e:
        print(f"Erro em get_student_classes: {e}")
        return jsonify(error=str(e)), 500

@student_api_bp.route('/payments', methods=['GET'])
@role_required('student')
def get_student_payments():
    """Retorna o histórico financeiro do aluno."""
    try:
        student_id = g.user.id
        charges = payment_service.get_charges_by_user_id(student_id)
        return jsonify(charges), 200
    except Exception as e:
        print(f"Erro em get_student_payments: {e}")
        return jsonify(error=str(e)), 500

# --- NOVO ENDPOINT PARA PAGAMENTO ---
@student_api_bp.route('/payments/<string:payment_id>/create-preference', methods=['POST'])
@role_required('student')
def create_payment_preference_route(payment_id):
    """Cria uma preferência de pagamento no Mercado Pago para uma fatura."""
    try:
        # Passa o objeto 'user' completo para o serviço
        preference_id = payment_service.create_payment_preference(payment_id, g.user)
        return jsonify({"preferenceId": preference_id}), 200
    except ValueError as ve:
        return jsonify(error=str(ve)), 404 # Fatura não encontrada
    except Exception as e:
        print(f"Erro em create_payment_preference_route: {e}")
        return jsonify(error="Falha ao gerar link de pagamento."), 500

