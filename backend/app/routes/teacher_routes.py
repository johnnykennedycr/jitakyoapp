# backend/app/routes/teacher_routes.py

from flask import Blueprint, flash, redirect, render_template, request, url_for, g, jsonify
from app.utils.decorators import login_required, role_required
from datetime import datetime

# Variáveis globais para os serviços
user_service = None
teacher_service = None
training_class_service = None
enrollment_service = None
notification_service = None

teacher_bp = Blueprint(
    'teacher_api', 
    __name__, 
    url_prefix='/api/teacher'
)

def init_teacher_bp(us, ts, tcs, es, ns):
    """Inicializa o blueprint com os serviços necessários."""
    global user_service, teacher_service, training_class_service, enrollment_service, notification_service
    user_service = us
    teacher_service = ts
    training_class_service = tcs
    enrollment_service = es 
    notification_service = ns

@teacher_bp.route('/dashboard-data')
@login_required
@role_required('teacher', 'admin', 'super_admin')
def dashboard_data():
    """Fornece os dados para o dashboard do professor."""
    current_user = g.user
    teacher_profile = teacher_service.get_teacher_by_user_id(current_user.id)
    
    upcoming_classes = []
    if teacher_profile:
        teacher_classes = training_class_service.get_classes_by_teacher(teacher_profile.id)
        
        days_order = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
        today_weekday_index = datetime.today().weekday()

        for i in range(7):
            current_day_index = (today_weekday_index + i) % 7
            current_day_name = days_order[current_day_index]
            
            for training_class in teacher_classes:
                if training_class.schedule:
                    for slot in training_class.schedule:
                        if slot.day_of_week == current_day_name:
                            if i == 0 and slot.start_time < datetime.now().strftime('%H:%M'):
                                continue
                            
                            if len(upcoming_classes) < 7:
                                upcoming_classes.append({
                                    'day': 'Hoje' if i == 0 else ('Amanhã' if i == 1 else current_day_name),
                                    'name': training_class.name,
                                    'time': f"{slot.start_time} - {slot.end_time}",
                                    'teacher': teacher_profile.name
                                })
    
    response_data = {
        "teacher_name": teacher_profile.name if teacher_profile else current_user.name,
        "upcoming_classes": upcoming_classes
    }
    return jsonify(response_data), 200

@teacher_bp.route('/classes-data')
@login_required
@role_required('teacher', 'admin', 'super_admin')
def classes_data():
    """Fornece a lista de turmas do professor logado."""
    current_user = g.user
    teacher_profile = teacher_service.get_teacher_by_user_id(current_user.id)
    
    teacher_classes_data = []
    if teacher_profile:
        teacher_classes = training_class_service.get_classes_by_teacher(teacher_profile.id)
        # Converte os objetos para dicionários antes de enviar como JSON
        teacher_classes_data = [tc.to_dict() for tc in teacher_classes]
    
    return jsonify(teacher_classes_data), 200


@teacher_bp.route('/notify-class', methods=['POST'])
@login_required
@role_required('teacher', 'admin', 'super_admin')
def notify_class():
    """Recebe e processa um pedido de notificação para uma turma."""
    current_user = g.user
    teacher_profile = teacher_service.get_teacher_by_user_id(current_user.id)
    
    if not teacher_profile:
        return jsonify({"success": False, "message": "Perfil de professor não encontrado."}), 404

    data = request.get_json()
    class_id = data.get('class_id')
    title = data.get('title')
    message = data.get('message')

    if not all([class_id, title, message]):
        return jsonify({"success": False, "message": "Todos os campos são obrigatórios."}), 400

    enrollments = enrollment_service.get_enrollments_by_class(class_id)
    student_ids = [e.student_id for e in enrollments]

    success = notification_service.create_batch_notifications(
        teacher_id=teacher_profile.id, 
        student_ids=student_ids, 
        class_id=class_id, 
        title=title, 
        message=message
    )
    
    if success:
        return jsonify({"success": True, "message": f'Notificação enviada para {len(student_ids)} aluno(s)!'}), 200
    else:
        return jsonify({"success": False, "message": 'Ocorreu um erro ao enviar a notificação.'}), 500