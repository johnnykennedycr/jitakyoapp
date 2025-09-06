from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import login_required, current_user
from services import enrollment_service
from utils.decorators import teacher_required
from datetime import datetime, date, timedelta

# Variáveis globais para os serviços
user_service = None
teacher_service = None
training_class_service = None
notification_service = None

teacher_bp = Blueprint(
    'teacher', 
    __name__, 
    url_prefix='/professor',
    template_folder='../templates/teacher'
)

def init_teacher_bp(us, ts, tcs, es, ns):
    """Inicializa o blueprint com os serviços necessários."""
    global user_service, teacher_service, training_class_service, enrollment_service, notification_service
    user_service = us
    teacher_service = ts
    training_class_service = tcs
    enrollment_service = es 
    notification_service = ns

@teacher_bp.route('/dashboard')
@login_required
@teacher_required
def dashboard():
    """Exibe o dashboard do professor com suas próximas aulas."""
    
    # 1. Encontra o perfil de professor vinculado ao usuário logado
    teacher_profile = teacher_service.get_teacher_by_user_id(current_user.id)
    
    upcoming_classes = []
    if teacher_profile:
        # 2. Busca apenas as turmas deste professor
        teacher_classes = training_class_service.get_classes_by_teacher(teacher_profile.id)
        
        # 3. Lógica para encontrar as próximas aulas do professor
        days_order = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
        today_weekday_index = datetime.today().weekday()

        for i in range(7): # Procura nos próximos 7 dias
            current_day_index = (today_weekday_index + i) % 7
            current_day_name = days_order[current_day_index]
            
            for training_class in teacher_classes:
                if training_class.schedule:
                    for slot in training_class.schedule:
                        if slot.day_of_week == current_day_name:
                            # Para hoje, só considera horários futuros
                            if i == 0 and slot.start_time < datetime.now().strftime('%H:%M'):
                                continue
                            
                            if len(upcoming_classes) < 7: # Aumentei o limite para 7 próximas aulas
                                upcoming_classes.append({
                                    'day': 'Hoje' if i == 0 else ('Amanhã' if i == 1 else current_day_name),
                                    'name': training_class.name,
                                    'time': f"{slot.start_time} - {slot.end_time}",
                                    'teacher': teacher_profile.name
                                })

    return render_template('dashboard_teacher.html', upcoming_classes=upcoming_classes)

@teacher_bp.route('/turmas')
@login_required
@teacher_required
def list_classes():
    """Exibe a lista de turmas do professor logado."""
    teacher_profile = teacher_service.get_teacher_by_user_id(current_user.id)
    if teacher_profile:
        teacher_classes = training_class_service.get_classes_by_teacher(teacher_profile.id)
    else:
        teacher_classes = []
    
    return render_template('list_classes.html', classes=teacher_classes)


@teacher_bp.route('/notificar', methods=['GET', 'POST'])
@login_required
@teacher_required
def notify_class():
    teacher_profile = teacher_service.get_teacher_by_user_id(current_user.id)
    if not teacher_profile:
        flash("Perfil de professor não encontrado.", "danger")
        return redirect(url_for('teacher.dashboard'))

    teacher_classes = training_class_service.get_classes_by_teacher(teacher_profile.id)

    if request.method == 'POST':
        class_id = request.form.get('class_id')
        title = request.form.get('title')
        message = request.form.get('message')

        if not all([class_id, title, message]):
            flash("Todos os campos são obrigatórios.", "danger")
            return redirect(url_for('teacher.notify_class'))

        # Busca todos os alunos da turma selecionada
        enrollments = enrollment_service.get_enrollments_by_class(class_id)
        student_ids = [e.student_id for e in enrollments]

        # Cria uma notificação para cada aluno usando o serviço
        success = notification_service.create_batch_notifications(
            teacher_id=teacher_profile.id, 
            student_ids=student_ids, 
            class_id=class_id, 
            title=title, 
            message=message
        )
        
        if success:
            flash(f'Notificação enviada para {len(student_ids)} aluno(s)!', 'success')
        else:
            flash('Ocorreu um erro ao enviar a notificação.', 'danger')
        
        return redirect(url_for('teacher.notify_class'))

    return render_template('notification_form.html', classes=teacher_classes)