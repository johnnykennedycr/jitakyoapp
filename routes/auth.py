from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_user, logout_user, current_user, login_required

# Variável para ser inicializada pela factory
user_service = None
auth_bp = Blueprint('auth', __name__)

def init_auth_bp(us):
    """Inicializa o blueprint de autenticação com o serviço de usuário."""
    global user_service
    user_service = us

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Processa o login do usuário."""
    
    # Se o usuário já estiver logado, redireciona para o painel apropriado.
    if current_user.is_authenticated:
        if current_user.role in ['admin', 'super_admin']:
            return redirect(url_for('admin.dashboard'))
        elif current_user.role == 'student':
            return redirect(url_for('student.dashboard'))
        elif current_user.role == 'teacher':
            return redirect(url_for('teacher.dashboard'))
    
    # Se a requisição for um POST, tenta autenticar.
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        if not email or not password:
            flash('E-mail e senha são obrigatórios.', 'danger')
            return redirect(url_for('auth.login'))

        user = user_service.authenticate_user(email, password)

        if user:
            # A função login_user do Flask-Login cuida de criar a sessão.
            login_user(user, remember=True)
            
            # Verifica se o usuário foi redirecionado de uma página protegida.
            next_page = request.args.get('next')
            
            # Se a URL 'next' não for segura, ignore-a.
            # (Esta é uma boa prática de segurança, mas omitida para simplicidade agora)

            # Redireciona para a página 'next' ou para o dashboard padrão.
            if next_page:
                return redirect(next_page)
            
            if user.role in ['admin', 'super_admin']:
                return redirect(url_for('admin.dashboard'))
            elif user.role == 'student':
                return redirect(url_for('student.dashboard'))
            elif user.role == 'teacher':
                return redirect(url_for('teacher.dashboard'))
        else:
            flash('Credenciais inválidas.', 'danger')
            return redirect(url_for('auth.login'))
    
    # Se for um GET e o usuário não estiver logado, mostra a página de login.
    return render_template('auth/login.html')


@auth_bp.route('/logout')
@login_required
def logout():
    """Processa o logout do usuário."""
    logout_user()
    flash('Você foi desconectado.', 'info')
    return redirect(url_for('auth.login'))
