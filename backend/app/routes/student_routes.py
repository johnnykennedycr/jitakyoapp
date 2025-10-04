from flask import Blueprint, jsonify, request, g
from app.utils.decorators import login_required, role_required

student_api_bp = Blueprint('student_api', __name__, url_prefix='/api/student')

# Variáveis para serviços
user_service = None
enrollment_service = None
payment_service = None

def init_student_bp(us, es, tcs, ats, ps):
    global user_service, enrollment_service, payment_service
    user_service = us
    enrollment_service = es
    payment_service = ps

@student_api_bp.route('/profile', methods=['GET'])
@login_required
@role_required('student')
def get_student_profile():
    try:
        return jsonify(g.user.to_dict()), 200
    except Exception as e:
        print(f"Erro ao buscar perfil do aluno: {e}")
        return jsonify(error="Erro interno ao buscar perfil."), 500

@student_api_bp.route('/classes', methods=['GET'])
@login_required
@role_required('student')
def get_student_classes():
    try:
        enrollments = enrollment_service.get_enrollments_by_student_id(g.user.id)
        return jsonify(enrollments), 200
    except Exception as e:
        print(f"Erro ao buscar turmas do aluno: {e}")
        return jsonify(error="Erro interno ao buscar turmas."), 500

@student_api_bp.route('/payments', methods=['GET'])
@login_required
@role_required('student')
def get_student_payments():
    try:
        charges = payment_service.get_charges_by_user_id(g.user.id)
        return jsonify(charges), 200
    except Exception as e:
        print(f"Erro ao buscar financeiro do aluno: {e}")
        return jsonify(error="Erro interno ao buscar dados financeiros."), 500

@student_api_bp.route('/payments/<string:payment_id>/create-preference', methods=['POST'])
@login_required
@role_required('student')
def create_payment_preference(payment_id):
    """Cria uma preferência de pagamento no Mercado Pago para uma fatura."""
    try:
        preference_id = payment_service.create_payment_preference(payment_id, g.user)
        return jsonify({'preferenceId': preference_id}), 200
    except Exception as e:
        print(f"Erro ao criar preferência de pagamento: {e}")
        return jsonify(error=str(e)), 500

@student_api_bp.route('/payments/process', methods=['POST'])
@login_required
@role_required('student')
def process_payment_route():
    """Processa um pagamento enviado pelo frontend."""
    try:
        data = request.get_json()
        payment_id = data.get('paymentId')
        mp_data = data.get('mercadoPagoData')
        
        if not payment_id or not mp_data:
            return jsonify(error="Dados de pagamento inválidos."), 400

        result = payment_service.process_payment(payment_id, mp_data, g.user.id)
        return jsonify(result), 200
        
    except Exception as e:
        print(f"Erro na rota de processamento de pagamento: {e}")
        return jsonify(error=str(e)), 500

