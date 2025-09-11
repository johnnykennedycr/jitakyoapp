from flask import Blueprint, render_template, request, redirect, url_for, flash, make_response
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

    # Se a requisição for um POST, tenta autenticar PRIMEIRO.
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        if not email or not password:
            flash('E-mail e senha são obrigatórios.', 'danger')
            return redirect(url_for('auth.login'))

        user = user_service.authenticate_user(email, password)

        if user:
            # A função login_user do Flask-Login modifica a sessão.
            login_user(user, remember=True)
            
            # Determina o alvo do redirecionamento
            next_page = request.args.get('next')
            target_url = next_page
            
            if not target_url:
                if user.role in ['admin', 'super_admin']:
                    target_url = url_for('admin.dashboard')
                elif user.role == 'student':
                    target_url = url_for('student.dashboard')
                elif user.role == 'teacher':
                    target_url = url_for('teacher.dashboard')

            # Cria a resposta para que possamos inspecionar os cabeçalhos
            response = make_response(redirect(target_url))
            
            # LINHA DE DEPURAÇÃO CRÍTICA:
            # Imprime os cabeçalhos ANTES de enviá-los.
            print(f"DEBUG: HEADERS ENVIADOS PELO FLASK: {response.headers}")
            
            return response
        else:
            flash('Credenciais inválidas.', 'danger')
            return redirect(url_for('auth.login'))
    
    # Se for um GET e o usuário já estiver logado, redireciona para o painel.
    if current_user.is_authenticated:
        if current_user.role in ['admin', 'super_admin']:
            return redirect(url_for('admin.dashboard'))
        elif current_user.role == 'student':
            return redirect(url_for('student.dashboard'))
        elif current_user.role == 'teacher':
            return redirect(url_for('teacher.dashboard'))
    
    # Se for um GET e o usuário não estiver logado, mostra a página de login.
    return render_template('auth/login.html')


@auth_bp.route('/logout')
@login_required
def logout():
    """Processa o logout do usuário."""
    logout_user()
    flash('Você foi desconectado.', 'info')
    return redirect(url_for('auth.login'))

