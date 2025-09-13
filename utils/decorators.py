from functools import wraps
from flask import flash, redirect, url_for
from flask_login import current_user

def super_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or getattr(current_user, 'role', None) != 'super_admin':
            flash('Acesso restrito a super administradores.', 'danger')
            return redirect(url_for('auth.login')) # Redireciona para o login
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ['admin', 'super_admin']:
            flash('Acesso negado. Você precisa ser um administrador.', 'danger')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

def receptionist_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ['receptionist', 'admin', 'super_admin']:
            flash('Acesso negado.', 'danger')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

def teacher_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ['teacher', 'admin', 'super_admin']:
            flash('Acesso negado.', 'danger')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

def student_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        print("\n--- DECORATOR @student_required ACIONADO ---")

        # Verificação combinada para robustez
        if not current_user.is_authenticated or current_user.role != 'student':
            print(f"!!! ACESSO NEGADO !!!")
            print(f"--> Usuário autenticado? {current_user.is_authenticated}")
            # A linha abaixo vai quebrar se o usuário não estiver autenticado,
            # por isso a verificação acima é importante.
            if current_user.is_authenticated:
                print(f"--> Role do usuário: '{current_user.role}'")
                print(f"--> A role é diferente de 'student'? {current_user.role != 'student'}")

            flash('Acesso negado. Esta área é restrita para alunos.', 'danger')
            return redirect(url_for('auth.login'))

        print("--- Acesso PERMITIDO pelo decorador ---")
        return f(*args, **kwargs)
    return decorated_function

def teacher_or_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ['teacher', 'admin', 'super_admin']:
            flash('Acesso negado.', 'danger')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function