from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_user, logout_user, current_user, login_required

user_service = None
auth_bp = Blueprint('auth', __name__)

def init_auth_bp(us):
    global user_service
    user_service = us

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        if current_user.role in ['admin', 'super_admin']:
            return redirect(url_for('admin.dashboard'))
        elif current_user.role == 'student':
            return redirect(url_for('student.dashboard'))
        # --- LÓGICA DE REDIRECIONAMENTO DO PROFESSOR ---
        elif current_user.role == 'teacher':
            return redirect(url_for('teacher.dashboard'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        if not email or not password:
            flash('E-mail e senha são obrigatórios.', 'danger')
            return redirect(url_for('auth.login'))

        user = user_service.authenticate_user(email, password)

        if user:
            login_user(user)
            if user.role in ['admin', 'super_admin']:
                return redirect(url_for('admin.dashboard'))
            elif user.role == 'student':
                return redirect(url_for('student.dashboard'))
            # --- LÓGICA DE REDIRECIONAMENTO DO PROFESSOR ---
            elif user.role == 'teacher':
                return redirect(url_for('teacher.dashboard'))
            else:
                return redirect(url_for('index')) # Fallback
        else:
            flash('Credenciais inválidas.', 'danger')
    
    return render_template('auth/login.html')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Você foi desconectado.', 'info')
    return redirect(url_for('auth.login'))