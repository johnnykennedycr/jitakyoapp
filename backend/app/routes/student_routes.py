from flask import Blueprint, jsonify, request, g
from app.utils.decorators import login_required, role_required
from datetime import datetime

# Estes serviços serão inicializados pelo main.py
user_service = None
enrollment_service = None
training_class_service = None
teacher_service = None
payment_service = None

# Renomeamos para student_bp para clareza e adicionamos /api ao prefixo
student_bp = Blueprint('student_api', __name__, url_prefix='/api/student')

def init_student_bp(us, es, tcs, ts, ps):
    """Inicializa o blueprint do aluno com os serviços."""
    global user_service, enrollment_service, training_class_service, teacher_service, payment_service
    user_service = us
    enrollment_service = es
    training_class_service = tcs
    teacher_service = ts
    payment_service = ps

@student_bp.route('/dashboard-data')
@login_required
@role_required('student')
def dashboard_data():
    """Fornece os dados necessários para o dashboard do aluno."""
    current_user = g.user
    
    try:
        # A lógica de negócio para buscar os dados permanece a mesma
        enrollments = enrollment_service.get_enrollments_by_student(current_user.id)
        student_class_ids = {e.class_id for e in enrollments}
        all_classes = training_class_service.get_all_classes()
        teachers_map = {t.id: t.name for t in teacher_service.get_all_teachers()}
        
        days_order = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
        upcoming_classes = []
        today_weekday_index = datetime.today().weekday()

        for i in range(7):
            current_day_index = (today_weekday_index + i) % 7
            current_day_name = days_order[current_day_index]
            
            for training_class in all_classes:
                if training_class.id in student_class_ids and training_class.schedule:
                    for slot in training_class.schedule:
                        if slot.day_of_week == current_day_name:
                            if i == 0 and slot.start_time < datetime.now().strftime('%H:%M'):
                                continue
                            
                            if len(upcoming_classes) < 2:
                                upcoming_classes.append({
                                    'day': 'Hoje' if i == 0 else ('Amanhã' if i == 1 else current_day_name),
                                    'name': training_class.name,
                                    'time': f"{slot.start_time} - {slot.end_time}",
                                    'teacher': teachers_map.get(training_class.teacher_id, 'N/A')
                                })
        
        # Montamos um objeto JSON para retornar ao frontend
        response_data = {
            "student_name": current_user.name,
            "upcoming_classes": upcoming_classes
        }
        return jsonify(response_data), 200

    except Exception as e:
        print(f"Erro ao buscar dados do dashboard do aluno: {e}")
        return jsonify({"error": "Ocorreu um erro interno ao processar sua solicitação."}), 500


@student_bp.route('/financials-data')
@login_required
@role_required('student')
def financials_data():
    """Fornece os dados financeiros para o aluno."""
    current_user = g.user
    payments_raw = payment_service.get_payments_by_student(current_user.id)
    
    detailed_payments = []
    for payment in payments_raw:
        training_class = training_class_service.get_class_by_id(payment.class_id)
        detailed_payments.append({
            "id": payment.id,
            "due_date": payment.due_date.strftime('%d/%m/%Y'),
            "amount": payment.amount,
            "status": payment.status,
            "class_name": training_class.name if training_class else 'N/A'
        })

    return jsonify(detailed_payments), 200


@student_bp.route('/notifications-data')
@login_required
@role_required('student')
def notifications_data():
    """Fornece as notificações para o aluno."""
    # current_user = g.user
    # Sua lógica para buscar notificações aqui...
    user_notifications = [] # Placeholder
    return jsonify(user_notifications), 200


@student_bp.route('/save-push-subscription', methods=['POST'])
@login_required
@role_required('student')
def save_push_subscription():
    """Salva a inscrição de notificação push do usuário no banco de dados."""
    current_user = g.user
    subscription_data = request.get_json()
    if not subscription_data:
        return jsonify({'success': False, 'error': 'No subscription data provided'}), 400

    success = user_service.add_push_subscription(current_user.id, subscription_data)
    
    if success:
        return jsonify({'success': True}), 200
    else:
        return jsonify({'success': False, 'error': 'Failed to save subscription'}), 500