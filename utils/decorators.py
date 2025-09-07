from functools import wraps
from flask import flash, redirect, url_for
from flask_login import current_user

# Decorator para Super Administrador
def super_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or getattr(current_user, 'role', None) != 'super_admin':
            flash('Acesso restrito a super administradores.', 'danger')
            return redirect(url_for('admin.dashboard')) # Super admin já logado vai para o dashboard
        return f(*args, **kwargs)
    return decorated_function

# Decorator para Administradores de Academia
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ['admin', 'super_admin']:
            flash('Acesso negado. Você precisa ser um administrador.', 'danger')
            # --- CORREÇÃO AQUI ---
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

# Decorator para Recepcionistas
def receptionist_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ['receptionist', 'admin', 'super_admin']:
            flash('Acesso negado.', 'danger')
            # --- CORREÇÃO AQUI ---
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

# Decorator para Professores
def teacher_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ['teacher', 'admin', 'super_admin']:
            flash('Acesso negado. Você precisa ser um professor.', 'danger')
            # --- CORREÇÃO AQUI ---
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

# Decorator para Alunos
def student_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'student':
            flash('Acesso negado.', 'danger')
            # --- CORREÇÃO AQUI ---
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

def teacher_or_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Permite acesso se o usuário for teacher, admin, ou super_admin
        if not current_user.is_authenticated or current_user.role not in ['teacher', 'admin', 'super_admin']:
            flash('Acesso negado. Você não tem permissão para ver esta página.', 'danger')
            # Redireciona para o dashboard apropriado se já estiver logado
            if current_user.is_authenticated:
                if current_user.role == 'student':
                    return redirect(url_for('student.dashboard'))
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function