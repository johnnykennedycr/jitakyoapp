# routes/admin.py

from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user, login_user, logout_user
from functools import wraps
from firebase_admin import firestore
from datetime import datetime, date, time, timedelta 

from services.user_service import UserService
from services.teacher_service import TeacherService
from services.training_class_service import TrainingClassService
from services.enrollment_service import EnrollmentService
from services.attendance_service import AttendanceService

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

user_service = None
teacher_service = None
training_class_service = None
enrollment_service = None
attendance_service = None

def init_admin_bp(us, ts, tcs, es_param, as_param):
    global user_service, teacher_service, training_class_service, enrollment_service, attendance_service
    user_service = us
    teacher_service = ts
    training_class_service = tcs
    enrollment_service = es_param
    attendance_service = as_param

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'admin':
            flash('Acesso negado. Você precisa ser um administrador.', 'danger')
            return redirect(url_for('admin.login'))
        return f(*args, **kwargs)
    return decorated_function

# --- Rotas de Autenticação Básica (Admin) ---
@admin_bp.route('/login', methods=['GET', 'POST'])
def login():
    from app import User as FlaskLoginUser

    if current_user.is_authenticated and current_user.role == 'admin':
        return redirect(url_for('admin.dashboard'))

    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        user = user_service.authenticate_user(email, password)

        if user and user.role == 'admin':
            flask_login_user = FlaskLoginUser(user.id, user.role)
            login_user(flask_login_user)
            flash(f'Login de administrador bem-sucedido para {user.name}!', 'success')
            return redirect(url_for('admin.dashboard'))
        else:
            flash('Credenciais inválidas ou você não tem permissão de administrador.', 'danger')

    return render_template('admin/login.html')

@admin_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Você foi desconectado.', 'info')
    return redirect(url_for('admin.login'))

# --- Rota do Dashboard de Administração ---
@admin_bp.route('/')
@admin_bp.route('/dashboard')
@login_required
@admin_required
def dashboard():
    return render_template('admin/dashboard.html')

# --- Rotas de Gerenciamento de Professores ---
@admin_bp.route('/teachers')
@login_required
@admin_required
def list_teachers():
    teachers = teacher_service.get_all_teachers()
    return render_template('admin/teachers/list.html', teachers=teachers)

@admin_bp.route('/teachers/add', methods=['GET', 'POST'])
@login_required
@admin_required
def add_teacher():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form.get('email')
        phone = request.form.get('phone')
        description = request.form.get('description')

        disciplines_data = []
        i = 0
        while True:
            discipline_name = request.form.get(f'discipline_name_{i}')
            graduation = request.form.get(f'graduation_{i}')
            if discipline_name and graduation:
                disciplines_data.append({'discipline_name': discipline_name, 'graduation': graduation})
            elif not discipline_name and not graduation:
                break
            i += 1

        contact_info = {}
        if email:
            contact_info['email'] = email
        if phone:
            contact_info['phone'] = phone

        new_teacher = teacher_service.create_teacher(
            name, contact_info, disciplines_data, description
        )
        if new_teacher:
            flash(f'Professor "{new_teacher.name}" adicionado com sucesso!', 'success')
            return redirect(url_for('admin.list_teachers'))
        else:
            flash('Erro ao adicionar professor. Verifique os dados.', 'danger')

    return render_template('admin/teachers/form.html', teacher=None)

@admin_bp.route('/teachers/edit/<string:teacher_id>', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_teacher(teacher_id):
    teacher = teacher_service.get_teacher_by_id(teacher_id)
    if not teacher:
        flash('Professor não encontrado.', 'danger')
        return redirect(url_for('admin.list_teachers'))

    if request.method == 'POST':
        name = request.form['name']
        email = request.form.get('email')
        phone = request.form.get('phone')
        description = request.form.get('description')

        disciplines_data = []
        i = 0
        while True:
            discipline_name = request.form.get(f'discipline_name_{i}')
            graduation = request.form.get(f'graduation_{i}')
            if discipline_name and graduation:
                disciplines_data.append({'discipline_name': discipline_name, 'graduation': graduation})
            elif not discipline_name and not graduation:
                break
            i += 1

        contact_info = {}
        if email:
            contact_info['email'] = email
        if phone:
            contact_info['phone'] = phone

        update_data = {
            'name': name,
            'contact_info': contact_info,
            'disciplines': disciplines_data,
            'description': description
        }

        if teacher_service.update_teacher(teacher_id, update_data):
            flash(f'Professor "{name}" atualizado com sucesso!', 'success')
            return redirect(url_for('admin.list_teachers'))
        else:
            flash('Erro ao atualizar professor.', 'danger')

    return render_template('admin/teachers/form.html', teacher=teacher)

@admin_bp.route('/teachers/delete/<string:teacher_id>', methods=['POST'])
@login_required
@admin_required
def delete_teacher(teacher_id):
    if teacher_service.delete_teacher(teacher_id):
        flash('Professor deletado com sucesso!', 'success')
    else:
        flash('Erro ao deletar professor.', 'danger')
    return redirect(url_for('admin.list_teachers'))

# --- Rotas de Gerenciamento de Turmas ---
@admin_bp.route('/classes')
@login_required
@admin_required
def list_classes():
    classes = training_class_service.get_all_classes()
    teachers_map = {t.id: t.name for t in teacher_service.get_all_teachers()}
    return render_template('admin/training_classes/list.html', classes=classes, teachers_map=teachers_map)

@admin_bp.route('/classes/add', methods=['GET', 'POST'])
@login_required
@admin_required
def add_class():
    teachers = teacher_service.get_all_teachers()

    if request.method == 'POST':
        name = request.form['name']
        discipline = request.form['discipline']
        teacher_id = request.form['teacher_id']
        capacity = int(request.form['capacity'])
        description = request.form.get('description')

        schedule_data = []
        i = 0
        while True:
            day_of_week = request.form.get(f'day_of_week_{i}')
            start_time = request.form.get(f'start_time_{i}')
            end_time = request.form.get(f'end_time_{i}')
            if day_of_week and start_time and end_time:
                schedule_data.append({
                    'day_of_week': day_of_week,
                    'start_time': start_time,
                    'end_time': end_time
                })
            elif not day_of_week and not start_time and not end_time:
                break
            i += 1

        new_class = training_class_service.create_class(
            name, discipline, teacher_id, schedule_data, capacity, description
        )
        if new_class:
            flash(f'Turma "{new_class.name}" adicionada com sucesso!', 'success')
            return redirect(url_for('admin.list_classes'))
        else:
            flash('Erro ao adicionar turma. Verifique os dados.', 'danger')

    return render_template('admin/training_classes/form.html', training_class=None, teachers=teachers)

@admin_bp.route('/classes/edit/<string:class_id>', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_class(class_id):
    training_class = training_class_service.get_class_by_id(class_id)
    if not training_class:
        flash('Turma não encontrada.', 'danger')
        return redirect(url_for('admin.list_classes'))

    teachers = teacher_service.get_all_teachers()

    enrolled_students_enrollments = enrollment_service.get_enrollments_by_class(class_id)
    enrolled_students = []
    for enrollment in enrolled_students_enrollments:
        student = user_service.get_user_by_id(enrollment.student_id)
        if student:
            enrolled_students.append(student)

    all_students = user_service.get_users_by_role('student')
    enrolled_student_ids = {s.id for s in enrolled_students}
    available_students = [s for s in all_students if s.id not in enrolled_student_ids]
    
    available_students_data = [{'id': s.id, 'name': s.name, 'email': s.email} for s in available_students]

    if request.method == 'POST':
        if 'student_id_to_enroll' in request.form and request.form['student_id_to_enroll']:
            student_id_to_enroll = request.form['student_id_to_enroll']
            new_enrollment = enrollment_service.create_enrollment(student_id_to_enroll, class_id)
            if new_enrollment:
                flash(f'Aluno matriculado com sucesso nesta turma!', 'success')
            else:
                flash('Erro ao matricular aluno ou aluno já matriculado nesta turma.', 'danger')
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

        schedule_data = []
        i = 0
        while True:
            day_of_week = request.form.get(f'day_of_week_{i}')
            start_time = request.form.get(f'start_time_{i}')
            end_time = request.form.get(f'end_time_{i}')
            if day_of_week and start_time and end_time:
                schedule_data.append({
                    'day_of_week': day_of_week,
                    'start_time': start_time,
                    'end_time': end_time
                })
            elif not day_of_week and not start_time and not end_time:
                break
            i += 1

        update_data = {
            'name': name,
            'discipline': discipline,
            'teacher_id': teacher_id,
            'schedule': schedule_data,
            'capacity': capacity,
            'description': description
        }

        if training_class_service.update_class(class_id, update_data):
            flash(f'Turma "{name}" atualizada com sucesso!', 'success')
            return redirect(url_for('admin.list_classes'))
        else:
            flash('Erro ao atualizar turma.', 'danger')
            return redirect(url_for('admin.edit_class', class_id=class_id))

    return render_template('admin/training_classes/form.html',
                           training_class=training_class,
                           teachers=teachers,
                           enrolled_students=enrolled_students,
                           available_students=available_students,
                           available_students_json=available_students_data)

@admin_bp.route('/classes/delete/<string:class_id>', methods=['POST'])
@login_required
@admin_required
def delete_class(class_id):
    if training_class_service.delete_class(class_id):
        flash('Turma deletada com sucesso!', 'success')
    else:
        flash('Erro ao deletar turma.', 'danger')
    return redirect(url_for('admin.list_classes'))


# --- Rotas de Gerenciamento de Alunos (Usuários com role='student') ---
@admin_bp.route('/students')
@login_required
@admin_required
def list_students():
    students = user_service.get_users_by_role('student')
    return render_template('admin/users/list.html', users=students, role_filter='student')

@admin_bp.route('/students/add', methods=['GET', 'POST'])
@login_required
@admin_required
def add_student():
    classes = training_class_service.get_all_classes()

    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']

        date_of_birth_str = request.form.get('date_of_birth')
        date_of_birth = None
        if date_of_birth_str:
            parsed_date = datetime.strptime(date_of_birth_str, '%Y-%m-%d').date()
            date_of_birth = datetime(parsed_date.year, parsed_date.month, parsed_date.day)

        phone = request.form.get('phone')

        enrolled_disciplines = []
        i = 0
        while True:
            student_discipline_name = request.form.get(f'student_discipline_name_{i}')
            student_graduation = request.form.get(f'student_graduation_{i}')
            if student_discipline_name and student_graduation:
                enrolled_disciplines.append({'discipline_name': student_discipline_name, 'graduation': student_graduation})
            elif not student_discipline_name and not student_graduation:
                break
            i += 1

        guardians = []
        j = 0
        while True:
            guardian_name = request.form.get(f'guardian_name_{j}')
            guardian_contact = request.form.get(f'guardian_contact_{j}')
            guardian_kinship = request.form.get(f'guardian_kinship_{j}')
            if guardian_name and guardian_contact:
                guardians.append({'name': guardian_name, 'contact': guardian_contact, 'kinship': guardian_kinship or ''})
            elif not guardian_name and not guardian_contact:
                break
            j += 1

        selected_class_ids = request.form.getlist('enrolled_classes')

        new_student = user_service.create_user(
            name, email, 'student',
            date_of_birth=date_of_birth,
            phone=phone,
            enrolled_disciplines=enrolled_disciplines,
            guardians=guardians
        )

        if new_student:
            for class_id in selected_class_ids:
                enrollment_service.create_enrollment(new_student.id, class_id)

            flash(f'Aluno "{new_student.name}" adicionado com sucesso e senha enviada para {new_student.email}!', 'success')
            return redirect(url_for('admin.list_students'))
        else:
            flash('Erro ao adicionar aluno. O e-mail pode já estar em uso.', 'danger')

    return render_template('admin/users/form.html', user=None, current_role='student', classes=classes)

@admin_bp.route('/students/edit/<string:user_id>', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_student(user_id):
    user = user_service.get_user_by_id(user_id)

    if not user or user.role != 'student':
        flash('Aluno não encontrado ou usuário não é um aluno.', 'danger')
        return redirect(url_for('admin.list_students'))

    all_classes = training_class_service.get_all_classes()
    current_enrollments = enrollment_service.get_enrollments_by_student(user_id)
    current_class_ids = {e.class_id for e in current_enrollments}

    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form.get('password')

        date_of_birth_str = request.form.get('date_of_birth')
        date_of_birth = None
        if date_of_birth_str:
            parsed_date = datetime.strptime(date_of_birth_str, '%Y-%m-%d').date()
            date_of_birth = datetime(parsed_date.year, parsed_date.month, parsed_date.day)

        phone = request.form.get('phone')

        enrolled_disciplines = []
        i = 0
        while True:
            student_discipline_name = request.form.get(f'student_discipline_name_{i}')
            student_graduation = request.form.get(f'student_graduation_{i}')
            if student_discipline_name and student_graduation:
                enrolled_disciplines.append({'discipline_name': student_discipline_name, 'graduation': student_graduation})
            elif not student_discipline_name and not student_graduation:
                break
            i += 1

        guardians = []
        j = 0
        while True:
            guardian_name = request.form.get(f'guardian_name_{j}')
            guardian_contact = request.form.get(f'guardian_contact_{j}')
            guardian_kinship = request.form.get(f'guardian_kinship_{j}')
            if guardian_name and guardian_contact:
                guardians.append({'name': guardian_name, 'contact': guardian_contact, 'kinship': guardian_kinship or ''})
            elif not guardian_name and not guardian_contact:
                break
            j += 1

        selected_class_ids = set(request.form.getlist('enrolled_classes'))
        class_ids_to_enroll = list(selected_class_ids - current_class_ids)
        class_ids_to_unenroll = list(current_class_ids - selected_class_ids)

        update_data = {
            'name': name,
            'email': email,
            'date_of_birth': date_of_birth,
            'phone': phone,
            'enrolled_disciplines': enrolled_disciplines,
            'guardians': guardians
        }
        if password:
            update_data['password'] = password

        if user_service.update_user(user_id, update_data):
            for class_id in class_ids_to_enroll:
                enrollment_service.create_enrollment(user_id, class_id)

            for class_id in class_ids_to_unenroll:
                enrollment_to_delete = enrollment_service.get_enrollments_by_student_and_class(user_id, class_id)
                if enrollment_to_delete:
                    enrollment_service.delete_enrollment(enrollment_to_delete[0].id)

            flash(f'Aluno "{name}" atualizado com sucesso!', 'success')
            return redirect(url_for('admin.list_students'))
        else:
            flash('Erro ao atualizar aluno. O e-mail pode já estar em uso.', 'danger')

    return render_template('admin/users/form.html',
                           user=user,
                           current_role='student',
                           classes=all_classes,
                           current_class_ids=current_class_ids)

@admin_bp.route('/students/delete/<string:user_id>', methods=['POST'])
@login_required
@admin_required
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
@login_required
@admin_required
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
@login_required
@admin_required
def delete_enrollment(enrollment_id):
    if enrollment_service.delete_enrollment(enrollment_id):
        flash('Matrícula deletada com sucesso!', 'success')
    else:
        flash('Erro ao deletar matrícula.', 'danger')
    return redirect(url_for('admin.list_enrollments'))


# --- ROTAS PARA LISTA DE PRESENÇA ---
@admin_bp.route('/classes/<string:class_id>/attendance', methods=['GET'])
@login_required
@admin_required
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


# --- ROTA SAVE_ATTENDANCE CORRIGIDA ---
@admin_bp.route('/classes/<string:class_id>/attendance', methods=['POST'])
@login_required
@admin_required
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
        flash(f'Ocorreu um erro ao salvar a presença: {e}', 'danger')
        return redirect(url_for('admin.get_attendance_list', class_id=class_id, date=request.form.get('date')))

# --- ROTA DE RESUMO DE PRESENÇA ---
@admin_bp.route('/classes/all_calls/<string:class_id>')
@login_required
@admin_required
def all_calls(class_id):
    training_class = training_class_service.get_class_by_id(class_id)
    if not training_class:
        flash('Turma não encontrada.', 'danger')
        return redirect(url_for('admin.list_classes'))

    # Lógica de cálculo de total_classes (permanece a mesma)
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
            
            # --- MUDANÇA PRINCIPAL AQUI ---
            # Formatamos o nome para incluir a idade, se disponível
            student_name_with_age = student.name
            if student.age is not None:
                student_name_with_age = f"{student.name} ({student.age} anos)"

            student_summary_dict[student.id] = {
                'id': student.id,
                'name': student_name_with_age, # <-- Usamos a nova variável com a idade
                'graduation': student_graduation,
                'present_count': 0,
                'total_classes': total_classes
            }

    # O resto da lógica para contar presença e calcular porcentagem permanece igual
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

# --- ROTA PARA DESMATRICULAR ALUNO ---
@admin_bp.route('/classes/<string:class_id>/unenroll/<string:student_id>', methods=['POST'])
@login_required
@admin_required
def unenroll_student_from_class(class_id, student_id):
    enrollments_to_delete = enrollment_service.get_enrollments_by_student_and_class(student_id, class_id)
    
    if enrollments_to_delete:
        enrollment_id = enrollments_to_delete[0].id
        if enrollment_service.delete_enrollment(enrollment_id):
            flash('Aluno desmatriculado com sucesso!', 'success')
        else:
            flash('Erro ao tentar desmatricular o aluno.', 'danger')
    else:
        flash('Matrícula não encontrada.', 'warning')
        
    return redirect(url_for('admin.all_calls', class_id=class_id))

# --- Rotas Financeiras (Exemplo) ---
@admin_bp.route('/financial')
@login_required
@admin_required
def financial_dashboard():
    flash('Funcionalidade Financeira em desenvolvimento!', 'info')
    return render_template('admin/financial/dashboard.html')