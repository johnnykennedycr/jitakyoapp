from flask import Blueprint, render_template, request, redirect, session, url_for, flash
from flask_login import login_user, logout_user, current_user, login_required

user_service = None
auth_bp = Blueprint('auth', __name__)

def init_auth_bp(us):
    """Inicializa o blueprint de autenticação com o serviço de usuário."""
    global user_service
    user_service = us

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Processa o login do usuário."""
    
    # Se o usuário já está logado, redireciona para o painel apropriado.
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
        
        print("--- AUTHENTICATION ATTEMPT START ---")
        user = user_service.authenticate(email, password)
        
        if user:
            print(f"1. Autenticação BEM-SUCEDIDA para o usuário: {user.id}")
            login_user(user, remember=True) # Assumindo que você tem um 'lembrar-me'
            
            # Use session.update() para forçar a escrita imediata da sessão antes do log
            session.update({}) 
            print(f"2. Sessão Flask criada. Conteúdo da sessão: {dict(session)}")
            
            print("3. Redirecionando para o dashboard...")
            return redirect(url_for('student.dashboard')) # Ou o blueprint correto do dashboard
        else:
            print("!!! Autenticação FALHOU. Senha incorreta ou usuário não encontrado.")
            flash('Email ou senha inválidos.', 'error')
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

