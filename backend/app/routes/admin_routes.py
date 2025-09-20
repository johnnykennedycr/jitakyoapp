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


@admin_api_bp.route('/test', methods=['GET'])
def test_route():
    """Uma rota de teste para verificar se o blueprint está funcionando."""
    return jsonify(message="Rota de teste do admin_api_bp funcionando!"), 200

# --- Rotas de Gerenciamento de Professores ---

@admin_api_bp.route('/teachers', methods=['GET'])
@login_required
@role_required('admin', 'super_admin')
def list_teachers():
    """API para listar todos os professores."""
    try:
        teachers = teacher_service.get_all_teachers()
        # Converte a lista de objetos para uma lista de dicionários
        teachers_data = [t.to_dict() for t in teachers] 
        return jsonify(teachers_data), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/teachers', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def add_teacher():
    """API para adicionar um novo professor."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        if not user_id:
            return jsonify(success=False, message='ID de usuário é obrigatório.'), 400
        
        # Sua lógica de verificação e criação permanece
        existing_teacher = teacher_service.get_teacher_by_user_id(user_id)
        if existing_teacher:
            return jsonify(success=False, message='Este usuário já está vinculado a um professor.'), 409 # Conflict

        new_teacher = teacher_service.create_teacher(
            name=data.get('name'), 
            contact_info=data.get('contact_info'), 
            disciplines_data=data.get('disciplines'), 
            description=data.get('description'), 
            user_id=user_id
        )
        if new_teacher:
            return jsonify(success=True, teacher=new_teacher.to_dict()), 201
        else:
            return jsonify(success=False, message='Erro ao criar professor.'), 500
    except Exception as e:
        return jsonify(error=str(e)), 500


@admin_api_bp.route('/teachers/<string:teacher_id>', methods=['PUT'])
@login_required
@role_required('admin', 'super_admin')
def edit_teacher(teacher_id):
    """API para editar um professor existente."""
    try:
        data = request.get_json()
        # Sua lógica de validação e atualização vai aqui
        # ...
        
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

@admin_api_bp.route('/classes', methods=['GET'])
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def list_classes():
    """API para listar todas as turmas."""
    try:
        classes_raw = training_class_service.get_all_classes()
        teachers_map = {t.id: t.name for t in teacher_service.get_all_teachers()}
        
        classes_data = []
        for cls in classes_raw:
            cls_dict = cls.to_dict()
            cls_dict['teacher_name'] = teachers_map.get(cls.teacher_id, 'N/A')
            classes_data.append(cls_dict)
            
        return jsonify(classes_data), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/classes', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def add_class():
    """API para criar uma nova turma."""
    try:
        data = request.get_json()
        new_class = training_class_service.create_class(
            name=data.get('name'),
            discipline=data.get('discipline'),
            teacher_id=data.get('teacher_id'),
            schedule_data=data.get('schedule', []),
            capacity=data.get('capacity'),
            description=data.get('description'),
            default_monthly_fee=data.get('default_monthly_fee', 0)
        )
        if new_class:
            return jsonify(success=True, class_data=new_class.to_dict()), 201
        else:
            return jsonify(success=False, message="Erro ao criar a turma."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/classes/<string:class_id>', methods=['GET'])
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def get_class_details(class_id):
    """API para obter detalhes de uma turma específica, incluindo alunos."""
    try:
        training_class = training_class_service.get_class_by_id(class_id)
        if not training_class:
            return jsonify(error="Turma não encontrada."), 404

        teachers = teacher_service.get_all_teachers()
        
        enrollments = enrollment_service.get_enrollments_by_class(class_id)
        enrolled_students = [user_service.get_user_by_id(e.student_id) for e in enrollments]
        enrolled_students = [s for s in enrolled_students if s]

        all_students = user_service.get_users_by_role('student')
        enrolled_student_ids = {s.id for s in enrolled_students}
        available_students = [s for s in all_students if s.id not in enrolled_student_ids]
        
        response_data = {
            "class": training_class.to_dict(),
            "teachers": [t.to_dict() for t in teachers],
            "enrolled_students": [s.to_dict() for s in enrolled_students],
            "available_students": [s.to_dict() for s in available_students]
        }
        return jsonify(response_data), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/classes/<string:class_id>', methods=['PUT'])
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def edit_class(class_id):
    """API para atualizar os dados de uma turma."""
    try:
        data = request.get_json()
        if training_class_service.update_class(class_id, data):
            return jsonify(success=True), 200
        else:
            return jsonify(success=False, message="Erro ao atualizar a turma."), 500
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
        else:
            return jsonify(success=False, message="Erro ao deletar a turma."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

# --- Rotas de Gerenciamento de Alunos (Usuários com role='student') ---

@admin_api_bp.route('/students', methods=['GET'])
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def list_students():
    """API para listar todos os alunos."""
    try:
        students = user_service.get_users_by_role('student')
        return jsonify([s.to_dict() for s in students]), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

# A rota de ADICIONAR aluno é complexa, pois envolve criar o usuário no Firebase Auth
# e no Firestore. Ela deve ficar em uma rota de 'users' mais genérica.

@admin_api_bp.route('/students/<string:user_id>', methods=['PUT'])
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def edit_student(user_id):
    """API para editar os dados de um aluno."""
    try:
        user = user_service.get_user_by_id(user_id)
        if not user or user.role != 'student':
            return jsonify(error="Aluno não encontrado."), 404
        
        data = request.get_json()

        # Lógica de matricular/desmatricular
        current_enrollments = enrollment_service.get_enrollments_by_student(user_id)
        current_class_ids = {e.class_id for e in current_enrollments}
        selected_class_ids = set(data.get('enrolled_classes', []))
        
        class_ids_to_enroll = list(selected_class_ids - current_class_ids)
        class_ids_to_unenroll = list(current_class_ids - selected_class_ids)

        for class_id in class_ids_to_enroll:
            # ... sua lógica de create_enrollment ...
            pass
        for class_id in class_ids_to_unenroll:
            # ... sua lógica de delete_enrollment ...
            pass

        # Remove 'enrolled_classes' para não tentar salvar no documento do usuário
        data.pop('enrolled_classes', None)
        
        if user_service.update_user(user_id, data):
            return jsonify(success=True), 200
        else:
            return jsonify(success=False, message="Erro ao atualizar aluno."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

# A rota para DELETAR um aluno deve ser uma rota de 'users' mais genérica para
# lidar com a exclusão no Auth e no Firestore.

# --- Rotas de Gerenciamento de Matrículas ---

@admin_api_bp.route('/enrollments', methods=['GET'])
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def list_enrollments():
    """API para listar todas as matrículas."""
    try:
        enrollments = enrollment_service.get_all_enrollments()
        detailed_enrollments = []
        for enrollment in enrollments:
            student = user_service.get_user_by_id(enrollment.student_id)
            training_class = training_class_service.get_class_by_id(enrollment.class_id)
            detailed_enrollments.append({
                'id': enrollment.id,
                'student_name': student.name if student else 'Aluno Desconhecido',
                'class_name': training_class.name if training_class else 'Turma Desconhecida',
                'enrollment_date': enrollment.enrollment_date.strftime('%d/%m/%Y')
            })
        return jsonify(detailed_enrollments), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/enrollments', methods=['POST'])
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def new_enrollment():
    """API para criar uma nova matrícula."""
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        class_id = data.get('class_id')
        # ... outros dados ...

        if not student_id or not class_id:
            return jsonify(success=False, message="ID do aluno e da turma são obrigatórios."), 400
        
        # ... Sua lógica de create_enrollment
        enrollment = enrollment_service.create_enrollment(...)
        if enrollment:
            return jsonify(success=True, enrollment=enrollment.to_dict()), 201
        else:
            return jsonify(success=False, message="Aluno já matriculado."), 409
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/enrollments/<string:enrollment_id>', methods=['DELETE'])
@login_required
@role_required('admin', 'super_admin')
def delete_enrollment(enrollment_id):
    """API para deletar uma matrícula."""
    try:
        if enrollment_service.delete_enrollment(enrollment_id):
            return jsonify(success=True), 200
        else:
            return jsonify(success=False, message="Erro ao deletar matrícula."), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

# --- ROTAS PARA LISTA DE PRESENÇA (API) ---

@admin_api_bp.route('/classes/<string:class_id>/attendance', methods=['GET'])
@login_required
@role_required('admin', 'super_admin', 'teacher', 'receptionist')
def get_attendance_list(class_id):
    """API para buscar os dados para a página de chamada."""
    try:
        training_class = training_class_service.get_class_by_id(class_id)
        if not training_class:
            return jsonify(error="Turma não encontrada."), 404

        selected_date_str = request.args.get('date', date.today().isoformat())
        selected_date = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
        
        enrollments = enrollment_service.get_enrollments_by_class(class_id) or []
        
        students_raw = [user_service.get_user_by_id(e.student_id) for e in enrollments]
        students = [s.to_dict() for s in students_raw if s]

        attendance_record = attendance_service.get_attendance_by_class_and_date(class_id, selected_date)

        student_attendance_map = {}
        if attendance_record and attendance_record.students:
            for record in attendance_record.students:
                student_id = record.get('student_id')
                status = record.get('status')
                if student_id:
                    student_attendance_map[student_id] = (status == 'present')
        
        response_data = {
            "class": training_class.to_dict(),
            "students": students,
            "selected_date": selected_date.isoformat(),
            "attendance_map": student_attendance_map
        }
        return jsonify(response_data), 200
    except Exception as e:
        return jsonify(error=str(e)), 500


@admin_api_bp.route('/classes/<string:class_id>/attendance', methods=['POST'])
@login_required
@role_required('admin', 'super_admin', 'teacher', 'receptionist')
def save_attendance(class_id):
    """API para salvar o registro de presença."""
    try:
        data = request.get_json()
        selected_date_str = data.get('date')
        attendance_data = data.get('attendance') # Espera uma lista de {'student_id': '...', 'status': '...'}

        if not selected_date_str or not attendance_data:
            return jsonify(success=False, message="Dados de data e presença são obrigatórios."), 400

        selected_date = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
        selected_datetime = datetime.combine(selected_date, time.min)

        if attendance_service.save_attendance_record(class_id, selected_datetime, attendance_data):
            return jsonify(success=True, message="Lista de presença salva com sucesso!"), 200
        else:
            return jsonify(success=False, message="Erro ao salvar a lista de presença."), 500
    
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/classes/<string:class_id>/attendance-summary')
@login_required
@role_required('admin', 'super_admin', 'teacher', 'receptionist')
def get_attendance_summary(class_id):
    """API para buscar o resumo de presença (all_calls)."""
    try:
        training_class = training_class_service.get_class_by_id(class_id)
        if not training_class:
            return jsonify(error="Turma não encontrada."), 404

        # Sua lógica de cálculo de resumo de presença permanece a mesma
        # ... (cálculo de total_classes, student_summary_dict, etc.)
        
        # Exemplo simplificado do retorno
        student_summary = [] # Você deve preencher com sua lógica
        
        # Retorna o resumo como JSON
        response_data = {
            "class": training_class.to_dict(),
            "student_summary": student_summary # Sua lista de resumos aqui
        }
        return jsonify(response_data), 200
    except Exception as e:
        return jsonify(error=str(e)), 500


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

# --- Rotas Financeiras (API) ---

@admin_api_bp.route('/financial/dashboard-data')
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def financial_dashboard_data():
    """Fornece os dados para o dashboard financeiro."""
    try:
        today = date.today()
        
        total_received = payment_service.get_paid_total_for_month(today.year, today.month)
        overdue_payments = payment_service.get_overdue_payments()
        pending_payments = payment_service.get_pending_payments()
        recent_paid = payment_service.get_recent_paid_payments(limit=5)

        def enrich_payments(payments):
            # Função auxiliar para adicionar nomes de alunos aos pagamentos
            return [{
                'payment': p.to_dict(),
                'student_name': user_service.get_user_by_id(p.student_id).name or 'Aluno Removido'
            } for p in payments]

        response_data = {
            "total_received_this_month": total_received,
            "overdue": {
                "count": len(overdue_payments),
                "total": sum(p.amount for p in overdue_payments if p.amount),
                "payments": enrich_payments(overdue_payments)
            },
            "pending": {
                "count": len(pending_payments),
                "total": sum(p.amount for p in pending_payments if p.amount),
                "payments": enrich_payments(pending_payments)
            },
            "recent_paid": enrich_payments(recent_paid)
        }
        return jsonify(response_data), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/financial/generate-charges', methods=['POST'])
@login_required
@role_required('admin', 'super_admin')
def generate_monthly_charges_route():
    """API para gerar as cobranças mensais."""
    try:
        data = request.get_json()
        year = data.get('year')
        month = data.get('month')
        summary = payment_service.generate_monthly_charges(year, month)
        return jsonify(success=True, summary=summary), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/financial/pay/<string:payment_id>', methods=['POST'])
@login_required
@role_required('admin', 'super_admin', 'receptionist')
def mark_payment_as_paid_route(payment_id):
    """API para marcar um pagamento como pago."""
    try:
        data = request.get_json()
        payment_method = data.get('payment_method', 'Não especificado')
        if payment_service.mark_payment_as_paid(payment_id, payment_method):
            return jsonify(success=True, message='Pagamento registrado com sucesso!'), 200
        else:
            return jsonify(success=False, message='Erro ao registrar pagamento.'), 500
    except Exception as e:
        return jsonify(error=str(e)), 500

# (Outras rotas financeiras como history e student_history seguiriam o mesmo padrão)

# --- ROTAS DE GERENCIAMENTO DE USUÁRIOS (API) ---

@admin_api_bp.route('/users', methods=['GET'])
@login_required
@role_required('super_admin') # Apenas Super Admin pode listar todos os usuários
def list_all_users():
    """API para listar todos os usuários do sistema."""
    try:
        all_users = user_service.get_all_users()
        return jsonify([u.to_dict() for u in all_users]), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_api_bp.route('/users', methods=['POST'])
@login_required
@role_required('super_admin') # Apenas Super Admin pode criar novos usuários
def add_user():
    """API para criar um novo usuário (qualquer role)."""
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        role = data.get('role')
        password = data.get('password')

        if not all([name, email, role, password]):
            return jsonify(success=False, message="Nome, email, role e senha são obrigatórios."), 400

        # 1. Cria no Firebase Auth
        firebase_user = auth.create_user(email=email, password=password, display_name=name)
        
        # 2. Cria no Firestore
        user_in_db = user_service.create_user(
            user_id=firebase_user.uid, name=name, email=email, role=role
        )

        if user_in_db:
            return jsonify(success=True, user=user_in_db.to_dict()), 201
        else:
            # Rollback: deleta do Auth se a criação no Firestore falhar
            auth.delete_user(firebase_user.uid)
            return jsonify(success=False, message="Erro ao salvar usuário no Firestore."), 500
            
    except Exception as e:
        return jsonify(error=str(e)), 400 # 400 para erros como 'email já existe'

@admin_api_bp.route('/users/<string:user_id>', methods=['PUT'])
@login_required
@role_required('super_admin')
def edit_user(user_id):
    """API para editar um usuário."""
    try:
        data = request.get_json()
        
        # Lógica para atualizar senha no Firebase Auth, se fornecida
        password = data.get('password')
        if password:
            auth.update_user(user_id, password=password)
            data.pop('password', None) # Remove para não tentar salvar no Firestore

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

        # Lógica adicional, como deletar matrículas, pode ser adicionada aqui
        # if user_to_delete.role == 'student':
        #     ...

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
        # Dados de formulário multipart/form-data
        academy_name = request.form.get('academy_name')
        
        # O caminho do logo atual pode ser enviado para ser mantido se nenhum novo for enviado
        logo_path = request.form.get('current_logo_path') 
        
        if 'academy_logo' in request.files:
            file = request.files['academy_logo']
            if file and file.filename != '':
                filename = secure_filename(file.filename)
                
                # ATENÇÃO: O upload para a pasta 'static' do Cloud Run é efêmero.
                # O ideal é fazer o upload para o Google Cloud Storage.
                # Por enquanto, manteremos a lógica original.
                upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
                os.makedirs(upload_folder, exist_ok=True)
                file.save(os.path.join(upload_folder, filename))
                logo_path = f'uploads/{filename}' # O caminho a ser salvo no Firestore

        # Salva os dados no Firestore
        settings_ref = db.collection('settings').document('branding')
        settings_ref.set({
            'academy_name': academy_name,
            'logo_path': logo_path
        })
        
        return jsonify(success=True, message="Configurações salvas com sucesso!"), 200
    except Exception as e:
        print(f"Erro ao salvar configurações: {e}")
        return jsonify(error=str(e)), 500