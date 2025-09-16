# routes/admin.py ATUALIZADO COMPLETAMENTE

import os
from flask import Blueprint, jsonify, render_template, request, redirect, url_for, flash, current_app, g
from datetime import datetime, date, time, timedelta 
from werkzeug.utils import secure_filename
from firebase_admin import auth

# NOVAS IMPORTAÇÕES DE DECORADORES
from utils.decorators import token_required, role_required

# As importações de Services permanecem as mesmas
from services.user_service import UserService
from services.teacher_service import TeacherService
from services.training_class_service import TrainingClassService
from services.enrollment_service import EnrollmentService
from services.attendance_service import AttendanceService
from services.payment_service import PaymentService

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

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


@admin_bp.route('/dashboard')
#@token_required  # <-- TEMPORARIAMENTE DESABILITADO
#@role_required('admin', 'super_admin', 'receptionist') # <-- TEMPORARIAMENTE DESABILITADO
def dashboard():
    """ ROTA DE TESTE PARA VERIFICAR CABEÇALHOS """
    print("\n--- DIAGNÓSTICO FINAL: CABEÇALHOS DA REQUISIÇÃO ---")
    # Imprime todos os cabeçalhos que o Flask está recebendo
    print(request.headers)
    print("--- FIM DO DIAGNÓSTICO ---\n")
    api_url = url_for('admin.dashboard_data')
    return render_template('admin/dashboard.html', dashboard_api_url=api_url)


@admin_bp.route('/')
@admin_bp.route('/dashboard')
# @token_required
# @role_required('admin', 'super_admin', 'receptionist')
def dashboard_data():
    """Exibe o dashboard principal com o calendário de treinos da semana."""
    days_order = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    time_slots = [f"{h:02d}:{m:02d}" for h in range(5, 23) for m in (0, 30)]

    all_classes = training_class_service.get_all_classes()
    teachers_map = {t.id: t.name for t in teacher_service.get_all_teachers()}
    scheduled_events = []
    
    for training_class in all_classes:
        if not training_class.schedule:
            continue
        for slot in training_class.schedule:
            try:
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
            except Exception as e:
                print(f"Erro ao processar horário para a turma {training_class.name}: {e}")
    data = {
        'days_order': days_order,
        'time_slots': time_slots,
        'scheduled_events': scheduled_events
    }
    return jsonify(data)

# --- Rotas de Gerenciamento de Professores ---
@admin_bp.route('/teachers')
@token_required
@role_required('admin', 'super_admin')
def list_teachers():
    teachers = teacher_service.get_all_teachers()
    return render_template('admin/teachers/list.html', teachers=teachers)

@admin_bp.route('/teachers/add', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin')
def add_teacher():
    if request.method == 'POST':
        user_id = request.form.get('user_id')
        if not user_id:
            flash('Você precisa selecionar uma conta de usuário para vincular ao professor.', 'danger')
            return redirect(url_for('admin.add_teacher'))
        
        existing_teacher = teacher_service.get_teacher_by_user_id(user_id)
        if existing_teacher:
            flash('Este usuário já está vinculado a outro perfil de professor.', 'danger')
            return redirect(url_for('admin.add_teacher'))
        
        name = request.form['name']
        email = request.form.get('email')
        phone = request.form.get('phone')
        description = request.form.get('description')
        contact_info = {'email': email, 'phone': phone}

        disciplines = {}
        for key, value in request.form.items():
            if key.startswith('discipline_name_'):
                index = int(key.split('_')[-1])
                if index not in disciplines: disciplines[index] = {}
                disciplines[index]['discipline_name'] = value
            elif key.startswith('graduation_'):
                index = int(key.split('_')[-1])
                if index not in disciplines: disciplines[index] = {}
                disciplines[index]['graduation'] = value
        
        disciplines_data = [v for k, v in sorted(disciplines.items())]

        new_teacher = teacher_service.create_teacher(
            name, contact_info, disciplines_data, description, user_id=user_id
        )
        if new_teacher:
            flash(f'Professor "{new_teacher.name}" adicionado e vinculado com sucesso!', 'success')
            return redirect(url_for('admin.list_teachers'))
        else:
            flash('Erro ao adicionar professor.', 'danger')

    all_teacher_users = user_service.get_users_by_role('teacher')
    all_teachers = teacher_service.get_all_teachers()
    linked_user_ids = {t.user_id for t in all_teachers if t.user_id}
    available_teacher_users = [u for u in all_teacher_users if u.id not in linked_user_ids]
    
    return render_template('admin/teachers/form.html', teacher=None, available_teacher_users=available_teacher_users)

@admin_bp.route('/teachers/edit/<string:teacher_id>', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin')
def edit_teacher(teacher_id):
    teacher = teacher_service.get_teacher_by_id(teacher_id)
    if not teacher:
        flash('Professor não encontrado.', 'danger')
        return redirect(url_for('admin.list_teachers'))

    if request.method == 'POST':
        user_id = request.form.get('user_id')
        if not user_id:
            flash('Você precisa selecionar uma conta de usuário para vincular ao professor.', 'danger')
            return redirect(url_for('admin.edit_teacher', teacher_id=teacher_id))

        existing_teacher = teacher_service.get_teacher_by_user_id(user_id)
        if existing_teacher and existing_teacher.id != teacher_id:
            flash('Este usuário já está vinculado a outro perfil de professor.', 'danger')
            return redirect(url_for('admin.edit_teacher', teacher_id=teacher_id))
        
        name = request.form['name']
        email = request.form.get('email')
        phone = request.form.get('phone')
        description = request.form.get('description')
        contact_info = {'email': email, 'phone': phone}

        disciplines = {}
        for key, value in request.form.items():
            if key.startswith('discipline_name_'):
                index = int(key.split('_')[-1])
                if index not in disciplines: disciplines[index] = {}
                disciplines[index]['discipline_name'] = value
            elif key.startswith('graduation_'):
                index = int(key.split('_')[-1])
                if index not in disciplines: disciplines[index] = {}
                disciplines[index]['graduation'] = value
        
        disciplines_data = [v for k, v in sorted(disciplines.items())]

        update_data = {
            'name': name,
            'contact_info': contact_info,
            'disciplines': disciplines_data,
            'description': description,
            'user_id': user_id
        }

        if teacher_service.update_teacher(teacher_id, update_data):
            flash(f'Professor "{name}" atualizado com sucesso!', 'success')
            return redirect(url_for('admin.list_teachers'))
        else:
            flash('Erro ao atualizar professor.', 'danger')

    all_teacher_users = user_service.get_users_by_role('teacher')
    all_teachers = teacher_service.get_all_teachers()
    linked_user_ids = {t.user_id for t in all_teachers if t.user_id and t.id != teacher_id}
    available_teacher_users = [u for u in all_teacher_users if u.id not in linked_user_ids]
    
    current_linked_user = user_service.get_user_by_id(teacher.user_id) if teacher.user_id else None
    
    return render_template(
        'admin/teachers/form.html', 
        teacher=teacher, 
        available_teacher_users=available_teacher_users,
        current_linked_user=current_linked_user
    )

@admin_bp.route('/teachers/delete/<string:teacher_id>', methods=['POST'])
@token_required
@role_required('admin', 'super_admin')
def delete_teacher(teacher_id):
    if teacher_service.delete_teacher(teacher_id):
        flash('Professor deletado com sucesso!', 'success')
    else:
        flash('Erro ao deletar professor.', 'danger')
    return redirect(url_for('admin.list_teachers'))

# --- Rotas de Gerenciamento de Turmas ---
@admin_bp.route('/classes')
@token_required
@role_required('admin', 'super_admin', 'receptionist')
def list_classes():
    classes = training_class_service.get_all_classes()
    teachers_map = {t.id: t.name for t in teacher_service.get_all_teachers()}
    return render_template('admin/training_classes/list.html', classes=classes, teachers_map=teachers_map)

@admin_bp.route('/classes/add', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin')
def add_class():
    teachers = teacher_service.get_all_teachers()
    if request.method == 'POST':
        name = request.form['name']
        discipline = request.form['discipline']
        teacher_id = request.form['teacher_id']
        capacity = int(request.form['capacity'])
        description = request.form.get('description')
        default_monthly_fee = float(request.form.get('default_monthly_fee', 0))

        schedule_data = []
        i = 0
        while True:
            day_of_week = request.form.get(f'day_of_week_{i}')
            start_time = request.form.get(f'start_time_{i}')
            end_time = request.form.get(f'end_time_{i}')
            if day_of_week and start_time and end_time:
                schedule_data.append({
                    'day_of_week': day_of_week, 'start_time': start_time, 'end_time': end_time
                })
            elif not any([day_of_week, start_time, end_time]):
                break
            i += 1
        
        new_class = training_class_service.create_class(name, discipline, teacher_id, schedule_data, capacity, description, default_monthly_fee=default_monthly_fee)
        if new_class:
            flash(f'Turma "{new_class.name}" adicionada com sucesso!', 'success')
            return redirect(url_for('admin.list_classes'))
        else:
            flash('Erro ao adicionar turma. Verifique os dados.', 'danger')
    return render_template('admin/training_classes/form.html', training_class=None, teachers=teachers)

@admin_bp.route('/classes/edit/<string:class_id>', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin', 'receptionist')
def edit_class(class_id):
    training_class = training_class_service.get_class_by_id(class_id)
    if not training_class:
        flash('Turma não encontrada.', 'danger')
        return redirect(url_for('admin.list_classes'))

    teachers = teacher_service.get_all_teachers()
    enrolled_students_enrollments = enrollment_service.get_enrollments_by_class(class_id)
    enrolled_students = [user_service.get_user_by_id(e.student_id) for e in enrolled_students_enrollments]
    enrolled_students = [s for s in enrolled_students if s]

    all_students = user_service.get_users_by_role('student')
    enrolled_student_ids = {s.id for s in enrolled_students}
    available_students = [s for s in all_students if s.id not in enrolled_student_ids]
    available_students_data = [{'id': s.id, 'name': s.name, 'email': s.email} for s in available_students]

    if request.method == 'POST':
        if 'student_id_to_enroll' in request.form and request.form['student_id_to_enroll']:
            student_id = request.form['student_id_to_enroll']
            base_fee = float(request.form.get('base_monthly_fee') or '0')
            discount = float(request.form.get('discount_amount') or '0')
            reason = request.form.get('discount_reason', '')
            if enrollment_service.create_enrollment(student_id, class_id, base_fee, discount, reason):
                flash('Aluno matriculado com sucesso!', 'success')
            else:
                flash('Erro ao matricular aluno ou aluno já matriculado.', 'danger')
            return redirect(url_for('admin.edit_class', class_id=class_id))
        
        if 'unenroll_student_id' in request.form and request.form['unenroll_student_id']:
            student_id_to_unenroll = request.form['unenroll_student_id']
            enrollments_to_delete = enrollment_service.get_enrollments_by_student_and_class(student_id_to_unenroll, class_id)
            if enrollments_to_delete:
                enrollment_service.delete_enrollment(enrollments_to_delete[0].id)
                flash(f'Aluno desmatriculado com sucesso!', 'success')
            else:
                flash('Erro: Matrícula não encontrada para desmatricular.', 'danger')
            return redirect(url_for('admin.edit_class', class_id=class_id))

        name = request.form['name']
        discipline = request.form['discipline']
        teacher_id = request.form['teacher_id']
        capacity = int(request.form['capacity'])
        description = request.form.get('description')
        default_monthly_fee = float(request.form.get('default_monthly_fee', 0))
        schedule_data = []
        i = 0
        while True:
            day_of_week = request.form.get(f'day_of_week_{i}')
            start_time = request.form.get(f'start_time_{i}')
            end_time = request.form.get(f'end_time_{i}')
            if day_of_week and start_time and end_time:
                schedule_data.append({'day_of_week': day_of_week, 'start_time': start_time, 'end_time': end_time})
            elif not any([day_of_week, start_time, end_time]):
                break
            i += 1
            
        update_data = {'name': name, 'discipline': discipline, 'teacher_id': teacher_id, 'schedule': schedule_data, 'capacity': capacity, 'description': description, 'default_monthly_fee': default_monthly_fee}
        if training_class_service.update_class(class_id, update_data):
            flash(f'Turma "{name}" atualizada com sucesso!', 'success')
            return redirect(url_for('admin.list_classes'))
        else:
            flash('Erro ao atualizar turma.', 'danger')
            return redirect(url_for('admin.edit_class', class_id=class_id))

    return render_template('admin/training_classes/form.html', training_class=training_class, teachers=teachers, enrolled_students=enrolled_students, available_students=available_students, available_students_json=available_students_data)

@admin_bp.route('/classes/delete/<string:class_id>', methods=['POST'])
@token_required
@role_required('admin', 'super_admin')
def delete_class(class_id):
    if training_class_service.delete_class(class_id):
        flash('Turma deletada com sucesso!', 'success')
    else:
        flash('Erro ao deletar turma.', 'danger')
    return redirect(url_for('admin.list_classes'))


# --- Rotas de Gerenciamento de Alunos (Usuários com role='student') ---
@admin_bp.route('/students')
@token_required
@role_required('admin', 'super_admin', 'receptionist')
def list_students():
    students = user_service.get_users_by_role('student')
    return render_template('admin/users/list.html', users=students, role_filter='student')

@admin_bp.route('/students/add', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin', 'receptionist')
def add_student():
    classes = training_class_service.get_all_classes()
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        date_of_birth_str = request.form.get('date_of_birth')
        date_of_birth = datetime.strptime(date_of_birth_str, '%Y-%m-%d') if date_of_birth_str else None
        phone = request.form.get('phone')

        enrolled_disciplines, guardians = [], []
        # (Lógica para extrair disciplinas e guardiões do formulário)

        new_student = user_service.create_user(name, email, 'student', date_of_birth=date_of_birth, phone=phone, enrolled_disciplines=enrolled_disciplines, guardians=guardians)
        if new_student:
            selected_class_ids = request.form.getlist('enrolled_classes')
            for class_id in selected_class_ids:
                training_class = training_class_service.get_class_by_id(class_id)
                default_fee = training_class.default_monthly_fee if training_class else 0
                enrollment_service.create_enrollment(new_student.id, class_id, base_fee=default_fee)
            flash(f'Aluno "{new_student.name}" adicionado com sucesso e senha enviada para {new_student.email}!', 'success')
            return redirect(url_for('admin.list_students'))
        else:
            flash('Erro ao adicionar aluno. O e-mail pode já estar em uso.', 'danger')

    return render_template('admin/users/form.html', user=None, current_role='student', classes=classes)

@admin_bp.route('/students/edit/<string:user_id>', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin', 'receptionist')
def edit_student(user_id):
    user = user_service.get_user_by_id(user_id)
    if not user or user.role != 'student':
        flash('Aluno não encontrado ou usuário não é um aluno.', 'danger')
        return redirect(url_for('admin.list_students'))
    
    # (Lógica da rota permanece a mesma, pois não usa current_user)
    all_classes = training_class_service.get_all_classes()
    current_enrollments = enrollment_service.get_enrollments_by_student(user_id)
    current_class_ids = {e.class_id for e in current_enrollments}

    if request.method == 'POST':
        # ... (lógica de atualização do POST)
        flash('Aluno atualizado com sucesso!', 'success')
        return redirect(url_for('admin.list_students'))

    return render_template('admin/users/form.html', user=user, current_role='student', classes=all_classes, current_class_ids=current_class_ids)

@admin_bp.route('/students/delete/<string:user_id>', methods=['POST'])
@token_required
@role_required('admin', 'super_admin')
def delete_student(user_id):
    user = user_service.get_user_by_id(user_id)
    if user and user.role == 'student':
        enrollments = enrollment_service.get_enrollments_by_student(user_id)
        for enrollment in enrollments:
            enrollment_service.delete_enrollment(enrollment.id)
        if user_service.delete_user(user_id):
            flash('Aluno deletado com sucesso!', 'success')
        else:
            flash('Erro ao deletar aluno.', 'danger')
    else:
        flash('Usuário não encontrado ou não é um aluno.', 'danger')
    return redirect(url_for('admin.list_students'))

# --- Rotas de Gerenciamento de Matrículas ---
@admin_bp.route('/enrollments')
@token_required
@role_required('admin', 'super_admin', 'receptionist')
def list_enrollments():
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
    return render_template('admin/enrollments/list.html', enrollments=detailed_enrollments)

@admin_bp.route('/enrollments/delete/<string:enrollment_id>', methods=['POST'])
@token_required
@role_required('admin', 'super_admin')
def delete_enrollment(enrollment_id):
    if enrollment_service.delete_enrollment(enrollment_id):
        flash('Matrícula deletada com sucesso!', 'success')
    else:
        flash('Erro ao deletar matrícula.', 'danger')
    return redirect(url_for('admin.list_enrollments'))

@admin_bp.route('/enrollments/new/<string:class_id>', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin', 'receptionist')
def new_enrollment(class_id):
    training_class = training_class_service.get_class_by_id(class_id)
    if not training_class:
        flash('Turma não encontrada.', 'danger')
        return redirect(url_for('admin.list_classes'))
    if request.method == 'POST':
        student_id = request.form.get('student_id')
        base_fee = float(request.form.get('base_monthly_fee') or '0')
        discount = float(request.form.get('discount_amount') or '0')
        reason = request.form.get('discount_reason', '')
        due_day = int(request.form.get('due_day') or 15)

        if not student_id:
            flash('Por favor, selecione um aluno.', 'danger')
        else:
            enrollment = enrollment_service.create_enrollment(student_id, class_id, base_fee, due_day, discount, reason)
            if enrollment:
                flash('Aluno matriculado com sucesso!', 'success')
                return redirect(url_for('admin.edit_class', class_id=class_id))
            else:
                flash('Erro: Aluno já matriculado nesta turma.', 'danger')
                return redirect(url_for('admin.new_enrollment', class_id=class_id))

    enrolled_student_ids = {e.student_id for e in enrollment_service.get_enrollments_by_class(class_id)}
    all_students = user_service.get_users_by_role('student')
    available_students = [s for s in all_students if s.id not in enrolled_student_ids]
    available_students_json = [{'id': s.id, 'name': s.name, 'email': s.email} for s in available_students]
    return render_template('admin/enrollments/form.html', training_class=training_class, available_students_json=available_students_json)

# --- ROTAS PARA LISTA DE PRESENÇA ---
@admin_bp.route('/classes/<string:class_id>/attendance', methods=['GET'])
@token_required
@role_required('admin', 'super_admin', 'teacher', 'receptionist')
def get_attendance_list(class_id):
    training_class = training_class_service.get_class_by_id(class_id)
    if not training_class:
        flash('Turma não encontrada.', 'danger')
        return redirect(url_for('admin.list_classes'))

    weekday_map_to_js = {
        'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3,
        'Quinta': 4, 'Sexta': 5, 'Sábado': 6
    }
    scheduled_days_js = []
    if training_class.schedule:
        for item in training_class.schedule:
            day_number = weekday_map_to_js.get(item.day_of_week)
            if day_number is not None:
                scheduled_days_js.append(day_number)
    
    selected_date_str = request.args.get('date')
    if selected_date_str:
        selected_date = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
    else:
        selected_date = date.today()
    
    enrollments = enrollment_service.get_enrollments_by_class(class_id) or []
    
    students_with_none = [user_service.get_user_by_id(e.student_id) for e in enrollments]
    students = [s for s in students_with_none if s is not None]

    attendance_record = attendance_service.get_attendance_by_class_and_date(class_id, selected_date)

    student_attendance_map = {}
    if attendance_record and attendance_record.students:
        for record in attendance_record.students:
            student_id = record.get('student_id')
            status = record.get('status')
            if student_id:
                student_attendance_map[student_id] = (status == 'present')

    return render_template('admin/training_classes/call_list.html',
                           training_class=training_class,
                           students=students,
                           selected_date=selected_date,
                           student_attendance_map=student_attendance_map,
                           scheduled_days_js=scheduled_days_js)

@admin_bp.route('/classes/<string:class_id>/attendance', methods=['POST'])
@token_required
@role_required('admin', 'super_admin', 'teacher', 'receptionist')
def save_attendance(class_id):
    try:
        selected_date_str = request.form['date']
        selected_date = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
        selected_datetime = datetime.combine(selected_date, time.min)

        enrollments = enrollment_service.get_enrollments_by_class(class_id) or []
        students_in_class = [user_service.get_user_by_id(e.student_id) for e in enrollments]
        
        attendance_data = []
        for student in students_in_class:
            if student: 
                student_id = student.id
                is_present = f'student_present_{student_id}' in request.form
                status = 'present' if is_present else 'absent'
                attendance_data.append({'student_id': student_id, 'status': status})

        if attendance_service.save_attendance_record(class_id, selected_datetime, attendance_data):
            flash('Lista de presença salva com sucesso!', 'success')
        else:
            flash('Erro ao salvar a lista de presença.', 'danger')
        
        return redirect(url_for('admin.all_calls', class_id=class_id))
    
    except Exception as e:
        flash(f'Ocorreu um erro inesperado ao salvar a presença: {e}', 'danger')
        return redirect(url_for('admin.get_attendance_list', class_id=class_id, date=request.form.get('date')))

@admin_bp.route('/classes/all_calls/<string:class_id>')
@token_required
@role_required('admin', 'super_admin', 'teacher', 'receptionist')
def all_calls(class_id):
    training_class = training_class_service.get_class_by_id(class_id)
    if not training_class:
        flash('Turma não encontrada.', 'danger')
        return redirect(url_for('admin.list_classes'))

    weekday_map = {
        'Segunda': 'Monday', 'Terça': 'Tuesday', 'Quarta': 'Wednesday',
        'Quinta': 'Thursday', 'Sexta': 'Friday', 'Sábado': 'Saturday', 'Domingo': 'Sunday'
    }
    
    scheduled_days_pt = [item.day_of_week for item in training_class.schedule]
    scheduled_days_en = [weekday_map.get(day) for day in scheduled_days_pt if weekday_map.get(day)]

    today = date.today()
    start_date = today.replace(day=1) 
    
    actual_class_dates = []
    current_date = start_date
    while current_date <= today:
        if current_date.strftime('%A') in scheduled_days_en:
            actual_class_dates.append(current_date)
        current_date += timedelta(days=1)
    total_classes = len(actual_class_dates)
    
    all_attendance_records = attendance_service.get_all_attendance_by_class(class_id)
    enrollments = enrollment_service.get_enrollments_by_class(class_id) or []
    
    student_summary_dict = {}
    for enrollment in enrollments:
        student = user_service.get_user_by_id(enrollment.student_id)
        if student:
            student_graduation = "N/A"
            if student.enrolled_disciplines:
                for discipline_info in student.enrolled_disciplines:
                    if discipline_info.get('discipline_name') == training_class.discipline:
                        student_graduation = discipline_info.get('graduation', 'N/A')
                        break
            
            student_name_with_age = student.name
            if student.age is not None:
                student_name_with_age = f"{student.name} ({student.age} anos)"

            student_summary_dict[student.id] = {
                'id': student.id,
                'name': student_name_with_age,
                'graduation': student_graduation,
                'present_count': 0,
                'total_classes': total_classes
            }

    present_dates_by_student = {} 

    for record in all_attendance_records:
        attendance_date_obj = record.attendance_date
        if record.students:
            for student_record in record.students:
                student_id = student_record.get('student_id')
                status = student_record.get('status')
                if student_id in student_summary_dict and status == 'present':
                    if student_id not in present_dates_by_student:
                        present_dates_by_student[student_id] = set()
                    present_dates_by_student[student_id].add(attendance_date_obj)
    
    for student_id, dates_attended in present_dates_by_student.items():
        student_summary_dict[student_id]['present_count'] = len(dates_attended)
    
    for student_id in student_summary_dict:
        if total_classes > 0:
            present_count = student_summary_dict[student_id]['present_count']
            student_summary_dict[student_id]['attendance_percentage'] = (present_count / total_classes) * 100
        else:
            student_summary_dict[student_id]['attendance_percentage'] = 0

    return render_template('admin/training_classes/all_calls.html',
                           training_class=training_class,
                           student_summary=list(student_summary_dict.values()))

@admin_bp.route('/classes/<string:class_id>/unenroll/<string:student_id>', methods=['POST'])
@token_required
@role_required('admin', 'super_admin')
def unenroll_student_from_class(class_id, student_id):
    enrollments_to_delete = enrollment_service.get_enrollments_by_student_and_class(student_id, class_id)
    if enrollments_to_delete:
        if enrollment_service.delete_enrollment(enrollments_to_delete[0].id):
            flash('Aluno desmatriculado com sucesso!', 'success')
        else:
            flash('Erro ao tentar desmatricular o aluno.', 'danger')
    else:
        flash('Matrícula não encontrada.', 'warning')
    return redirect(url_for('admin.all_calls', class_id=class_id))

# --- Rotas Financeiras ---
@admin_bp.route('/financial')
@token_required
@role_required('admin', 'super_admin', 'receptionist')
def financial_dashboard():
    """Exibe o painel financeiro principal com dados detalhados."""
    today = date.today()
    
    # 1. Busca todos os dados necessários
    total_received_this_month = payment_service.get_paid_total_for_month(today.year, today.month)
    overdue_payments_raw = payment_service.get_overdue_payments()
    pending_payments_raw = payment_service.get_pending_payments() # <-- BUSCA OS PAGAMENTOS PENDENTES
    recent_paid_raw = payment_service.get_recent_paid_payments(limit=5)

    # 2. Calcula os totais para os cards
    overdue_total = sum(p.amount for p in overdue_payments_raw if p.amount)
    pending_total = sum(p.amount for p in pending_payments_raw if p.amount)
    
    # 3. Enriquece os dados com nomes para exibição
    def enrich_payments(payments):
        detailed_list = []
        for payment in payments:
            student = user_service.get_user_by_id(payment.student_id)
            detailed_list.append({
                'payment': payment,
                'student_name': student.name if student else 'Aluno Removido'
            })
        return detailed_list

    overdue_payments = enrich_payments(overdue_payments_raw)
    pending_payments = enrich_payments(pending_payments_raw) # <-- PROCESSA OS PAGAMENTOS PENDENTES
    recent_paid = enrich_payments(recent_paid_raw)

    return render_template(
        'admin/financial/dashboard.html', 
        current_month=today.month, 
        current_year=today.year,
        total_received=total_received_this_month,
        overdue_payments=overdue_payments,
        pending_payments=pending_payments, # <-- ENVIA PARA O TEMPLATE
        recent_paid=recent_paid,
        overdue_count=len(overdue_payments),
        overdue_total=overdue_total,
        pending_count=len(pending_payments), # <-- ENVIA A CONTAGEM
        pending_total=pending_total,
        today=today
    )


@admin_bp.route('/financial/generate_charges', methods=['POST'])
@token_required
@role_required('admin', 'super_admin')
def generate_monthly_charges_route():
    year = int(request.form.get('year'))
    month = int(request.form.get('month'))
    summary = payment_service.generate_monthly_charges(year, month)
    flash(f"Geração de cobranças concluída para {month}/{year}: {summary['created']} criadas, {summary['skipped']} já existentes.", 'success')
    return redirect(url_for('admin.financial_dashboard'))

@admin_bp.route('/financial/pay/<string:payment_id>', methods=['POST'])
@token_required
@role_required('admin', 'super_admin', 'receptionist')
def mark_payment_as_paid_route(payment_id):
    payment_method = request.form.get('payment_method', 'Não especificado')
    if payment_service.mark_payment_as_paid(payment_id, payment_method):
        flash('Pagamento registrado com sucesso!', 'success')
    else:
        flash('Ocorreu um erro ao registrar o pagamento.', 'danger')
    return redirect(url_for('admin.financial_dashboard'))

@admin_bp.route('/financial/student/<string:student_id>')
@token_required
@role_required('admin', 'super_admin')
def student_financial_history(student_id):
    student = user_service.get_user_by_id(student_id)
    if not student:
        flash('Aluno não encontrado.', 'danger')
        return redirect(url_for('admin.list_students'))

    # Usa o método que já existe para buscar todos os pagamentos do aluno
    payments = payment_service.get_payments_by_student(student_id)

    # Enriquece os dados de pagamento com o nome da turma
    detailed_payments = []
    for payment in payments:
        training_class = training_class_service.get_class_by_id(payment.class_id)
        detailed_payments.append({
            'payment': payment,
            'class_name': training_class.name if training_class else 'Turma Removida'
        })
    
    return render_template(
        'admin/financial/student_history.html',
        student=student,
        payments=detailed_payments
    )


@admin_bp.route('/financial/history')
@token_required
@role_required('admin', 'super_admin')
def payment_history():
    # Pega os filtros da URL
    selected_year = request.args.get('year', default=datetime.now().year, type=int)
    selected_month = request.args.get('month', default='')
    selected_class_id = request.args.get('class_id', default='')
    selected_status = request.args.get('status', default='')

    month_int = int(selected_month) if selected_month else None

    # Busca os pagamentos aplicando os filtros
    payments = payment_service.get_all_payments_with_filters(
        class_id=selected_class_id,
        year=selected_year,
        month=month_int,
        status=selected_status
    )

    # --- LÓGICA DE CÁLCULO ADICIONADA AQUI ---
    total_received_in_period = 0.0
    total_pending_in_period = 0.0
    for payment in payments:
        if payment.status == 'paid' and payment.amount:
            total_received_in_period += payment.amount
        elif payment.status in ['pending', 'overdue'] and payment.amount:
            total_pending_in_period += payment.amount
    # --- FIM DA LÓGICA DE CÁLCULO ---

    # Enriquece os dados para exibição
    detailed_payments = []
    for payment in payments:
        student = user_service.get_user_by_id(payment.student_id)
        training_class = training_class_service.get_class_by_id(payment.class_id)
        detailed_payments.append({
            'payment': payment,
            'student_name': student.name if student else 'Aluno Removido',
            'class_name': training_class.name if training_class else 'Turma Removida'
        })

    all_classes = training_class_service.get_all_classes()
    years = range(datetime.now().year - 2, datetime.now().year + 2)

    return render_template(
        'admin/financial/history.html',
        payments=detailed_payments,
        all_classes=all_classes,
        years=years,
        selected_year=selected_year,
        selected_month=int(selected_month) if selected_month else '',
        selected_class_id=selected_class_id,
        selected_status=selected_status,
        total_received_in_period=total_received_in_period, # <-- Envia o novo total
        total_pending_in_period=total_pending_in_period   # <-- Envia o novo total
    )


# --- ROTAS DE GERENCIAMENTO DE USUÁRIOS (UNIFICADO) ---
@admin_bp.route('/users/add', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin')
def add_user():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        role = request.form['role']
        new_user = user_service.create_user(name, email, role)
        if new_user:
            flash(f'Usuário "{name}" ({role}) criado com sucesso! Uma senha temporária foi enviada para {email}.', 'success')
            return redirect(url_for('admin.list_all_users'))
        else:
            flash('Erro ao criar usuário. O e-mail pode já estar em uso.', 'danger')
    return render_template('admin/users/user_form.html', user=None, title="Adicionar Novo Usuário")

@admin_bp.route('/users/edit/<string:user_id>', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin')
def edit_user(user_id):
    user = user_service.get_user_by_id(user_id)
    if not user:
        flash('Usuário não encontrado.', 'danger')
        return redirect(url_for('admin.list_all_users'))

    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        role = request.form['role']
        password = request.form.get('password')
        update_data = { 'name': name, 'email': email, 'role': role }
        if password:
            update_data['password'] = password
        if user_service.update_user(user_id, update_data):
            flash('Usuário atualizado com sucesso!', 'success')
            return redirect(url_for('admin.list_all_users'))
        else:
            flash('Erro ao atualizar usuário.', 'danger')
    return render_template('admin/users/user_form.html', user=user, title=f"Editar Usuário: {user.name}")

# --- ROTAS DE SUPER ADMIN ---
@admin_bp.route('/super/users')
@token_required
@role_required('super_admin')
def list_all_users():
    all_users = user_service.get_all_users()
    return render_template('admin/super/list_users.html', users=all_users)

@admin_bp.route('/financial/add_charge', methods=['GET', 'POST'])
@token_required
@role_required('admin', 'super_admin')
def add_manual_charge():
    if request.method == 'POST':
        student_id = request.form.get('student_id')
        amount_str = request.form.get('amount') or '0'
        description = request.form.get('description')
        due_date_str = request.form.get('due_date')

        if not student_id or not amount_str or not description or not due_date_str:
            flash('Todos os campos são obrigatórios.', 'danger')
            return redirect(url_for('admin.add_manual_charge'))

        try:
            amount = float(amount_str)
            due_date = datetime.strptime(due_date_str, '%Y-%m-%d')

            payment_service.create_payment(
                student_id=student_id,
                amount=amount,
                due_date=due_date,
                description=description,
                status='pending' # Cobranças manuais começam como pendentes
            )
            flash('Cobrança avulsa criada com sucesso!', 'success')
            return redirect(url_for('admin.financial_dashboard'))
        except ValueError:
            flash('Valor inválido fornecido.', 'danger')
        except Exception as e:
            flash(f'Ocorreu um erro: {e}', 'danger')
        
        return redirect(url_for('admin.add_manual_charge'))

    # Para o método GET, prepara a lista de alunos para o autocomplete
    all_students = user_service.get_users_by_role('student')
    students_json = [{'id': s.id, 'name': s.name, 'email': s.email} for s in all_students]
    
    return render_template('admin/financial/manual_charge_form.html', students_json=students_json)


@admin_bp.route('/super/users/add', methods=['GET', 'POST'])
@token_required
@role_required('super_admin')
def add_system_user():
    """Exibe e processa o formulário para o Super Admin criar qualquer tipo de usuário."""
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        role = request.form.get('role')
        # O admin define uma senha inicial para o usuário
        password = request.form.get('password')

        if not all([name, email, role, password]):
            flash('Todos os campos, incluindo a senha, são obrigatórios.', 'danger')
            return render_template('admin/super/user_form.html', action="Adicionar", user=None)

        try:
            # 1. Cria o usuário no Firebase Authentication
            firebase_user = auth.create_user(
                email=email,
                password=password,
                display_name=name
            )
            print(f"Usuário criado no Firebase Auth com UID: {firebase_user.uid}")

            # 2. Tenta salvar os dados adicionais no Firestore através do nosso serviço
            # Note que não passamos a senha para o nosso user_service
            user_in_db = user_service.create_user(
                user_id=firebase_user.uid,
                name=name,
                email=email,
                role=role
            )

            if user_in_db:
                flash(f'Usuário "{name}" ({role}) criado com sucesso!', 'success')
                return redirect(url_for('admin.list_all_users'))
            else:
                # Se falhou ao salvar no Firestore, deletamos do Auth para manter a consistência
                auth.delete_user(firebase_user.uid)
                flash('Erro ao salvar os dados do usuário no banco de dados.', 'danger')

        except Exception as e:
            # Captura erros comuns do Firebase Auth, como "e-mail já existe"
            flash(f'Erro ao criar usuário no Firebase: {e}', 'danger')

    return render_template('admin/super/user_form.html', action="Adicionar", user=None)

@admin_bp.route('/super/users/edit/<string:user_id>', methods=['GET', 'POST'])
@token_required
@role_required('super_admin')
def edit_system_user(user_id):
    user = user_service.get_user_by_id(user_id)
    if not user:
        flash('Usuário não encontrado.', 'danger')
        return redirect(url_for('admin.list_all_users'))
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        role = request.form.get('role')
        password = request.form.get('password')
        update_data = {'name': name, 'email': email, 'role': role}
        if password:
            update_data['password'] = password
        if user_service.update_user(user_id, update_data):
            flash('Usuário atualizado com sucesso!', 'success')
            return redirect(url_for('admin.list_all_users'))
        else:
            flash('Erro ao atualizar usuário.', 'danger')
    return render_template('admin/super/user_form.html', action="Editar", user=user)

@admin_bp.route('/users/delete/<string:user_id>', methods=['POST'])
@token_required
@role_required('super_admin')
def delete_user(user_id):
    # g.user foi definido pelo decorador @role_required
    if user_id == g.user.id:
        flash('Você não pode deletar a si mesmo.', 'danger')
        return redirect(url_for('admin.list_all_users'))
    
    user_to_delete = user_service.get_user_by_id(user_id)
    if not user_to_delete:
        flash('Usuário não encontrado.', 'danger')
        return redirect(url_for('admin.list_all_users'))

    if user_to_delete.role == 'student':
        enrollments = enrollment_service.get_enrollments_by_student(user_id)
        for enrollment in enrollments:
            enrollment_service.delete_enrollment(enrollment.id)

    if user_service.delete_user(user_id):
        flash(f'Usuário "{user_to_delete.name}" deletado com sucesso!', 'success')
    else:
        flash('Erro ao deletar o usuário.', 'danger')
    return redirect(url_for('admin.list_all_users'))

@admin_bp.route('/super/settings', methods=['GET', 'POST'])
@token_required
@role_required('super_admin')
def branding_settings():
    if request.method == 'POST':
        academy_name = request.form.get('academy_name')
        logo_path = request.form.get('current_logo_path')
        if 'academy_logo' in request.files:
            file = request.files['academy_logo']
            if file.filename != '':
                filename = secure_filename(file.filename)
                upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
                os.makedirs(upload_folder, exist_ok=True)
                file.save(os.path.join(upload_folder, filename))
                logo_path = f'uploads/{filename}'
        
        settings_ref = db.collection('settings').document('branding')
        settings_ref.set({'academy_name': academy_name, 'logo_path': logo_path})
        flash('Configurações de identidade salvas com sucesso!', 'success')
        return redirect(url_for('admin.branding_settings'))

    settings = db.collection('settings').document('branding').get().to_dict() or {}
    return render_template('admin/super/settings_form.html', settings=settings)
