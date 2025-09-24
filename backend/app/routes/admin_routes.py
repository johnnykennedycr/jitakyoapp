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

admin_api_bp = Blueprint('admin_api', __name__, url_prefix='/api/admin')

# A inicialização de serviços permanece a mesma
user_service = None
teacher_service = None
training_class_service = None
enrollment_service = None
attendance_service = None
payment_service = None
db = None

def init_admin_bp(database, us, ts, tcs, es_param, as_param, ps_param):
    global db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service
    db = database
    user_service = us
    teacher_service = ts
    training_class_service = tcs
    enrollment_service = es_param
    attendance_service = as_param
    payment_service = ps_param


@admin_api_bp.route('/dashboard-data')
@login_required 
@role_required('admin', 'super_admin', 'receptionist') 
def dashboard_data():
    """Fornece os dados para o calendário do dashboard."""
    try:
        days_order = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
        time_slots = [f"{h:02d}:{m:02d}" for h in range(5, 23) for m in (0, 30)]

        all_classes = training_class_service.get_all_classes()
        teachers_map = {t.id: t.name for t in teacher_service.get_all_teachers()}
        scheduled_events = []
        
        for training_class in all_classes:
            if training_class.schedule:
                for slot in training_class.schedule:
                    if slot.day_of_week in days_order:
                        start_h, start_m = map(int, slot.start_time.split(':'))
                        end_h, end_m = map(int, slot.end_time.split(':'))
                        grid_col = days_order.index(slot.day_of_week) + 2
                        grid_row_start = ((start_h - 5) * 2) + (start_m // 30) + 2
                        duration_slots = ((end_h * 60 + end_m) - (start_h * 60 + start_m)) // 30
                        
                        if duration_slots > 0:
                            scheduled_events.append({
                                'id': training_class.id,
                                'name': training_class.name,
                                'time': f"{slot.start_time} - {slot.end_time}",
                                'teacher': teachers_map.get(training_class.teacher_id, 'N/A'),
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
        if not data.get('user_id'):
            return jsonify(success=False, message='ID de usuário é obrigatório.'), 400
        
        new_teacher = teacher_service.create_teacher(data)
        if new_teacher:
            return jsonify(success=True, teacher=new_teacher.to_dict()), 201
        else:
            return jsonify(success=False, message='Erro ao criar professor.'), 500
    except ValueError as ve:
        return jsonify(error=str(ve)), 409 # Conflict for existing teacher
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
            return jsonify(success=False, message='Erro ao atualizar professor.'), 500
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
            return jsonify(success=False, message='Erro ao deletar professor.'), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

# --- Rotas de Gerenciamento de Turmas ---

@admin_api_bp.route('/classes/', methods=['GET'])
@login_required
def list_classes():
    try:
        classes = training_class_service.get_all_classes()
        classes_data = [c.to_dict() for c in classes]
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
        new_class = training_class_service.create_class(data)
        if new_class:
            return jsonify(new_class.to_dict()), 201
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

@admin_api_bp.route('/students/search', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def search_students():
    """Busca alunos por um termo no nome."""
    try:
        search_term = request.args.get('name', '')
        students = user_service.search_students_by_name(search_term)
        return jsonify([s.to_dict() for s in students]), 200
    except Exception as e:
        print(f"Erro em search_students: {e}")
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/students/', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def list_students():
    """API para listar todos os alunos com suas matrículas e nomes de turmas."""
    try:
        students_data = user_service.get_students_with_enrollments()
        return jsonify([s.to_dict() for s in students_data]), 200
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
        return jsonify(new_user.to_dict()), 201
            
    except ValueError as ve:
        return jsonify(error=str(ve)), 400
    except Exception as e:
        print(f"Erro em add_student_with_enrollments: {e}")
        return jsonify(error="Erro interno ao criar aluno."), 500

@admin_api_bp.route('/students/<string:student_id>', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_student(student_id):
    """API para buscar um aluno específico."""
    student = user_service.get_user_by_id(student_id)
    if student and student.role == 'student':
        return jsonify(student.to_dict()), 200
    return jsonify(error="Aluno não encontrado."), 404

@admin_api_bp.route('/students/<string:student_id>', methods=['PUT'])
@login_required
@role_required('admin', 'super_admin')
def update_student(student_id):
    """API para atualizar um aluno."""
    try:
        data = request.get_json()
        if user_service.update_user(student_id, data):
            return jsonify(success=True), 200
        return jsonify(error="Aluno não encontrado ou falha na atualização."), 404
    except Exception as e:
        print(f"Erro em update_student: {e}")
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/students/<string:student_id>', methods=['DELETE'])
@login_required
@role_required('admin', 'super_admin')
def delete_student(student_id):
    """API para deletar um aluno."""
    try:
        if user_service.delete_user(student_id):
            return jsonify(success=True), 200
        return jsonify(error="Aluno não encontrado ou falha ao deletar."), 404
    except Exception as e:
        return jsonify(error=str(e)), 500

# --- Rotas de Gerenciamento de Matrículas ---

@admin_api_bp.route('/students/<string:student_id>/enrollments', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_student_enrollments(student_id):
    """API para buscar todas as matrículas de um aluno específico."""
    try:
        enrollments = enrollment_service.get_enrollments_by_student_id(student_id)
        return jsonify([e.to_dict() for e in enrollments]), 200
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
    data = request.get_json()
    if not data or 'class_id' not in data or 'date' not in data:
        return jsonify({"error": "Dados de chamada inválidos"}), 400
    try:
        if attendance_service.create_or_update_attendance(data):
            return jsonify({"success": True, "message": "Chamada salva com sucesso."}), 201
        return jsonify({"error": "Não foi possível salvar a chamada"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_api_bp.route('/classes/<class_id>/attendance-semesters', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def get_attendance_semesters(class_id):
    try:
        semesters = attendance_service.get_available_semesters(class_id)
        return jsonify(semesters), 200
    except Exception as e:
        logging.error(f"Erro ao buscar semestres de chamada para a turma {class_id}: {e}")
        return jsonify({"error": "Falha ao carregar semestres."}), 500

@admin_api_bp.route('/classes/<class_id>/attendance-history', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
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
        logging.error(f"Erro ao obter status financeiro: {e}")
        return jsonify({"error": f"Erro ao obter status financeiro: {e}"}), 500

@admin_api_bp.route('/payments', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def register_payment():
    data = request.get_json()
    try:
        new_payment = payment_service.record_payment(data)
        return jsonify(new_payment.to_dict()), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logging.error(f"Erro ao registrar pagamento: {e}")
        return jsonify({"error": f"Erro interno: {e}"}), 500

