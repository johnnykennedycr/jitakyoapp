from flask import Blueprint, jsonify, g, request
from app.utils.decorators import role_required

# Inicialização das variáveis de serviço (serão injetadas)
user_service = None
enrollment_service = None
payment_service = None

student_api_bp = Blueprint('student_api', __name__, url_prefix='/api/student')

def init_student_bp(us, es, ps):
    """Inicializa o Blueprint com as instâncias de serviço necessárias."""
    global user_service, enrollment_service, payment_service
    user_service = us
    enrollment_service = es
    payment_service = ps

@student_api_bp.route('/profile', methods=['GET'])
@role_required('student')
def get_student_profile():
    """Retorna os dados do perfil do aluno logado."""
    try:
        # g.user já é o objeto User completo, graças ao decorator login_required
        return jsonify(g.user.to_dict()), 200
    except Exception as e:
        print(f"Erro ao buscar perfil do aluno: {e}")
        return jsonify(error="Falha ao buscar perfil do aluno."), 500

@student_api_bp.route('/classes', methods=['GET'])
@role_required('student')
def get_student_classes():
    """Retorna as turmas em que o aluno logado está matriculado."""
    try:
        enrollments = enrollment_service.get_enrollments_by_student_id(g.user.id)
        return jsonify(enrollments), 200
    except Exception as e:
        print(f"Erro ao buscar turmas do aluno: {e}")
        return jsonify(error="Falha ao buscar turmas do aluno."), 500

@student_api_bp.route('/payments', methods=['GET'])
@role_required('student')
def get_student_payments():
    """Retorna o histórico financeiro do aluno logado."""
    try:
        charges = payment_service.get_charges_by_user_id(g.user.id)
        return jsonify(charges), 200
    except Exception as e:
        print(f"Erro ao buscar financeiro do aluno: {e}")
        return jsonify(error="Falha ao buscar histórico financeiro."), 500

@student_api_bp.route('/payments/<string:payment_id>/create-preference', methods=['POST'])
@role_required('student')
def create_payment_preference(payment_id):
    """Cria uma preferência de pagamento no Mercado Pago para uma fatura específica."""
    try:
        # Extrai o CPF do corpo da requisição JSON
        data = request.get_json()
        cpf = data.get('cpf')
        
        preference_id = payment_service.create_payment_preference(payment_id, g.user, cpf=cpf)
        return jsonify({'preferenceId': preference_id}), 200
    except ValueError as ve:
        return jsonify(error=str(ve)), 404
    except Exception as e:
        print(f"Erro ao criar preferência de pagamento: {e}")
        return jsonify(error="Não foi possível gerar o link de pagamento."), 500

@student_api_bp.route('/payments/process', methods=['POST'])
@role_required('student')
def process_student_payment():
    """Processa o pagamento recebido do frontend."""
    data = request.get_json()
    
    payment_id = data.get('paymentId')
    mp_data = data.get('mercadoPagoData')
    
    if not all([payment_id, mp_data]):
        return jsonify(error="Dados de pagamento incompletos."), 400
        
    try:
        result = payment_service.process_payment(payment_id, mp_data, g.user.id)
        return jsonify(result)
    except Exception as e:
        return jsonify(error=f"Erro no processamento do pagamento: {e}"), 500

