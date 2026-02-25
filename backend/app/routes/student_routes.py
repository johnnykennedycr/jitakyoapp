from flask import Blueprint, jsonify, g, request
from app.utils.decorators import role_required
from firebase_admin import firestore

# Inicialização das variáveis de serviço (serão injetadas)
user_service = None
enrollment_service = None
training_class_service = None
attendance_service = None
payment_service = None
notification_service = None

student_api_bp = Blueprint('student_api', __name__, url_prefix='/api/student')

def init_student_bp(us, es, tcs, ats, ps, ns):
    """Inicializa o Blueprint com as instâncias de serviço necessárias."""
    global user_service, enrollment_service, training_class_service, attendance_service, payment_service, notification_service
    user_service = us
    enrollment_service = es
    training_class_service = tcs
    attendance_service = ats
    payment_service = ps
    notification_service = ns

@student_api_bp.route('/profile', methods=['GET'])
@role_required('student')
def get_student_profile():
    """Retorna os dados do perfil do aluno logado."""
    try:
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

@student_api_bp.route('/save-push-token', methods=['POST'])
@role_required('student')
def save_push_token():
    """Salva o token de notificação push para o usuário logado."""
    data = request.get_json()
    token = data.get('token')
    if not token:
        return jsonify(error="Token não fornecido."), 400
    
    try:
        if notification_service.save_token(g.user.id, token):
            return jsonify(success=True, message="Token salvo com sucesso."), 200
        else:
            return jsonify(error="Falha ao salvar token."), 500
    except Exception as e:
        print(f"Erro ao salvar token de notificação: {e}")
        return jsonify(error="Erro interno ao salvar token."), 500

@student_api_bp.route('/notifications', methods=['GET'])
@role_required('student')
def get_student_notifications():
    """Busca as notificações salvas para o aluno logado."""
    try:
        user_ref = user_service.collection.document(g.user.id)
        notifications_ref = user_ref.collection('notifications').order_by(
            'created_at', direction=firestore.Query.DESCENDING
        ).limit(20)
        
        notifications = []
        for doc in notifications_ref.stream():
            notification_data = doc.to_dict()
            notification_data['id'] = doc.id
            notifications.append(notification_data)
            
        return jsonify(notifications), 200
    except Exception as e:
        print(f"Erro ao buscar notificações do aluno: {e}")
        return jsonify(error="Falha ao buscar notificações."), 500

@student_api_bp.route('/payments/<string:payment_id>/create-preference', methods=['POST'])
@role_required('student')
def create_payment_preference(payment_id):
    """Cria uma preferência de pagamento no Mercado Pago para uma fatura específica."""
    try:
        data = request.get_json() or {}
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

# --- NOVA ROTA PARA O QUESTIONÁRIO PAR-Q ---

@student_api_bp.route('/par-q', methods=['POST'])
@role_required('student')
def save_student_par_q():
    """
    Recebe os dados do questionário de prontidão física (PAR-Q) e
    atualiza o perfil do aluno no Firestore.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify(error="Nenhum dado recebido."), 400
        
        # O payload do frontend contém par_q_data e par_q_filled.
        # Usamos o user_service para persistir essas informações no documento do aluno.
        updated_user = user_service.update_user(g.user.id, data)
        
        if updated_user:
            return jsonify(success=True, message="Dados de saúde registrados com sucesso."), 200
        else:
            return jsonify(error="Não foi possível atualizar seu perfil de saúde."), 500

    except Exception as e:
        print(f"Erro ao processar salvamento do PAR-Q: {e}")
        return jsonify(error="Erro interno ao salvar dados."), 500