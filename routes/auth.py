from flask import Blueprint, render_template, request, redirect, session, url_for, flash
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.security import check_password_hash

user_service = None
auth_bp = Blueprint('auth', __name__)

def init_auth_bp(us):
    """Inicializa o blueprint de autenticação com o serviço de usuário."""
    global user_service
    user_service = us

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    # Se o usuário já estiver logado, redireciona para o dashboard certo
    if current_user.is_authenticated:
        if current_user.role == 'admin':
            return redirect(url_for('admin.dashboard'))
        elif current_user.role == 'teacher':
            return redirect(url_for('teacher.dashboard'))
        return redirect(url_for('student.dashboard'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        remember = True if request.form.get('remember') else False

        user = user_service.get_user_by_email(email)

        # A verificação agora é feita aqui, em duas etapas, como é o padrão do Flask
        if user and check_password_hash(user.password_hash, password):
            login_user(user, remember=remember)
            
            # Lógica de redirecionamento após o login bem-sucedido
            if user.role == 'admin':
                next_page = url_for('admin.dashboard')
            elif user.role == 'teacher':
                next_page = url_for('teacher.dashboard')
            else: # Assume que é 'student'
                next_page = url_for('student.dashboard')
            
            return redirect(next_page)
        
        # Se o usuário não existir ou a senha estiver errada
        flash('Email ou senha inválidos. Por favor, tente novamente.', 'error')
        return redirect(url_for('auth.login'))

    return render_template('auth/login.html')


@auth_bp.route('/logout')
@login_required
def logout():
    """Processa o logout do usuário."""
    logout_user()
    flash('Você foi desconectado.', 'info')
    return redirect(url_for('auth.login'))

