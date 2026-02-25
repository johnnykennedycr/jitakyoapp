# backend/app/routes/admin_routes.py

import logging
import os
from flask import Blueprint, jsonify, render_template, request, redirect, url_for, flash, current_app, g
from datetime import datetime, date, time, timedelta 
from werkzeug.utils import secure_filename
from firebase_admin import auth

# NOVAS IMPORTAÇÕES DE DECORADORES
from app.utils.decorators import login_required, role_required

# As importações de Services permanecem as mesmas
from app.services.user_service import UserService
from app.services.teacher_service import TeacherService
from app.services.training_class_service import TrainingClassService
from app.services.enrollment_service import EnrollmentService
from app.services.attendance_service import AttendanceService
from app.services.payment_service import PaymentService
from app.services.notification_service import NotificationService # <-- NOVO
from app.services.facial_recognition_service import FacialRecognitionService # <-- NOVO

admin_api_bp = Blueprint('admin_api', __name__, url_prefix='/api/admin')

# A inicialização de serviços permanece a mesma
user_service = None
teacher_service = None
training_class_service = None
enrollment_service = None
attendance_service = None
payment_service = None
notification_service = None # <-- NOVO
facial_recognition_service = None # <-- NOVO
db = None

def init_admin_bp(database, us, ts, tcs, es_param, as_param, ps_param, ns, frs=None): # <-- frs ADICIONADO
    global db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service, notification_service, facial_recognition_service
    db = database
    user_service = us
    teacher_service = ts
    training_class_service = tcs
    enrollment_service = es_param
    attendance_service = as_param
    payment_service = ps_param
    notification_service = ns # <-- NOVO
    facial_recognition_service = frs # <-- NOVO


# --- NOVA ROTA PARA O DASHBOARD ---
@admin_api_bp.route('/dashboard-summary', methods=['GET'])
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def get_dashboard_summary():
    """Coleta KPIs, incluindo agora o status de saúde dos alunos."""
    try:
        active_students = user_service.count_active_students()
        financial_summary = payment_service.get_financial_summary_for_dashboard()
        upcoming_birthdays = user_service.get_upcoming_birthdays(days_ahead=7)

        # Nova métrica: Alunos sem PAR-Q
        # Nota: Idealmente você adicionaria um método count_pending_parq no user_service
        # Por enquanto, podemos filtrar na lista de alunos ativos se o volume for baixo
        all_students = user_service.get_users_by_role('student')
        pending_parq = len([s for s in all_students if not getattr(s, 'par_q_filled', False)])

        summary_data = {
            "kpis": {
                "active_students": active_students,
                "monthly_revenue": financial_summary.get("total_paid_this_month", 0),
                "total_overdue": financial_summary.get("total_overdue", 0),
                "upcoming_birthdays": upcoming_birthdays,
                "pending_parq_count": pending_parq  # <-- Novo Indicador
            },
            "charts": {
                "new_students": user_service.get_new_students_per_month(num_months=6),
                "students_by_discipline": payment_service.get_students_by_discipline()
            },
            "lists": {
                "recent_payments": payment_service.get_recent_payments(limit=5)
            }
        }
        return jsonify(summary_data), 200
    except Exception as e:
        logging.error(f"Erro ao gerar resumo do dashboard: {e}")
        return jsonify(error="Falha ao carregar dados."), 500

@admin_api_bp.route('/dashboard-data')
@login_required 
@role_required('admin', 'super_admin', 'receptionist') 
def dashboard_data():
    """Fornece os dados para o calendário do dashboard."""
    try:
        days_order = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
        time_slots = [f"{h:02d}:{m:02d}" for h in range(5, 23) for m in (0, 30)]

        all_classes = training_class_service.get_all_classes()
        
        scheduled_events = []
        
        for training_class in all_classes:
            if training_class.get('schedule'):
                for slot in training_class['schedule']:
                    if slot.get('day_of_week') in days_order:
                        start_h, start_m = map(int, slot['start_time'].split(':'))
                        end_h, end_m = map(int, slot['end_time'].split(':'))
                        grid_col = days_order.index(slot['day_of_week']) + 2
                        grid_row_start = ((start_h - 5) * 2) + (start_m // 30) + 2
                        duration_slots = ((end_h * 60 + end_m) - (start_h * 60 + start_m)) // 30
                        
                        if duration_slots > 0:
                            scheduled_events.append({
                                'id': training_class['id'],
                                'name': training_class['name'],
                                'time': f"{slot['start_time']} - {slot['end_time']}",
                                'teacher': training_class.get('teacher_name', 'N/A'),
                                'style': (
                                    f"grid-column: {grid_col}; "
                                    f"grid-row: {grid_row_start} / span {duration_slots};"
                                )
                            })
    
        data = {
            'days_order': days_order,
            'time_slots': time_slots,
            'scheduled_events': scheduled_events
        }
        return jsonify(data), 200
    except Exception as e:
        print(f"Erro em dashboard_data: {e}")
        return jsonify(error=str(e)), 500
    
    # 1. ROTA PARA DISPARAR O GUIA DE INSTALAÇÃO (E-MAIL)
@admin_api_bp.route('/students/<string:student_id>/send-guide', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def send_student_guide(student_id):
    """
    Aciona o UserService para enviar o e-mail HTML com o guia de 
    instalação do PWA para o aluno.
    """
    try:
        if user_service.send_installation_guide(student_id):
            return jsonify(success=True, message="Guia de instalação enviado com sucesso!"), 200
        return jsonify(error="Falha ao enviar guia ou aluno não encontrado."), 404
    except Exception as e:
        logging.error(f"Erro ao disparar guia PWA: {e}")
        return jsonify(error=str(e)), 500



# --- NOVO ENDPOINT: SALVAR DESCRITOR FACIAL (CLIENT-SIDE) ---
@admin_api_bp.route('/students/<string:student_id>/face', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def save_student_face(student_id):
    """
    Recebe o descritor facial e salva no Firestore.
    Suporta o payload envolvido em 'user_data' para manter consistência 
    com o formulário de edição.
    """
    try:
        data = request.get_json()
        
        # Tenta pegar de 'user_data' (novo padrão) ou da raiz (padrão antigo)
        user_data = data.get('user_data', {})
        descriptor = user_data.get('face_descriptor') or data.get('face_descriptor')

        if not descriptor or not isinstance(descriptor, list):
            return jsonify(error="Descritor facial ausente ou em formato inválido."), 400

        # Atualiza o usuário. O UserService agora aceita esses campos.
        success = user_service.update_user(student_id, {
            'face_descriptor': descriptor,
            'has_face_registered': True
        })

        if success:
            return jsonify(success=True, message="Biometria salva com sucesso."), 200
        return jsonify(error="Aluno não encontrado ou falha na persistência."), 404

    except Exception as e:
        logging.error(f"Erro ao salvar biometria: {e}")
        return jsonify(error=str(e)), 500



# --- BUSCA DE ALUNOS (CASE-INSENSITIVE) ---
@admin_api_bp.route('/students/search', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def search_students():
    """
    Busca alunos por nome. Realiza um filtro adicional em Python para 
    garantir que a busca ignore maiúsculas/minúsculas.
    """
    try:
        search_term = request.args.get('name', '').strip()
        if not search_term:
            return jsonify([]), 200

        # Busca inicial via serviço (prefixo)
        students = user_service.search_students_by_name(search_term)
        
        # Refinamento para garantir case-insensitivity total (contém termo)
        search_term_lower = search_term.lower()
        filtered_data = [
            s.to_dict() for s in students 
            if search_term_lower in s.name.lower()
        ]
        
        return jsonify(filtered_data), 200
    except Exception as e:
        logging.error(f"Erro na busca de alunos: {e}")
        return jsonify(error=str(e)), 500


# --- Rota para buscar usuários que podem ser professores ---
@admin_api_bp.route('/available-users', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_available_users():
    """API para listar usuários com a role 'student'."""
    try:
        students = user_service.get_users_by_role('student')
        students_data = [user.to_dict() for user in students]
        return jsonify(students_data), 200
    except Exception as e:
        print(f"Erro em get_available_users: {e}")
        return jsonify(error=str(e)), 500

# --- ROTA DE NOTIFICAÇÕES ATUALIZADA ---
@admin_api_bp.route('/notifications', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def send_notification():
    """Envia uma notificação push para um público-alvo específico."""
    data = request.get_json()
    title = data.get('title')
    body = data.get('body')
    target_type = data.get('target_type', 'all') # 'all', 'class', 'individual'
    target_ids = data.get('target_ids', [])

    if not title or not body:
        return jsonify(error="Título e corpo da mensagem são obrigatórios."), 400

    try:
        result = notification_service.send_targeted_notification(
            title, body, target_type, target_ids
        )
        success_count = result.get('success', 0)
        return jsonify(success=True, message=f"{success_count} notificações enviadas com sucesso.", details=result), 200
    except Exception as e:
        logging.error(f"Erro ao enviar notificações: {e}", exc_info=True)
        return jsonify(error=f"Falha ao enviar notificações: {e}"), 500
    
# --- NOVA ROTA PARA HISTÓRICO ---
@admin_api_bp.route('/notifications/history', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_notification_history():
    """Busca o histórico de notificações enviadas."""
    try:
        history = notification_service.get_sent_notification_history()
        return jsonify(history), 200
    except Exception as e:
        logging.error(f"Erro ao buscar histórico de notificações: {e}", exc_info=True)
        return jsonify(error=f"Falha ao buscar histórico: {e}"), 500



# --- Rotas de Gerenciamento de Professores ---

@admin_api_bp.route('/teachers/<string:teacher_id>', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_teacher(teacher_id):
    """API para buscar um professor específico por seu ID."""
    try:
        teacher = teacher_service.get_teacher_by_id(teacher_id)
        if teacher:
            return jsonify(teacher.to_dict()), 200
        else:
            return jsonify(error="Professor não encontrado."), 404
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/teachers/', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def list_teachers():
    """API para listar todos os professores."""
    try:
        teachers = teacher_service.get_all_teachers()
        teachers_data = [t.to_dict() for t in teachers]
        return jsonify(teachers_data), 200
    except Exception as e:
        print(f"Erro em list_teachers: {e}")
        return jsonify(error=str(e)), 500


@admin_api_bp.route('/teachers', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def add_teacher():
    """API para adicionar um novo professor."""
    try:
        data = request.get_json()
        new_teacher = teacher_service.create_teacher(data)
        if new_teacher:
            return jsonify(new_teacher.to_dict()), 201
        else:
            return jsonify(error='Erro ao criar professor.'), 500
    except Exception as e:
        return jsonify(error=str(e)), 500


@admin_api_bp.route('/teachers/<string:teacher_id>', methods=['PUT'])
@login_required
@role_required('admin', 'super_admin')
def edit_teacher(teacher_id):
    """API para editar um professor existente."""
    try:
        data = request.get_json()
        if teacher_service.update_teacher(teacher_id, data):
            return jsonify(success=True), 200
        else:
            return jsonify(error='Erro ao atualizar professor.'), 500
    except Exception as e:
        return jsonify(error=str(e)), 500


@admin_api_bp.route('/teachers/<string:teacher_id>', methods=['DELETE'])
@login_required
@role_required('admin', 'super_admin')
def delete_teacher(teacher_id):
    """API para deletar um professor."""
    try:
        if teacher_service.delete_teacher(teacher_id):
            return jsonify(success=True), 200
        else:
            return jsonify(error='Erro ao deletar professor.'), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

# --- Rotas de Gerenciamento de Turmas ---

@admin_api_bp.route('/classes/', methods=['GET'])
@login_required
def list_classes():
    try:
        classes_data = training_class_service.get_all_classes()
        return jsonify(classes_data), 200
    except Exception as e:
        print(f"Erro em list_classes: {e}")
        return jsonify(error=str(e)), 500
    
@admin_api_bp.route('/classes/<string:class_id>/enrolled-students', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_enrolled_students(class_id):
    """API para buscar todos os alunos matriculados em uma turma específica."""
    try:
        enrolled_student_ids = enrollment_service.get_student_ids_by_class_id(class_id)
        students = []
        for student_id in enrolled_student_ids:
            student = user_service.get_user_by_id(student_id)
            if student:
                students.append(student.to_dict())
        return jsonify(students), 200
    except Exception as e:
        print(f"Erro em get_enrolled_students: {e}")
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/classes', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def add_class():
    """API para criar uma nova turma."""
    try:
        data = request.get_json()
        new_class_dict = training_class_service.create_class(data)
        if new_class_dict:
            return jsonify(new_class_dict), 201
        return jsonify(error="Falha ao criar turma."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/classes/<string:class_id>', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_class(class_id):
    """API para buscar uma turma específica."""
    try:
        training_class = training_class_service.get_class_by_id(class_id)
        if training_class:
            return jsonify(training_class.to_dict()), 200
        return jsonify(error="Turma não encontrada."), 404
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/classes/<string:class_id>', methods=['PUT'])
@login_required
@role_required('admin', 'super_admin')
def update_class(class_id):
    """API para atualizar uma turma."""
    try:
        data = request.get_json()
        if training_class_service.update_class(class_id, data):
            return jsonify(success=True), 200
        return jsonify(error="Falha ao atualizar turma."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/classes/<string:class_id>', methods=['DELETE'])
@login_required
@role_required('admin', 'super_admin')
def delete_class(class_id):
    """API para deletar uma turma."""
    try:
        if training_class_service.delete_class(class_id):
            return jsonify(success=True), 200
        return jsonify(error="Falha ao deletar turma."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500


# --- Rotas de Gerenciamento de Alunos ---


@admin_api_bp.route('/students/', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def list_students():
    """API para listar todos os alunos com suas matrículas e nomes de turmas."""
    try:
        students = user_service.get_users_by_role('student')
        all_classes_dicts = training_class_service.get_all_classes()
        class_map = {c['id']: c['name'] for c in all_classes_dicts}
        
        students_data = []
        for student in students:
            student_dict = student.to_dict()
            enrollments = enrollment_service.get_enrollments_by_student_id(student.id)
            
            student_dict['enrollments'] = [
                {**enrollment, 'class_name': class_map.get(enrollment.get('class_id'), 'Turma Desconhecida')}
                for enrollment in enrollments
            ]
            students_data.append(student_dict)
            
        return jsonify(students_data), 200
    except Exception as e:
        print(f"Erro em list_students: {e}")
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/students', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def add_student_with_enrollments():
    """Cria um novo aluno e opcionalmente o matricula em turmas."""
    try:
        data = request.get_json()
        user_data = data.get('user_data', {})
        enrollments_data = data.get('enrollments_data', [])
        
        if not user_data.get('email') or not user_data.get('name'):
            return jsonify(error="Nome e email são obrigatórios."), 400

        new_user = user_service.create_user_with_enrollments(user_data, enrollments_data)
        if new_user:
            return jsonify(new_user.to_dict()), 201
        else:
            raise Exception("Falha ao criar usuário no serviço.")
            
    except Exception as e:
        print(f"Erro em add_student_with_enrollments: {e}")
        return jsonify(error=str(e)), 400

@admin_api_bp.route('/students/<string:student_id>', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_student(student_id):
    """API para buscar um aluno específico."""
    student = user_service.get_user_by_id(student_id)
    if student and student.role == 'student':
        return jsonify(student.to_dict()), 200
    return jsonify(error="Aluno não encontrado."), 404

# --- INÍCIO DA CORREÇÃO ---
@admin_api_bp.route('/students/<string:student_id>', methods=['PUT'])
@login_required
@role_required('admin', 'super_admin')
def update_student(student_id):
    """API para atualizar um aluno, agora esperando os dados dentro de 'user_data'."""
    try:
        payload = request.get_json()
        
        # Padrão consistente com a rota de criação: extrai os dados de 'user_data'
        user_data = payload.get('user_data')

        # Validação para garantir que os dados necessários foram enviados
        if user_data is None:
            return jsonify(error="A chave 'user_data' contendo os dados do aluno é obrigatória."), 400
        
        # Passa apenas o dicionário com os dados do aluno para o serviço
        if user_service.update_user(student_id, user_data):
            return jsonify(success=True), 200
        
        return jsonify(error="Aluno não encontrado ou falha na atualização."), 404
    except Exception as e:
        print(f"Erro em update_student: {e}")
        return jsonify(error=str(e)), 500
# --- FIM DA CORREÇÃO ---

@admin_api_bp.route('/students/<string:student_id>', methods=['DELETE'])
@login_required
@role_required('admin', 'super_admin')
def delete_student(student_id):
    """API para deletar um aluno."""
    if user_service.delete_user(student_id):
        return jsonify(success=True), 200
    return jsonify(error="Aluno não encontrado."), 404




# --- Rotas de Gerenciamento de Matrículas ---

@admin_api_bp.route('/students/<string:student_id>/enrollments', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_student_enrollments(student_id):
    """API para buscar todas as matrículas de um aluno específico."""
    try:
        enrollments = enrollment_service.get_enrollments_by_student_id(student_id)
        # Assumindo que o serviço já retorna uma lista de dicionários
        return jsonify(enrollments), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/enrollments', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def add_enrollment():
    """API para criar uma nova matrícula para um aluno em uma turma."""
    try:
        data = request.get_json()
        new_enrollment = enrollment_service.create_enrollment(data)
        if new_enrollment:
            return jsonify(new_enrollment.to_dict()), 201
    except ValueError as ve: 
        return jsonify(error=str(ve)), 400
    except Exception as e:
        print(f"Erro em add_enrollment: {e}")
        return jsonify(error="Falha interna ao criar matrícula."), 500

@admin_api_bp.route('/enrollments/<string:enrollment_id>', methods=['DELETE'])
@login_required
@role_required('admin', 'super_admin')
def delete_enrollment(enrollment_id):
    """API para deletar uma matrícula."""
    try:
        if enrollment_service.delete_enrollment(enrollment_id):
            return jsonify(success=True), 200
        return jsonify(error="Falha ao deletar matrícula."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500
    
@admin_api_bp.route('/classes/<string:class_id>/un-enrolled-students', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_un_enrolled_students(class_id):
    """Retorna alunos que NÃO estão matriculados em uma turma específica."""
    try:
        all_students = user_service.get_users_by_role('student')
        enrolled_students_ids = enrollment_service.get_student_ids_by_class_id(class_id)
        un_enrolled = [s.to_dict() for s in all_students if s.id not in enrolled_students_ids]
        return jsonify(un_enrolled), 200
    except Exception as e:
        print(f"Erro em get_un_enrolled_students: {e}")
        return jsonify(error=str(e)), 500

# --- ROTAS PARA CHAMADA (ATTENDANCE) ---
@admin_api_bp.route('/attendance', methods=['POST'])
@login_required
@role_required('admin', 'super_admin', 'teacher')
def save_attendance():
    """Cria ou atualiza um registro de chamada."""
    data = request.get_json()
    if not data or 'class_id' not in data or 'date' not in data:
        return jsonify({"error": "Dados de chamada inválidos"}), 400
    
    try:
        if attendance_service.create_or_update_attendance(data):
            return jsonify({"success": True, "message": "Chamada salva com sucesso."}), 201
        return jsonify({"error": "Não foi possível salvar a chamada"}), 500
    except ValueError as ve:
        # Erro de validação esperado (ex: dia da semana incorreto)
        logging.warning(f"Erro de validação ao salvar chamada: {ve}")
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        # Erro inesperado no servidor
        logging.error(f"Erro inesperado ao salvar chamada: {e}", exc_info=True)
        return jsonify({"error": "Ocorreu uma falha interna ao salvar a chamada."}), 500


@admin_api_bp.route('/classes/<class_id>/attendance-semesters', methods=['GET'])
@login_required
@role_required('admin', 'super_admin', 'teacher')
def get_attendance_semesters(class_id):
    try:
        semesters = attendance_service.get_available_semesters(class_id)
        return jsonify(semesters), 200
    except Exception as e:
        logging.error(f"Erro ao buscar semestres de chamada para a turma {class_id}: {e}")
        return jsonify({"error": "Falha ao carregar semestres."}), 500

@admin_api_bp.route('/classes/<class_id>/attendance-history', methods=['GET'])
@login_required
@role_required('admin', 'super_admin', 'teacher')
def get_attendance_history(class_id):
    try:
        year = request.args.get('year', type=int)
        semester = request.args.get('semester', type=int)

        if not year or not semester:
            today = datetime.utcnow()
            year = today.year
            semester = 1 if today.month <= 6 else 2

        history = attendance_service.get_attendance_history_for_class(class_id, year, semester)
        return jsonify(history), 200
    except Exception as e:
        logging.error(f"Erro ao buscar histórico de chamadas para a turma {class_id}: {e}")
        return jsonify({"error": f"Erro ao buscar histórico de chamadas para a turma {class_id}: {e}"}), 500

# --- ROTAS DE RECONHECIMENTO FACIAL (KIOSK) ---

@admin_api_bp.route('/students/<string:student_id>/face-registration', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def register_student_face(student_id):
    """Recebe uma foto de referência, gera o encoding e salva no perfil do aluno."""
    if 'file' not in request.files:
        return jsonify(error="Nenhum arquivo enviado."), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify(error="Nome de arquivo inválido."), 400

    try:
        # Gera o encoding (vetor numérico)
        encoding = facial_recognition_service.get_face_encoding_from_stream(file)
        
        if encoding is None:
            return jsonify(error="Nenhum rosto detectado na imagem. Tente uma foto mais clara."), 400
        
        # Atualiza o usuário com o novo campo 'face_encoding'
        # Nota: O user_service precisa suportar atualização de campos arbitrários ou você deve adicionar isso ao modelo
        success = user_service.update_user(student_id, {'face_encoding': encoding, 'has_face_registered': True})
        
        if success:
            return jsonify(success=True, message="Face registrada com sucesso!"), 200
        else:
            return jsonify(error="Erro ao salvar dados faciais no banco."), 500
            
    except Exception as e:
        logging.error(f"Erro no registro facial: {e}", exc_info=True)
        return jsonify(error=f"Erro interno: {e}"), 500

@admin_api_bp.route('/attendance/kiosk/recognize', methods=['POST'])
# @login_required -> Kiosk pode usar um token especial ou estar na rede interna, mas vamos manter login por enquanto
def kiosk_recognize_attendance():
    """
    Recebe uma foto do tablet na entrada.
    1. Identifica o aluno.
    2. Verifica se há aula agora.
    3. Registra presença.
    """
    if 'file' not in request.files:
        return jsonify(error="Imagem não fornecida."), 400
        
    try:
        # 1. Buscar todos os alunos que têm face cadastrada
        # Otimização: Em produção, cachear isso ou buscar apenas ativos
        all_students = user_service.get_users_by_role('student')
        students_with_face = [s.to_dict() for s in all_students if s.to_dict().get('face_encoding')]
        
        # 2. Identificar Aluno
        file = request.files['file']
        identified_student = facial_recognition_service.identify_student(file, students_with_face)
        
        if not identified_student:
            return jsonify(success=False, message="Aluno não identificado."), 404
            
        # 3. Verificar Turma no Horário Atual
        now = datetime.now()
        current_weekday = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][now.weekday()]
        current_time_minutes = now.hour * 60 + now.minute
        
        all_classes = training_class_service.get_all_classes()
        matching_class = None
        
        for cls in all_classes:
            for slot in cls.get('schedule', []):
                if slot['day_of_week'] == current_weekday:
                    start_h, start_m = map(int, slot['start_time'].split(':'))
                    start_minutes = start_h * 60 + start_m
                    # Aceita presença se estiver dentro de uma janela (ex: 30 min antes até 30 min depois do início)
                    if abs(current_time_minutes - start_minutes) <= 45: 
                        matching_class = cls
                        break
            if matching_class: break
        
        if matching_class:
            # 4. Registrar Presença
            attendance_data = {
                'class_id': matching_class['id'],
                'date': now.strftime('%Y-%m-%d'),
                'students': [{'student_id': identified_student['id'], 'status': 'present', 'method': 'facial_recognition'}]
            }
            attendance_service.create_or_update_attendance(attendance_data)
            
            return jsonify({
                "success": True, 
                "student_name": identified_student['name'],
                "class_name": matching_class['name'],
                "message": f"Bem-vindo, {identified_student['name']}! Presença confirmada."
            }), 200
        else:
            return jsonify({
                "success": False, 
                "student_name": identified_student['name'],
                "message": f"Olá {identified_student['name']}, nenhuma aula encontrada para agora."
            }), 200

    except Exception as e:
        logging.error(f"Erro no Kiosk: {e}", exc_info=True)
        return jsonify(error=f"Erro de processamento: {e}"), 500


@admin_api_bp.route('/classes/<string:class_id>/unenroll/<string:student_id>', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def unenroll_student_from_class(class_id, student_id):
    """API para desmatricular um aluno (agora usando POST para seguir o padrão)."""
    try:
        enrollments_to_delete = enrollment_service.get_enrollments_by_student_and_class(student_id, class_id)
        
        if enrollments_to_delete:
            if enrollment_service.delete_enrollment(enrollments_to_delete[0].id):
                return jsonify(success=True, message="Aluno desmatriculado com sucesso!"), 200
            else:
                return jsonify(success=False, message="Erro ao desmatricular aluno."), 500
        else:
            return jsonify(success=False, message="Matrícula não encontrada."), 404
    except Exception as e:
        return jsonify(error=str(e)), 500

# --- ROTAS FINANCEIRAS (FINANCIAL) ---
@admin_api_bp.route('/financial/status', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_financial_status():
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    if not year or not month:
        return jsonify({"error": "Ano e mês são obrigatórios"}), 400
    try:
        status = payment_service.get_financial_status(year, month)
        return jsonify(status)
    except Exception as e:
        logging.error(f"Erro ao obter status financeiro: {e}", exc_info=True)
        return jsonify({"error": f"Erro ao buscar status financeiro: {e}"}), 500

@admin_api_bp.route('/financial/generate-billings', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def generate_monthly_billings():
    """Gera as cobranças do mês corrente ou do mês/ano especificado."""
    try:
        today = datetime.utcnow()
        # A rota pode receber o ano e mês pelo corpo do JSON para testes ou execuções manuais.
        # Se não receber, usa o mês e ano atuais.
        year = request.json.get('year', today.year) if request.is_json else today.year
        month = request.json.get('month', today.month) if request.is_json else today.month
        
        result = payment_service.generate_monthly_payments(year, month)
        return jsonify(success=True, message=f"{result['generated']} cobranças geradas. {result['skipped']} já existiam.", details=result), 201
    except Exception as e:
        logging.error(f"Erro ao gerar cobranças: {e}", exc_info=True)
        return jsonify(error=f"Erro ao gerar cobranças: {e}"), 500

# --- NOVA ROTA PARA FATURAS AVULSAS ---
@admin_api_bp.route('/financial/generate-misc-invoice', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def generate_misc_invoice():
    """Gera faturas avulsas para múltiplos alunos."""
    try:
        data = request.get_json()
        created_count = payment_service.create_misc_invoices(data)
        return jsonify(success=True, message=f"{created_count} faturas avulsas geradas com sucesso."), 201
    except ValueError as ve:
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logging.error(f"Erro ao gerar faturas avulsas: {e}", exc_info=True)
        return jsonify(error=f"Erro ao gerar faturas avulsas: {e}"), 500

@admin_api_bp.route('/payments', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def register_payment():
    data = request.get_json()
    try:
        if payment_service.record_payment(data):
            return jsonify({"message": "Pagamento registrado com sucesso"}), 201
        return jsonify({"error": "Falha ao registrar pagamento"}), 500
    except Exception as e:
        return jsonify({"error": f"Erro interno: {e}"}), 500



# --- ROTAS DE GERENCIAMENTO DE USUÁRIOS (API) ---

@admin_api_bp.route('/users', methods=['GET'])
@login_required
@role_required('super_admin')
def list_all_users():
    """API para listar todos os usuários do sistema."""
    try:
        all_users = user_service.get_all_users()
        return jsonify([u.to_dict() for u in all_users]), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

# --- FUNÇÃO CORRIGIDA ---
@admin_api_bp.route('/users', methods=['POST'])
@login_required
@role_required('admin', 'super_admin') # Permissão ajustada
def add_user():
    """
    API para criar um novo usuário. 
    Se a role for 'student', usa o método especializado.
    Caso contrário, usa o método genérico (que requer senha).
    """
    try:
        data = request.get_json()
        role = data.get('role')

        # Se for um estudante, a lógica é tratada pelo user_service que gera senha, etc.
        if role == 'student':
            # A função `create_user_with_enrollments` espera os dados do usuário e uma lista de matrículas.
            # Como estamos apenas criando o usuário, passamos uma lista vazia de matrículas.
            new_user = user_service.create_user_with_enrollments(data, [])
            if new_user:
                return jsonify(new_user.to_dict()), 201
            else:
                return jsonify(error="Falha ao criar estudante no serviço."), 500
        
        # Lógica original para criar outros tipos de usuários (mantida para flexibilidade)
        else:
            name = data.get('name')
            email = data.get('email')
            password = data.get('password')

            if not all([name, email, role, password]):
                return jsonify(error="Nome, email, role e senha são obrigatórios para este tipo de usuário."), 400
            
            # Aqui, a criação genérica permanece, assumindo que `create_user` exista
            # ou que será implementado futuramente. Para o caso atual de 'student', não será usado.
            # NOTA: O `user_service.py` fornecido não tem um método `create_user` simples.
            # Esta parte do código falharia se a role não fosse 'student'.
            firebase_user = auth.create_user(email=email, password=password, display_name=name)
            user_in_db = user_service.create_user(
                user_id=firebase_user.uid, name=name, email=email, role=role
            )

            if user_in_db:
                return jsonify(user_in_db.to_dict()), 201
            else:
                auth.delete_user(firebase_user.uid)
                return jsonify(error="Erro ao salvar usuário no Firestore."), 500

    except ValueError as ve:
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logging.error(f"Erro ao adicionar usuário: {e}", exc_info=True)
        return jsonify(error=str(e)), 500


@admin_api_bp.route('/users/<string:user_id>', methods=['PUT'])
@login_required
@role_required('super_admin')
def edit_user(user_id):
    """API para editar um usuário."""
    try:
        data = request.get_json()
        
        password = data.get('password')
        if password:
            auth.update_user(user_id, password=password)
            data.pop('password', None)

        if user_service.update_user(user_id, data):
            return jsonify(success=True), 200
        else:
            return jsonify(success=False, message="Erro ao atualizar usuário."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500


@admin_api_bp.route('/users/<string:user_id>', methods=['DELETE'])
@login_required
@role_required('super_admin')
def delete_user(user_id):
    """API para deletar um usuário (do Auth e do Firestore)."""
    current_user = g.user
    if user_id == current_user.id:
        return jsonify(success=False, message="Você não pode deletar a si mesmo."), 403

    try:
        user_to_delete = user_service.get_user_by_id(user_id)
        if not user_to_delete:
            return jsonify(success=False, message="Usuário não encontrado."), 404

        if user_service.delete_user(user_id):
            return jsonify(success=True), 200
        else:
            return jsonify(success=False, message="Erro ao deletar usuário."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

# --- Rota de Configurações (API) ---

@admin_api_bp.route('/settings/branding', methods=['GET'])
@login_required
@role_required('super_admin')
def get_branding_settings():
    """API para buscar as configurações de identidade visual."""
    try:
        settings_doc = db.collection('settings').document('branding').get()
        settings = settings_doc.to_dict() if settings_doc.exists else {}
        return jsonify(settings), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/settings/branding', methods=['POST'])
@login_required
@role_required('super_admin')
def update_branding_settings():
    """API para atualizar as configurações de identidade, incluindo o upload do logo."""
    try:
        academy_name = request.form.get('academy_name')
        logo_path = request.form.get('current_logo_path') 
        
        if 'academy_logo' in request.files:
            file = request.files['academy_logo']
            if file and file.filename != '':
                filename = secure_filename(file.filename)
                
                upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
                os.makedirs(upload_folder, exist_ok=True)
                file.save(os.path.join(upload_folder, filename))
                logo_path = f'uploads/{filename}'

        settings_ref = db.collection('settings').document('branding')
        settings_ref.set({
            'academy_name': academy_name,
            'logo_path': logo_path
        })
        
        return jsonify(success=True, message="Configurações salvas com sucesso!"), 200
    except Exception as e:
        print(f"Erro ao salvar configurações: {e}")
        return jsonify(error=str(e)), 500