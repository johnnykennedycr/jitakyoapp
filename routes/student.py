from flask import Blueprint, jsonify, render_template, request, session
from flask_login import login_required, current_user
from utils.decorators import student_required
from datetime import datetime, date, timedelta

# Estes serviços serão inicializados pelo app.py
user_service = None
enrollment_service = None
training_class_service = None
teacher_service = None
payment_service = None

student_bp = Blueprint(
    'student', 
    __name__, 
    url_prefix='/aluno',
    template_folder='../templates/student'
)

def init_student_bp(us, es, tcs, ts, ps):
    """Inicializa o blueprint do aluno com os serviços."""
    global user_service, enrollment_service, training_class_service, teacher_service, payment_service
    user_service = us
    enrollment_service = es
    training_class_service = tcs
    teacher_service = ts
    payment_service = ps

@student_bp.route('/dashboard')
@login_required
@student_required
def dashboard():
    # 1. Busca as matrículas do aluno logado
    enrollments = enrollment_service.get_enrollments_by_student(current_user.id)
    student_class_ids = {e.class_id for e in enrollments}

    # 2. Busca a agenda completa da academia
    all_classes = training_class_service.get_all_classes()
    teachers_map = {t.id: t.name for t in teacher_service.get_all_teachers()}
    
    days_order = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
    time_slots = [f"{h:02d}:{m:02d}" for h in range(5, 23) for m in (0, 30)]
    scheduled_events = [] # Para o calendário completo

    # 3. Lógica para encontrar as próximas duas aulas do aluno
    upcoming_classes = []
    today_weekday_index = datetime.today().weekday() # Segunda é 0, Domingo é 6
    
    # Mapeia nosso dia da semana para o índice do Python
    day_map_to_index = {day: i for i, day in enumerate(days_order)}

    # Procura por aulas nos próximos 7 dias
    for i in range(7):
        current_day_index = (today_weekday_index + i) % 7
        current_day_name = days_order[current_day_index]
        
        for training_class in all_classes:
            if training_class.id in student_class_ids and training_class.schedule:
                for slot in training_class.schedule:
                    if slot.day_of_week == current_day_name:
                        # Para a primeira iteração (hoje), só considera horários futuros
                        if i == 0 and slot.start_time < datetime.now().strftime('%H:%M'):
                            continue
                        
                        if len(upcoming_classes) < 2:
                            upcoming_classes.append({
                                'day': 'Hoje' if i == 0 else ('Amanhã' if i == 1 else current_day_name),
                                'name': training_class.name,
                                'time': f"{slot.start_time} - {slot.end_time}",
                                'teacher': teachers_map.get(training_class.teacher_id, 'N/A')
                            })
    
    # 4. Preenche a agenda completa para o calendário visual
    # (Este código pode ser copiado/adaptado do dashboard de admin se necessário)
    
    return render_template(
        'dashboard_student.html',
        upcoming_classes=upcoming_classes,
        # scheduled_events=scheduled_events, # Descomente quando for implementar o calendário completo
        # days_order=days_order,
        # time_slots=time_slots
    )

@student_bp.route('/financeiro')
@login_required
@student_required
def financials():
    payments_raw = payment_service.get_payments_by_student(current_user.id)
    
    detailed_payments = []
    for payment in payments_raw:
        training_class = training_class_service.get_class_by_id(payment.class_id)
        # Adicionamos o nome da turma diretamente ao objeto para facilitar
        payment.class_name = training_class.name if training_class else 'N/A'
        detailed_payments.append(payment)

    return render_template('financials.html', payments=detailed_payments)


@student_bp.route('/notificacoes')
@login_required
@student_required
def notifications():
    # Busca as notificações do aluno logado
    # user_notifications = notification_service.get_notifications_for_student(current_user.id)
    user_notifications = [] # Placeholder
    return render_template('notifications.html', notifications=user_notifications)



@student_bp.route('/save-push-subscription', methods=['POST'])
@login_required
@student_required
def save_push_subscription():
    """Salva a inscrição de notificação push do usuário no banco de dados."""
    subscription_data = request.get_json()
    if not subscription_data:
        return jsonify({'success': False, 'error': 'No subscription data provided'}), 400

    # Chama o serviço para salvar a inscrição no perfil do usuário
    success = user_service.add_push_subscription(current_user.id, subscription_data)
    
    if success:
        return jsonify({'success': True}), 200
    else:
        return jsonify({'success': False, 'error': 'Failed to save subscription'}), 500